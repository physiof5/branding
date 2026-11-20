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
  /** 단가. priceBasis 가 CLOSE_ESTIMATE 이면 공시일(또는 직전 거래일) 종가 추정치 */
  price: number;
  /** 변동 수량(주, 절댓값) */
  shares: number;
  summary: string;
  /** REPORTED: 신고서 기재 체결 단가(가중평균) · CLOSE_ESTIMATE: 공시일 종가 추정 */
  priceBasis?: 'REPORTED' | 'CLOSE_ESTIMATE';
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
  /** POC(최대 체결 구간) bin index. 데이터 없으면 -1 */
  pocIndex: number;
  /** 현재가 하방 체결 밀집 상위 구간 index (현재가에 가까운 순) — 분할 매수 참고 위치 */
  lowerHeavyIndexes: number[];
  /** 현재가 상방 체결 밀집 상위 구간 index (현재가에 가까운 순) — 분할 익절 참고 위치 */
  upperHeavyIndexes: number[];
}

/** 분할 매수/익절 시뮬레이터 목표가 키 */
export type SplitTargetKey = 'buy1' | 'buy2' | 'take1' | 'take2';

export interface DisclosurePositionSummary {
  total: number;
  buyCount: number;
  sellCount: number;
  /** 공시 단가가 현재가보다 높은 건수 / 낮은(같은 포함) 건수 */
  aboveCount: number;
  belowCount: number;
  /** 매수·취득 공시의 수량 가중평균 단가 (없으면 null) */
  avgBuyPrice: number | null;
  avgSellPrice: number | null;
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
