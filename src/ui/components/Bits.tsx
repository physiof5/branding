import { tierForTrophies, tierProgress, nextTier } from '../../game/rank';

export function Gold({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`font-display inline-flex items-center gap-1 rounded-full bg-black/30 px-3 py-1 text-[#ffd76a] ${className}`}>
      🪙 <span className="tabular-nums">{value.toLocaleString()}</span>
    </span>
  );
}

export function TierBadge({ trophies, compact = false }: { trophies: number; compact?: boolean }) {
  const tier = tierForTrophies(trophies);
  const next = nextTier(trophies);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="font-display flex items-center gap-2 text-lg">
        <span className="rounded-full px-2.5 py-0.5 text-[#1b1633]" style={{ background: tier.color }}>
          {tier.emoji} {tier.name}
        </span>
        <span className="text-white/90">🏆 {trophies}</span>
      </div>
      {!compact && (
        <div className="flex items-center gap-2 text-xs text-white/70">
          <div className="h-2 w-28 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full" style={{ width: `${Math.round(tierProgress(trophies) * 100)}%`, background: tier.color }} />
          </div>
          {next ? `다음 ${next.name} ${next.min}` : '최고 티어!'}
        </div>
      )}
    </div>
  );
}

export function Slider({
  label,
  value,
  onChange,
  left,
  right,
  hint,
  accent = '#ff6f91',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  left: string;
  right: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-display text-lg">{label}</span>
        {hint && (
          <span className="font-display rounded-full px-2 py-0.5 text-sm text-[#1b1633]" style={{ background: accent }}>
            {hint}
          </span>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-3 w-full cursor-pointer"
        style={{ accentColor: accent }}
      />
      <div className="mt-0.5 flex justify-between text-xs text-white/60">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </label>
  );
}

export function Toast({ text }: { text: string }) {
  return (
    <div className="anim-toast font-display pointer-events-none fixed top-3 left-1/2 z-[70] -translate-x-1/2 rounded-full border-2 border-white/15 bg-[#2a2350]/95 px-5 py-2 text-base shadow-xl">
      {text}
    </div>
  );
}
