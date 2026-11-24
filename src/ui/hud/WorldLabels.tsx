import { useEffect, useRef, useState } from 'react';
import { ACTION_EMOJI, ACTION_LABEL, TIER_LABEL } from '../../game/describe';
import { attackTierFor } from '../../game/rules';
import type { PlayerIndex } from '../../game/types';
import { burstFor, type Burst } from '../../scene/effects/bursts';
import { baseXFor } from '../../scene/layout';
import { useFollowWorld } from '../../scene/screenSpace';
import { battleEvents, useBattleStore } from '../../store/battleStore';

const pill = 'font-display whitespace-nowrap rounded-full px-3 py-1 text-[15px] shadow-lg border-2 border-[#1b1633]';

/** 머리 위 말풍선: 생각 중 / 선택 완료(행동은 숨김) / 공개된 행동 */
function FighterBubble({ index }: { index: PlayerIndex }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = baseXFor(index);
  useFollowWorld(ref, () => [x, 2.6, 0]);
  const phase = useBattleStore((s) => s.phase);
  const turn = useBattleStore((s) => s.turn);
  const choice = useBattleStore((s) => s.choices[index]);
  const timedOut = useBattleStore((s) => s.timedOut[index]);
  const controller = useBattleStore((s) => s.fighters[index].controller);
  const jammed = useBattleStore((s) => s.fighters[index].jammed);
  const stacks = useBattleStore((s) => s.fighters[index].stacks);
  const resultTier = useBattleStore((s) => s.result?.outcomes[index].tier ?? null);

  let bubble: React.ReactNode = null;
  if (phase === 'select') {
    if (choice !== null) {
      bubble = timedOut ? (
        <div className={`${pill} bg-slate-300 text-slate-700`}>💤 시간 초과</div>
      ) : (
        <div className={`${pill} anim-pop bg-emerald-300 text-emerald-950`}>✔ 선택 완료</div>
      );
    } else if (controller === 'ai') {
      bubble = <div className={`${pill} anim-bob bg-white text-[#1b1633]`}>{jammed ? '🦑 앞이 안 보여!' : '🤔 …'}</div>;
    }
  } else if ((phase === 'reveal' || phase === 'action') && choice) {
    const tier = choice === 'attack' ? (resultTier ?? attackTierFor(stacks)) : null;
    const label = tier ? TIER_LABEL[tier] : ACTION_LABEL[choice];
    const color =
      choice === 'charge'
        ? 'bg-amber-300 text-amber-950'
        : choice === 'dodge'
          ? 'bg-sky-300 text-sky-950'
          : choice === 'attack'
            ? tier === 'special'
              ? 'bg-yellow-200 text-red-700 text-[19px]'
              : tier === 'power'
                ? 'bg-orange-500 text-white'
                : 'bg-rose-400 text-white'
            : 'bg-slate-300 text-slate-700';
    bubble = (
      <div key={`${turn}-${choice}`} className={`${pill} anim-pop ${color}`}>
        {ACTION_EMOJI[choice]} {label}
        {tier === 'power' ? '!' : tier === 'special' ? '!!!' : ''}
      </div>
    );
  }
  return (
    <div ref={ref} className="pointer-events-none absolute top-0 left-0" style={{ visibility: 'hidden' }}>
      <div className="-translate-x-1/2 -translate-y-1/2">{bubble}</div>
    </div>
  );
}

/** 데미지/회피/기+1 숫자 팝업 */
function DamagePops({ index }: { index: PlayerIndex }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = baseXFor(index);
  useFollowWorld(ref, () => [x, 1.95, 0.3]);
  const phase = useBattleStore((s) => s.phase);
  const turn = useBattleStore((s) => s.turn);
  const impactDone = useBattleStore((s) => s.impactDone);
  const o = useBattleStore((s) => s.result?.outcomes[index] ?? null);
  const show = impactDone && (phase === 'action' || phase === 'aftermath') && o;
  const pops: { text: string; cls: string; size: number }[] = [];
  if (show && o) {
    if (o.damageTaken > 0) pops.push({ text: `-${o.damageTaken}`, cls: 'text-[#ff4d4d]', size: o.damageTaken >= 100 ? 64 : o.damageTaken >= 50 ? 48 : 36 });
    if (o.dodgedAttack) pops.push({ text: '회피!', cls: 'text-sky-300', size: 32 });
    if (o.shieldBlocked) pops.push({ text: '막았다!', cls: 'text-cyan-300', size: 32 });
    if (o.shieldPierced) pops.push({ text: '방어막 관통!', cls: 'text-yellow-200', size: 24 });
    if (o.stackGained) pops.push({ text: '기 +1', cls: 'text-amber-300', size: 28 });
    if (o.hitWhileCharging) pops.push({ text: '무방비!', cls: 'text-slate-200', size: 18 });
  }
  return (
    <div ref={ref} className="pointer-events-none absolute top-0 left-0" style={{ visibility: 'hidden' }}>
      {pops.length > 0 && (
        <div key={turn} className="flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          {pops.map((p, k) => (
            <div key={k} className={`anim-float font-display text-outline whitespace-nowrap ${p.cls}`} style={{ fontSize: p.size, animationDelay: `${k * 90}ms` }}>
              {p.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComicText({ b }: { b: Burst }) {
  const ref = useRef<HTMLDivElement>(null);
  useFollowWorld(ref, () => b.pos);
  return (
    <div ref={ref} className="pointer-events-none absolute top-0 left-0" style={{ visibility: 'hidden' }}>
      <div className="anim-comic font-display text-outline absolute whitespace-nowrap" style={{ fontSize: `${Math.round(42 * Math.min(1.9, b.size))}px`, color: b.textColor }}>
        {b.text}
      </div>
    </div>
  );
}

/** 임팩트 의성어 (퍽! 콰앙!! 쿠콰콰쾅!!! 띠요옹~!) */
function ComicTexts() {
  const [list, setList] = useState<Burst[]>([]);
  useEffect(
    () =>
      battleEvents.on((e) => {
        if (e.type === 'impact') {
          const b = burstFor(e.result, Date.now());
          if (b?.text) setList((l) => [...l.filter((x) => Date.now() - x.start < 1200), b]);
        }
        if (e.type === 'start' || e.type === 'exit') setList([]);
      }),
    [],
  );
  return (
    <>
      {list.map((b) => (
        <ComicText key={b.id} b={b} />
      ))}
    </>
  );
}

/** 3D 공간에 붙어 다니는 HUD 라벨 레이어 */
export function WorldLabels() {
  const active = useBattleStore((s) => s.phase !== 'idle');
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {active && (
        <>
          <FighterBubble index={0} />
          <FighterBubble index={1} />
          <DamagePops index={0} />
          <DamagePops index={1} />
        </>
      )}
      <ComicTexts />
    </div>
  );
}
