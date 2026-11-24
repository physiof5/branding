import { Fragment, useEffect, useRef } from 'react';
import { sound } from '../../audio/SoundEngine';
import { MAPS } from '../../data/maps';
import { rewardEmoji, rewardLabel } from '../../data/seasonPass';
import { TROPHY_ROAD } from '../../data/trophyRoad';
import { TIERS, tierLabel } from '../../game/rank';
import { useProfileStore } from '../../store/profileStore';
import { useUIStore } from '../../store/uiStore';

const AI_LABEL = ['새내기 AI', '눈치 AI', '전략 AI', '마스터 AI'];

/** 트로피 로드: 티어(I/II 단계)·무대·50 트로피마다 보상 — 위로 갈수록 높은 티어 */
export function TrophyRoadScreen() {
  const trophies = useProfileStore((s) => s.trophies);
  const best = useProfileStore((s) => s.bestTrophies);
  const flex = useProfileStore((s) => s.flexTrophies);
  const claimed = useProfileStore((s) => s.roadClaimed);
  const claim = useProfileStore((s) => s.claimRoadReward);
  const toast = useUIStore((s) => s.showToast);
  const here = useRef<HTMLDivElement>(null);

  useEffect(() => {
    here.current?.scrollIntoView({ block: 'center' });
  }, []);

  // 높은 값부터: 티어 헤더 + 보상 단계 + 현재 위치 표시
  const top = Math.max(1050, ...TROPHY_ROAD.map((r) => r.trophies));
  const values = new Set<number>([...TROPHY_ROAD.map((r) => r.trophies), ...TIERS.map((t) => t.min)]);
  const rows = [...values].filter((v) => v <= top).sort((a, b) => b - a);
  const markerAfter = rows.find((v) => v <= trophies);

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,#4a3a8a_0%,#1b1633_60%)] pb-6">
      <header className="sticky top-0 z-10 bg-[#1f1940]/95 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <h1 className="font-display text-2xl">🏆 트로피 로드</h1>
        <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-white/8 px-3 py-2">
            <div className="text-xs text-white/60">클래식 랭크 (솔로/듀오)</div>
            <div className="font-display">
              {tierLabel(trophies)} · 🏆 {trophies}
            </div>
          </div>
          <div className="rounded-2xl bg-white/8 px-3 py-2">
            <div className="text-xs text-white/60">자유 랭크 (1~3인)</div>
            <div className="font-display">
              {tierLabel(flex)} · 🏆 {flex}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 pt-3">
        {rows.map((v) => {
          const tier = TIERS.find((t) => t.min === v);
          const step = TROPHY_ROAD.find((r) => r.trophies === v);
          const reached = best >= v;
          const got = claimed.includes(v);
          return (
            <Fragment key={v}>
              {tier && (
                <div className="my-3 overflow-hidden rounded-3xl border-2 border-white/15" style={{ background: `linear-gradient(120deg, ${tier.color}, #2a2350)` }}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="text-4xl">{tier.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-xl leading-tight text-white drop-shadow">
                        {tier.name} I · {tier.min}+
                      </div>
                      <div className="text-xs text-white/90">
                        새 무대: {MAPS[tier.mapId].name} · 상대 {AI_LABEL[tier.aiLevel]}
                      </div>
                    </div>
                    {trophies >= tier.min && <span className="font-display rounded-full bg-white/85 px-2 py-0.5 text-xs text-[#2a2350]">도달</span>}
                  </div>
                </div>
              )}
              {step && (
                <div className={`flex items-center gap-3 py-1.5 ${reached ? '' : 'opacity-55'}`}>
                  <div className="font-display w-14 shrink-0 text-right text-sm text-[#ffd76a]">{v}</div>
                  <div className={`h-12 w-1.5 shrink-0 rounded-full ${reached ? 'bg-[#ffd23f]' : 'bg-white/15'}`} />
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white/8 px-3 py-2">
                    <span className="text-2xl">{rewardEmoji(step.reward)}</span>
                    <span className="font-display min-w-0 flex-1 truncate">{rewardLabel(step.reward)}</span>
                    {got ? (
                      <span className="font-display text-xs text-emerald-300">✔ 받음</span>
                    ) : reached ? (
                      <button
                        className="font-display rounded-full bg-emerald-400 px-3 py-1 text-xs text-emerald-950"
                        onClick={() => {
                          const r = claim(v);
                          if (r) {
                            sound.play('claim');
                            toast(`${rewardEmoji(r)} ${rewardLabel(r)} 획득!`);
                          }
                        }}
                      >
                        받기
                      </button>
                    ) : (
                      <span className="text-xs text-white/50">🔒</span>
                    )}
                  </div>
                </div>
              )}
              {markerAfter === v && (
                <div ref={here} className="font-display my-2 flex items-center gap-2 text-sm text-[#ff8fb0]">
                  <span className="h-0.5 flex-1 bg-[#ff8fb0]" />
                  지금 여기 · 🏆 {trophies}
                  <span className="h-0.5 flex-1 bg-[#ff8fb0]" />
                </div>
              )}
            </Fragment>
          );
        })}
        <p className="mt-4 text-center text-xs text-white/50">보상은 최고 기록(🏆 {best}) 기준으로 한 번씩 받을 수 있어요 · 티어마다 50% 지점에서 II 단계</p>
      </div>
    </div>
  );
}
