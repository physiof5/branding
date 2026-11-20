'use client';

import { useEffect, useRef, useState } from 'react';
import type { MarketType, SearchItem } from '@/types/stock';

type Scope = 'ALL' | 'CURRENT';

interface Props {
  market: MarketType;
  onSelect: (item: SearchItem) => void;
}

export default function TickerSearchBox({ market, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('ALL');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 180ms 디바운스 + AbortController 로 이전 요청 취소
  useEffect(() => {
    const q = query.trim();
    if (!q) return; // 빈 검색어일 때 드롭다운은 query 조건으로 숨겨짐
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q, market: scope === 'ALL' ? 'ALL' : market });
        const res = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal });
        const json = (await res.json()) as { items?: SearchItem[] };
        setItems(json.items ?? []);
        setActiveIndex(-1);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setItems([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, scope, market]);

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

  const choose = (item: SearchItem) => {
    onSelect(item);
    setQuery('');
    setItems([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(items[activeIndex >= 0 ? activeIndex : 0]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => items.length > 0 && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="종목명·코드 검색 (예: 삼성전자, NVDA)"
            aria-label="종목 검색"
            role="combobox"
            aria-expanded={open}
            aria-controls="ticker-search-list"
            className="w-full rounded-xl bg-gray-100 px-4 py-3 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          )}
        </div>
        <div className="flex shrink-0 rounded-lg bg-gray-100 p-0.5 text-xs font-semibold">
          {(['ALL', 'CURRENT'] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`rounded-md px-2 py-1.5 transition ${scope === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {s === 'ALL' ? '한+미' : market === 'KR' ? '국내' : '미국'}
            </button>
          ))}
        </div>
      </div>

      {open && query.trim() && (
        <ul
          id="ticker-search-list"
          role="listbox"
          className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
        >
          {items.length === 0 && !loading && <li className="px-4 py-3 text-sm text-gray-400">검색 결과가 없습니다</li>}
          {items.map((item, idx) => (
            <li key={`${item.market}-${item.ticker}`} role="option" aria-selected={idx === activeIndex}>
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
