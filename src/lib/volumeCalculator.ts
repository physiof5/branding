import type {
  CandleData,
  DisclosureEvent,
  DominantFlow,
  MarketType,
  StockProfileResult,
  VolumeBin,
} from '@/types/stock';

export interface BuildVolumeProfileParams {
  ticker: string;
  name: string;
  market: MarketType;
  candles: CandleData[];
  disclosures?: DisclosureEvent[];
  periodDays: number;
  binCount: number;
}

const round = (value: number, digits = 2) => {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
};

function pickDominantFlow(foreign: number, institution: number, retail: number): DominantFlow {
  const entries: Array<[DominantFlow, number]> = [
    ['FOREIGN', foreign],
    ['INSTITUTION', institution],
    ['RETAIL', retail],
  ];
  const total = entries.reduce((s, [, v]) => s + Math.abs(v), 0);
  if (total === 0) return 'NONE';
  const sorted = [...entries].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [topFlow, topValue] = sorted[0];
  const secondValue = Math.abs(sorted[1][1]);
  // 최상위 주체의 순매수가 양수이고, 2위와 격차가 충분할 때만 지배 수급으로 판정
  if (topValue > 0 && Math.abs(topValue) >= secondValue * 1.3) return topFlow;
  return 'MIXED';
}

const FLOW_LABEL: Record<DominantFlow, string> = {
  FOREIGN: '외국인',
  INSTITUTION: '기관',
  RETAIL: '개인',
  MIXED: '혼조',
  NONE: '없음',
};

export function flowLabel(flow: DominantFlow): string {
  return FLOW_LABEL[flow];
}

export function buildVolumeProfile({
  ticker,
  name,
  market,
  candles,
  disclosures = [],
  periodDays,
  binCount,
}: BuildVolumeProfileParams): StockProfileResult {
  const sorted = [...candles]
    .filter((c) => Number.isFinite(c.high) && Number.isFinite(c.low) && c.high > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const window = sorted.slice(-Math.max(1, periodDays));
  const currency = market === 'KR' ? 'KRW' : 'USD';
  const safeBinCount = Math.max(4, Math.min(60, Math.floor(binCount) || 20));

  if (window.length === 0) {
    return {
      ticker,
      name,
      market,
      currency,
      currentPrice: 0,
      aboveVolumeShare: 0,
      belowVolumeShare: 0,
      bins: [],
      commentary: '조회 가능한 시세 데이터가 없습니다.',
      periodDays: 0,
      totalVolume: 0,
      hasFlowData: false,
    };
  }

  const currentPrice = window[window.length - 1].close;
  const rangeHigh = Math.max(...window.map((c) => c.high));
  const rangeLow = Math.min(...window.map((c) => c.low));
  const span = rangeHigh - rangeLow || Math.max(rangeHigh * 0.01, 1);
  const binSize = span / safeBinCount;

  const bins: VolumeBin[] = Array.from({ length: safeBinCount }, (_, i) => {
    const minPrice = rangeLow + binSize * i;
    const maxPrice = i === safeBinCount - 1 ? rangeLow + span : minPrice + binSize;
    return {
      index: i,
      minPrice,
      maxPrice,
      midPrice: (minPrice + maxPrice) / 2,
      volume: 0,
      volumeShare: 0,
      netBuyForeign: 0,
      netBuyInstitution: 0,
      netBuyRetail: 0,
      dominantFlow: 'NONE',
      containsCurrentPrice: false,
      disclosures: [],
    };
  });

  let hasFlowData = false;

  for (const candle of window) {
    const low = Math.min(candle.low, candle.high);
    const high = Math.max(candle.low, candle.high);
    const candleSpan = high - low;
    const flowF = candle.netBuyForeign ?? 0;
    const flowI = candle.netBuyInstitution ?? 0;
    const flowR = candle.netBuyRetail ?? 0;
    if (candle.netBuyForeign !== undefined || candle.netBuyInstitution !== undefined || candle.netBuyRetail !== undefined) {
      hasFlowData = true;
    }

    if (candleSpan <= 0) {
      // 상·하한가 등 고가=저가: 해당 가격 구간에 전량 배분
      const idx = Math.min(safeBinCount - 1, Math.max(0, Math.floor((low - rangeLow) / binSize)));
      const bin = bins[idx];
      bin.volume += candle.volume;
      bin.netBuyForeign += flowF;
      bin.netBuyInstitution += flowI;
      bin.netBuyRetail += flowR;
      continue;
    }

    for (const bin of bins) {
      const overlap = Math.min(high, bin.maxPrice) - Math.max(low, bin.minPrice);
      if (overlap <= 0) continue;
      const ratio = overlap / candleSpan;
      bin.volume += candle.volume * ratio;
      bin.netBuyForeign += flowF * ratio;
      bin.netBuyInstitution += flowI * ratio;
      bin.netBuyRetail += flowR * ratio;
    }
  }

  // 공시 이벤트 매칭: 조회 기간 시작일 이후 건만
  const periodStart = window[0].date;
  const periodEnd = window[window.length - 1].date;
  const relevant = disclosures
    .filter((d) => d.date >= periodStart && Number.isFinite(d.price) && d.price > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const event of relevant) {
    let target = bins.find((b, i) =>
      event.price >= b.minPrice && (i === bins.length - 1 ? event.price <= b.maxPrice : event.price < b.maxPrice),
    );
    if (!target) {
      target = bins.reduce((best, b) =>
        Math.abs(b.midPrice - event.price) < Math.abs(best.midPrice - event.price) ? b : best,
      );
    }
    target.disclosures.push(event);
  }

  const totalVolume = bins.reduce((s, b) => s + b.volume, 0);
  let above = 0;
  let below = 0;
  for (const bin of bins) {
    bin.volumeShare = totalVolume > 0 ? round((bin.volume / totalVolume) * 100, 2) : 0;
    bin.containsCurrentPrice = currentPrice >= bin.minPrice && currentPrice <= bin.maxPrice;
    bin.dominantFlow = pickDominantFlow(bin.netBuyForeign, bin.netBuyInstitution, bin.netBuyRetail);
    if (bin.midPrice > currentPrice) above += bin.volume;
    else if (bin.midPrice < currentPrice) below += bin.volume;
    bin.volume = Math.round(bin.volume);
    bin.netBuyForeign = Math.round(bin.netBuyForeign);
    bin.netBuyInstitution = Math.round(bin.netBuyInstitution);
    bin.netBuyRetail = Math.round(bin.netBuyRetail);
    bin.minPrice = round(bin.minPrice, market === 'KR' ? 0 : 2);
    bin.maxPrice = round(bin.maxPrice, market === 'KR' ? 0 : 2);
    bin.midPrice = round(bin.midPrice, market === 'KR' ? 0 : 2);
  }

  const aboveVolumeShare = totalVolume > 0 ? round((above / totalVolume) * 100, 1) : 0;
  const belowVolumeShare = totalVolume > 0 ? round((below / totalVolume) * 100, 1) : 0;

  const peak = bins.reduce((best, b) => (b.volume > best.volume ? b : best), bins[0]);
  const fmt = (v: number) =>
    market === 'KR' ? `${Math.round(v).toLocaleString('ko-KR')}원` : `$${v.toFixed(2)}`;
  const side =
    aboveVolumeShare > belowVolumeShare
      ? `현재가 상방 누적 거래량 비중(${aboveVolumeShare}%)이 하방(${belowVolumeShare}%)보다 큽니다`
      : `현재가 하방 누적 거래량 비중(${belowVolumeShare}%)이 상방(${aboveVolumeShare}%)보다 큽니다`;
  const disclosureNote = relevant.length > 0 ? `, 기간 내 지분 공시 이벤트 ${relevant.length}건` : '';
  const commentary = `최근 ${window.length}거래일 기준 ${side}. 최대 체결 구간은 ${fmt(peak.minPrice)}~${fmt(peak.maxPrice)}(구간별 누적 체결량 비중 ${peak.volumeShare}%)${disclosureNote}.`;

  return {
    ticker,
    name,
    market,
    currency,
    currentPrice,
    aboveVolumeShare,
    belowVolumeShare,
    bins,
    commentary,
    periodDays: window.length,
    periodStart,
    periodEnd,
    totalVolume: Math.round(totalVolume),
    hasFlowData,
  };
}
