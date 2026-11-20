import 'server-only';
import type { CandleData } from '@/types/stock';

/**
 * 미국 주식 일봉 (Polygon.io Aggregates) — 서버 전용.
 * 미국 시장은 투자자별 순매수 데이터가 공개되지 않으므로,
 * 최근 20일 평균 거래량 대비 1.5배 이상 급증한 양봉에 한해 netBuyInstitution 추정치를 부여한다.
 */

interface PolygonAgg {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export const VOLUME_SPIKE_MULTIPLIER = 1.5;
const AVG_WINDOW = 20;

export function hasPolygonKey() {
  return Boolean(process.env.POLYGON_API_KEY);
}

/** 거래량 급증 양봉 → 기관 추정 순매수(초과 거래량 × 몸통 비율) */
export function tagVolumeSpikes(candles: CandleData[]): CandleData[] {
  return candles.map((c, i) => {
    const prev = candles.slice(Math.max(0, i - AVG_WINDOW), i);
    if (prev.length < 5) return c;
    const avg = prev.reduce((s, p) => s + p.volume, 0) / prev.length;
    const isBullish = c.close > c.open;
    if (!isBullish || c.volume < avg * VOLUME_SPIKE_MULTIPLIER) return c;
    const bodyRatio = (c.close - c.open) / Math.max(c.high - c.low, 1e-6);
    return { ...c, netBuyInstitution: Math.round((c.volume - avg) * bodyRatio) };
  });
}

export async function fetchUsDailyCandles(ticker: string, days: number): Promise<CandleData[]> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return [];

  const to = new Date();
  // 이동평균 계산용 여유분 + 휴장일 고려
  const from = new Date(to.getTime() - Math.ceil((days + AVG_WINDOW) * 1.6 + 10) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const url =
    `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker.toUpperCase())}/range/1/day/` +
    `${iso(from)}/${iso(to)}?adjusted=true&sort=asc&limit=50000&apiKey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Polygon HTTP ${res.status}`);
  const json = (await res.json()) as { status?: string; results?: PolygonAgg[]; error?: string };
  if (json.status === 'ERROR') throw new Error(`Polygon 오류: ${json.error ?? 'unknown'}`);

  const candles: CandleData[] = (json.results ?? []).map((r) => ({
    date: new Date(r.t).toISOString().slice(0, 10),
    open: r.o,
    high: r.h,
    low: r.l,
    close: r.c,
    volume: Math.round(r.v),
  }));

  return tagVolumeSpikes(candles).slice(-days);
}
