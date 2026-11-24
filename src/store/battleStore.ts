import { create } from 'zustand';
import { DEFAULT_APPEARANCE, type Appearance } from '../data/appearance';
import type { BattleItemId } from '../data/items';
import type { MapId } from '../data/maps';
import { decideAiAction, decideAiItem } from '../game/ai';
import { MAX_HP, MAX_STACKS, OVERTIME_TURN, TIMING } from '../game/constants';
import { describeTurn } from '../game/describe';
import { createEmitter } from '../game/events';
import { randRange } from '../game/rng';
import { resolveTurn } from '../game/rules';
import type { ActionType, ChosenAction, CombatState, PlayerIndex, TurnResult } from '../game/types';

// ─────────────────────────────────────────────────────────────
// 배틀 상태 머신
//
//   idle → intro → [ select(3초) → reveal → action(임팩트) → aftermath ]×N → ko → finished
//
// - 모든 시간은 '배틀 시계(clock)' 기준. 일시정지/슬로모션/히트스톱이 시계 속도로 표현되어
//   로직·3D 애니메이션·HUD 가 같은 시간축을 공유한다.
// - 연출(사운드/카메라/이펙트)은 battleEvents 를 구독해서 반응 → 로직과 표현을 분리.
// ─────────────────────────────────────────────────────────────

export type BattleMode = 'ai' | 'local';
export type BattlePhase = 'idle' | 'intro' | 'select' | 'reveal' | 'action' | 'aftermath' | 'ko' | 'finished';
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
  mapId: MapId;
  /** AI 난이도 0~3 */
  aiLevel: number;
  fighters: [FighterSetup, FighterSetup];
  turnMs?: number;
}

export interface FighterRuntime extends CombatState {
  name: string;
  appearance: Appearance;
  controller: Controller;
  items: Record<BattleItemId, number>;
  history: ActionType[];
  /** 이번 선택 시간 동안 먹물에 맞은 상태 */
  jammed: boolean;
  /** 다음 턴에 먹물 적용 예약 */
  jamQueued: boolean;
  damageTaken: number;
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
  /** 야자 타임: 턴 시작 시 두 사람 모두 기 +1 */
  | { type: 'overtime'; turn: number; first: boolean }
  | { type: 'lock'; player: PlayerIndex; timeout: boolean }
  | { type: 'item'; player: PlayerIndex; item: BattleItemId }
  | { type: 'impact'; result: TurnResult; turn: number }
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
  turn: number;
  fighters: [FighterRuntime, FighterRuntime];
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
  jammed: false,
  jamQueued: false,
  damageTaken: 0,
});

const fighterFromSetup = (s: FighterSetup): FighterRuntime => ({
  ...emptyFighter(),
  name: s.name,
  appearance: s.appearance,
  controller: s.controller,
  stacks: Math.min(MAX_STACKS, Math.max(0, s.startStacks)),
  items: { ...s.items },
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
  if (item === 'jam') next[other(p)] = { ...next[other(p)], jamQueued: true };
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
  fighters: [emptyFighter(), emptyFighter()] as [FighterRuntime, FighterRuntime],
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
      jammed: f.jamQueued,
      jamQueued: false,
      stacks: overtime ? Math.min(MAX_STACKS, f.stacks + 1) : f.stacks,
    })) as [FighterRuntime, FighterRuntime];
    if (overtime) events.push({ type: 'overtime', turn, first: turn === OVERTIME_TURN });
    const base = cfg.turnMs ?? TIMING.turnMs;
    const durations = fighters.map((f) => (f.jammed && f.controller === 'human' ? TIMING.jammedTurnMs : base)) as [
      number,
      number,
    ];
    const aiPlans = fighters.map((f, i): AiPlan | null => {
      if (f.controller !== 'ai') return null;
      const opp = fighters[other(i as PlayerIndex)];
      const ctx = { self: f, opp, oppHistory: opp.history, level: cfg.aiLevel, confused: f.jammed };
      const action = decideAiAction(ctx);
      const item = decideAiItem({ ...ctx, items: f.items, planned: action });
      return {
        action,
        // 너무 빨리 확정하면 기계 같으니 0.4~1.4초 사이에 '선택 완료'
        lockAt: now + randRange(400, Math.min(1400, durations[i] - 350)),
        item,
        itemAt: now + randRange(250, 800),
        itemDone: false,
      };
    }) as [AiPlan | null, AiPlan | null];

    events.push({ type: 'phase', phase: 'select', turn });
    return {
      phase: 'select',
      phaseStart: now,
      turn,
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
        log: [...s.log, { turn: s.turn, result: r, headline: desc.headline, log: desc.log }].slice(-40),
      };
      events.push({ type: 'impact', result: r, turn: s.turn });
    }

    if (t >= durationMs) {
      events.push({ type: 'phase', phase: 'aftermath', turn: s.turn });
      patch = { ...patch, phase: 'aftermath', phaseStart: now };
    }
    return patch;
  };

  const finishPatch = (winner: Winner, reason: FinishReason, now: number, events: BattleEvent[]): Partial<BattleState> => {
    events.push({ type: 'phase', phase: 'finished', turn: get().turn });
    events.push({ type: 'finish', winner, reason });
    return { phase: 'finished', phaseStart: now, winner, finishReason: reason };
  };

  return {
    ...initialData,

    start: (config) => {
      const fighters: [FighterRuntime, FighterRuntime] = [fighterFromSetup(config.fighters[0]), fighterFromSetup(config.fighters[1])];
      set({
        ...initialData,
        config,
        fighters,
        phase: 'intro',
        phaseStart: 0,
        clock: 0,
        turn: 1,
      });
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
          if (t >= TIMING.aftermathMs) {
            const [a, b] = s.fighters;
            if (a.hp <= 0 || b.hp <= 0) {
              const winner: Winner = a.hp <= 0 && b.hp <= 0 ? 'draw' : a.hp <= 0 ? 1 : 0;
              events.push({ type: 'phase', phase: 'ko', turn: s.turn });
              patch = { phase: 'ko', phaseStart: now, winner, finishReason: 'ko' };
            } else if (s.turn >= TIMING.maxTurns) {
              const winner: Winner = a.hp === b.hp ? 'draw' : a.hp > b.hp ? 0 : 1;
              events.push({ type: 'phase', phase: 'ko', turn: s.turn });
              patch = { phase: 'ko', phaseStart: now, winner, finishReason: 'timeover' };
            } else {
              patch = enterSelect(s, now, s.turn + 1, events);
            }
          }
          break;
        case 'ko':
          if (t >= TIMING.koMs) patch = finishPatch(s.winner ?? 'draw', s.finishReason ?? 'ko', now, events);
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

// ── 셀렉터 헬퍼 ──────────────────────────────────────────────
export const selectPhaseTime = (s: BattleState): number => s.clock - s.phaseStart;
