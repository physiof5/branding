import { PASS_LEVELS, passLevelFor } from '../../data/seasonPass';
import { TROPHY_ROAD } from '../../data/trophyRoad';
import { useProfileStore } from '../../store/profileStore';
import { useUIStore, type Screen } from '../../store/uiStore';

const TABS: { id: Screen; label: string; emoji: string }[] = [
  { id: 'shop', label: '상점', emoji: '🛒' },
  { id: 'customize', label: '꾸미기', emoji: '👕' },
  { id: 'lobby', label: '전투', emoji: '⚔️' },
  { id: 'pass', label: '패스', emoji: '👑' },
  { id: 'road', label: '랭크', emoji: '🏆' },
];

/** 하단 탭: 상점 · 꾸미기 · 전투(로비) · 패스 · 랭크(트로피 로드) */
export function BottomNav() {
  const screen = useUIStore((s) => s.screen);
  const go = useUIStore((s) => s.go);
  const passBadge = useProfileStore((s) => {
    const lvl = passLevelFor(s.pass.xp);
    return PASS_LEVELS.filter(
      (l) => l.level <= lvl && ((l.free && !s.pass.claimed.free.includes(l.level)) || (s.pass.premium && !s.pass.claimed.premium.includes(l.level))),
    ).length;
  });
  const roadBadge = useProfileStore((s) => TROPHY_ROAD.filter((r) => r.trophies <= s.bestTrophies && !s.roadClaimed.includes(r.trophies)).length);
  const badge = (id: Screen) => (id === 'pass' ? passBadge : id === 'road' ? roadBadge : 0);

  return (
    <nav className="relative z-20 flex items-end gap-1 rounded-t-[26px] bg-[#241d47] px-2 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-4px_0_rgba(0,0,0,0.25)]">
      {TABS.map((t) => {
        const on = screen === t.id;
        const n = badge(t.id);
        return (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            aria-current={on ? 'page' : undefined}
            className={`font-display relative flex flex-1 flex-col items-center rounded-2xl py-1.5 text-[12px] transition-transform active:scale-95 ${
              on ? '-mt-4 bg-[#ffd23f] pb-2 text-[#2a1f00] shadow-[0_4px_0_#c48a00]' : 'text-white/75'
            }`}
          >
            <span className={on ? 'text-2xl' : 'text-xl'}>{t.emoji}</span>
            {t.label}
            {n > 0 && <span className="absolute top-0 right-[18%] grid h-5 min-w-5 place-items-center rounded-full bg-[#ff4d5e] px-1 text-[11px] text-white">{n}</span>}
          </button>
        );
      })}
    </nav>
  );
}
