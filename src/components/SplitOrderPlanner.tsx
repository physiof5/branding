'use client';

import { FLOW_STYLE, formatPct, formatPrice, roundToTick } from '@/lib/display';
import { findBinForPrice, pctFromCurrent } from '@/lib/volumeCalculator';
import type { MarketType, SplitTargetKey, StockProfileResult, VolumeBin } from '@/types/stock';

/**
 * 중기 분할 매수·매도 구간 시뮬레이터.
 * 사용자가 입력한 가상의 목표가가 매물대의 어느 구간에 놓이는지 보여 주는 참고 계산기이며,
 * 목표가를 추천하거나 매매를 권유하지 않는다.
 */

export type SplitTargets = Record<SplitTargetKey, string>;

export const SPLIT_TARGETS: Array<{
  key: SplitTargetKey;
  tag: string;
  label: string;
  side: 'BUY' | 'TAKE';
  defaultPct: number;
}> = [
  { key: 'buy1', tag: '매수1', label: '1차 분할 매수', side: 'BUY', defaultPct: -5 },
  { key: 'buy2', tag: '매수2', label: '2차 분할 매수', side: 'BUY', defaultPct: -12 },
  { key: 'take1', tag: '익절1', label: '1차 분할 익절', side: 'TAKE', defaultPct: 8 },
  { key: 'take2', tag: '익절2', label: '2차 분할 익절', side: 'TAKE', defaultPct: 18 },
];

export const SPLIT_TAG_STYLE: Record<'BUY' | 'TAKE', string> = {
  BUY: 'bg-rose-500 text-white',
  TAKE: 'bg-blue-500 text-white',
};

const toInput = (price: number, market: MarketType) =>
  price > 0 ? (market === 'KR' ? String(Math.round(price)) : price.toFixed(2)) : '';

/** 현재가 기준 기본 제안값: 매수 -5% / -12%, 익절 +8% / +18% */
export function defaultSplitTargets(currentPrice: number, market: MarketType): SplitTargets {
  const entries = SPLIT_TARGETS.map((t) => [
    t.key,
    toInput(roundToTick(currentPrice * (1 + t.defaultPct / 100), market), market),
  ]);
  return Object.fromEntries(entries) as SplitTargets;
}

/** 매물대 기준 채우기: 하방/상방 두터운 구간 중심가 (없으면 기본 제안값 유지) */
export function zoneSplitTargets(profile: StockProfileResult): SplitTargets {
  const base = defaultSplitTargets(profile.currentPrice, profile.market);
  const mid = (index: number | undefined) => {
    const bin = profile.bins.find((b) => b.index === index);
    return bin ? toInput(roundToTick(bin.midPrice, profile.market), profile.market) : undefined;
  };
  return {
    buy1: mid(profile.lowerHeavyIndexes[0]) ?? base.buy1,
    buy2: mid(profile.lowerHeavyIndexes[1]) ?? base.buy2,
    take1: mid(profile.upperHeavyIndexes[0]) ?? base.take1,
    take2: mid(profile.upperHeavyIndexes[1]) ?? base.take2,
  };
}

export function parsePriceInput(value: string): number {
  const n = Number(value.replace(/[,\s원$]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 차트 연동용: bin index → 해당 구간에 놓인 목표가 키 목록 */
export function splitTagsByBin(bins: VolumeBin[], targets: SplitTargets): Map<number, SplitTargetKey[]> {
  const map = new Map<number, SplitTargetKey[]>();
  for (const t of SPLIT_TARGETS) {
    const bin = findBinForPrice(bins, parsePriceInput(targets[t.key]));
    if (!bin) continue;
    map.set(bin.index, [...(map.get(bin.index) ?? []), t.key]);
  }
  return map;
}

interface Props {
  profile: StockProfileResult;
  targets: SplitTargets;
  open: boolean;
  onToggle: () => void;
  onChange: (key: SplitTargetKey, value: string) => void;
  onReplaceAll: (next: SplitTargets) => void;
  onSelectBin: (index: number) => void;
}

function warningFor(side: 'BUY' | 'TAKE', pct: number) {
  if (side === 'BUY' && pct >= 0) return '현재가 이상 가격입니다';
  if (side === 'TAKE' && pct <= 0) return '현재가 이하 가격입니다';
  return null;
}

export default function SplitOrderPlanner({ profile, targets, open, onToggle, onChange, onReplaceAll, onSelectBin }: Props) {
  const { market, currentPrice, bins, hasFlowData } = profile;

  const buyPrices = (['buy1', 'buy2'] as const).map((k) => parsePriceInput(targets[k])).filter((p) => p > 0);
  const avgBuy = buyPrices.length > 0 ? buyPrices.reduce((s, p) => s + p, 0) / buyPrices.length : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="split-order-planner"
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-gray-800">중기 분할 매수·매도 구간 시뮬레이터</span>
          <span className="block text-[11px] text-gray-400">입력한 가격이 매물대 어느 구간에 놓이는지 확인하는 참고 계산기</span>
        </span>
        <span className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div id="split-order-planner" className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onReplaceAll(defaultSplitTargets(currentPrice, market))}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600"
            >
              현재가 기준 (-5/-12%, +8/+18%)
            </button>
            <button
              type="button"
              onClick={() => onReplaceAll(zoneSplitTargets(profile))}
              disabled={profile.lowerHeavyIndexes.length + profile.upperHeavyIndexes.length === 0}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 disabled:opacity-40"
            >
              두터운 매물 구간 중심가로 채우기
            </button>
          </div>

          <ul className="space-y-2">
            {SPLIT_TARGETS.map((t) => {
              const price = parsePriceInput(targets[t.key]);
              const pct = price > 0 ? pctFromCurrent(price, currentPrice) : null;
              const bin = price > 0 ? findBinForPrice(bins, price) : undefined;
              const warn = pct !== null ? warningFor(t.side, pct) : null;
              const pctView = pct !== null ? formatPct(pct) : null;
              return (
                <li key={t.key} className="rounded-xl bg-gray-50 p-3">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${SPLIT_TAG_STYLE[t.side]}`}>{t.tag}</span>
                    <label htmlFor={`split-${t.key}`} className="shrink-0 text-[12px] font-semibold text-gray-700">
                      {t.label}
                    </label>
                    <div className="relative ml-auto w-[124px]">
                      {market === 'US' && (
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-gray-400">$</span>
                      )}
                      <input
                        id={`split-${t.key}`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={targets[t.key]}
                        onChange={(e) => onChange(t.key, e.target.value.replace(/[^\d.,]/g, ''))}
                        className={`w-full rounded-lg border border-gray-200 bg-white py-1.5 text-right text-[14px] font-semibold tabular-nums text-gray-900 outline-none focus:border-blue-400 ${
                          market === 'US' ? 'pl-5 pr-2' : 'pl-2 pr-6'
                        }`}
                      />
                      {market === 'KR' && (
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-gray-400">원</span>
                      )}
                    </div>
                    <span className={`w-14 shrink-0 text-right text-[12px] font-semibold tabular-nums ${pctView?.cls ?? 'text-gray-300'}`}>
                      {pctView?.text ?? '—'}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px]">
                    {price <= 0 ? (
                      <span className="text-gray-400">가격을 입력하세요</span>
                    ) : bin ? (
                      <button
                        type="button"
                        onClick={() => onSelectBin(bin.index)}
                        className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-left text-gray-500"
                      >
                        <span className="tabular-nums">
                          구간 {formatPrice(bin.minPrice, market)}~{formatPrice(bin.maxPrice, market)}
                        </span>
                        <span className="font-semibold tabular-nums text-gray-700">누적 체결량 비중 {bin.volumeShare.toFixed(1)}%</span>
                        {hasFlowData && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${FLOW_STYLE[bin.dominantFlow].badge}`}>
                            {FLOW_STYLE[bin.dominantFlow].label}
                          </span>
                        )}
                        {bin.index === profile.pocIndex && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">POC</span>
                        )}
                      </button>
                    ) : (
                      <span className="text-gray-400">조회 기간 가격 범위 밖 — 해당 가격대 체결 이력이 없습니다</span>
                    )}
                    {warn && <p className="mt-1 text-amber-600">⚠ {warn}</p>}
                  </div>
                </li>
              );
            })}
          </ul>

          {avgBuy > 0 && (
            <div className="rounded-xl bg-blue-50/60 p-3 text-[12px] leading-relaxed text-gray-600">
              <p>
                1·2차 매수가 <b>동일 수량</b>이라고 가정하면 평균 단가{' '}
                <b className="tabular-nums text-gray-900">{formatPrice(roundToTick(avgBuy, market), market)}</b>
                {' '}(현재가 대비 <span className={formatPct(pctFromCurrent(avgBuy, currentPrice)).cls}>
                  {formatPct(pctFromCurrent(avgBuy, currentPrice)).text}
                </span>)
              </p>
              {(['take1', 'take2'] as const).map((k, i) => {
                const p = parsePriceInput(targets[k]);
                if (p <= 0) return null;
                const v = formatPct(pctFromCurrent(p, avgBuy));
                return (
                  <p key={k}>
                    {i + 1}차 익절가는 평균 단가 대비 <span className={`font-semibold ${v.cls}`}>{v.text}</span>
                  </p>
                );
              })}
              <p className="mt-1 text-[10px] text-gray-400">수수료·세금·체결 여부는 반영하지 않은 단순 계산입니다.</p>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-gray-400">
            입력한 가격은 매물대 차트에 <span className="font-semibold text-rose-500">매수1·2</span> /{' '}
            <span className="font-semibold text-blue-500">익절1·2</span> 태그로 표시됩니다. 이 계산기는 가상의 가격대 위치를 보여 줄 뿐,
            목표가를 제안하거나 매매를 권유하지 않습니다.
          </p>
        </div>
      )}
    </section>
  );
}
