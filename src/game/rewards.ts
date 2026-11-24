import { trophyDelta } from './rank';
import type { AttackTier, MatchOutcome } from './types';

export interface MatchSummary {
  mode: 'ai' | 'local';
  /** P1(로그인 유저) 기준 결과 */
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
}

export const BASE_REWARD: Record<MatchOutcome, { gold: number; xp: number }> = {
  win: { gold: 60, xp: 120 },
  lose: { gold: 20, xp: 50 },
  draw: { gold: 35, xp: 70 },
};

export function computeRewards(s: MatchSummary): RewardSummary {
  // 로컬 2인 대전은 친선전 — 랭크/재화 변동 없음
  if (s.mode === 'local') return { gold: 0, xp: 0, trophies: 0, bonuses: [] };

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
  return { gold, xp, trophies: trophyDelta(s.outcome, s.winStreakBefore), bonuses };
}
