import { useEffect, useRef, useState } from 'react';
import { ITEMS } from '../../data/items';
import { MAPS } from '../../data/maps';
import { OVERTIME_TURN, POWER_STACKS, SPECIAL_STACKS, TIMING } from '../../game/constants';
import { describeTurn, type HeadlineTone } from '../../game/describe';
import { attackPreview } from '../../game/rules';
import type { ChosenAction, PlayerIndex } from '../../game/types';
import { PLAYER_COLORS } from '../../scene/layout';
import { stacksHiddenFor } from '../../scene/effects/FighterFx';
import { battleEvents, teamRemaining, useBattleStore } from '../../store/battleStore';
import { FaceIcon } from '../components/FaceIcon';
import { WorldLabels } from './WorldLabels';

const hpColor = (hp: number) => (hp > 60 ? '#3ccf8e' : hp > 30 ? '#ffc542' : '#ff4d5e');

function StackPips({ index }: { index: PlayerIndex }) {
  const hidden = useBattleStore((s) => stacksHiddenFor(s, index));
  // 먹물에 맞은 쪽 눈에는 상대 게이지가 먹물 맞을 때 값에서 멈춰 보인다
  const stacks = useBattleStore((s) => (stacksHiddenFor(s, index) ? s.fighters[index === 0 ? 1 : 0].inkSeen : s.fighters[index].stacks));
  const right = index === 1;
  return (
    <div className={`relative mt-1 flex items-center gap-1 ${right ? 'flex-row-reverse' : ''}`}>
      <div className={`flex gap-[2px] sm:gap-[3px] ${right ? 'flex-row-reverse' : ''}`}>
        {Array.from({ length: SPECIAL_STACKS }, (_, k) => {
          const on = k < stacks;
          const special = stacks >= SPECIAL_STACKS;
          const bg = !on ? 'rgba(0,0,0,0.45)' : special ? '#fff1a8' : stacks >= POWER_STACKS ? '#ff8a3d' : '#ffc542';
          return (
            <span
              key={k}
              className={`block h-2 w-2 rotate-45 rounded-[2px] border border-[#1b1633] sm:h-3.5 sm:w-3.5 sm:rounded-[3px] ${k === 2 || k === 9 ? 'outline outline-1 outline-white/60' : ''}`}
              style={{ background: bg, boxShadow: on && special && !hidden ? '0 0 8px #ffe66b' : undefined }}
            />
          );
        })}
      </div>
      <span className="font-display ml-1 text-xs whitespace-nowrap text-white/85 sm:text-sm">
        {hidden ? (
          <span className="text-[#c9b8ff]">??</span>
        ) : stacks >= SPECIAL_STACKS ? (
          <span className="text-[#fff1a8]">필살!</span>
        ) : stacks >= POWER_STACKS ? (
          <span className="text-[#ffb27a]">
            {stacks}
            <span className="hidden sm:inline"> · 강력</span>
          </span>
        ) : (
          <>
            <span className="hidden sm:inline">기 </span>
            {stacks}
          </>
        )}
      </span>
      {hidden && (
        <div className="pointer-events-none absolute -inset-1 flex items-center justify-center rounded-md bg-[#14101f]/75" title="먹물 때문에 상대 기가 안 보여요">
          <span className="font-display text-xs text-[#c9b8ff] sm:text-sm">🦑 먹물! 기 안 보임</span>
        </div>
      )}
    </div>
  );
}

/** 팀전: 남은 주자 표시 */
function TeamDots({ index }: { index: PlayerIndex }) {
  const size = useBattleStore((s) => s.config?.teams[index].length ?? 1);
  const out = useBattleStore((s) => s.eliminated[index]);
  if (size <= 1) return null;
  return (
    <div className={`mt-1 flex gap-1 ${index === 1 ? 'justify-end' : ''}`} aria-label={`남은 주자 ${size - out}명`}>
      {Array.from({ length: size }, (_, k) => (
        <span
          key={k}
          className={`grid h-4 w-4 place-items-center rounded-full border border-[#1b1633] text-[9px] ${k < out ? 'bg-black/50 text-white/60' : 'bg-white text-[#1b1633]'}`}
        >
          {k < out ? '✕' : k + 1}
        </span>
      ))}
    </div>
  );
}

function FighterPanel({ index }: { index: PlayerIndex }) {
  const name = useBattleStore((s) => s.fighters[index].name);
  const appearance = useBattleStore((s) => s.fighters[index].appearance);
  const hp = useBattleStore((s) => s.fighters[index].hp);
  const shield = useBattleStore((s) => s.fighters[index].shield);
  const inked = useBattleStore((s) => s.fighters[index].inkTurns > 0);
  const right = index === 1;
  const side = right ? { right: 0 } : { left: 0 };
  return (
    <div className={`flex min-w-0 flex-1 items-start gap-2 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <div className="relative shrink-0 rounded-full border-[3px] bg-white/15 p-0.5" style={{ borderColor: PLAYER_COLORS[index] }}>
        <FaceIcon appearance={appearance} size={46} flip={right} />
        {shield && <span className="absolute -right-1 -bottom-1 text-lg drop-shadow">🛡️</span>}
        {inked && <span className="absolute -top-1 -left-1 text-lg" title="먹물에 맞음">🦑</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`font-display flex items-center justify-between gap-2 text-sm sm:text-base ${right ? 'flex-row-reverse' : ''}`}>
          <span className="truncate text-outline-sm">{name}</span>
          <span className="tabular-nums text-outline-sm">{hp}</span>
        </div>
        <div className="relative h-4 overflow-hidden rounded-full border-2 border-[#1b1633] bg-black/55 sm:h-5">
          <div className="absolute inset-y-0 bg-white/80 transition-[width] delay-300 duration-700 ease-out" style={{ ...side, width: `${hp}%` }} />
          <div className="absolute inset-y-0 transition-[width,background] duration-150" style={{ ...side, width: `${hp}%`, background: hpColor(hp) }} />
        </div>
        <StackPips index={index} />
        <TeamDots index={index} />
      </div>
    </div>
  );
}

function TurnTimer() {
  const phase = useBattleStore((s) => s.phase);
  const turn = useBattleStore((s) => s.turn);
  const mode = useBattleStore((s) => s.config?.mode);
  // 남은 시간 (0.1초 단위). 야자 타임(1.5초)은 소수점까지 보여준다
  const tenths = useBattleStore((s) => {
    if (s.phase !== 'select') return null;
    const humans = ([0, 1] as const).filter((i) => s.fighters[i].controller === 'human' && s.choices[i] === null);
    if (!humans.length) return 0;
    return Math.max(0, Math.ceil((Math.max(...humans.map((i) => s.deadlines[i])) - s.clock) / 100));
  });
  const fast = useBattleStore((s) => Math.max(...s.turnDurations) < 2000);
  const secs = tenths === null ? null : Math.ceil(tenths / 10);
  const shown = tenths === null ? null : fast && tenths > 0 ? (tenths / 10).toFixed(1) : String(secs);
  const ring = useRef<SVGCircleElement>(null);
  const R = 30;
  const C = 2 * Math.PI * R;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = useBattleStore.getState();
      if (ring.current) {
        let k = 0;
        if (s.phase === 'select') {
          const i: PlayerIndex = s.config?.mode === 'local' ? (s.deadlines[0] >= s.deadlines[1] ? 0 : 1) : 0;
          k = Math.min(1, Math.max(0, (s.deadlines[i] - s.clock) / s.turnDurations[i]));
        }
        ring.current.style.strokeDashoffset = String(C * (1 - k));
        ring.current.style.stroke = k < 0.34 ? '#ff4d5e' : k < 0.67 ? '#ffc542' : '#3ccf8e';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [C]);

  const label = phase === 'select' ? null : phase === 'reveal' ? '공개!' : phase === 'action' ? '퍽!' : phase === 'intro' ? 'READY' : '…';
  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="relative h-[74px] w-[74px] sm:h-[84px] sm:w-[84px]">
        <svg viewBox="0 0 72 72" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="36" cy="36" r={R} fill="rgba(27,22,51,0.85)" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
          <circle ref={ring} cx="36" cy="36" r={R} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} />
        </svg>
        <div
          key={`${turn}-${fast ? 'fast' : secs}`}
          className={`font-display absolute inset-0 grid place-items-center ${shown !== null ? `anim-pop ${fast ? 'text-3xl' : 'text-4xl'}` : 'text-lg'} ${secs === 1 ? 'text-[#ff4d5e]' : ''}`}
        >
          {shown !== null ? shown : label}
        </div>
      </div>
      <div className={`font-display -mt-1 rounded-full px-2.5 py-0.5 text-xs ${turn >= OVERTIME_TURN ? 'bg-[#5b2a86] text-[#ffe66b]' : 'bg-[#1b1633]/85'}`}>
        {turn >= OVERTIME_TURN ? '🌙 야자 · ' : mode === 'local' ? '친선전 · ' : ''}TURN {Math.max(1, turn)}/{TIMING.maxTurns}
      </div>
    </div>
  );
}

const TONE_CLASS: Record<HeadlineTone, string> = {
  neutral: 'text-white',
  good: 'text-[#7dffb6]',
  bad: 'text-[#ff8a95]',
  epic: 'text-[#ffe66b]',
};

interface Announcement {
  key: number;
  text: string;
  sub?: string;
  tone: HeadlineTone;
  big?: boolean;
}

function Announcer() {
  const [a, setA] = useState<Announcement | null>(null);
  useEffect(() => {
    let seq = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (ann: Omit<Announcement, 'key'>, ms = 1300) => {
      setA({ ...ann, key: ++seq });
      clearTimeout(timer);
      timer = setTimeout(() => setA(null), ms);
    };
    const off = battleEvents.on((e) => {
      const s = useBattleStore.getState();
      if (e.type === 'phase' && e.phase === 'intro' && s.config) {
        show({ text: 'READY?', sub: MAPS[s.config.mapId].name, tone: 'neutral', big: true }, 2200);
      }
      if (e.type === 'phase' && e.phase === 'select' && e.turn === 1) show({ text: '엉덩이 싸움 시작!', tone: 'epic', big: true }, 1000);
      if (e.type === 'overtime' && e.first) show({ text: '🌙 야자 타임!', sub: '이제 매 턴 기 +1 — 필살기를 조심해!', tone: 'epic', big: true }, 1800);
      if (e.type === 'impact') {
        const me = s.config?.mode === 'ai' ? 0 : null;
        const d = describeTurn(e.result, [s.fighters[0].name, s.fighters[1].name], me);
        show({ text: d.headline, tone: d.tone, big: e.result.kind === 'special' }, 1250);
      }
      if (e.type === 'phase' && e.phase === 'ko') {
        show({ text: s.finishReason === 'timeover' ? 'TIME OVER' : 'K.O.!!', tone: 'epic', big: true }, 2400);
      }
      if (e.type === 'item') {
        const who = s.fighters[e.player].name;
        const sub = e.item === 'jam' ? `${s.fighters[e.player === 0 ? 1 : 0].name}: 상대 기가 안 보여요!` : undefined;
        show({ text: `${who} ${ITEMS[e.item].emoji} ${ITEMS[e.item].name}!`, sub, tone: 'neutral' }, 1200);
      }
      if (e.type === 'swap') {
        const names = ([0, 1] as const).filter((i) => e.sides[i]).map((i) => `${s.fighters[i].member + 1}번 주자 ${s.fighters[i].name}`);
        show({ text: '다음 주자 등장!', sub: names.join(' · '), tone: 'epic', big: true }, 1700);
      }
      if (e.type === 'start' || e.type === 'exit') setA(null);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);
  if (!a) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[28%] flex flex-col items-center px-4 text-center">
      <div key={a.key} className={`anim-pop font-display text-outline leading-none ${TONE_CLASS[a.tone]} ${a.big ? 'text-5xl sm:text-7xl' : 'text-3xl sm:text-5xl'}`}>
        {a.text}
      </div>
      {a.sub && (
        <div key={`s${a.key}`} className="anim-pop font-display text-outline-sm mt-2 text-lg text-white/90 sm:text-2xl">
          {a.sub}
        </div>
      )}
    </div>
  );
}

const ACTIONS: { action: ChosenAction; emoji: string; label: string; cls: string }[] = [
  { action: 'charge', emoji: '🔥', label: '기 모으기', cls: 'bg-[#ffc542] text-[#3b2600] shadow-[0_5px_0_#c48a00]' },
  { action: 'dodge', emoji: '💨', label: '피하기', cls: 'bg-[#4da3ff] text-white shadow-[0_5px_0_#2563b8]' },
  { action: 'attack', emoji: '🍑', label: '공격', cls: 'bg-[#ff6f91] text-white shadow-[0_5px_0_#b8395c]' },
];

export function ActionPad({ player, hidden, keys, compact = false }: { player: PlayerIndex; hidden: boolean; keys: [string, string, string]; compact?: boolean }) {
  const phase = useBattleStore((s) => s.phase);
  const choice = useBattleStore((s) => s.choices[player]);
  const stacks = useBattleStore((s) => s.fighters[player].stacks);
  const paused = useBattleStore((s) => s.paused);
  const timedOut = useBattleStore((s) => s.timedOut[player]);
  const enabled = phase === 'select' && choice === null && !paused;
  const atk = attackPreview(stacks);
  const locked = phase === 'select' && choice !== null;

  return (
    <div className="relative">
      <div className={`grid grid-cols-3 gap-2 ${compact ? 'sm:gap-2' : 'sm:gap-3'}`}>
        {ACTIONS.map((b, k) => {
          let label = b.label;
          let sub = '';
          let extra = '';
          if (b.action === 'attack') {
            if (atk.tier === 'special') {
              label = '필살기!!';
              sub = '100 · 회피 불가';
              extra = 'ring-4 ring-[#fff1a8] animate-pulse !bg-[#ffd84a] !text-[#7a1d00]';
            } else if (atk.tier === 'power') {
              label = '강력 공격';
              sub = '50 · 기-3';
              extra = 'ring-2 ring-[#ffb27a] !bg-[#ff7a3d]';
            } else sub = '10';
          } else if (b.action === 'charge') sub = '기 +1';
          else sub = '회피';
          const chosen = !hidden && choice === b.action && (phase === 'select' || phase === 'reveal');
          return (
            <button
              key={b.action}
              disabled={!enabled}
              onClick={() => useBattleStore.getState().choose(player, b.action)}
              className={`font-display relative flex flex-col items-center justify-center rounded-2xl px-1 leading-tight transition-transform active:translate-y-[3px] active:shadow-none disabled:opacity-45 ${compact ? 'h-16 text-sm sm:h-20 sm:text-base' : 'h-20 text-base sm:h-24 sm:text-xl'} ${b.cls} ${extra} ${chosen ? 'scale-105 !opacity-100 outline-4 outline-white' : ''}`}
            >
              <span className={compact ? 'text-xl' : 'text-2xl sm:text-3xl'}>{b.emoji}</span>
              <span>{label}</span>
              <span className="text-[11px] opacity-80 sm:text-xs">{sub}</span>
              <span className="absolute top-1 right-2 hidden rounded bg-black/25 px-1 text-[10px] sm:block">{keys[k]}</span>
            </button>
          );
        })}
      </div>
      {locked && hidden && (
        <div className="font-display anim-pop absolute inset-0 grid place-items-center rounded-2xl bg-[#1b1633]/80 text-xl text-emerald-300">
          {timedOut ? '💤 시간 초과' : '✔ 선택 완료 (비밀!)'}
        </div>
      )}
    </div>
  );
}

function ItemButton({ item, hotkey }: { item: 'shield' | 'jam'; hotkey: string }) {
  const count = useBattleStore((s) => s.fighters[0].items[item]);
  const phase = useBattleStore((s) => s.phase);
  const usedThisTurn = useBattleStore((s) => s.itemUsedThisTurn[0]);
  const shieldOn = useBattleStore((s) => s.fighters[0].shield);
  const def = ITEMS[item];
  const disabled = count <= 0 || phase !== 'select' || usedThisTurn !== null || (item === 'shield' && shieldOn);
  return (
    <button
      disabled={disabled}
      onClick={() => useBattleStore.getState().useItem(0, item)}
      title={def.description}
      className="font-display flex items-center gap-1 rounded-full border-2 border-white/20 bg-[#2a2350]/90 px-3 py-1.5 text-sm transition active:scale-95 disabled:opacity-35"
    >
      <span className="text-lg">{def.emoji}</span>
      {def.name} <span className="rounded-full bg-black/30 px-1.5 text-xs tabular-nums">×{count}</span>
      <span className="hidden text-[10px] text-white/60 sm:inline">({hotkey})</span>
    </button>
  );
}

export function ItemBar() {
  return (
    <div className="flex justify-center gap-2">
      <ItemButton item="shield" hotkey="Q" />
      <ItemButton item="jam" hotkey="E" />
    </div>
  );
}

/** 섬광 / 피격 비네트 / 먹물 */
function ScreenFx() {
  const [flash, setFlash] = useState<{ key: number; color: string } | null>(null);
  const [hurt, setHurt] = useState(0);
  const mode = useBattleStore((s) => s.config?.mode);
  const inkSide = useBattleStore((s) => {
    if (s.phase !== 'select') return null;
    const j0 = s.fighters[0].inkTurns > 0 && s.fighters[0].controller === 'human';
    const j1 = s.fighters[1].inkTurns > 0 && s.fighters[1].controller === 'human';
    return j0 && j1 ? 'both' : j0 ? 'p1' : j1 ? 'p2' : null;
  });
  useEffect(() => {
    let k = 0;
    return battleEvents.on((e) => {
      if (e.type !== 'impact') return;
      const r = e.result;
      if (r.kind === 'special' || (r.kind === 'clash' && r.topTier === 'special')) setFlash({ key: ++k, color: '#ffffff' });
      else if (r.ko[0] || r.ko[1]) setFlash({ key: ++k, color: '#fff6d6' });
      const s = useBattleStore.getState();
      if (s.config?.mode === 'ai' && r.outcomes[0].damageTaken > 0) setHurt((h) => h + 1);
    });
  }, []);
  const inkStyle = inkSide === 'p1' && mode === 'local' ? 'right-1/2' : inkSide === 'p2' ? 'left-1/2' : '';
  return (
    <>
      {flash && <div key={flash.key} className="anim-flash pointer-events-none absolute inset-0" style={{ background: flash.color }} />}
      {hurt > 0 && (
        <div
          key={`h${hurt}`}
          className="anim-flash pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(255,30,60,0.55) 100%)' }}
        />
      )}
      {inkSide && (
        <div className={`pointer-events-none absolute inset-0 overflow-hidden ${inkStyle}`}>
          {[
            [8, 26, 34],
            [92, 30, 30],
            [20, 62, 26],
            [84, 68, 28],
            [50, 14, 22],
          ].map(([x, y, s], k) => (
            <svg
              key={k}
              viewBox="0 0 100 100"
              className="absolute"
              style={{ left: `${x}%`, top: `${y}%`, width: `${s}vmin`, height: `${s}vmin`, transform: 'translate(-50%,-50%)', animation: `ink-splat 0.4s ${k * 60}ms ease-out both` }}
            >
              <path
                d="M50 8 C62 10 66 24 78 22 C92 20 96 38 86 48 C78 56 94 66 84 78 C74 90 60 80 52 92 C42 100 34 86 24 86 C10 86 6 70 14 60 C20 52 4 44 12 32 C20 20 34 26 38 16 C42 8 46 8 50 8 Z"
                fill="#14101f"
                opacity="0.85"
              />
            </svg>
          ))}
          <div className="font-display text-outline absolute inset-x-0 top-[38%] text-center text-2xl text-[#d9ccff] sm:text-3xl">🦑 먹물! 상대 기가 안 보여요</div>
        </div>
      )}
    </>
  );
}

/** 팀0 현재 주자가 누구인가 (나 / 같은 기기 친구 / AI 파트너) */
function useActiveSeat(): 'me' | 'friend' | 'ai' {
  return useBattleStore((s) => {
    const f = s.fighters[0];
    if (f.controller === 'ai') return 'ai';
    return f.member === 0 ? 'me' : 'friend';
  });
}

function SeatBanner() {
  const seat = useActiveSeat();
  const name = useBattleStore((s) => s.fighters[0].name);
  if (seat === 'me') return null;
  return (
    <div className="font-display mx-auto mb-1 w-fit rounded-full bg-[#1b1633]/85 px-4 py-1 text-sm text-[#ffe66b]">
      {seat === 'ai' ? `🤖 ${name} 출전 중 — 응원해 주세요!` : `👥 ${name} 차례! 기기를 넘겨주세요`}
    </div>
  );
}

export function BattleHud({ onPause }: { onPause: () => void }) {
  const mode = useBattleStore((s) => s.config?.mode);
  const phase = useBattleStore((s) => s.phase);
  const seat = useActiveSeat();
  const remaining = useBattleStore((s) => teamRemaining(s, 0));
  const showPads = phase !== 'finished' && phase !== 'ko' && phase !== 'swap';
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <WorldLabels />
      <ScreenFx />
      <div className="pointer-events-auto px-4 pt-[max(8px,env(safe-area-inset-top))]">
        <div className="flex items-start gap-2 sm:gap-4">
          <FighterPanel index={0} />
          <TurnTimer />
          <FighterPanel index={1} />
        </div>
      </div>
      <button
        onClick={onPause}
        className="pointer-events-auto absolute top-[calc(max(8px,env(safe-area-inset-top))+92px)] right-4 grid h-10 w-10 place-items-center rounded-full bg-[#1b1633]/80 text-lg"
        aria-label="일시정지"
      >
        ⏸
      </button>
      <Announcer />
      <div className="flex-1" />
      {showPads && (
        <div className="pointer-events-auto px-4 pb-[max(10px,env(safe-area-inset-bottom))]">
          {mode === 'ai' ? (
            <div className="mx-auto flex max-w-xl flex-col gap-2">
              <SeatBanner />
              {seat === 'me' && <ItemBar />}
              {seat !== 'ai' && <ActionPad player={0} hidden={false} keys={['A', 'S', 'D']} />}
              {seat === 'ai' && remaining > 0 && <div className="h-2" />}
            </div>
          ) : (
            <div className="flex items-end justify-between gap-3">
              <div className="w-full max-w-sm">
                <div className="font-display mb-1 text-sm" style={{ color: PLAYER_COLORS[0] }}>
                  1P (A · S · D)
                </div>
                <ActionPad player={0} hidden keys={['A', 'S', 'D']} compact />
              </div>
              <div className="w-full max-w-sm">
                <div className="font-display mb-1 text-right text-sm" style={{ color: PLAYER_COLORS[1] }}>
                  2P (J · K · L)
                </div>
                <ActionPad player={1} hidden keys={['J', 'K', 'L']} compact />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
