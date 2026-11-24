import { create } from 'zustand';
import { DEFAULT_APPEARANCE, type Appearance } from '../data/appearance';
import type { BattleItemId } from '../data/items';
import type { MapId } from '../data/maps';
import { decideAiAction, decideAiItem } from '../game/ai';
import { INK_TURNS, MAX_HP, MAX_STACKS, OVERTIME_TURN, TIMING } from '../game/constants';
import { describeTurn } from '../game/describe';
import { createEmitter } from '../game/events';
import { randRange } from '../game/rng';
import { resolveTurn } from '../game/rules';
import type { ActionType, ChosenAction, CombatState, PlayerIndex, TurnResult } from '../game/types';

// ─────────────────────────────────────────────────────────────
// 배틀 상태 머신
//
//   idle → intro → [ select(3초 / 야자 1.5초) → reveal → action(임팩트) → aftermath ]×N
//        → ko ─┬─ (팀에 다음 주자 있음) → swap → select …
//              └─ (팀 전멸) → finished
//
// - 모든 시간은 '배틀 시계(clock)' 기준. 일시정지/슬로모션/히트스톱이 시계 속도로 표현되어
//   로직·3D 애니메이션·HUD 가 같은 시간축을 공유한다.
// - 팀전(듀오/자유 랭크)은 KOF 식 릴레이: 한 명씩 1:1 로 싸우고, 쓰러지면 다음 주자가 나온다.
// - 연출(사운드/카메라/이펙트)은 battleEvents 를 구독해서 반응 → 로직과 표현을 분리.
// ─────────────────────────────────────────────────────────────

/** 조작 방식: ai = 팀0(사람+파트너) vs AI 팀 / local = 한 기기에서 2인 */
export type BattleMode = 'ai' | 'local';
/** 경기 종류 (보상·랭크 계산용) */
export type MatchKindId = 'ranked' | 'flex' | 'challenge' | 'local';
export type BattlePhase = 'idle' | 'intro' | 'select' | 'reveal' | 'action' | 'aftermath' | 'ko' | 'swap' | 'finished';
/** 'remote' 는 온라인 매칭 확장용 (src/net 참고) */
export type Controller = 'human' | 'ai' | 'remote';
export type FinishReason = 'ko' | 'timeover' | 'forfeit';
export type Winner = PlayerIndex | 'draw';

export interface FighterSetup {
  name: string;
  appearance: Appearance;
  controller: Controller;
  /** 이번 판에 쓸 수 있는 전투 아이템 수 */
  items: Record<BattleItemId, number>;
  /** 기폭제 등으로 시작 시 보유한 기 */
  startStacks: number;
}

export interface BattleConfig {
  mode: BattleMode;
  kind: MatchKindId;
  mapId: MapId;
  /** AI 난이도 0~3 */
  aiLevel: number;
  /** 각 팀 출전 순서 (1~3명) */
  teams: [FighterSetup[], FighterSetup[]];
  turnMs?: number;
}

export interface FighterRuntime extends CombatState {
  name: string;
  appearance: Appearance;
  controller: Controller;
  items: Record<BattleItemId, number>;
  history: ActionType[];
  /** 🦑 먹물: 남은 턴 수 — 그동안 상대의 기 게이지를 볼 수 없다 */
  inkTurns: number;
  /** 먹물 맞을 때 본 상대의 기 (게이지가 이 값에서 멈춰 보임) */
  inkSeen: number;
  damageTaken: number;
  /** 팀 내 순번 (0부터) */
  member: number;
}

export interface TurnLogEntry {
  turn: number;
  result: TurnResult;
  headline: string;
  log: string;
}

interface AiPlan {
  action: ChosenAction;
  lockAt: number;
  item: BattleItemId | null;
  itemAt: number;
  itemDone: boolean;
}

export type BattleEvent =
  | { type: 'start'; config: BattleConfig }
  | { type: 'phase'; phase: BattlePhase; turn: number }
  | { type: 'countdown'; seconds: number }
  /** 야자 타임: 턴 시작 시 두 사람 모두 기 +1, 선택 시간 1.5초 */
  | { type: 'overtime'; turn: number; first: boolean }
  | { type: 'lock'; player: PlayerIndex; timeout: boolean }
  | { type: 'item'; player: PlayerIndex; item: BattleItemId }
  | { type: 'impact'; result: TurnResult; turn: number }
  /** 팀전: 다음 주자 등장 */
  | { type: 'swap'; sides: [boolean, boolean] }
  | { type: 'finish'; winner: Winner; reason: FinishReason }
  | { type: 'pause'; paused: boolean }
  | { type: 'exit' };

export const battleEvents = createEmitter<BattleEvent>();

export interface BattleState {
  config: BattleConfig | null;
  phase: BattlePhase;
  /** 배틀 시계 (ms) */
  clock: number;
  timeScale: number;
  slowmo: { until: number; scale: number };
  phaseStart: number;
  /** 현재 대결(1:1)의 턴 */
  turn: number;
  /** 경기 전체 누적 턴 */
  totalTurns: number;
  fighters: [FighterRuntime, FighterRuntime];
  /** 팀별 현재 출전 순번 */
  activeIdx: [number, number];
  /** 팀별 탈락 인원 */
  eliminated: [number, number];
  /** 이번 KO 뒤 교체될 쪽 */
  swapSides: [boolean, boolean];
  choices: [ActionType | null, ActionType | null];
  deadlines: [number, number];
  turnDurations: [number, number];
  timedOut: [boolean, boolean];
  itemUsedThisTurn: [BattleItemId | null, BattleItemId | null];
  aiPlans: [AiPlan | null, AiPlan | null];
  result: TurnResult | null;
  impactDone: boolean;
  log: TurnLogEntry[];
  winner: Winner | null;
  finishReason: FinishReason | null;
  paused: boolean;
  lastCountdown: number;

  start(config: BattleConfig): void;
  /** source 'remote' 는 온라인 상대의 공개된 선택 (controller === 'remote' 인 슬롯만) */
  choose(p: PlayerIndex, action: ActionType, source?: 'local' | 'remote'): void;
  useItem(p: PlayerIndex, item: BattleItemId): void;
  /** rAF 루프에서 실제 경과 ms 로 호출 */
  tick(realDtMs: number): void;
  setPaused(paused: boolean): void;
  forfeit(p: PlayerIndex): void;
  exit(): void;
}

const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

const emptyFighter = (): FighterRuntime => ({
  name: '',
  appearance: DEFAULT_APPEARANCE,
  controller: 'human',
  hp: MAX_HP,
  stacks: 0,
  shield: false,
  items: { shield: 0, jam: 0 },
  history: [],
  inkTurns: 0,
  inkSeen: 0,
  damageTaken: 0,
  member: 0,
});

const fighterFromSetup = (s: FighterSetup, member: number): FighterRuntime => ({
  ...emptyFighter(),
  name: s.name,
  appearance: s.appearance,
  controller: s.controller,
  stacks: Math.min(MAX_STACKS, Math.max(0, s.startStacks)),
  items: { ...s.items },
  member,
});

/** 이번 턴 판정이 필살기 연출(긴 타임라인)을 쓰는가 */
export function isSpecialTurn(r: TurnResult | null): boolean {
  return !!r && (r.outcomes[0].tier === 'special' || r.outcomes[1].tier === 'special');
}

export function actionTiming(r: TurnResult | null): { impactMs: number; durationMs: number } {
  return isSpecialTurn(r)
    ? { impactMs: TIMING.specialImpactMs, durationMs: TIMING.specialActionMs }
    : { impactMs: TIMING.impactMs, durationMs: TIMING.actionMs };
}

/** 뷰어 v 가 볼 수 있는 상대(other(v))의 기 — 먹물에 맞았으면 멈춘 값 */
export function perceivedStacks(s: Pick<BattleState, 'fighters'>, viewer: PlayerIndex): number {
  const me = s.fighters[viewer];
  const opp = s.fighters[other(viewer)];
  return me.inkTurns > 0 ? me.inkSeen : opp.stacks;
}

/** 아이템 적용 (사람/AI 공용). 적용 불가면 null */
function applyItem(
  fighters: [FighterRuntime, FighterRuntime],
  p: PlayerIndex,
  item: BattleItemId,
): [FighterRuntime, FighterRuntime] | null {
  const me = fighters[p];
  if (me.items[item] <= 0) return null;
  if (item === 'shield' && me.shield) return null;
  const next: [FighterRuntime, FighterRuntime] = [{ ...fighters[0] }, { ...fighters[1] }];
  next[p] = { ...next[p], items: { ...me.items, [item]: me.items[item] - 1 } };
  if (item === 'shield') next[p].shield = true;
  if (item === 'jam') {
    // 상대 시야를 먹물로 가림: 상대는 INK_TURNS 동안 내 기 게이지를 지금 값으로만 본다
    next[other(p)] = { ...next[other(p)], inkTurns: INK_TURNS, inkSeen: me.stacks };
  }
  return next;
}

const initialData = {
  config: null,
  phase: 'idle' as BattlePhase,
  clock: 0,
  timeScale: 1,
  slowmo: { until: 0, scale: 1 },
  phaseStart: 0,
  turn: 0,
  totalTurns: 0,
  fighters: [emptyFighter(), emptyFighter()] as [FighterRuntime, FighterRuntime],
  activeIdx: [0, 0] as [number, number],
  eliminated: [0, 0] as [number, number],
  swapSides: [false, false] as [boolean, boolean],
  choices: [null, null] as [ActionType | null, ActionType | null],
  deadlines: [0, 0] as [number, number],
  turnDurations: [TIMING.turnMs, TIMING.turnMs] as [number, number],
  timedOut: [false, false] as [boolean, boolean],
  itemUsedThisTurn: [null, null] as [BattleItemId | null, BattleItemId | null],
  aiPlans: [null, null] as [AiPlan | null, AiPlan | null],
  result: null,
  impactDone: false,
  log: [] as TurnLogEntry[],
  winner: null,
  finishReason: null,
  paused: false,
  lastCountdown: 0,
};

export const useBattleStore = create<BattleState>()((set, get) => {
  /** 선택 단계 진입 (턴 시작) */
  const enterSelect = (s: BattleState, now: number, turn: number, events: BattleEvent[]): Partial<BattleState> => {
    const cfg = s.config!;
    const overtime = turn >= OVERTIME_TURN;
    const fighters = s.fighters.map((f) => ({
      ...f,
      inkTurns: turn > 1 ? Math.max(0, f.inkTurns - 1) : f.inkTurns,
      stacks: overtime ? Math.min(MAX_STACKS, f.stacks + 1) : f.stacks,
    })) as [FighterRuntime, FighterRuntime];
    if (overtime) events.push({ type: 'overtime', turn, first: turn === OVERTIME_TURN });

    const base = overtime ? TIMING.overtimeTurnMs : (cfg.turnMs ?? TIMING.turnMs);
    const durations: [number, number] = [base, base];
    const aiPlans = fighters.map((f, i): AiPlan | null => {
      if (f.controller !== 'ai') return null;
      const opp = fighters[other(i as PlayerIndex)];
      // 먹물에 맞은 AI 는 상대 기를 멈춘 값으로만 안다
      const oppSeen = f.inkTurns > 0 ? { ...opp, stacks: f.inkSeen } : opp;
      const ctx = { self: f, opp: oppSeen, oppHistory: opp.history, level: cfg.aiLevel };
      const action = decideAiAction(ctx);
      const item = decideAiItem({ ...ctx, items: f.items, planned: action });
      return {
        action,
        // 너무 빨리 확정하면 기계 같으니 마감 전에 랜덤하게 '선택 완료'
        lockAt: now + randRange(Math.min(400, base * 0.25), Math.min(1400, base - 300)),
        item,
        itemAt: now + randRange(200, Math.min(800, base - 400)),
        itemDone: false,
      };
    }) as [AiPlan | null, AiPlan | null];

    events.push({ type: 'phase', phase: 'select', turn });
    return {
      phase: 'select',
      phaseStart: now,
      turn,
      totalTurns: s.totalTurns + 1,
      fighters,
      choices: [null, null],
      deadlines: [now + durations[0], now + durations[1]],
      turnDurations: durations,
      timedOut: [false, false],
      itemUsedThisTurn: [null, null],
      aiPlans,
      result: null,
      impactDone: false,
      lastCountdown: 0,
    };
  };

  const stepSelect = (s: BattleState, now: number, events: BattleEvent[]): Partial<BattleState> => {
    const choices: [ActionType | null, ActionType | null] = [...s.choices];
    const timedOut: [boolean, boolean] = [...s.timedOut];
    const aiPlans: [AiPlan | null, AiPlan | null] = [s.aiPlans[0], s.aiPlans[1]];
    let fighters = s.fighters;
    const itemUsed: [BattleItemId | null, BattleItemId | null] = [...s.itemUsedThisTurn];
    let changed = false;

    for (const i of [0, 1] as const) {
      const plan = aiPlans[i];
      if (plan) {
        if (plan.item && !plan.itemDone && now >= plan.itemAt) {
          const applied = applyItem(fighters, i, plan.item);
          if (applied) {
            fighters = applied;
            itemUsed[i] = plan.item;
            events.push({ type: 'item', player: i, item: plan.item });
          }
          aiPlans[i] = { ...plan, itemDone: true };
          changed = true;
        }
        if (choices[i] === null && now >= plan.lockAt) {
          choices[i] = plan.action;
          events.push({ type: 'lock', player: i, timeout: false });
          changed = true;
        }
      }
      if (choices[i] === null && now >= s.deadlines[i]) {
        choices[i] = 'idle';
        timedOut[i] = true;
        events.push({ type: 'lock', player: i, timeout: true });
        changed = true;
      }
    }

    // 사람 플레이어 카운트다운 (3, 2, 1)
    let lastCountdown = s.lastCountdown;
    let humanDeadline = 0;
    for (const i of [0, 1] as const) {
      if (s.fighters[i].controller === 'human' && choices[i] === null) humanDeadline = Math.max(humanDeadline, s.deadlines[i]);
    }
    if (humanDeadline > 0) {
      const secs = Math.ceil((humanDeadline - now) / 1000);
      if (secs > 0 && secs !== lastCountdown) {
        lastCountdown = secs;
        events.push({ type: 'countdown', seconds: secs });
        changed = true;
      }
    }

    const patch: Partial<BattleState> = changed
      ? { choices, timedOut, aiPlans, fighters, itemUsedThisTurn: itemUsed, lastCountdown }
      : {};

    if (choices[0] !== null && choices[1] !== null) {
      events.push({ type: 'phase', phase: 'reveal', turn: s.turn });
      return { ...patch, phase: 'reveal', phaseStart: now };
    }
    return patch;
  };

  const stepAction = (s: BattleState, now: number, t: number, events: BattleEvent[]): Partial<BattleState> => {
    const r = s.result!;
    const { impactMs, durationMs } = actionTiming(r);
    let patch: Partial<BattleState> = {};

    if (!s.impactDone && t >= impactMs) {
      const fighters = s.fighters.map((f, i) => {
        const o = r.outcomes[i];
        return {
          ...f,
          hp: o.hpAfter,
          stacks: o.stacksAfter,
          shield: o.shieldAfter,
          history: [...f.history, o.action],
          damageTaken: f.damageTaken + o.damageTaken,
        };
      }) as [FighterRuntime, FighterRuntime];
      const names = [s.fighters[0].name, s.fighters[1].name] as const;
      const desc = describeTurn(r, names, null);

      // 히트스톱 / 슬로모션 — 시계 속도로 표현
      let slowmo = s.slowmo;
      if (r.ko[0] || r.ko[1]) slowmo = { until: now + 360, scale: 0.22 };
      else if (r.kind === 'power' || r.kind === 'overpower') slowmo = { until: now + 16, scale: 0.1 };
      else if (r.kind === 'hit' || r.kind === 'clash' || r.kind === 'blocked') slowmo = { until: now + 9, scale: 0.1 };
      else if (r.kind === 'dodge') slowmo = { until: now + 170, scale: 0.35 };

      patch = {
        fighters,
        impactDone: true,
        slowmo,
        log: [...s.log, { turn: s.turn, result: r, headline: desc.headline, log: desc.log }].slice(-60),
      };
      events.push({ type: 'impact', result: r, turn: s.turn });
    }

    if (t >= durationMs) {
      events.push({ type: 'phase', phase: 'aftermath', turn: s.turn });
      patch = { ...patch, phase: 'aftermath', phaseStart: now };
    }
    return patch;
  };

  /** 1:1 대결이 끝났는지 → 탈락 처리 (팀에 남은 주자가 있으면 교체 대기) */
  const resolveBout = (s: BattleState, now: number, events: BattleEvent[]): Partial<BattleState> | null => {
    const [a, b] = s.fighters;
    let elim: [boolean, boolean] = [a.hp <= 0, b.hp <= 0];
    let reason: FinishReason = 'ko';
    if (!elim[0] && !elim[1]) {
      if (s.turn < TIMING.maxTurns) return null;
      reason = 'timeover';
      elim = a.hp === b.hp ? [true, true] : a.hp < b.hp ? [true, false] : [false, true];
    }
    const teams = s.config!.teams;
    const eliminated: [number, number] = [s.eliminated[0] + (elim[0] ? 1 : 0), s.eliminated[1] + (elim[1] ? 1 : 0)];
    const left: [number, number] = [teams[0].length - eliminated[0], teams[1].length - eliminated[1]];
    events.push({ type: 'phase', phase: 'ko', turn: s.turn });
    if (left[0] <= 0 || left[1] <= 0) {
      const winner: Winner = left[0] <= 0 && left[1] <= 0 ? 'draw' : left[0] <= 0 ? 1 : 0;
      return { phase: 'ko', phaseStart: now, eliminated, winner, finishReason: reason, swapSides: [false, false] };
    }
    return { phase: 'ko', phaseStart: now, eliminated, swapSides: elim, finishReason: reason };
  };

  const enterSwap = (s: BattleState, now: number, events: BattleEvent[]): Partial<BattleState> => {
    const teams = s.config!.teams;
    const activeIdx: [number, number] = [...s.activeIdx];
    const fighters = s.fighters.map((f, i) => {
      if (s.swapSides[i]) {
        activeIdx[i] = s.eliminated[i];
        return fighterFromSetup({ ...teams[i][activeIdx[i]], startStacks: 0 }, activeIdx[i]);
      }
      // 살아남은 쪽은 체력 유지, 기·방어막·먹물은 초기화
      return { ...f, stacks: 0, shield: false, inkTurns: 0, inkSeen: 0 };
    }) as [FighterRuntime, FighterRuntime];
    events.push({ type: 'swap', sides: s.swapSides });
    events.push({ type: 'phase', phase: 'swap', turn: 0 });
    return { phase: 'swap', phaseStart: now, fighters, activeIdx, turn: 0, result: null, finishReason: null };
  };

  const finishPatch = (winner: Winner, reason: FinishReason, now: number, events: BattleEvent[]): Partial<BattleState> => {
    events.push({ type: 'phase', phase: 'finished', turn: get().turn });
    events.push({ type: 'finish', winner, reason });
    return { phase: 'finished', phaseStart: now, winner, finishReason: reason };
  };

  return {
    ...initialData,

    start: (config) => {
      const fighters: [FighterRuntime, FighterRuntime] = [fighterFromSetup(config.teams[0][0], 0), fighterFromSetup(config.teams[1][0], 0)];
      set({ ...initialData, config, fighters, phase: 'intro', phaseStart: 0, clock: 0, turn: 1 });
      battleEvents.emit({ type: 'start', config });
      battleEvents.emit({ type: 'phase', phase: 'intro', turn: 1 });
    },

    choose: (p, action, source = 'local') => {
      const s = get();
      if (s.phase !== 'select' || s.paused) return;
      const expected: Controller = source === 'remote' ? 'remote' : 'human';
      if (s.choices[p] !== null || s.fighters[p].controller !== expected) return;
      if (source === 'local' && action === 'idle') return;
      const choices: [ActionType | null, ActionType | null] = [...s.choices];
      choices[p] = action;
      set({ choices });
      battleEvents.emit({ type: 'lock', player: p, timeout: false });
    },

    useItem: (p, item) => {
      const s = get();
      if (s.phase !== 'select' || s.paused || s.itemUsedThisTurn[p] !== null) return;
      if (s.fighters[p].controller !== 'human') return;
      const fighters = applyItem(s.fighters, p, item);
      if (!fighters) return;
      const itemUsedThisTurn: [BattleItemId | null, BattleItemId | null] = [...s.itemUsedThisTurn];
      itemUsedThisTurn[p] = item;
      set({ fighters, itemUsedThisTurn });
      battleEvents.emit({ type: 'item', player: p, item });
    },

    tick: (realDtMs) => {
      const s = get();
      if (!s.config || s.phase === 'idle' || s.paused) return;
      const scale = s.clock < s.slowmo.until ? s.slowmo.scale : 1;
      const now = s.clock + Math.min(Math.max(realDtMs, 0), 100) * scale;
      const t = now - s.phaseStart;
      const events: BattleEvent[] = [];
      let patch: Partial<BattleState> = {};

      switch (s.phase) {
        case 'intro':
          if (t >= TIMING.introMs) patch = enterSelect(s, now, 1, events);
          break;
        case 'select':
          patch = stepSelect(s, now, events);
          break;
        case 'reveal':
          if (t >= TIMING.revealMs) {
            const choices = s.choices as [ActionType, ActionType];
            const result = resolveTurn([s.fighters[0], s.fighters[1]], choices);
            events.push({ type: 'phase', phase: 'action', turn: s.turn });
            patch = { phase: 'action', phaseStart: now, result, impactDone: false };
          }
          break;
        case 'action':
          patch = stepAction(s, now, t, events);
          break;
        case 'aftermath':
          if (t >= TIMING.aftermathMs) patch = resolveBout(s, now, events) ?? enterSelect(s, now, s.turn + 1, events);
          break;
        case 'ko': {
          const finalKo = s.winner !== null;
          if (t >= (finalKo ? TIMING.koMs : TIMING.koShortMs)) {
            patch = finalKo ? finishPatch(s.winner!, s.finishReason ?? 'ko', now, events) : enterSwap(s, now, events);
          }
          break;
        }
        case 'swap':
          if (t >= TIMING.swapMs) patch = enterSelect(s, now, 1, events);
          break;
        case 'finished':
          break;
      }

      set({ ...patch, clock: now, timeScale: scale });
      for (const e of events) battleEvents.emit(e);
    },

    setPaused: (paused) => {
      const s = get();
      if (s.phase === 'idle' || s.phase === 'finished' || s.paused === paused) return;
      set({ paused });
      battleEvents.emit({ type: 'pause', paused });
    },

    forfeit: (p) => {
      const s = get();
      if (s.phase === 'idle' || s.phase === 'finished') return;
      const events: BattleEvent[] = [];
      set({ ...finishPatch(other(p), 'forfeit', s.clock, events), paused: false });
      for (const e of events) battleEvents.emit(e);
    },

    exit: () => {
      set({ ...initialData });
      battleEvents.emit({ type: 'exit' });
    },
  };
});

/** 팀 남은 인원 */
export function teamRemaining(s: Pick<BattleState, 'config' | 'eliminated'>, side: PlayerIndex): number {
  return (s.config?.teams[side].length ?? 1) - s.eliminated[side];
}

// ── 셀렉터 헬퍼 ──────────────────────────────────────────────
export const selectPhaseTime = (s: BattleState): number => s.clock - s.phaseStart;
