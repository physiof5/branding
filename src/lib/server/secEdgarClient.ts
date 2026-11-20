import 'server-only';
import type { DisclosureEvent, SearchItem } from '@/types/stock';

/**
 * SEC EDGAR 클라이언트 — 서버 전용.
 * - company_tickers.json: 티커 → 10자리 CIK / 회사명 (24h 캐시)
 * - submissions/CIK{cik10}.json: 최근 Form 4 목록
 * - Form 4 원본 XML: 내부자 장내 매수(P) / 매도(S) 단가·수량·직책 추출
 * SEC는 User-Agent(연락처 포함) 필수, 초당 10건 제한을 권고한다.
 */

export interface SecCikInfo {
  ticker: string;
  cik: string; // 10자리 zero-padded
  name: string;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const FORM4_TTL_MS = 60 * 60 * 1000;
const MAX_FORM4_FILINGS = 40;
const CONCURRENCY = 4;

let tickerCache: { map: Map<string, SecCikInfo>; fetchedAt: number } | null = null;
let tickerInflight: Promise<Map<string, SecCikInfo>> | null = null;
const form4Cache = new Map<string, { events: DisclosureEvent[]; fetchedAt: number }>();

function userAgent() {
  return process.env.SEC_USER_AGENT?.replace(/^"|"$/g, '') || 'StockVolumeProfileApp contact@example.com';
}

async function secFetch(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent(), 'Accept-Encoding': 'gzip, deflate' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`SEC ${res.status} ${url}`);
  return res;
}

async function loadTickerMap(): Promise<Map<string, SecCikInfo>> {
  const res = await secFetch('https://www.sec.gov/files/company_tickers.json');
  const json = (await res.json()) as Record<string, { cik_str: number; ticker: string; title: string }>;
  const map = new Map<string, SecCikInfo>();
  for (const row of Object.values(json)) {
    const ticker = row.ticker.toUpperCase();
    if (!map.has(ticker)) {
      map.set(ticker, { ticker, cik: String(row.cik_str).padStart(10, '0'), name: row.title });
    }
  }
  return map;
}

async function getTickerMap(): Promise<Map<string, SecCikInfo>> {
  if (tickerCache && Date.now() - tickerCache.fetchedAt < TTL_MS) return tickerCache.map;
  if (tickerInflight) return tickerInflight;
  tickerInflight = loadTickerMap()
    .then((map) => {
      tickerCache = { map, fetchedAt: Date.now() };
      return map;
    })
    .finally(() => {
      tickerInflight = null;
    });
  return tickerInflight;
}

export async function getSecCikInfo(ticker: string): Promise<SecCikInfo | null> {
  const map = await getTickerMap();
  return map.get(ticker.trim().toUpperCase()) ?? null;
}

export async function getAllSecTickers(): Promise<SearchItem[]> {
  const map = await getTickerMap();
  return [...map.values()].map((v) => ({ ticker: v.ticker, name: v.name, market: 'US' as const, cik: v.cik }));
}

// ---------------- Form 4 XML 파싱 ----------------

function tagText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : '';
}

/** <tag><value>..</value></tag> 또는 <tag>..</tag> 모두 처리 */
function valueOf(xml: string, tag: string): string {
  const block = tagText(xml, tag);
  if (!block) return '';
  const inner = tagText(block, 'value');
  return (inner || block).replace(/<[^>]+>/g, '').trim();
}

function decode(s: string) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

interface ParsedForm4 {
  ownerName: string;
  role: string;
  transactions: Array<{ date: string; code: string; shares: number; price: number }>;
}

export function parseForm4Xml(xml: string): ParsedForm4 {
  const owner = tagText(xml, 'reportingOwner');
  const ownerName = decode(tagText(owner, 'rptOwnerName'));
  const rel = tagText(owner, 'reportingOwnerRelationship');
  const flag = (t: string) => ['1', 'true'].includes(tagText(rel, t).toLowerCase());
  const roles: string[] = [];
  const officerTitle = decode(tagText(rel, 'officerTitle'));
  if (flag('isOfficer')) roles.push(officerTitle || 'Officer');
  if (flag('isDirector')) roles.push('Director');
  if (flag('isTenPercentOwner')) roles.push('10% Owner');
  if (flag('isOther')) roles.push(decode(tagText(rel, 'otherText')) || 'Other');

  const transactions: ParsedForm4['transactions'] = [];
  const re = /<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const code = tagText(tagText(block, 'transactionCoding'), 'transactionCode');
    const amounts = tagText(block, 'transactionAmounts');
    transactions.push({
      date: valueOf(block, 'transactionDate').slice(0, 10),
      code,
      shares: Number(valueOf(amounts, 'transactionShares')) || 0,
      price: Number(valueOf(amounts, 'transactionPricePerShare')) || 0,
    });
  }
  return { ownerName, role: roles.join(', ') || 'Insider', transactions };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

interface SubmissionsJson {
  name?: string;
  filings?: {
    recent?: {
      accessionNumber: string[];
      filingDate: string[];
      form: string[];
      primaryDocument: string[];
    };
  };
}

export async function fetchSecForm4Disclosures({
  ticker,
  days,
}: {
  ticker: string;
  days: number;
}): Promise<DisclosureEvent[]> {
  const info = await getSecCikInfo(ticker);
  if (!info) return [];

  const cacheKey = `${info.cik}:${days}`;
  const cached = form4Cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < FORM4_TTL_MS) return cached.events;

  const res = await secFetch(`https://data.sec.gov/submissions/CIK${info.cik}.json`);
  const sub = (await res.json()) as SubmissionsJson;
  const recent = sub.filings?.recent;
  if (!recent) return [];

  const cutoff = new Date(Date.now() - Math.ceil(days * 1.5) * 86400000).toISOString().slice(0, 10);
  const filings: Array<{ accession: string; filingDate: string; doc: string }> = [];
  for (let i = 0; i < recent.form.length && filings.length < MAX_FORM4_FILINGS; i++) {
    if (recent.form[i] !== '4') continue;
    if (recent.filingDate[i] < cutoff) break; // 최신순 정렬
    filings.push({
      accession: recent.accessionNumber[i],
      filingDate: recent.filingDate[i],
      // "xslF345X05/form4.xml" 은 렌더링 HTML — 접두 경로를 제거하면 원본 XML
      doc: recent.primaryDocument[i].replace(/^xslF345X\d+\//, ''),
    });
  }

  const cikInt = String(Number(info.cik));
  const perFiling = await mapWithConcurrency(filings, CONCURRENCY, async (f): Promise<DisclosureEvent[]> => {
    try {
      const url = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${f.accession.replace(/-/g, '')}/${f.doc}`;
      const xml = await (await secFetch(url)).text();
      const parsed = parseForm4Xml(xml);
      const out: DisclosureEvent[] = [];
      for (const code of ['P', 'S'] as const) {
        const txs = parsed.transactions.filter((t) => t.code === code && t.shares > 0);
        if (txs.length === 0) continue;
        const shares = txs.reduce((s, t) => s + t.shares, 0);
        const notional = txs.reduce((s, t) => s + t.shares * t.price, 0);
        const price = shares > 0 ? Math.round((notional / shares) * 100) / 100 : 0;
        const date = txs.map((t) => t.date).filter(Boolean).sort().at(-1) || f.filingDate;
        out.push({
          id: `sec-${f.accession}-${code}`,
          date,
          source: 'SEC_FORM4',
          reporter: `${parsed.ownerName} (${parsed.role})`,
          action: code === 'P' ? 'BUY' : 'SELL',
          price,
          priceBasis: 'REPORTED',
          shares: Math.round(shares),
          summary: `Form 4 ${code === 'P' ? '장내 매수(P)' : '장내 매도(S)'} ${Math.round(shares).toLocaleString('en-US')}주 @ $${price.toFixed(2)} · ${parsed.role} · 신고일 ${f.filingDate}`,
        });
      }
      return out;
    } catch (err) {
      console.warn('[secEdgar] Form 4 파싱 실패', f.accession, err);
      return [];
    }
  });

  const events = perFiling.flat().sort((a, b) => a.date.localeCompare(b.date));
  form4Cache.set(cacheKey, { events, fetchedAt: Date.now() });
  return events;
}
