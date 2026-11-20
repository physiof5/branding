'use client';

import { useEffect, useRef, useState } from 'react';
import type { MarketType, SearchItem } from '@/types/stock';

type Scope = 'ALL' | 'CURRENT';

interface Props {
  market: MarketType;
  onSelect: (item: SearchItem) => void;
}

/** 일반 입력 디바운스 */
const DEBOUNCE_MS = 180;
/** 한글 조합 중에는 자모마다 요청하지 않도록 더 길게 대기 */
const COMPOSING_DEBOUNCE_MS = 350;

export default function TickerSearchBox({ market, onSelect }: Props) {
  /** 입력창에 보이는 값 (조합 중 자모 포함) */
  const [input, setInput] = useState('');
  /** 검색 트리거 값 — 바뀔 때마다 디바운스 후 요청 */
  const [query, setQuery] = useState('');
  /** compositionend 시 디바운스 없이 즉시 요청하기 위한 신호 */
  const [flushTick, setFlushTick] = useState(0);
  const [scope, setScope] = useState<Scope>('ALL');
  const [items, setItems] = useState<SearchItem[]>([]);
  /** 입력이 바뀐 순간부터 해당 입력의 응답이 도착할 때까지 true — '결과 없음' 깜빡임 방지 */
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const flushRef = useRef(false);
  /** 마지막으로 결과를 받은 요청 키 — 같은 키 중복 호출 방지 */
  const lastFetchedKeyRef = useRef<string | null>(null);

  const scopeParam = scope === 'ALL' ? 'ALL' : market;

  // 디바운스 + AbortController 로 이전 요청 취소
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const key = `${scopeParam}|${q}`;
    const controller = new AbortController();
    const delay = flushRef.current ? 0 : composingRef.current ? COMPOSING_DEBOUNCE_MS : DEBOUNCE_MS;
    flushRef.current = false;

    const timer = setTimeout(async () => {
      // compositionend 직후 같은 값으로 onChange 가 한 번 더 오는 브라우저(iOS Safari 등) 대응
      if (key === lastFetchedKeyRef.current) {
        setIsSearching(false);
        return;
      }
      try {
        const params = new URLSearchParams({ q, market: scopeParam });
        const res = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal });
        const json = (await res.json()) as { items?: SearchItem[] };
        lastFetchedKeyRef.current = key;
        setItems(json.items ?? []);
        setActiveIndex(-1);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // 다음 입력이 이어받음 — 검색 중 유지
        lastFetchedKeyRef.current = null;
        setItems([]);
      }
      setIsSearching(false);
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, scopeParam, flushTick]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const updateQuery = (value: string) => {
    setInput(value);
    if (!value.trim()) {
      setQuery('');
      setItems([]);
      setIsSearching(false);
      lastFetchedKeyRef.current = null;
      return;
    }
    setQuery(value);
    // 입력이 바뀌는 즉시 검색 중으로 전환 (응답 전 '결과 없음' 노출 금지)
    if (`${scopeParam}|${value.trim()}` !== lastFetchedKeyRef.current) setIsSearching(true);
    setOpen(true);
  };

  const onCompositionStart = () => {
    composingRef.current = true;
  };

  const onCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false;
    flushRef.current = true;
    updateQuery(e.currentTarget.value);
    setFlushTick((t) => t + 1);
  };

  const changeScope = (s: Scope) => {
    if (s === scope) return;
    setScope(s);
    if (input.trim()) setIsSearching(true);
  };

  const choose = (item: SearchItem) => {
    onSelect(item);
    setInput('');
    setQuery('');
    setItems([]);
    setIsSearching(false);
    lastFetchedKeyRef.current = null;
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중 Enter/방향키는 IME 확정용 — 선택 동작으로 처리하지 않음
    if (e.nativeEvent.isComposing || composingRef.current) return;
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter' && !isSearching) {
      e.preventDefault();
      choose(items[activeIndex >= 0 ? activeIndex : 0]);
    }
  };

  const hasQuery = input.trim().length > 0;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="search"
            value={input}
            onChange={(e) => updateQuery(e.target.value)}
            onCompositionStart={onCompositionStart}
            onCompositionEnd={onCompositionEnd}
            onFocus={() => hasQuery && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="종목명·코드 검색 (예: 삼성전자, 테슬라)"
            aria-label="종목 검색"
            role="combobox"
            aria-expanded={open && hasQuery}
            aria-controls="ticker-search-list"
            aria-busy={isSearching}
            autoComplete="off"
            className="w-full rounded-xl bg-gray-100 px-4 py-3 pr-10 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500"
          />
          {isSearching && (
            <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          )}
        </div>
        <div className="flex shrink-0 rounded-lg bg-gray-100 p-0.5 text-xs font-semibold">
          {(['ALL', 'CURRENT'] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeScope(s)}
              className={`rounded-md px-2 py-1.5 transition ${scope === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {s === 'ALL' ? '한+미' : market === 'KR' ? '국내' : '미국'}
            </button>
          ))}
        </div>
      </div>

      {open && hasQuery && (
        <ul
          id="ticker-search-list"
          role="listbox"
          className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
        >
          {items.length === 0 &&
            (isSearching ? (
              <li className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
                검색 중…
              </li>
            ) : (
              <li className="px-4 py-3 text-sm text-gray-400">검색 결과가 없습니다</li>
            ))}
          {items.map((item, idx) => (
            <li
              key={`${item.market}-${item.ticker}`}
              role="option"
              aria-selected={idx === activeIndex}
              className={isSearching ? 'opacity-60 transition-opacity' : 'transition-opacity'}
            >
              <button
                type="button"
                onClick={() => choose(item)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left ${idx === activeIndex ? 'bg-gray-50' : ''}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium text-gray-900">{item.name}</span>
                  <span className="text-xs text-gray-400">{item.ticker}</span>
                </span>
                <span
                  className={`ml-3 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${item.market === 'KR' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}
                >
                  {item.market === 'KR' ? '국내' : '미국'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
