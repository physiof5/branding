import type { NextRequest } from 'next/server';
import { getFallbackMockStock, getMockStock, type MockStock } from '@/data/mockStocks';
import { getCorpInfoByTicker } from '@/lib/server/corpCodeMap';
import { fetchDartOwnershipDisclosures } from '@/lib/server/dartClient';
import { attachKrInvestorFlow, fetchKrDailyCandles, hasKisCredentials } from '@/lib/server/kisClient';
import { fetchSecForm4Disclosures, getSecCikInfo } from '@/lib/server/secEdgarClient';
import { fetchUsDailyCandles, hasPolygonKey } from '@/lib/server/usMarketClient';
import { buildVolumeProfile } from '@/lib/volumeCalculator';
import type { CandleData, DataSource, DisclosureEvent, MarketType, StockProfileResponse } from '@/types/stock';

const clamp = (v: number, min: number, max: number, fallback: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function inferMarket(ticker: string): MarketType {
  return /^\d{6}$/.test(ticker) ? 'KR' : 'US';
}

interface Assembled {
  ticker: string;
  name: string;
  candles: CandleData[];
  disclosures: DisclosureEvent[];
  source: DataSource;
  notes: string[];
}

function fromMock(mock: MockStock, requested: string, notes: string[]): Assembled {
  if (mock.ticker !== requested) {
    notes.push(`요청 종목(${requested})의 시세를 불러오지 못해 샘플 종목(${mock.name}) 데이터를 표시합니다.`);
  } else {
    notes.push('API 키 미설정 또는 조회 실패로 샘플(mock) 데이터를 표시합니다.');
  }
  return {
    ticker: mock.ticker,
    name: mock.name,
    candles: mock.candles,
    disclosures: mock.disclosures,
    source: 'mock',
    notes,
  };
}

async function assembleKr(ticker: string, period: number): Promise<Assembled> {
  const notes: string[] = [];
  const mock = getMockStock(ticker);

  if (hasKisCredentials()) {
    try {
      let candles = await fetchKrDailyCandles(ticker, period);
      if (candles.length > 0) {
        try {
          candles = await attachKrInvestorFlow(ticker, candles);
          notes.push('투자자별 순매수 수급은 KIS 제공 범위(최근 약 30거래일)만 반영됩니다.');
        } catch (e) {
          notes.push(`수급 조회 실패: ${errMsg(e)}`);
        }
        let disclosures: DisclosureEvent[] = [];
        try {
          disclosures = await fetchDartOwnershipDisclosures({ ticker, days: period, candles });
        } catch (e) {
          notes.push(`DART 공시 조회 실패: ${errMsg(e)}`);
        }
        if (!process.env.OPENDART_API_KEY) notes.push('OPENDART_API_KEY 미설정으로 지분 공시 이벤트가 생략되었습니다.');
        const corp = await getCorpInfoByTicker(ticker).catch(() => null);
        return {
          ticker,
          name: corp?.corpName ?? mock?.name ?? ticker,
          candles,
          disclosures,
          source: 'live',
          notes,
        };
      }
      notes.push('KIS 시세 조회 결과가 비어 있습니다.');
    } catch (e) {
      notes.push(`KIS 조회 실패: ${errMsg(e)}`);
    }
  }
  return fromMock(mock ?? getFallbackMockStock('KR'), ticker, notes);
}

async function assembleUs(ticker: string, period: number): Promise<Assembled> {
  const notes: string[] = [];
  const mock = getMockStock(ticker);

  const [cikInfo, form4] = await Promise.all([
    getSecCikInfo(ticker).catch(() => null),
    fetchSecForm4Disclosures({ ticker, days: period }).catch((e) => {
      notes.push(`SEC Form 4 조회 실패: ${errMsg(e)}`);
      return null;
    }),
  ]);

  if (hasPolygonKey()) {
    try {
      const candles = await fetchUsDailyCandles(ticker, period);
      if (candles.length > 0) {
        notes.push('미국 주식은 투자자별 수급이 공개되지 않아, 거래량 급증(20일 평균 1.5배↑) 양봉에만 기관 추정 수급을 표시합니다.');
        return {
          ticker,
          name: cikInfo?.name ?? mock?.name ?? ticker,
          candles,
          disclosures: form4 ?? [],
          source: 'live',
          notes,
        };
      }
      notes.push('Polygon 시세 조회 결과가 비어 있습니다.');
    } catch (e) {
      notes.push(`Polygon 조회 실패: ${errMsg(e)}`);
    }
  }

  if (form4 && form4.length > 0 && mock) {
    notes.push('시세는 샘플 데이터, 내부자 거래는 실제 SEC Form 4 공시입니다 (가격대 매칭은 참고용).');
    return {
      ticker: mock.ticker,
      name: cikInfo?.name ?? mock.name,
      candles: mock.candles,
      disclosures: form4,
      source: 'hybrid-sec',
      notes,
    };
  }
  return fromMock(mock ?? getFallbackMockStock('US'), ticker, notes);
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const ticker = (sp.get('ticker') ?? '').trim().toUpperCase();
  if (!/^[0-9A-Z.\-]{1,12}$/.test(ticker)) {
    return Response.json({ error: '유효한 종목 코드(ticker)가 필요합니다.' }, { status: 400 });
  }
  const marketParam = (sp.get('market') ?? '').toUpperCase();
  const market: MarketType = marketParam === 'KR' || marketParam === 'US' ? marketParam : inferMarket(ticker);
  const period = clamp(Number(sp.get('period') ?? 120), 20, 250, 120);
  const bins = clamp(Number(sp.get('bins') ?? 24), 8, 40, 24);

  const data = market === 'KR' ? await assembleKr(ticker, period) : await assembleUs(ticker, period);
  const profile = buildVolumeProfile({
    ticker: data.ticker,
    name: data.name,
    market,
    candles: data.candles,
    disclosures: data.disclosures,
    periodDays: period,
    binCount: bins,
  });

  const body: StockProfileResponse = { ...profile, source: data.source, notes: data.notes };
  return Response.json(body, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
