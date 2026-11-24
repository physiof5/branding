import type { ItemId } from '../data/items';
import { trophyDelta } from './rank';
import type { AttackTier, MatchOutcome } from './types';

/** 경기 종류: 클래식 랭크전(솔로/듀오) · 자유 랭크전 · 클래식 도전 · 클래식 1v1(로컬) */
export type MatchKind = 'ranked' | 'flex' | 'challenge' | 'local';

export interface MatchSummary {
  kind: MatchKind;
  /** 내 팀(팀0) 기준 결과 */
  outcome: MatchOutcome;
  /** 마지막 일격의 공격 단계 */
  finisher: AttackTier | null;
  /** 한 대도 안 맞고 승리 */
  perfect: boolean;
  winStreakBefore: number;
  forfeit: boolean;
}

export interface RewardSummary {
  gold: number;
  xp: number;
  trophies: number;
  bonuses: { label: string; gold: number }[];
  /** 클래식 도전 승리 보상 */
  item: ItemId | null;
}

export const BASE_REWARD: Record<MatchOutcome, { gold: number; xp: number }> = {
  win: { gold: 60, xp: 120 },
  lose: { gold: 20, xp: 50 },
  draw: { gold: 35, xp: 70 },
};

/** 클래식 도전: 하루 10판, 이길 때마다 아이템 1개 */
export const CHALLENGE_DAILY_GAMES = 10;
const CHALLENGE_ITEM_TABLE: readonly [ItemId, number][] = [
  ['shield', 0.4],
  ['jam', 0.3],
  ['catalyst', 0.3],
];

export function rollChallengeItem(rng: () => number = Math.random): ItemId {
  let r = rng();
  for (const [id, w] of CHALLENGE_ITEM_TABLE) {
    if ((r -= w) <= 0) return id;
  }
  return 'shield';
}

export function computeRewards(s: MatchSummary, rng: () => number = Math.random): RewardSummary {
  // 로컬 1v1 은 친선전 — 랭크/재화 변동 없음
  if (s.kind === 'local') return { gold: 0, xp: 0, trophies: 0, bonuses: [], item: null };

  if (s.kind === 'challenge') {
    const win = s.outcome === 'win';
    return {
      gold: win ? 30 : 10,
      xp: win ? 80 : 30,
      trophies: 0,
      bonuses: [],
      item: win && !s.forfeit ? rollChallengeItem(rng) : null,
    };
  }

  const base = BASE_REWARD[s.outcome];
  const bonuses: { label: string; gold: number }[] = [];
  if (s.outcome === 'win') {
    if (s.finisher === 'special') bonuses.push({ label: '필살기 피니시', gold: 40 });
    if (s.perfect) bonuses.push({ label: '노데미지 퍼펙트', gold: 30 });
    if (s.winStreakBefore >= 1) bonuses.push({ label: `${s.winStreakBefore + 1}연승`, gold: 10 * Math.min(5, s.winStreakBefore) });
  }
  const forfeitPenalty = s.forfeit ? 0.5 : 1;
  const gold = Math.round((base.gold + bonuses.reduce((a, b) => a + b.gold, 0)) * forfeitPenalty);
  const xp = Math.round(base.xp * forfeitPenalty);
  return { gold, xp, trophies: trophyDelta(s.outcome, s.winStreakBefore), bonuses, item: null };
}

/** 로컬 날짜 키 (클래식 도전 일일 초기화) */
export function todayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
