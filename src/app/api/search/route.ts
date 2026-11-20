import type { NextRequest } from 'next/server';
import { MOCK_STOCKS } from '@/data/mockStocks';
import { getCorpCodeMap } from '@/lib/server/corpCodeMap';
import { getAllSecTickers } from '@/lib/server/secEdgarClient';
import type { SearchItem } from '@/types/stock';

type MarketFilter = 'ALL' | 'KR' | 'US';

const MOCK_ITEMS: SearchItem[] = Object.values(MOCK_STOCKS).map((s) => ({
  ticker: s.ticker,
  name: s.name,
  market: s.market,
}));

/** 미국 주요 종목 한글명 별칭 (SEC 목록은 영문명만 제공) */
const US_KO_ALIASES: Record<string, string> = {
  NVDA: '엔비디아',
  TSLA: '테슬라',
  AAPL: '애플',
  MSFT: '마이크로소프트',
  GOOGL: '알파벳',
  AMZN: '아마존',
  META: '메타',
  AMD: 'AMD',
  AVGO: '브로드컴',
  PLTR: '팔란티어',
  NFLX: '넷플릭스',
  TSM: 'TSMC',
};

function score(item: SearchItem, q: string): number {
  const ticker = item.ticker.toUpperCase();
  const name = item.name.toUpperCase().replace(/\s+/g, '');
  const query = q.toUpperCase().replace(/\s+/g, '');
  if (ticker === query) return 100;
  if (name === query) return 95;
  if (ticker.startsWith(query)) return 80 - Math.min(ticker.length - query.length, 10);
  if (name.startsWith(query)) return 70 - Math.min(name.length - query.length, 10) * 0.5;
  if (ticker.includes(query)) return 45;
  if (name.includes(query)) return 40 - Math.min(name.length, 30) * 0.2;
  const alias = item.market === 'US' ? US_KO_ALIASES[ticker] : undefined;
  if (alias) {
    if (alias === query) return 90;
    if (alias.startsWith(query)) return 65;
    if (alias.includes(query)) return 35;
  }
  return 0;
}

async function krItems(): Promise<SearchItem[]> {
  try {
    const map = await getCorpCodeMap();
    if (map.size === 0) return MOCK_ITEMS.filter((m) => m.market === 'KR');
    return [...map.values()].map((c) => ({
      ticker: c.stockCode,
      name: c.corpName,
      market: 'KR' as const,
      corpCode: c.corpCode,
    }));
  } catch {
    return MOCK_ITEMS.filter((m) => m.market === 'KR');
  }
}

async function usItems(): Promise<SearchItem[]> {
  try {
    const list = await getAllSecTickers();
    return list.length ? list : MOCK_ITEMS.filter((m) => m.market === 'US');
  } catch {
    return MOCK_ITEMS.filter((m) => m.market === 'US');
  }
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  const marketParam = (request.nextUrl.searchParams.get('market') ?? 'ALL').toUpperCase();
  const market: MarketFilter = marketParam === 'KR' || marketParam === 'US' ? marketParam : 'ALL';

  if (q.length === 0) return Response.json({ query: q, market, items: [] });

  const [kr, us] = await Promise.all([
    market === 'US' ? Promise.resolve<SearchItem[]>([]) : krItems(),
    market === 'KR' ? Promise.resolve<SearchItem[]>([]) : usItems(),
  ]);

  const items = [...kr, ...us]
    .map((item) => ({ item, s: score(item, q) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.item.name.length - b.item.name.length)
    .slice(0, 10)
    .map((r) => r.item);

  return Response.json({ query: q, market, items });
}
