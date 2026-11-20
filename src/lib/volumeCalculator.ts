import type {
  CandleData,
  DisclosurePositionSummary,
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
      pocIndex: -1,
      lowerHeavyIndexes: [],
      upperHeavyIndexes: [],
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
  const { lowerHeavyIndexes, upperHeavyIndexes } = findHeavyZones(bins, currentPrice);
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
    pocIndex: totalVolume > 0 ? peak.index : -1,
    lowerHeavyIndexes,
    upperHeavyIndexes,
  };
}

/**
 * 현재가 하방/상방에서 체결량이 가장 두터운 구간 상위 N개.
 * 현재가가 속한 구간은 제외하고, 결과는 현재가에 가까운 순으로 정렬한다.
 */
export function findHeavyZones(bins: VolumeBin[], currentPrice: number, topN = 2) {
  const pick = (side: VolumeBin[], nearestFirst: (a: VolumeBin, b: VolumeBin) => number) =>
    side
      .filter((b) => b.volume > 0)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, topN)
      .sort(nearestFirst)
      .map((b) => b.index);
  const lower = bins.filter((b) => !b.containsCurrentPrice && b.maxPrice <= currentPrice);
  const upper = bins.filter((b) => !b.containsCurrentPrice && b.minPrice >= currentPrice);
  return {
    lowerHeavyIndexes: pick(lower, (a, b) => b.midPrice - a.midPrice),
    upperHeavyIndexes: pick(upper, (a, b) => a.midPrice - b.midPrice),
  };
}

/** 가격이 속한 구간. 조회 구간 고가~저가 범위 밖이면 undefined */
export function findBinForPrice(bins: VolumeBin[], price: number): VolumeBin | undefined {
  if (!Number.isFinite(price) || price <= 0 || bins.length === 0) return undefined;
  const sorted = [...bins].sort((a, b) => a.minPrice - b.minPrice);
  return sorted.find((b, i) => price >= b.minPrice && (i === sorted.length - 1 ? price <= b.maxPrice : price < b.maxPrice));
}

/** 현재가 대비 등락률(%) */
export function pctFromCurrent(price: number, currentPrice: number) {
  return currentPrice > 0 ? ((price - currentPrice) / currentPrice) * 100 : 0;
}

/** 조회 기간 내 공시의 매수/매도 건수와 현재가 대비 상·하방 분포 */
export function summarizeDisclosurePositions(bins: VolumeBin[], currentPrice: number): DisclosurePositionSummary {
  const events = bins.flatMap((b) => b.disclosures);
  const weightedAvg = (list: DisclosureEvent[]) => {
    const priced = list.filter((d) => d.price > 0 && d.shares > 0);
    const shares = priced.reduce((s, d) => s + d.shares, 0);
    return shares > 0 ? priced.reduce((s, d) => s + d.price * d.shares, 0) / shares : null;
  };
  const buys = events.filter((d) => d.action === 'BUY');
  const sells = events.filter((d) => d.action === 'SELL');
  const priced = events.filter((d) => d.price > 0);
  return {
    total: events.length,
    buyCount: buys.length,
    sellCount: sells.length,
    aboveCount: priced.filter((d) => d.price > currentPrice).length,
    belowCount: priced.filter((d) => d.price <= currentPrice).length,
    avgBuyPrice: weightedAvg(buys),
    avgSellPrice: weightedAvg(sells),
  };
}
