import 'server-only';
import AdmZip from 'adm-zip';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

/**
 * Open DART 고유번호(corpCode.xml) → 상장사 맵.
 * - 24시간 TTL 메모리 캐시
 * - os.tmpdir() 디스크 캐시 (서버 재시작 시 재다운로드 방지)
 * - inflightPromise 로 동시 다운로드 방지
 */

export interface CorpInfo {
  corpCode: string; // 8자리
  corpName: string;
  stockCode: string; // 6자리
}

export type CorpCodeMap = Map<string, CorpInfo>; // key: stockCode

const TTL_MS = 24 * 60 * 60 * 1000;
const DISK_CACHE_PATH = path.join(os.tmpdir(), 'opendart-corp-code-map.json');
const CORP_CODE_URL = 'https://opendart.fss.or.kr/api/corpCode.xml';

let memoryCache: { map: CorpCodeMap; fetchedAt: number } | null = null;
let inflightPromise: Promise<CorpCodeMap> | null = null;

function decodeXml(text: string) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function pickTag(block: string, tag: string) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? decodeXml(m[1]) : '';
}

export function parseCorpCodeXml(xml: string): CorpInfo[] {
  const result: CorpInfo[] = [];
  const listRe = /<list>([\s\S]*?)<\/list>/g;
  let match: RegExpExecArray | null;
  while ((match = listRe.exec(xml)) !== null) {
    const block = match[1];
    const corpCode = pickTag(block, 'corp_code');
    const corpName = pickTag(block, 'corp_name');
    const stockCode = pickTag(block, 'stock_code');
    if (/^\d{8}$/.test(corpCode) && /^[0-9A-Z]{6}$/.test(stockCode) && corpName) {
      result.push({ corpCode, corpName, stockCode });
    }
  }
  return result;
}

function toMap(items: CorpInfo[]): CorpCodeMap {
  const map: CorpCodeMap = new Map();
  for (const item of items) map.set(item.stockCode, item);
  return map;
}

/** OPENDART_CORP_MAP_JSON: 인라인 JSON 또는 JSON 파일 경로. 키 없이도 최소 매핑 제공 */
async function loadOverrideMap(): Promise<CorpInfo[]> {
  const raw = process.env.OPENDART_CORP_MAP_JSON?.trim();
  if (!raw) return [];
  try {
    const text = raw.startsWith('{') || raw.startsWith('[') ? raw : await fs.readFile(raw, 'utf8');
    const parsed: unknown = JSON.parse(text);
    const items: CorpInfo[] = [];
    if (Array.isArray(parsed)) {
      for (const row of parsed as Array<Record<string, string>>) {
        const stockCode = row.stock_code ?? row.stockCode;
        const corpCode = row.corp_code ?? row.corpCode;
        const corpName = row.corp_name ?? row.corpName ?? stockCode;
        if (stockCode && corpCode) items.push({ stockCode, corpCode, corpName });
      }
    } else if (parsed && typeof parsed === 'object') {
      for (const [stockCode, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === 'string') items.push({ stockCode, corpCode: value, corpName: stockCode });
        else if (value && typeof value === 'object') {
          const v = value as Record<string, string>;
          const corpCode = v.corp_code ?? v.corpCode;
          if (corpCode) items.push({ stockCode, corpCode, corpName: v.corp_name ?? v.corpName ?? stockCode });
        }
      }
    }
    return items;
  } catch (err) {
    console.warn('[corpCodeMap] OPENDART_CORP_MAP_JSON 파싱 실패', err);
    return [];
  }
}

async function readDiskCache(): Promise<CorpInfo[] | null> {
  try {
    const stat = await fs.stat(DISK_CACHE_PATH);
    if (Date.now() - stat.mtimeMs > TTL_MS) return null;
    const parsed = JSON.parse(await fs.readFile(DISK_CACHE_PATH, 'utf8')) as CorpInfo[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

async function writeDiskCache(items: CorpInfo[]) {
  try {
    await fs.writeFile(DISK_CACHE_PATH, JSON.stringify(items), 'utf8');
  } catch (err) {
    console.warn('[corpCodeMap] 디스크 캐시 저장 실패', err);
  }
}

async function downloadCorpCodes(apiKey: string): Promise<CorpInfo[]> {
  const res = await fetch(`${CORP_CODE_URL}?crtfc_key=${encodeURIComponent(apiKey)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`corpCode.xml HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  // 키 오류 시 ZIP 대신 XML/JSON 에러 본문이 반환된다 (ZIP 매직넘버 PK)
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error(`corpCode.xml 응답이 ZIP이 아닙니다: ${buffer.toString('utf8', 0, 200)}`);
  }
  const zip = new AdmZip(buffer);
  const entry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith('.xml'));
  if (!entry) throw new Error('corpCode ZIP 안에 XML이 없습니다');
  return parseCorpCodeXml(entry.getData().toString('utf8'));
}

async function loadCorpCodeMap(): Promise<CorpCodeMap> {
  const overrides = await loadOverrideMap();
  let items = await readDiskCache();
  if (!items) {
    const apiKey = process.env.OPENDART_API_KEY;
    if (apiKey) {
      try {
        items = await downloadCorpCodes(apiKey);
        if (items.length > 0) await writeDiskCache(items);
      } catch (err) {
        console.warn('[corpCodeMap] corpCode.xml 다운로드 실패', err);
      }
    }
  }
  const map = toMap(items ?? []);
  for (const o of overrides) {
    const existing = map.get(o.stockCode);
    map.set(o.stockCode, { ...o, corpName: existing?.corpName ?? o.corpName });
  }
  return map;
}

export async function getCorpCodeMap(): Promise<CorpCodeMap> {
  if (memoryCache && Date.now() - memoryCache.fetchedAt < TTL_MS) return memoryCache.map;
  if (inflightPromise) return inflightPromise;
  inflightPromise = loadCorpCodeMap()
    .then((map) => {
      // 비어 있는 결과는 캐싱하지 않아 다음 요청에서 재시도
      if (map.size > 0) memoryCache = { map, fetchedAt: Date.now() };
      return map;
    })
    .finally(() => {
      inflightPromise = null;
    });
  return inflightPromise;
}

export async function getCorpInfoByTicker(ticker: string): Promise<CorpInfo | null> {
  const map = await getCorpCodeMap();
  return map.get(ticker.trim().toUpperCase()) ?? null;
}

export async function getCorpCodeByTicker(ticker: string): Promise<string | null> {
  return (await getCorpInfoByTicker(ticker))?.corpCode ?? null;
}
