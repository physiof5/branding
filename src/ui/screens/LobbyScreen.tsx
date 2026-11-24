import { useState } from 'react';
import { MAPS } from '../../data/maps';
import { MODES } from '../../data/modes';
import { passLevelFor, passLevelProgress } from '../../data/seasonPass';
import { tierForTrophies, tierLabel } from '../../game/rank';
import { CHALLENGE_DAILY_GAMES } from '../../game/rewards';
import { LobbyStage } from '../../scene/preview/LobbyStage';
import { useChallengeToday, useProfileStore } from '../../store/profileStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useUIStore } from '../../store/uiStore';
import { FaceIcon } from '../components/FaceIcon';

/**
 * 시작 페이지 (스크롤 없는 한 화면)
 *  ┌ 프로필·티어·트로피(좌상단) ─────── 골드·설정 ┐
 *  ├ 클래식 도전 칩 ─────────────── 로열 패스 ┤
 *  │  랭크 맵 무대 + 받침대 위 내 캐릭터 (누르면 꾸미기) │
 *  ├ [모드] [      전투!      ] [?] ┤
 *  └ 하단 탭 (App) ┘
 */
export function LobbyScreen() {
  const appearance = useProfileStore((s) => s.appearance);
  const nickname = useProfileStore((s) => s.nickname);
  const gold = useProfileStore((s) => s.gold);
  const trophies = useProfileStore((s) => s.trophies);
  const stats = useProfileStore((s) => s.stats);
  const passXp = useProfileStore((s) => s.pass.xp);
  const challenge = useChallengeToday();
  const prefs = useSettingsStore((s) => s.modePrefs);
  const setPrefs = useSettingsStore((s) => s.setModePrefs);
  const ui = useUIStore();
  const [wiggle, setWiggle] = useState(0);

  const tier = tierForTrophies(trophies);
  const def = MODES[prefs.mode];
  const sub =
    prefs.mode === 'ranked'
      ? prefs.queue === 'duo'
        ? '듀오 · 2:2 릴레이'
        : '솔로 · 1:1'
      : prefs.mode === 'flex'
        ? `${Math.max(1, Math.min(3, prefs.partySize))}인 파티`
        : prefs.mode === 'challenge'
          ? `오늘 ${challenge.played}/${CHALLENGE_DAILY_GAMES}판`
          : MAPS[prefs.localMap].name;

  return (
    <div className="flex h-full flex-col overflow-hidden text-[#2a1f00]" style={{ background: 'linear-gradient(180deg, #ffe36e 0%, #ffd23f 52%, #ffbf2a 100%)' }}>
      <header className="flex items-start gap-2 px-4 pt-[max(10px,env(safe-area-inset-top))]">
        <button
          onClick={() => ui.go('road')}
          className="flex min-w-0 items-center gap-2 rounded-2xl bg-white/60 p-1.5 pr-3 text-left shadow-[0_3px_0_rgba(90,60,0,0.25)] active:translate-y-[2px]"
          title="트로피 로드 보기"
        >
          <FaceIcon appearance={appearance} size={46} className="shrink-0" />
          <span className="min-w-0">
            <span className="font-display flex flex-wrap items-center gap-x-1.5 text-sm leading-tight">
              <span className="rounded-full px-2 py-0.5 text-white" style={{ background: tier.color }}>
                {tier.emoji} {tierLabel(trophies)}
              </span>
              <span>🏆 {trophies}</span>
            </span>
            <span className="font-display block truncate text-base leading-tight">{nickname}</span>
            <span className="block text-[11px] text-[#6b5512]">
              {stats.wins}승 {stats.losses}패 {stats.draws}무 · 최고 {stats.bestStreak}연승
            </span>
          </span>
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="font-display rounded-full bg-[#2a2350] px-3 py-1.5 text-sm text-[#ffd76a]">🪙 {gold.toLocaleString()}</span>
          <button onClick={() => ui.setSettingsOpen(true)} className="grid h-9 w-9 place-items-center rounded-full bg-[#2a2350] text-base" aria-label="설정">
            ⚙️
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between gap-2 px-4 pt-2">
        <button
          onClick={() => {
            setPrefs({ mode: 'challenge' });
            ui.setLoadoutOpen(true);
          }}
          className="font-display flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5 text-sm shadow-[0_3px_0_rgba(90,60,0,0.25)] active:translate-y-[2px]"
        >
          🎯 클래식 도전 <span className="rounded-full bg-[#ff6f91] px-2 text-white">{challenge.played}/{CHALLENGE_DAILY_GAMES}</span>
        </button>
        <button
          onClick={() => ui.go('pass')}
          className="font-display flex min-w-[132px] flex-col rounded-2xl bg-[#2a2350] px-3 py-1.5 text-left text-xs text-white shadow-[0_3px_0_#120e26] active:translate-y-[2px]"
        >
          <span>👑 로열 패스 Lv.{passLevelFor(passXp)}</span>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/20">
            <span className="block h-full rounded-full bg-[#ffd23f]" style={{ width: `${passLevelProgress(passXp) * 100}%` }} />
          </span>
        </button>
      </div>

      <section className="relative mx-4 mt-2 min-h-0 flex-1 overflow-hidden rounded-[28px] border-[3px] border-[#2a2350] bg-[#2a2350] shadow-[0_5px_0_#2a2350]">
        <LobbyStage appearance={appearance} mapId={tier.mapId} wiggleKey={wiggle} onTap={() => ui.go('customize')} />
        {/* 제목이 맵 배경(칠판 글씨 등)에 묻히지 않도록 위쪽만 살짝 어둡게 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#1b1633]/70 via-[#1b1633]/30 to-transparent sm:h-32" />
        <div className="pointer-events-none absolute inset-x-0 top-2 px-2 text-center">
          <h1 className="font-display text-outline text-[30px] leading-none text-[#fff3c4] sm:text-5xl">
            공부는 <span className="text-[#ff8fb0]">엉덩이</span> 싸움
          </h1>
          <p className="font-display text-outline-sm mt-0.5 text-sm text-white sm:text-lg">3초 심리전 1:1 엉덩이 배틀</p>
        </div>
        <div className="font-display pointer-events-none absolute bottom-2 left-2 rounded-full bg-[#1b1633]/80 px-3 py-1 text-xs text-white">
          {tier.emoji} {tier.name} 무대 · {MAPS[tier.mapId].name}
        </div>
        <div className="font-display pointer-events-none absolute top-[76px] right-2 rounded-full bg-white/85 px-2.5 py-1 text-[11px] text-[#2a2350] sm:top-24">
          👆 캐릭터를 누르면 꾸미기
        </div>
        <button
          onClick={() => setWiggle((w) => w + 1)}
          className="font-display absolute right-2 bottom-2 rounded-full bg-[#ff6f91] px-3 py-1.5 text-sm text-white shadow-lg active:scale-95"
        >
          🍑 씰룩!
        </button>
      </section>

      <div className="flex items-stretch gap-2 px-4 py-3">
        <button
          onClick={() => ui.setModeSheetOpen(true)}
          className="font-display flex w-20 shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow-[0_5px_0_#120e26] active:translate-y-[3px] active:shadow-none"
          style={{ background: `linear-gradient(160deg, ${def.colors[0]}, ${def.colors[1]})` }}
        >
          <span className="text-2xl leading-none">{def.emoji}</span>
          <span className="mt-1 text-[11px]">모드 변경</span>
        </button>
        <button
          onClick={() => ui.setLoadoutOpen(true)}
          className="font-display flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-[#ff9a3d] to-[#ff5a6e] py-2.5 text-white shadow-[0_5px_0_#b8395c] active:translate-y-[3px] active:shadow-none"
        >
          <span className="text-outline-sm text-[34px] leading-none">전투!</span>
          <span className="mt-1 truncate text-xs text-white/95">
            {def.name} · {sub}
          </span>
        </button>
        <button
          onClick={() => ui.setHelpOpen(true)}
          className="font-display flex w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#2a2350] text-white shadow-[0_5px_0_#120e26] active:translate-y-[3px] active:shadow-none"
          aria-label="게임 방법"
        >
          <span className="text-xl">❓</span>
          <span className="text-[10px]">방법</span>
        </button>
      </div>
    </div>
  );
}
