import type { DominantFlow, MarketType } from '@/types/stock';

/** 클라이언트 UI 공용 표시 헬퍼 (서버 비밀값 없음) */

export const FLOW_STYLE: Record<DominantFlow, { label: string; bar: string; text: string; badge: string }> = {
  FOREIGN: { label: '외국인 우위', bar: 'bg-violet-500', text: 'text-violet-600', badge: 'bg-violet-50 text-violet-600' },
  INSTITUTION: { label: '기관 우위', bar: 'bg-sky-500', text: 'text-sky-600', badge: 'bg-sky-50 text-sky-600' },
  RETAIL: { label: '개인 우위', bar: 'bg-orange-400', text: 'text-orange-500', badge: 'bg-orange-50 text-orange-600' },
  MIXED: { label: '혼조', bar: 'bg-gray-400', text: 'text-gray-500', badge: 'bg-gray-100 text-gray-600' },
  NONE: { label: '수급 없음', bar: 'bg-gray-300', text: 'text-gray-400', badge: 'bg-gray-100 text-gray-400' },
};

export function formatPrice(value: number, market: MarketType) {
  return market === 'KR'
    ? `${Math.round(value).toLocaleString('ko-KR')}원`
    : `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatQty(value: number, market: MarketType) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : value > 0 ? '+' : '';
  if (market === 'KR') {
    if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(1)}억주`;
    if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(1)}만주`;
    return `${sign}${Math.round(abs).toLocaleString('ko-KR')}주`;
  }
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B sh`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M sh`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K sh`;
  return `${sign}${Math.round(abs)} sh`;
}

/** 부호 포함 등락률 문자열. 국내 관례대로 상승 빨강 / 하락 파랑 클래스와 함께 반환 */
export function formatPct(pct: number) {
  const text = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  const cls = pct > 0 ? 'text-red-500' : pct < 0 ? 'text-blue-500' : 'text-gray-500';
  return { text, cls };
}

/** 국내 호가 단위 (2023년 개편 기준) */
function krTickSize(price: number) {
  if (price < 2000) return 1;
  if (price < 5000) return 5;
  if (price < 20000) return 10;
  if (price < 50000) return 50;
  if (price < 200000) return 100;
  if (price < 500000) return 500;
  return 1000;
}

/** 시장별 호가 단위로 반올림 (KR: 호가 단위, US: 센트) */
export function roundToTick(price: number, market: MarketType) {
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (market === 'US') return Math.round(price * 100) / 100;
  const tick = krTickSize(price);
  return Math.round(price / tick) * tick;
}
