import 'server-only';
import type { CandleData } from '@/types/stock';

/**
 * 한국투자증권(KIS) Open API 클라이언트 — 서버 전용.
 * - FHKST01010400: 주식현재가 일자별 (최근 30거래일)
 * - FHKST03010100: 국내주식 기간별 시세 (30거래일 초과 구간 보충, 1회 최대 100건)
 * - FHKST01010900: 주식현재가 투자자 (최근 약 30거래일 외국인/기관/개인 순매수)
 */

interface KisToken {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: KisToken | null = null;
let tokenInflight: Promise<string> | null = null;

const TOKEN_SAFETY_MS = 10 * 60 * 1000;

function baseUrl() {
  return (process.env.KIS_BASE_URL || 'https://openapi.koreainvestment.com:9443').replace(/\/$/, '');
}

export function hasKisCredentials() {
  return Boolean(process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET);
}

export async function getKisAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - TOKEN_SAFETY_MS) return tokenCache.accessToken;
  if (tokenInflight) return tokenInflight;

  const appkey = process.env.KIS_APP_KEY;
  const appsecret = process.env.KIS_APP_SECRET;
  if (!appkey || !appsecret) throw new Error('KIS_APP_KEY / KIS_APP_SECRET 미설정');

  tokenInflight = (async () => {
    const res = await fetch(`${baseUrl()}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ grant_type: 'client_credentials', appkey, appsecret }),
      cache: 'no-store',
    });
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      access_token_token_expired?: string;
      error_description?: string;
    };
    if (!res.ok || !json.access_token) {
      throw new Error(`KIS 토큰 발급 실패: ${json.error_description ?? res.status}`);
    }
    let expiresAt = Date.now() + (json.expires_in ?? 86400) * 1000;
    if (json.access_token_token_expired) {
      // "YYYY-MM-DD HH:mm:ss" (KST)
      const parsed = Date.parse(json.access_token_token_expired.replace(' ', 'T') + '+09:00');
      if (Number.isFinite(parsed)) expiresAt = Math.min(expiresAt, parsed);
    }
    tokenCache = { accessToken: json.access_token, expiresAt };
    return json.access_token;
  })().finally(() => {
    tokenInflight = null;
  });
  return tokenInflight;
}

async function kisGet<T>(apiPath: string, trId: string, params: Record<string, string>): Promise<T> {
  const token = await getKisAccessToken();
  const url = `${baseUrl()}${apiPath}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      authorization: `Bearer ${token}`,
      appkey: process.env.KIS_APP_KEY ?? '',
      appsecret: process.env.KIS_APP_SECRET ?? '',
      tr_id: trId,
      custtype: 'P',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`KIS ${trId} HTTP ${res.status}`);
  const json = (await res.json()) as T & { rt_cd?: string; msg1?: string };
  if (json.rt_cd && json.rt_cd !== '0') throw new Error(`KIS ${trId} 오류: ${json.msg1 ?? json.rt_cd}`);
  return json;
}

const num = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toIsoDate = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

const toYmd = (d: Date) => {
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface DailyPriceRow {
  stck_bsop_date: string;
  stck_oprc: string;
  stck_hgpr: string;
  stck_lwpr: string;
  stck_clpr: string;
  acml_vol: string;
}

function rowToCandle(row: DailyPriceRow): CandleData | null {
  if (!row?.stck_bsop_date || !/^\d{8}$/.test(row.stck_bsop_date)) return null;
  const candle: CandleData = {
    date: toIsoDate(row.stck_bsop_date),
    open: num(row.stck_oprc),
    high: num(row.stck_hgpr),
    low: num(row.stck_lwpr),
    close: num(row.stck_clpr),
    volume: num(row.acml_vol),
  };
  return candle.close > 0 && candle.high > 0 ? candle : null;
}

/** 국내 일봉 OHLCV. 최근 30거래일은 FHKST01010400, 그 이전은 FHKST03010100으로 보충 */
export async function fetchKrDailyCandles(ticker: string, days: number): Promise<CandleData[]> {
  const byDate = new Map<string, CandleData>();

  const recent = await kisGet<{ output?: DailyPriceRow[] }>(
    '/uapi/domestic-stock/v1/quotations/inquire-daily-price',
    'FHKST01010400',
    {
      FID_COND_MRKT_DIV_CODE: 'J',
      FID_INPUT_ISCD: ticker,
      FID_PERIOD_DIV_CODE: 'D',
      FID_ORG_ADJ_PRC: '0',
    },
  );
  for (const row of recent.output ?? []) {
    const c = rowToCandle(row);
    if (c) byDate.set(c.date, c);
  }

  // 30거래일 초과 요청 시 기간별 시세로 과거 구간 보충 (최대 4회 = 약 400거래일)
  let guard = 0;
  while (byDate.size < days && guard < 4) {
    guard += 1;
    const oldest = [...byDate.keys()].sort()[0];
    const end = oldest ? new Date(Date.parse(oldest) - 86400000) : new Date();
    const start = new Date(end.getTime() - 145 * 86400000); // 약 100거래일
    await sleep(80);
    const page = await kisGet<{ output2?: DailyPriceRow[] }>(
      '/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice',
      'FHKST03010100',
      {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD: ticker,
        FID_INPUT_DATE_1: toYmd(start),
        FID_INPUT_DATE_2: toYmd(end),
        FID_PERIOD_DIV_CODE: 'D',
        FID_ORG_ADJ_PRC: '0',
      },
    );
    const before = byDate.size;
    for (const row of page.output2 ?? []) {
      const c = rowToCandle(row);
      if (c && !byDate.has(c.date)) byDate.set(c.date, c);
    }
    if (byDate.size === before) break;
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
}

interface InvestorRow {
  stck_bsop_date: string;
  prsn_ntby_qty: string;
  frgn_ntby_qty: string;
  orgn_ntby_qty: string;
}

/** FHKST01010900 투자자별 순매수(수량)를 일봉에 병합. 제공 범위 밖 날짜는 undefined 유지 */
export async function attachKrInvestorFlow(ticker: string, candles: CandleData[]): Promise<CandleData[]> {
  const json = await kisGet<{ output?: InvestorRow[] }>(
    '/uapi/domestic-stock/v1/quotations/inquire-investor',
    'FHKST01010900',
    { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: ticker },
  );
  const flows = new Map<string, InvestorRow>();
  for (const row of json.output ?? []) {
    if (row?.stck_bsop_date && /^\d{8}$/.test(row.stck_bsop_date)) flows.set(toIsoDate(row.stck_bsop_date), row);
  }
  return candles.map((c) => {
    const f = flows.get(c.date);
    // 당일 장중에는 수급 값이 빈 문자열로 내려오므로 건너뜀
    if (!f || (f.frgn_ntby_qty === '' && f.orgn_ntby_qty === '' && f.prsn_ntby_qty === '')) return c;
    return {
      ...c,
      netBuyForeign: num(f.frgn_ntby_qty),
      netBuyInstitution: num(f.orgn_ntby_qty),
      netBuyRetail: num(f.prsn_ntby_qty),
    };
  });
}
