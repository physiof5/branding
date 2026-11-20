import type { CandleData, DisclosureEvent, MarketType } from '@/types/stock';

export interface MockStock {
  ticker: string;
  name: string;
  market: MarketType;
  candles: CandleData[];
  disclosures: DisclosureEvent[];
}

interface MockSeed {
  ticker: string;
  name: string;
  market: MarketType;
  startPrice: number;
  dailyVol: number;
  drift: number;
  baseVolume: number;
  seed: number;
  reporters: string[];
}

const MOCK_DAYS = 180;

/** 결정적(재현 가능한) 의사난수 생성기 — mulberry32 */
function createRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** 오늘(UTC) 기준 직전 영업일부터 거꾸로 n개 평일 날짜 */
function businessDays(count: number): string[] {
  const days: string[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  while (days.length < count) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(toIso(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days.reverse();
}

function tick(price: number, market: MarketType) {
  if (market === 'US') return Math.round(price * 100) / 100;
  const unit = price >= 500000 ? 1000 : price >= 100000 ? 500 : price >= 50000 ? 100 : 50;
  return Math.max(unit, Math.round(price / unit) * unit);
}

function generateMockStock(cfg: MockSeed): MockStock {
  const rng = createRng(cfg.seed);
  const dates = businessDays(MOCK_DAYS);
  const candles: CandleData[] = [];
  let prevClose = cfg.startPrice;

  dates.forEach((date, i) => {
    // 완만한 사이클 + 드리프트 + 노이즈
    const cycle = Math.sin((i / MOCK_DAYS) * Math.PI * 2.4) * cfg.dailyVol * 0.35;
    const ret = cfg.drift + cycle + gaussian(rng) * cfg.dailyVol;
    const open = tick(prevClose * (1 + gaussian(rng) * cfg.dailyVol * 0.3), cfg.market);
    const close = tick(Math.max(open * 0.7, prevClose * (1 + ret)), cfg.market);
    const high = tick(Math.max(open, close) * (1 + Math.abs(gaussian(rng)) * cfg.dailyVol * 0.6), cfg.market);
    const low = tick(Math.min(open, close) * (1 - Math.abs(gaussian(rng)) * cfg.dailyVol * 0.6), cfg.market);
    const moveRatio = Math.abs(close - prevClose) / prevClose / cfg.dailyVol;
    const spike = rng() < 0.06 ? 1.8 + rng() * 1.5 : 1;
    const volume = Math.round(cfg.baseVolume * (0.6 + rng() * 0.6 + moveRatio * 0.4) * spike);

    const candle: CandleData = { date, open, high, low, close, volume };
    const up = close >= open ? 1 : -1;

    if (cfg.market === 'KR') {
      const foreign = Math.round(volume * (up * 0.06 + gaussian(rng) * 0.05));
      const institution = Math.round(volume * (up * 0.03 + gaussian(rng) * 0.04));
      const etc = Math.round(volume * gaussian(rng) * 0.005);
      candle.netBuyForeign = foreign;
      candle.netBuyInstitution = institution;
      // 개인 = -(외국인 + 기관 + 기타법인) 근사
      candle.netBuyRetail = -(foreign + institution + etc);
    } else {
      // 미국: 거래량 급증 양봉에만 기관 추정치 부여 (실제 서비스 로직과 동일)
      const recent = candles.slice(-20);
      const avg = recent.length ? recent.reduce((s, c) => s + c.volume, 0) / recent.length : volume;
      if (close > open && volume >= avg * 1.5) {
        candle.netBuyInstitution = Math.round((volume - avg) * ((close - open) / Math.max(high - low, 0.01)));
      }
    }

    candles.push(candle);
    prevClose = close;
  });

  const disclosures: DisclosureEvent[] = [];
  const eventCount = 5 + Math.floor(rng() * 4);
  for (let k = 0; k < eventCount; k++) {
    const idx = Math.floor(rng() * candles.length);
    const c = candles[idx];
    const action: 'BUY' | 'SELL' = rng() < 0.55 ? 'BUY' : 'SELL';
    const price = tick(c.low + (c.high - c.low) * rng(), cfg.market);
    const reporter = cfg.reporters[Math.floor(rng() * cfg.reporters.length)];
    const shares =
      cfg.market === 'KR'
        ? Math.round((1000 + rng() * 200000) / 10) * 10
        : Math.round((500 + rng() * 60000) / 10) * 10;
    const isKr = cfg.market === 'KR';
    disclosures.push({
      id: `mock-${cfg.ticker}-${k}`,
      date: c.date,
      source: isKr ? 'DART' : 'SEC_FORM4',
      reporter,
      action,
      price,
      priceBasis: isKr ? 'CLOSE_ESTIMATE' : 'REPORTED',
      shares,
      summary: isKr
        ? `[샘플] ${reporter} ${action === 'BUY' ? '장내매수' : '장내매도'} ${shares.toLocaleString('ko-KR')}주 (지분 공시 이벤트)`
        : `[Sample] Form 4 ${action === 'BUY' ? 'open-market purchase (P)' : 'sale (S)'} by ${reporter}, ${shares.toLocaleString('en-US')} sh`,
    });
  }
  disclosures.sort((a, b) => a.date.localeCompare(b.date));

  return { ticker: cfg.ticker, name: cfg.name, market: cfg.market, candles, disclosures };
}

const SEEDS: MockSeed[] = [
  {
    ticker: '005930',
    name: '삼성전자',
    market: 'KR',
    startPrice: 62000,
    dailyVol: 0.017,
    drift: 0.0012,
    baseVolume: 15_000_000,
    seed: 5930,
    reporters: ['국민연금공단', '삼성생명보험', '임원 A', 'BlackRock Fund Advisors'],
  },
  {
    ticker: '000660',
    name: 'SK하이닉스',
    market: 'KR',
    startPrice: 175000,
    dailyVol: 0.026,
    drift: 0.0015,
    baseVolume: 3_500_000,
    seed: 660,
    reporters: ['국민연금공단', 'SK스퀘어', '임원 B', 'The Capital Group'],
  },
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corp',
    market: 'US',
    startPrice: 118,
    dailyVol: 0.028,
    drift: 0.0013,
    baseVolume: 230_000_000,
    seed: 1045810,
    reporters: ['Director A (Director)', 'Officer B (EVP)', 'Officer C (CFO)'],
  },
  {
    ticker: 'TSLA',
    name: 'Tesla Inc',
    market: 'US',
    startPrice: 240,
    dailyVol: 0.035,
    drift: 0.0006,
    baseVolume: 95_000_000,
    seed: 1318605,
    reporters: ['Director D (Director)', 'Officer E (CFO)', 'Officer F (SVP)'],
  },
];

export const MOCK_STOCKS: Record<string, MockStock> = Object.fromEntries(
  SEEDS.map((seed) => [seed.ticker, generateMockStock(seed)]),
);

export function getMockStock(ticker: string): MockStock | undefined {
  return MOCK_STOCKS[ticker.toUpperCase()] ?? MOCK_STOCKS[ticker];
}

/** 목 데이터가 없는 티커에 대해 대표 샘플을 고른다 */
export function getFallbackMockStock(market: MarketType): MockStock {
  return market === 'KR' ? MOCK_STOCKS['005930'] : MOCK_STOCKS['NVDA'];
}
