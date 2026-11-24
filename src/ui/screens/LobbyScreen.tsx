import { useState } from 'react';
import { MAPS } from '../../data/maps';
import { passLevelFor, passLevelProgress, PASS_LEVELS } from '../../data/seasonPass';
import { SEASON, tierForTrophies } from '../../game/rank';
import { CharacterPreview } from '../../scene/preview/CharacterPreview';
import { startRankedBattle } from '../../store/matchmaking';
import { useProfileStore } from '../../store/profileStore';
import { useUIStore } from '../../store/uiStore';
import { Gold, TierBadge } from '../components/Bits';
import { Button } from '../components/Button';
import { LocalSetupModal } from '../components/LocalSetupModal';

const AI_LABEL = ['새내기 AI', '눈치 AI', '전략 AI', '마스터 AI'];

function Nickname() {
  const nickname = useProfileStore((s) => s.nickname);
  const setNickname = useProfileStore((s) => s.setNickname);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nickname);
  if (editing)
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNickname(draft);
          setEditing(false);
        }}
      >
        <input
          autoFocus
          value={draft}
          maxLength={12}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setNickname(draft);
            setEditing(false);
          }}
          className="font-display w-40 rounded-xl bg-white/15 px-2 py-1 text-lg outline-none"
        />
      </form>
    );
  return (
    <button
      className="font-display truncate text-lg"
      onClick={() => {
        setDraft(nickname);
        setEditing(true);
      }}
      title="닉네임 바꾸기"
    >
      {nickname} <span className="text-sm text-white/50">✎</span>
    </button>
  );
}

export function LobbyScreen() {
  const appearance = useProfileStore((s) => s.appearance);
  const gold = useProfileStore((s) => s.gold);
  const trophies = useProfileStore((s) => s.trophies);
  const stats = useProfileStore((s) => s.stats);
  const catalysts = useProfileStore((s) => s.inventory.catalyst);
  const useCatalyst = useProfileStore((s) => s.useCatalyst);
  const setUseCatalyst = useProfileStore((s) => s.setUseCatalyst);
  const pass = useProfileStore((s) => s.pass);
  const go = useUIStore((s) => s.go);
  const setHelpOpen = useUIStore((s) => s.setHelpOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const [localOpen, setLocalOpen] = useState(false);
  const [wiggle, setWiggle] = useState(0);

  const tier = tierForTrophies(trophies);
  const lvl = passLevelFor(pass.xp);
  const claimable = PASS_LEVELS.filter(
    (l) => l.level <= lvl && ((l.free && !pass.claimed.free.includes(l.level)) || (pass.premium && !pass.claimed.premium.includes(l.level))),
  ).length;

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,#3a2f78_0%,#1b1633_60%)]">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <Nickname />
          <div className="text-xs text-white/60">
            {stats.wins}승 {stats.losses}패 {stats.draws}무 · 최고 {stats.bestStreak}연승
          </div>
        </div>
        <Gold value={gold} />
        <button onClick={() => setSettingsOpen(true)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-lg" aria-label="설정">
          ⚙️
        </button>
      </header>

      <main className="mx-auto grid max-w-6xl gap-2 px-4 pb-8 md:grid-cols-[1.1fr_1fr] md:gap-8">
        <section className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 text-center">
            <h1 className="font-display text-outline text-[42px] leading-none text-[#ffe9f0] sm:text-6xl">
              공부는 <span className="text-[#ff8fb0]">엉덩이</span> 싸움
            </h1>
            <p className="font-display text-outline-sm mt-1 text-base text-white/90 sm:text-xl">3초 심리전 1:1 엉덩이 배틀</p>
          </div>
          <div className="h-[48dvh] min-h-[320px] pt-16 sm:pt-20 md:h-[72dvh] md:pt-16">
            <CharacterPreview appearance={appearance} wiggleKey={wiggle} />
          </div>
          <button
            onClick={() => setWiggle((w) => w + 1)}
            className="font-display absolute right-2 bottom-3 rounded-full bg-[#ff6f91]/90 px-3 py-1.5 text-sm shadow-lg active:scale-95"
          >
            🍑 씰룩!
          </button>
        </section>

        <section className="flex flex-col gap-3 md:justify-center">
          <div className="flex items-center justify-between gap-3 rounded-3xl bg-white/7 p-3">
            <TierBadge trophies={trophies} />
            <div className="text-right text-xs text-white/60">
              {SEASON.name}
              <br />~{SEASON.endsAt}
            </div>
          </div>

          <Button variant="primary" className="py-4 text-2xl" onClick={startRankedBattle}>
            🏆 AI 랭크전
            <span className="mt-1 block text-sm opacity-90">
              {MAPS[tier.mapId].name} · {AI_LABEL[tier.aiLevel]}
            </span>
          </Button>

          <label className={`flex items-center justify-between rounded-2xl bg-white/7 px-4 py-2.5 ${catalysts ? '' : 'opacity-50'}`}>
            <span className="font-display">⚡ 기폭제 자동 사용 (시작 시 기 +1)</span>
            <span className="flex items-center gap-2 text-sm text-white/70">
              보유 {catalysts}
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#ffc542]"
                disabled={!catalysts}
                checked={useCatalyst && catalysts > 0}
                onChange={(e) => setUseCatalyst(e.target.checked)}
              />
            </span>
          </label>

          <Button variant="blue" className="py-3.5 text-xl" onClick={() => setLocalOpen(true)}>
            👥 로컬 2인 대전
            <span className="mt-0.5 block text-sm opacity-90">한 기기에서 몰래 선택! (친선전)</span>
          </Button>

          <div className="grid grid-cols-3 gap-3">
            <Button variant="ghost" onClick={() => go('customize')}>
              👕
              <br />
              꾸미기
            </Button>
            <Button variant="ghost" onClick={() => go('shop')}>
              🛒
              <br />
              상점
            </Button>
            <Button variant="gold" className="relative" onClick={() => go('pass')}>
              👑
              <br />
              로열 패스
              {claimable > 0 && (
                <span className="absolute -top-2 -right-2 grid h-6 min-w-6 place-items-center rounded-full bg-[#ff4d5e] px-1 text-sm text-white">{claimable}</span>
              )}
            </Button>
          </div>

          <div className="rounded-2xl bg-white/7 px-4 py-2.5">
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-display">👑 로열 패스 Lv.{lvl}</span>
              <span className="text-white/60">{pass.premium ? '프리미엄' : '무료 트랙'}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/40">
              <div className="h-full rounded-full bg-gradient-to-r from-[#ffc542] to-[#ff6f91]" style={{ width: `${passLevelProgress(pass.xp) * 100}%` }} />
            </div>
          </div>

          <Button variant="dark" onClick={() => setHelpOpen(true)}>
            ❓ 게임 방법
          </Button>
        </section>
      </main>
      {localOpen && <LocalSetupModal onClose={() => setLocalOpen(false)} />}
    </div>
  );
}
