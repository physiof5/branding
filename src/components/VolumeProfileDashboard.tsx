'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import SplitOrderPlanner, {
  SPLIT_TAG_STYLE,
  SPLIT_TARGETS,
  defaultSplitTargets,
  splitTagsByBin,
  type SplitTargets,
} from '@/components/SplitOrderPlanner';
import TickerSearchBox from '@/components/TickerSearchBox';
import { FLOW_STYLE, formatPct, formatPrice, formatQty } from '@/lib/display';
import { pctFromCurrent, summarizeDisclosurePositions } from '@/lib/volumeCalculator';
import type {
  DataSource,
  DisclosureEvent,
  DominantFlow,
  MarketType,
  SearchItem,
  SplitTargetKey,
  StockProfileResponse,
  VolumeBin,
} from '@/types/stock';

/** 빠른 선택 칩 — 키 없이도 샘플 데이터가 있는 대표 종목 */
const QUICK_CHIPS: Record<MarketType, Array<{ ticker: string; name: string }>> = {
  KR: [
    { ticker: '005930', name: '삼성전자' },
    { ticker: '000660', name: 'SK하이닉스' },
  ],
  US: [
    { ticker: 'NVDA', name: '엔비디아' },
    { ticker: 'TSLA', name: '테슬라' },
  ],
};

const PERIODS = [20, 60, 120, 180];
const BIN_OPTIONS = [12, 24, 36];

const SOURCE_BADGE: Record<DataSource, { label: string; cls: string }> = {
  live: { label: '실시간 API', cls: 'bg-emerald-50 text-emerald-700' },
  'hybrid-sec': { label: '샘플 시세 + SEC 공시', cls: 'bg-amber-50 text-amber-700' },
  mock: { label: '샘플 데이터', cls: 'bg-gray-100 text-gray-600' },
};

function priceBasisLabel(d: DisclosureEvent) {
  const basis = d.priceBasis ?? (d.source === 'DART' ? 'CLOSE_ESTIMATE' : 'REPORTED');
  if (d.price <= 0) return { label: '단가', note: '신고서에 단가 미기재' };
  return basis === 'CLOSE_ESTIMATE'
    ? { label: '추정 단가', note: '공시일 종가 기준 추정 (DART 공시는 체결 단가 미제공)' }
    : { label: '체결 단가', note: 'Form 4 신고 체결가 (여러 건은 수량 가중평균)' };
}

function DisclosureCard({ d, market }: { d: DisclosureEvent; market: MarketType }) {
  const isBuy = d.action === 'BUY';
  const basis = priceBasisLabel(d);
  return (
    <li className={`overflow-hidden rounded-xl border-l-4 bg-white shadow-sm ${isBuy ? 'border-red-400' : 'border-blue-400'}`}>
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <span className="flex items-center gap-1.5">
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${isBuy ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}
          >
            {isBuy ? '▲ 매수·보유 증가' : '▼ 매도·보유 감소'}
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
            {d.source === 'DART' ? 'DART' : 'SEC Form 4'}
          </span>
        </span>
      </div>
      <dl className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-1 px-3 py-2.5 text-[12px]">
        <dt className="text-gray-400">보고자</dt>
        <dd className="break-words font-semibold text-gray-800">{d.reporter}</dd>
        <dt className="text-gray-400">공시일</dt>
        <dd className="tabular-nums text-gray-700">{d.date}</dd>
        <dt className="text-gray-400">변동 수량</dt>
        <dd className={`font-semibold tabular-nums ${isBuy ? 'text-red-500' : 'text-blue-500'}`}>
          {isBuy ? '+' : '-'}
          {formatQty(d.shares, market).replace('+', '')}
        </dd>
        <dt className="text-gray-400">{basis.label}</dt>
        <dd className="tabular-nums text-gray-700">
          {d.price > 0 ? formatPrice(d.price, market) : '—'}
          <span className="block text-[10px] leading-snug text-gray-400">{basis.note}</span>
        </dd>
      </dl>
      <p className="border-t border-gray-50 px-3 py-2 text-[11px] leading-snug text-gray-400">{d.summary}</p>
    </li>
  );
}

function ZoneRow({
  tag,
  tagCls,
  bin,
  currentPrice,
  market,
  hasFlowData,
  isPoc = false,
  onSelect,
}: {
  isPoc?: boolean;
  tag: string;
  tagCls: string;
  bin: VolumeBin;
  currentPrice: number;
  market: MarketType;
  hasFlowData: boolean;
  onSelect: (bin: VolumeBin) => void;
}) {
  const pct = formatPct(pctFromCurrent(bin.midPrice, currentPrice));
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(bin)}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-gray-50"
      >
        <span className={`w-12 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-bold ${tagCls}`}>{tag}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold tabular-nums text-gray-800">
            {formatPrice(bin.minPrice, market)}~{formatPrice(bin.maxPrice, market)}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <span className={`tabular-nums ${pct.cls}`}>중심가 {pct.text}</span>
            {isPoc && <span className="rounded bg-amber-100 px-1 py-px font-bold text-amber-700">POC</span>}
            {hasFlowData && (
              <span className={`rounded px-1 py-px font-semibold ${FLOW_STYLE[bin.dominantFlow].badge}`}>
                {FLOW_STYLE[bin.dominantFlow].label}
              </span>
            )}
          </span>
        </span>
        <span className="shrink-0 text-[12px] font-bold tabular-nums text-gray-700">{bin.volumeShare.toFixed(1)}%</span>
      </button>
    </li>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-[13px] font-medium text-gray-700"
    >
      <span className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-blue-500' : 'bg-gray-300'}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
      {label}
    </button>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  render,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => string;
}) {
  return (
    <div className="flex rounded-lg bg-gray-100 p-0.5">
      {options.map((opt) => (
        <button
          key={String(opt)}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 rounded-md px-2 py-1.5 text-[13px] font-semibold transition ${
            value === opt ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          {render(opt)}
        </button>
      ))}
    </div>
  );
}

export default function VolumeProfileDashboard() {
  const [market, setMarket] = useState<MarketType>('KR');
  const [ticker, setTicker] = useState('005930');
  const [period, setPeriod] = useState(120);
  const [bins, setBins] = useState(24);
  const [flowHighlight, setFlowHighlight] = useState(true);
  const [showDisclosures, setShowDisclosures] = useState(true);
  const [data, setData] = useState<StockProfileResponse | null>(null);
  // 마지막으로 완료된 요청 키 — 현재 키와 다르면 로딩 중
  const [settled, setSettled] = useState<{ key: string; error: string | null } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  /** 종목별 사용자 입력 목표가. 종목이 바뀌면 key 불일치로 기본 제안값 사용 */
  const [plan, setPlan] = useState<{ key: string; values: SplitTargets } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ ticker, market, period: String(period), bins: String(bins) });
    const key = params.toString();
    fetch(`/api/profile?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        return json as StockProfileResponse;
      })
      .then((json) => {
        setData(json);
        setSettled({ key, error: null });
        const current = json.bins.find((b) => b.containsCurrentPrice);
        setSelectedIndex(current ? current.index : null);
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setSettled({ key, error: err.message });
      });
    return () => controller.abort();
  }, [ticker, market, period, bins]);

  const requestKey = new URLSearchParams({ ticker, market, period: String(period), bins: String(bins) }).toString();
  const loading = settled?.key !== requestKey;
  const error = settled?.key === requestKey ? settled.error : null;

  const binsHighToLow = useMemo(() => (data ? [...data.bins].sort((a, b) => b.minPrice - a.minPrice) : []), [data]);
  const maxVolume = useMemo(() => Math.max(1, ...binsHighToLow.map((b) => b.volume)), [binsHighToLow]);
  const selectedBin: VolumeBin | undefined = data?.bins.find((b) => b.index === selectedIndex);
  const disclosureCount = data?.bins.reduce((s, b) => s + b.disclosures.length, 0) ?? 0;
  const viewMarket = data?.market ?? market;

  const planKey = data ? `${data.market}:${data.ticker}` : '';
  const splitTargets: SplitTargets | null = data
    ? plan?.key === planKey
      ? plan.values
      : defaultSplitTargets(data.currentPrice, data.market)
    : null;
  // 차트 태그는 시뮬레이터를 펼쳤을 때만 표시
  const tagsByBin = useMemo(
    () => (data && splitTargets && plannerOpen ? splitTagsByBin(data.bins, splitTargets) : new Map<number, SplitTargetKey[]>()),
    [data, splitTargets, plannerOpen],
  );
  const disclosureSummary = useMemo(() => (data ? summarizeDisclosurePositions(data.bins, data.currentPrice) : null), [data]);
  const binByIndex = (index: number) => data?.bins.find((b) => b.index === index);
  const pocBin = data ? binByIndex(data.pocIndex) : undefined;

  const updateTarget = (key: SplitTargetKey, value: string) => {
    if (!splitTargets) return;
    setPlan({ key: planKey, values: { ...splitTargets, [key]: value } });
  };

  const selectStock = (next: { ticker: string; market: MarketType }) => {
    setMarket(next.market);
    setTicker(next.ticker);
  };

  const selectBin = (bin: VolumeBin) => {
    setSelectedIndex(bin.index);
    // 공시 마커가 있는 구간은 상세 카드로 스크롤해 바로 확인할 수 있게
    if (showDisclosures && bin.disclosures.length > 0) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const selectBinByIndex = (index: number) => {
    setSelectedIndex(index);
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const switchMarket = (m: MarketType) => {
    if (m === market) return;
    setMarket(m);
    setTicker(QUICK_CHIPS[m][0].ticker);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-white">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 space-y-3 border-b border-gray-100 bg-white/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">가격대별 매물대</h1>
          <Segmented<MarketType>
            options={['KR', 'US']}
            value={market}
            onChange={switchMarket}
            render={(m) => (m === 'KR' ? '🇰🇷 국내' : '🇺🇸 미국')}
          />
        </div>
        <TickerSearchBox market={market} onSelect={(item: SearchItem) => selectStock(item)} />
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="shrink-0 text-[11px] font-semibold text-gray-400">
            {market === 'KR' ? '국내 대표' : '미국 대표'}
          </span>
          {QUICK_CHIPS[market].map((chip) => {
            const active = ticker === chip.ticker;
            return (
              <button
                key={chip.ticker}
                type="button"
                aria-pressed={active}
                onClick={() => selectStock({ ticker: chip.ticker, market })}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
                  active ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600'
                }`}
              >
                {market === 'US' && (
                  <span className={`text-[11px] font-bold ${active ? 'text-blue-500' : 'text-gray-900'}`}>{chip.ticker}</span>
                )}
                {chip.name}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-4">
        {/* 조회 옵션 */}
        <section className="space-y-3 rounded-2xl bg-gray-50 p-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500">조회 기간</p>
            <Segmented options={PERIODS} value={period} onChange={setPeriod} render={(p) => `${p}일`} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500">구간 분할</p>
            <Segmented options={BIN_OPTIONS} value={bins} onChange={setBins} render={(b) => `${b}구간`} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            <Toggle label="수급 강조" checked={flowHighlight} onChange={setFlowHighlight} />
            <Toggle label="공시 마커" checked={showDisclosures} onChange={setShowDisclosures} />
          </div>
        </section>

        {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">데이터를 불러오지 못했습니다: {error}</div>}

        {data && (
          <div className={`space-y-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
            {/* 종목 요약 */}
            <section className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">{data.name}</h2>
                <span className="text-sm text-gray-400">{data.ticker}</span>
                <span className={`ml-auto rounded px-1.5 py-0.5 text-[11px] font-semibold ${SOURCE_BADGE[data.source].cls}`}>
                  {SOURCE_BADGE[data.source].label}
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-gray-900">{formatPrice(data.currentPrice, viewMarket)}</p>
              <p className="text-xs text-gray-400">
                {data.periodStart} ~ {data.periodEnd} · {data.periodDays}거래일 · 누적 거래량{' '}
                {formatQty(data.totalVolume ?? 0, viewMarket).replace('+', '')}
              </p>
            </section>

            {/* 상·하방 게이지 */}
            <section className="rounded-2xl border border-gray-100 p-4">
              <p className="mb-2 text-sm font-semibold text-gray-800">현재가 상방/하방 누적 거래량 비중</p>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full bg-indigo-400" style={{ width: `${data.aboveVolumeShare}%` }} />
                <div className="h-full w-0.5 bg-white" />
                <div className="h-full flex-1 bg-emerald-400" />
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span className="font-semibold text-indigo-500">상방 {data.aboveVolumeShare}%</span>
                <span className="text-gray-500">현재가 {formatPrice(data.currentPrice, viewMarket)}</span>
                <span className="font-semibold text-emerald-600">하방 {data.belowVolumeShare}%</span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-gray-600">{data.commentary}</p>
            </section>

            {/* 공시 포지션 요약 배너 */}
            {disclosureSummary && (
              <section className="rounded-xl bg-gray-900 px-4 py-3 text-white">
                {disclosureSummary.total === 0 ? (
                  <p className="text-[12px] text-gray-300">조회 기간 내 수집된 지분 공시 이벤트가 없습니다.</p>
                ) : (
                  <>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                      <span className="font-semibold text-gray-300">공시 포지션</span>
                      <span>
                        <span className="text-red-300">▲ 매수·취득 {disclosureSummary.buyCount}건</span>
                        <span className="text-gray-500"> / </span>
                        <span className="text-blue-300">▼ 매도·처분 {disclosureSummary.sellCount}건</span>
                      </span>
                      <span className="text-gray-500">·</span>
                      <span className="text-gray-200">
                        현재가 상방 {disclosureSummary.aboveCount} · 하방 {disclosureSummary.belowCount}
                      </span>
                    </p>
                    {(disclosureSummary.avgBuyPrice || disclosureSummary.avgSellPrice) && (
                      <p className="mt-1 text-[11px] text-gray-400">
                        {disclosureSummary.avgBuyPrice && (
                          <>
                            매수 공시 가중평균 {formatPrice(disclosureSummary.avgBuyPrice, viewMarket)} (현재가 대비{' '}
                            {formatPct(pctFromCurrent(disclosureSummary.avgBuyPrice, data.currentPrice)).text})
                          </>
                        )}
                        {disclosureSummary.avgBuyPrice && disclosureSummary.avgSellPrice && ' · '}
                        {disclosureSummary.avgSellPrice && (
                          <>
                            매도 공시 가중평균 {formatPrice(disclosureSummary.avgSellPrice, viewMarket)} (
                            {formatPct(pctFromCurrent(disclosureSummary.avgSellPrice, data.currentPrice)).text})
                          </>
                        )}
                      </p>
                    )}
                  </>
                )}
              </section>
            )}

            {/* 중기 매물 핵심 구간 */}
            {pocBin && (
              <section className="rounded-2xl border border-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-800">중기 매물 핵심 구간</p>
                <p className="mb-2 text-[11px] text-gray-400">
                  조회 기간 {data.periodDays}거래일 동안 체결량이 많았던 가격대입니다. 우측 수치는 구간별 누적 체결량 비중입니다.
                </p>
                <ul className="divide-y divide-gray-50">
                  <ZoneRow
                    tag="POC"
                    tagCls="bg-amber-100 text-amber-700"
                    bin={pocBin}
                    currentPrice={data.currentPrice}
                    market={viewMarket}
                    hasFlowData={Boolean(data.hasFlowData)}
                    onSelect={selectBin}
                  />
                </ul>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  {(
                    [
                      ['현재가 하방 두터운 구간', '분할 매수 참고 위치', data.lowerHeavyIndexes, '하방', 'bg-rose-50 text-rose-600'],
                      ['현재가 상방 두터운 구간', '분할 익절 참고 위치', data.upperHeavyIndexes, '상방', 'bg-blue-50 text-blue-600'],
                    ] as Array<[string, string, number[], string, string]>
                  ).map(([title, sub, indexes, tagPrefix, tagCls]) => (
                    <div key={title}>
                      <p className="text-[12px] font-semibold text-gray-600">
                        {title} <span className="font-normal text-gray-400">· {sub}</span>
                      </p>
                      {indexes.length === 0 ? (
                        <p className="py-1.5 text-[11px] text-gray-400">조회 기간 내 해당 방향 체결 구간이 없습니다.</p>
                      ) : (
                        <ul className="divide-y divide-gray-50">
                          {indexes.map((idx, i) => {
                            const bin = binByIndex(idx);
                            return bin ? (
                              <ZoneRow
                                key={idx}
                                tag={`${tagPrefix} ${i + 1}`}
                                tagCls={tagCls}
                                bin={bin}
                                currentPrice={data.currentPrice}
                                market={viewMarket}
                                hasFlowData={Boolean(data.hasFlowData)}
                                isPoc={idx === data.pocIndex}
                                onSelect={selectBin}
                              />
                            ) : null;
                          })}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 매물대 차트 */}
            <section className="rounded-2xl border border-gray-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">구간별 누적 체결량 비중</p>
                {showDisclosures && disclosureCount > 0 && (
                  <span className="text-[11px] text-gray-400">
                    <span className="text-red-500">▲</span>매수 <span className="text-blue-500">▼</span>매도 공시
                  </span>
                )}
              </div>
              {flowHighlight && (
                <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                  {(['FOREIGN', 'INSTITUTION', 'RETAIL', 'MIXED'] as DominantFlow[]).map((f) => (
                    <span key={f} className="flex items-center gap-1">
                      <span className={`inline-block h-2 w-2 rounded-sm ${FLOW_STYLE[f].bar}`} />
                      {FLOW_STYLE[f].label}
                    </span>
                  ))}
                </div>
              )}
              <div className="space-y-[3px]" role="list">
                {binsHighToLow.map((bin) => {
                  const isSelected = bin.index === selectedIndex;
                  const relation = bin.containsCurrentPrice ? 'current' : bin.midPrice > data.currentPrice ? 'above' : 'below';
                  const baseColor =
                    relation === 'current' ? 'bg-amber-400' : relation === 'above' ? 'bg-indigo-300' : 'bg-emerald-300';
                  const barColor = flowHighlight && data.hasFlowData && bin.dominantFlow !== 'NONE' ? FLOW_STYLE[bin.dominantFlow].bar : baseColor;
                  const buys = bin.disclosures.filter((d) => d.action === 'BUY').length;
                  const sells = bin.disclosures.length - buys;
                  const isPoc = bin.index === data.pocIndex;
                  const splitTags = tagsByBin.get(bin.index) ?? [];
                  return (
                    <button
                      key={bin.index}
                      type="button"
                      role="listitem"
                      onClick={() => selectBin(bin)}
                      aria-label={`${formatPrice(bin.minPrice, viewMarket)}~${formatPrice(bin.maxPrice, viewMarket)} 구간${
                        bin.disclosures.length > 0 ? `, 지분 공시 이벤트 ${bin.disclosures.length}건` : ''
                      }${isPoc ? ', POC 최대 체결 구간' : ''}${
                        splitTags.length > 0
                          ? `, 시뮬레이터 ${splitTags.map((k) => SPLIT_TARGETS.find((t) => t.key === k)!.tag).join('·')}`
                          : ''
                      }`}
                      className={`flex w-full items-center gap-2 rounded-md px-1 py-[2px] text-left transition ${
                        isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span
                        className={`w-[72px] shrink-0 text-right text-[11px] tabular-nums ${
                          relation === 'current' ? 'font-bold text-amber-600' : 'text-gray-500'
                        }`}
                      >
                        {formatPrice(bin.midPrice, viewMarket)}
                      </span>
                      <span className="relative h-3.5 flex-1">
                        <span
                          className={`absolute left-0 top-0 h-full rounded-r ${barColor} ${
                            relation === 'current' && flowHighlight ? 'ring-2 ring-amber-400' : ''
                          }`}
                          style={{ width: `${Math.max(1.5, (bin.volume / maxVolume) * 100)}%` }}
                        />
                        {(isPoc || splitTags.length > 0) && (
                          <span className="absolute right-0 top-1/2 flex -translate-y-1/2 gap-0.5">
                            {isPoc && (
                              <span className="rounded-sm bg-amber-100 px-1 text-[9px] font-bold leading-[14px] text-amber-700 ring-1 ring-white">
                                POC
                              </span>
                            )}
                            {splitTags.map((key) => {
                              const meta = SPLIT_TARGETS.find((t) => t.key === key)!;
                              return (
                                <span
                                  key={key}
                                  className={`rounded-sm px-1 text-[9px] font-bold leading-[14px] ring-1 ring-white ${SPLIT_TAG_STYLE[meta.side]}`}
                                >
                                  {meta.tag}
                                </span>
                              );
                            })}
                          </span>
                        )}
                      </span>
                      <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-gray-500">{bin.volumeShare.toFixed(1)}%</span>
                      <span className="w-7 shrink-0 text-[10px] leading-none">
                        {showDisclosures && buys > 0 && <span className="text-red-500">▲{buys > 1 ? buys : ''}</span>}
                        {showDisclosures && sells > 0 && <span className="text-blue-500">▼{sells > 1 ? sells : ''}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-gray-400">막대를 눌러 구간별 순매수 수급과 지분 공시 이벤트를 확인하세요.</p>
            </section>

            {/* 선택 구간 상세 */}
            {selectedBin && (
              <section ref={detailRef} className="scroll-mt-48 space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                    선택 구간
                    {selectedBin.disclosures.length > 0 && (
                      <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-gray-600 shadow-sm">
                        공시 {selectedBin.disclosures.length}건
                      </span>
                    )}
                  </p>
                  <p className="text-base font-bold text-gray-900">
                    {formatPrice(selectedBin.minPrice, viewMarket)} ~ {formatPrice(selectedBin.maxPrice, viewMarket)}
                  </p>
                  <p className="text-xs text-gray-500">
                    체결량 {formatQty(selectedBin.volume, viewMarket).replace('+', '')} · 구간별 누적 체결량 비중{' '}
                    {selectedBin.volumeShare.toFixed(2)}%
                  </p>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold text-gray-500">구간별 순매수 수급</p>
                  {data.hasFlowData ? (
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ['외국인', selectedBin.netBuyForeign, viewMarket === 'US'],
                          ['기관', selectedBin.netBuyInstitution, false],
                          ['개인', selectedBin.netBuyRetail, viewMarket === 'US'],
                        ] as Array<[string, number, boolean]>
                      ).map(([label, value, unavailable]) => (
                        <div key={label} className="rounded-xl bg-white p-2.5 text-center shadow-sm">
                          <p className="text-[11px] text-gray-500">
                            {label}
                            {viewMarket === 'US' && label === '기관' ? '(추정)' : ''}
                          </p>
                          <p
                            className={`text-sm font-bold tabular-nums ${
                              unavailable ? 'text-gray-300' : value > 0 ? 'text-red-500' : value < 0 ? 'text-blue-500' : 'text-gray-400'
                            }`}
                          >
                            {unavailable ? 'N/A' : formatQty(value, viewMarket)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">이 기간에는 투자자별 수급 데이터가 없습니다.</p>
                  )}
                  {data.hasFlowData && (
                    <p className={`mt-1.5 text-xs font-semibold ${FLOW_STYLE[selectedBin.dominantFlow].text}`}>
                      {FLOW_STYLE[selectedBin.dominantFlow].label}
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold text-gray-500">지분 공시 이벤트 ({selectedBin.disclosures.length})</p>
                  {selectedBin.disclosures.length === 0 ? (
                    <p className="text-xs text-gray-400">이 구간에 매칭된 공시가 없습니다.</p>
                  ) : (
                    <ul className="space-y-2">
                      {[...selectedBin.disclosures]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((d) => (
                          <DisclosureCard key={d.id} d={d} market={viewMarket} />
                        ))}
                    </ul>
                  )}
                </div>
              </section>
            )}

            {splitTargets && (
              <SplitOrderPlanner
                profile={data}
                targets={splitTargets}
                open={plannerOpen}
                onToggle={() => setPlannerOpen((v) => !v)}
                onChange={updateTarget}
                onReplaceAll={(values) => setPlan({ key: planKey, values })}
                onSelectBin={selectBinByIndex}
              />
            )}

            {data.notes.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-500">
                {data.notes.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!data && loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        )}
      </main>

      {/* 투자 유의사항 (고정) */}
      <footer className="border-t border-gray-100 bg-gray-50 px-4 py-4 text-[11px] leading-relaxed text-gray-500">
        <p className="mb-1 font-semibold text-gray-600">투자 유의사항</p>
        <p>
          본 화면은 과거 체결 거래량 분포와 공개 공시·수급 데이터를 시각화한 참고 자료이며, 특정 계좌의 실제 보유 잔고나
          투자 권유가 아닙니다. 가격 구간별 수치는 일봉 고가~저가 범위에 거래량을 균등 배분한 추정치이고, 미국 주식의 기관
          수급은 거래량 급증 양봉 기반 추정치입니다. POC·두터운 매물 구간은 과거 체결량이 많았던 위치를 표시할 뿐 지지·저항이나
          향후 가격을 보장하지 않습니다. 분할 매수/매도 시뮬레이션은 사용자가 입력한 가상의 가격대가 매물대 위 어디에
          위치하는지 표시하는 참고 계산기이며, 목표가 제시나 투자 권유가 아닙니다. 투자 판단과 그 결과에 대한 책임은
          투자자 본인에게 있습니다.
        </p>
      </footer>
    </div>
  );
}
