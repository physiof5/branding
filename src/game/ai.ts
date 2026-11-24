import { POWER_STACKS, SPECIAL_STACKS } from './constants';
import { defaultRng } from './rng';
import { resolveTurn } from './rules';
import type { ActionType, ChosenAction, CombatState } from './types';

// ─────────────────────────────────────────────────────────────
// 심리전 AI
//  1) 상대 '상황 정책'(기/체력 기반 직관) + 2) 상대 행동 기록(빈도·전이 패턴)을
//  섞어 상대의 다음 수를 예측하고, 3) 각 행동의 기대 가치를 1수 앞 시뮬레이션으로 계산해
//  4) 난이도별 온도(softmax)로 섞어서 고른다 — 너무 뻔하지 않도록 '혼합 전략'.
// ─────────────────────────────────────────────────────────────

export const CHOICES: readonly ChosenAction[] = ['charge', 'dodge', 'attack'];

export type Dist = Record<ChosenAction, number>;

export interface AiContext {
  self: CombatState;
  opp: CombatState;
  /** 상대의 지난 행동들 (오래된 → 최근) */
  oppHistory: readonly ActionType[];
  /** 0(브론즈) ~ 3(마스터) */
  level: number;
  /** 먹물 아이템에 맞아 시야가 가려짐 → 무작위 선택 */
  confused?: boolean;
  rng?: () => number;
}

interface LevelParams {
  /** softmax 온도. 낮을수록 계산대로 */
  temperature: number;
  /** 상대 패턴 학습 비중 */
  adapt: number;
  /** 완전 무작위 실수 확률 */
  blunder: number;
}

export const AI_LEVELS: readonly LevelParams[] = [
  { temperature: 38, adapt: 0, blunder: 0.22 }, // 브론즈: 감으로 둔다
  { temperature: 18, adapt: 0.35, blunder: 0.1 },
  { temperature: 10, adapt: 0.6, blunder: 0.04 },
  { temperature: 6, adapt: 0.75, blunder: 0 }, // 마스터: 패턴을 읽는다
];

const levelParams = (level: number): LevelParams =>
  AI_LEVELS[Math.max(0, Math.min(AI_LEVELS.length - 1, Math.round(level)))];

function normalize(d: Dist, floor = 0.04): Dist {
  const c = Math.max(floor, d.charge);
  const o = Math.max(floor, d.dodge);
  const a = Math.max(floor, d.attack);
  const s = c + o + a;
  return { charge: c / s, dodge: o / s, attack: a / s };
}

/** `me` 입장에서 보통 사람이 할 법한 선택 (직관 정책) */
export function situationalPolicy(me: CombatState, them: CombatState): Dist {
  if (me.stacks >= SPECIAL_STACKS) return { charge: 0.04, dodge: 0.04, attack: 0.92 };
  if (them.stacks >= SPECIAL_STACKS) return normalize({ charge: 0.3, dodge: 0.3, attack: 0.4 });

  let charge = 0.4;
  let dodge = 0.3;
  let attack = 0.3;
  if (them.stacks >= POWER_STACKS) {
    dodge += 0.2; // 강력 공격이 무섭다
    charge -= 0.08;
  }
  if (me.stacks >= POWER_STACKS) attack += 0.15;
  if (me.stacks >= 7) {
    charge += 0.3; // 필살기 욕심
    attack -= 0.1;
  }
  if (them.stacks >= 8) {
    attack += 0.25; // 필살기 저지
    charge -= 0.1;
  }
  if (me.hp <= 30) dodge += 0.1;
  if (them.shield) {
    attack -= 0.15;
    charge += 0.1;
  }
  return normalize({ charge, dodge, attack });
}

/** 상대 기록 기반 분포 (최근 가중 빈도 + 직전 행동 → 다음 행동 전이) */
export function observedDistribution(history: readonly ActionType[]): { dist: Dist; samples: number } | null {
  const acts = history.filter((a): a is ChosenAction => a !== 'idle');
  if (acts.length === 0) return null;

  const freq: Dist = { charge: 1, dodge: 1, attack: 1 };
  let w = 1;
  for (let i = acts.length - 1; i >= 0; i--) {
    freq[acts[i]] += w * 2;
    w *= 0.82;
  }

  const last = acts[acts.length - 1];
  const trans: Dist = { charge: 1, dodge: 1, attack: 1 };
  let n = 0;
  for (let i = 1; i < acts.length; i++) {
    if (acts[i - 1] === last) {
      trans[acts[i]] += 2;
      n++;
    }
  }

  const f = normalize(freq, 0);
  if (n < 2) return { dist: f, samples: acts.length };
  const t = normalize(trans, 0);
  const k = Math.min(0.6, n * 0.15);
  return {
    dist: normalize(
      {
        charge: f.charge * (1 - k) + t.charge * k,
        dodge: f.dodge * (1 - k) + t.dodge * k,
        attack: f.attack * (1 - k) + t.attack * k,
      },
      0,
    ),
    samples: acts.length,
  };
}

export function predictOpponent(ctx: AiContext): Dist {
  const base = situationalPolicy(ctx.opp, ctx.self);
  const { adapt } = levelParams(ctx.level);
  const obs = observedDistribution(ctx.oppHistory);
  if (!obs || adapt <= 0) return base;
  const w = adapt * Math.min(1, obs.samples / 6);
  return normalize(
    {
      charge: base.charge * (1 - w) + obs.dist.charge * w,
      dodge: base.dodge * (1 - w) + obs.dist.dodge * w,
      attack: base.attack * (1 - w) + obs.dist.attack * w,
    },
    0.02,
  );
}

const stackValue = (s: number): number => (s >= SPECIAL_STACKS ? 130 : s >= POWER_STACKS ? 28 + (s - POWER_STACKS) * 12 : s * 8);

/** self 입장에서 본 국면 가치 */
export function stateValue(self: CombatState, opp: CombatState): number {
  if (opp.hp <= 0 && self.hp > 0) return 1000;
  if (self.hp <= 0 && opp.hp > 0) return -1000;
  if (self.hp <= 0 && opp.hp <= 0) return 0;
  return (
    self.hp -
    opp.hp +
    stackValue(self.stacks) -
    stackValue(opp.stacks) +
    (self.shield ? 10 : 0) -
    (opp.shield ? 10 : 0)
  );
}

/** 각 행동의 기대 가치 (상대 예측 분포 기준 1수 시뮬레이션) */
export function evaluateActions(ctx: AiContext, pred: Dist = predictOpponent(ctx)): Dist {
  const ev: Dist = { charge: 0, dodge: 0, attack: 0 };
  for (const mine of CHOICES) {
    let sum = 0;
    for (const theirs of CHOICES) {
      const r = resolveTurn([ctx.self, ctx.opp], [mine, theirs]);
      const [o0, o1] = r.outcomes;
      const v = stateValue(
        { hp: o0.hpAfter, stacks: o0.stacksAfter, shield: o0.shieldAfter },
        { hp: o1.hpAfter, stacks: o1.stacksAfter, shield: o1.shieldAfter },
      );
      sum += pred[theirs] * v;
    }
    ev[mine] = sum;
  }
  return ev;
}

export function decideAiAction(ctx: AiContext): ChosenAction {
  const rng = ctx.rng ?? defaultRng;
  if (ctx.confused) return CHOICES[Math.floor(rng() * 3) % 3];

  const { temperature, blunder } = levelParams(ctx.level);
  // 필살기가 준비되면 거의 무조건 쏜다
  if (ctx.self.stacks >= SPECIAL_STACKS && rng() < 0.97) return 'attack';
  if (rng() < blunder) return CHOICES[Math.floor(rng() * 3) % 3];

  const ev = evaluateActions(ctx);
  const max = Math.max(ev.charge, ev.dodge, ev.attack);
  const weights = CHOICES.map((c) => Math.exp((ev[c] - max) / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < CHOICES.length; i++) {
    r -= weights[i];
    if (r <= 0) return CHOICES[i];
  }
  return CHOICES[CHOICES.length - 1];
}

export interface AiItemContext extends AiContext {
  items: { shield: number; jam: number };
  planned: ChosenAction;
}

/** AI 의 아이템 사용 판단 (브론즈 AI 는 아이템을 쓰지 않음) */
export function decideAiItem(ctx: AiItemContext): 'shield' | 'jam' | null {
  if (ctx.level <= 0) return null;
  const rng = ctx.rng ?? defaultRng;
  const { self, opp, items, planned } = ctx;

  if (items.shield > 0 && !self.shield && opp.stacks < SPECIAL_STACKS) {
    const threatened = opp.stacks >= POWER_STACKS;
    const greedyCharge = planned === 'charge' && self.stacks >= 6;
    if ((threatened && rng() < 0.5) || (greedyCharge && rng() < 0.55)) return 'shield';
  }
  if (items.jam > 0) {
    if (opp.stacks >= 6 && rng() < 0.45) return 'jam';
    if (rng() < 0.07) return 'jam';
  }
  return null;
}
