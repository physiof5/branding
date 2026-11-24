import { sound } from '../../audio/SoundEngine';
import { PASS_LEVELS, PASS_XP_PER_LEVEL, passLevelFor, passLevelProgress, rewardEmoji, rewardLabel, type PassReward, type PassTrack } from '../../data/seasonPass';
import { SEASON } from '../../game/rank';
import { useProfileStore } from '../../store/profileStore';
import { useUIStore } from '../../store/uiStore';
import { Gold } from '../components/Bits';
import { Button } from '../components/Button';

function RewardCard({ level, track, reward }: { level: number; track: PassTrack; reward: PassReward | null }) {
  const xp = useProfileStore((s) => s.pass.xp);
  const premium = useProfileStore((s) => s.pass.premium);
  const claimed = useProfileStore((s) => s.pass.claimed[track].includes(level));
  const claim = useProfileStore((s) => s.claimPassReward);
  const toast = useUIStore((s) => s.showToast);
  const reached = passLevelFor(xp) >= level;
  const locked = track === 'premium' && !premium;
  const gold = track === 'premium';

  if (!reward) return <div className="h-[118px] rounded-2xl border-2 border-dashed border-white/10" />;
  const canClaim = reached && !locked && !claimed;
  const big = reward.kind === 'costume' || reward.kind === 'effect';
  return (
    <div
      className={`relative flex h-[118px] flex-col items-center justify-between rounded-2xl border-2 p-2 text-center ${
        gold ? 'border-[#ffc542]/70 bg-gradient-to-b from-[#ffc542]/20 to-[#ff6f91]/10' : 'border-white/15 bg-white/7'
      } ${!reached ? 'opacity-55' : ''} ${canClaim ? 'ring-2 ring-emerald-300' : ''}`}
    >
      <div className={big ? 'text-3xl' : 'text-2xl'}>{rewardEmoji(reward)}</div>
      <div className="font-display text-[13px] leading-tight">{rewardLabel(reward)}</div>
      {claimed ? (
        <div className="font-display text-xs text-emerald-300">✔ 받음</div>
      ) : canClaim ? (
        <button
          className="font-display rounded-full bg-emerald-400 px-3 py-0.5 text-xs text-emerald-950"
          onClick={() => {
            const r = claim(track, level);
            if (r) {
              sound.play('claim');
              toast(`${rewardEmoji(r)} ${rewardLabel(r)} 획득!`);
            }
          }}
        >
          받기
        </button>
      ) : (
        <div className="text-[11px] text-white/50">{locked ? '🔒 프리미엄' : `Lv.${level}`}</div>
      )}
    </div>
  );
}

export function PassScreen() {
  const pass = useProfileStore((s) => s.pass);
  const gold = useProfileStore((s) => s.gold);
  const unlock = useProfileStore((s) => s.unlockPremium);
  const claim = useProfileStore((s) => s.claimPassReward);
  const go = useUIStore((s) => s.go);
  const toast = useUIStore((s) => s.showToast);
  const lvl = passLevelFor(pass.xp);

  const claimAll = () => {
    let n = 0;
    for (const l of PASS_LEVELS) {
      if (claim('free', l.level)) n++;
      if (claim('premium', l.level)) n++;
    }
    if (n) {
      sound.play('claim');
      toast(`보상 ${n}개를 받았어요!`);
    } else toast('받을 수 있는 보상이 없어요');
  };

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,#4a3270_0%,#1b1633_60%)]">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <Button variant="ghost" className="px-3 py-2 text-base" onClick={() => go('lobby')}>
          ← 로비
        </Button>
        <h1 className="font-display flex-1 text-2xl">👑 로열 패스</h1>
        <Gold value={gold} />
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-4 pb-10">
        <div className="grid gap-3 rounded-3xl bg-white/7 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="font-display text-xl">
              {SEASON.name} <span className="text-sm text-white/60">~{SEASON.endsAt}</span>
            </div>
            <div className="font-display mt-1 text-3xl">Lv.{lvl}</div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-black/40">
              <div className="h-full rounded-full bg-gradient-to-r from-[#ffc542] to-[#ff6f91]" style={{ width: `${passLevelProgress(pass.xp) * 100}%` }} />
            </div>
            <div className="mt-1 text-xs text-white/60">
              {lvl >= PASS_LEVELS.length ? '최종 레벨 달성!' : `다음 레벨까지 ${PASS_XP_PER_LEVEL - (pass.xp % PASS_XP_PER_LEVEL)} XP`} · 랭크전 승리 +120 / 무승부 +70 / 패배 +50
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {pass.premium ? (
              <div className="font-display rounded-2xl bg-gradient-to-r from-[#ffc542] to-[#ff6f91] px-4 py-3 text-center text-[#2a1600]">👑 프리미엄 활성화</div>
            ) : (
              <Button
                variant="gold"
                onClick={() => {
                  unlock();
                  sound.play('claim');
                  toast('👑 프리미엄 로열 패스 해금! (데모)');
                }}
              >
                💎 프리미엄 업그레이드
                <span className="block text-xs opacity-80">데모: 결제 연동 전 무료 해금</span>
              </Button>
            )}
            <Button variant="green" className="py-2 text-base" onClick={claimAll} silent>
              🎁 모두 받기
            </Button>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-3" style={{ scrollSnapType: 'x proximity', scrollPaddingLeft: 72 }}>
          <div className="sticky left-0 z-10 flex w-16 shrink-0 flex-col gap-2 bg-[#1f1940]/95 pt-7 text-center">
            <div className="font-display grid h-[118px] place-items-center rounded-2xl bg-white/7 text-sm">무료</div>
            <div className="font-display grid h-[118px] place-items-center rounded-2xl bg-[#ffc542]/25 text-sm text-[#ffd76a]">
              프리미엄
            </div>
          </div>
          {PASS_LEVELS.map((l) => (
            <div key={l.level} className="flex w-[104px] shrink-0 flex-col gap-2" style={{ scrollSnapAlign: 'start' }}>
              <div className={`font-display h-5 text-center text-sm ${lvl >= l.level ? 'text-[#ffd76a]' : 'text-white/50'}`}>Lv.{l.level}</div>
              <RewardCard level={l.level} track="free" reward={l.free} />
              <RewardCard level={l.level} track="premium" reward={l.premium} />
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-white/50">전용 코스튬 · 오라 이펙트 · 골드 · 아이템 보상 — 모든 보상은 외형/소모품이며 기본 능력치는 동일해요</p>
      </main>
    </div>
  );
}
