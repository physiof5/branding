import 'server-only';
import type { CandleData, DisclosureEvent } from '@/types/stock';
import { getCorpInfoByTicker } from './corpCodeMap';

/**
 * Open DART 지분 공시 → DisclosureEvent 변환 (서버 전용).
 * 1) /api/list.json (pblntf_ty=D 지분공시) 에서 대량보유상황보고서 / 임원ㆍ주요주주특정증권등소유상황보고서 필터
 * 2) /api/majorstock.json, /api/elestock.json 으로 접수번호별 증감 수량을 보강해 매수/매도 방향 판정
 * 3) DART 공시에는 체결 단가가 없으므로, 공시일(또는 직전 거래일) 종가를 추정 단가로 사용
 */

const DART_BASE = 'https://opendart.fss.or.kr/api';

interface DartListItem {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  report_nm: string;
  rcept_no: string;
  flr_nm: string;
  rcept_dt: string;
  rm: string;
}

interface DartListResponse {
  status: string;
  message: string;
  total_page?: number;
  list?: DartListItem[];
}

interface MajorStockItem {
  rcept_no: string;
  repror: string;
  stkqy_irds: string;
  stkrt_irds: string;
  report_resn: string;
}

interface EleStockItem {
  rcept_no: string;
  repror: string;
  isu_exctv_ofcps: string;
  sp_stock_lmp_irds_cnt: string;
}

const normalize = (s: string) => s.replace(/[\sㆍ·.]/g, '');
const TARGET_REPORTS = ['대량보유상황보고서', '임원주요주주특정증권등소유상황보고서'].map(normalize);

const toNum = (v: string | undefined) => {
  if (!v) return 0;
  const n = Number(v.replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const ymd = (d: Date) => {
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
};

const isoFromYmd = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

async function dartGet<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const key = process.env.OPENDART_API_KEY;
  if (!key) throw new Error('OPENDART_API_KEY 미설정');
  const qs = new URLSearchParams({ crtfc_key: key, ...params });
  const res = await fetch(`${DART_BASE}/${endpoint}?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`DART ${endpoint} HTTP ${res.status}`);
  return (await res.json()) as T;
}

function priceOnOrBefore(candles: CandleData[], isoDate: string): number {
  let price = 0;
  for (const c of candles) {
    if (c.date <= isoDate) price = c.close;
    else break;
  }
  return price || candles[0]?.close || 0;
}

export async function fetchDartOwnershipDisclosures({
  ticker,
  days,
  candles,
}: {
  ticker: string;
  days: number;
  candles: CandleData[];
}): Promise<DisclosureEvent[]> {
  if (!process.env.OPENDART_API_KEY) return [];
  const corp = await getCorpInfoByTicker(ticker);
  if (!corp) return [];

  const sortedCandles = [...candles].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sortedCandles[0]?.date
    ? new Date(sortedCandles[0].date)
    : new Date(Date.now() - Math.ceil(days * 1.5) * 86400000);

  // 1) 공시 목록 (최대 5페이지 × 100건)
  const items: DartListItem[] = [];
  for (let page = 1; page <= 5; page++) {
    const json = await dartGet<DartListResponse>('list.json', {
      corp_code: corp.corpCode,
      bgn_de: ymd(startDate),
      end_de: ymd(new Date()),
      pblntf_ty: 'D',
      page_no: String(page),
      page_count: '100',
    });
    if (json.status === '013') break; // 조회된 데이터 없음
    if (json.status !== '000') throw new Error(`DART list.json 오류: ${json.message}`);
    items.push(...(json.list ?? []));
    if (!json.total_page || page >= json.total_page) break;
  }

  const filtered = items.filter((it) => TARGET_REPORTS.some((t) => normalize(it.report_nm).includes(t)));
  if (filtered.length === 0) return [];

  // 2) 상세 증감 데이터 (회사 단위 전체 이력 1회 조회)
  const [major, ele] = await Promise.all([
    filtered.some((f) => normalize(f.report_nm).includes(TARGET_REPORTS[0]))
      ? dartGet<{ status: string; list?: MajorStockItem[] }>('majorstock.json', { corp_code: corp.corpCode }).catch(
          () => ({ status: 'ERR', list: [] as MajorStockItem[] }),
        )
      : Promise.resolve({ status: 'SKIP', list: [] as MajorStockItem[] }),
    filtered.some((f) => normalize(f.report_nm).includes(TARGET_REPORTS[1]))
      ? dartGet<{ status: string; list?: EleStockItem[] }>('elestock.json', { corp_code: corp.corpCode }).catch(
          () => ({ status: 'ERR', list: [] as EleStockItem[] }),
        )
      : Promise.resolve({ status: 'SKIP', list: [] as EleStockItem[] }),
  ]);
  const majorByRcept = new Map((major.list ?? []).map((m) => [m.rcept_no, m]));
  const eleByRcept = new Map((ele.list ?? []).map((e) => [e.rcept_no, e]));

  // 3) DisclosureEvent 변환
  const events: DisclosureEvent[] = [];
  for (const item of filtered) {
    const date = isoFromYmd(item.rcept_dt);
    const isMajor = normalize(item.report_nm).includes(TARGET_REPORTS[0]);
    let delta = 0;
    let reporter = item.flr_nm;
    let detail = '';
    if (isMajor) {
      const m = majorByRcept.get(item.rcept_no);
      if (m) {
        delta = toNum(m.stkqy_irds);
        reporter = m.repror || reporter;
        detail = m.report_resn ? ` · ${m.report_resn.replace(/\s+/g, ' ').slice(0, 60)}` : '';
        if (m.stkrt_irds) detail += ` · 지분율 ${toNum(m.stkrt_irds) >= 0 ? '+' : ''}${toNum(m.stkrt_irds)}%p`;
      }
    } else {
      const e = eleByRcept.get(item.rcept_no);
      if (e) {
        delta = toNum(e.sp_stock_lmp_irds_cnt);
        reporter = e.repror || reporter;
        detail = e.isu_exctv_ofcps && e.isu_exctv_ofcps !== '-' ? ` · ${e.isu_exctv_ofcps}` : '';
      }
    }
    // 증감 방향을 알 수 없는 공시(변동 없음/상세 미확인)는 매수·매도 이벤트로 표기하지 않음
    if (delta === 0) continue;

    const action: 'BUY' | 'SELL' = delta > 0 ? 'BUY' : 'SELL';
    const price = priceOnOrBefore(sortedCandles, date);
    events.push({
      id: `dart-${item.rcept_no}`,
      date,
      source: 'DART',
      reporter,
      action,
      price,
      shares: Math.abs(delta),
      summary: `${item.report_nm.trim()} — ${action === 'BUY' ? '보유 증가' : '보유 감소'} ${Math.abs(delta).toLocaleString('ko-KR')}주${detail} (단가는 공시일 종가 기준 추정)`,
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
