export type MarketType = 'KR' | 'US';

export type DominantFlow = 'FOREIGN' | 'INSTITUTION' | 'RETAIL' | 'MIXED' | 'NONE';

export type DataSource = 'live' | 'hybrid-sec' | 'mock';

export interface CandleData {
  /** YYYY-MM-DD */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** 외국인 순매수 수량(주). 미국 주식은 미제공 */
  netBuyForeign?: number;
  /** 기관 순매수 수량(주). 미국 주식은 거래량 급증 양봉 기반 추정치 */
  netBuyInstitution?: number;
  /** 개인 순매수 수량(주) */
  netBuyRetail?: number;
}

export interface DisclosureEvent {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  source: 'DART' | 'SEC_FORM4';
  reporter: string;
  action: 'BUY' | 'SELL';
  price: number;
  shares: number;
  summary: string;
}

export interface VolumeBin {
  index: number;
  minPrice: number;
  maxPrice: number;
  midPrice: number;
  volume: number;
  /** 전체 기간 대비 구간별 누적 체결량 비중(%) */
  volumeShare: number;
  netBuyForeign: number;
  netBuyInstitution: number;
  netBuyRetail: number;
  dominantFlow: DominantFlow;
  containsCurrentPrice: boolean;
  disclosures: DisclosureEvent[];
}

export interface StockProfileResult {
  ticker: string;
  name: string;
  market: MarketType;
  currency: 'KRW' | 'USD';
  currentPrice: number;
  /** 현재가 상방 누적 거래량 비중(%) */
  aboveVolumeShare: number;
  /** 현재가 하방 누적 거래량 비중(%) */
  belowVolumeShare: number;
  bins: VolumeBin[];
  commentary: string;
  periodDays?: number;
  periodStart?: string;
  periodEnd?: string;
  totalVolume?: number;
  hasFlowData?: boolean;
}

export interface StockProfileResponse extends StockProfileResult {
  source: DataSource;
  notes: string[];
}

export interface SearchItem {
  ticker: string;
  name: string;
  market: MarketType;
  corpCode?: string;
  cik?: string;
}
