import type { MapId } from '../data/maps';
import type { MatchOutcome } from './types';

export type TierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';

export interface TierDef {
  id: TierId;
  name: string;
  /** 이 티어가 되는 최소 트로피 */
  min: number;
  color: string;
  emoji: string;
  /** 티어별 자동 전환되는 배틀 맵 */
  mapId: MapId;
  /** 매칭되는 AI 난이도 (0~3) */
  aiLevel: number;
}

export const TIERS: readonly TierDef[] = [
  { id: 'bronze', name: '브론즈', min: 0, color: '#c9855a', emoji: '🥉', mapId: 'classroom', aiLevel: 0 },
  { id: 'silver', name: '실버', min: 100, color: '#aab8cc', emoji: '🥈', mapId: 'readingRoom', aiLevel: 1 },
  { id: 'gold', name: '골드', min: 250, color: '#f2c043', emoji: '🥇', mapId: 'scienceHigh', aiLevel: 1 },
  { id: 'platinum', name: '플래티넘', min: 450, color: '#4fd1c5', emoji: '💠', mapId: 'academyStreet', aiLevel: 2 },
  { id: 'diamond', name: '다이아', min: 700, color: '#7aa7ff', emoji: '💎', mapId: 'campus', aiLevel: 2 },
  { id: 'master', name: '마스터', min: 1000, color: '#c77dff', emoji: '👑', mapId: 'lab', aiLevel: 3 },
];

export const SEASON = {
  id: 1,
  name: '시즌 1 · 중간고사',
  endsAt: '2027-01-31',
} as const;

export function tierIndexFor(trophies: number): number {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (trophies >= TIERS[i].min) idx = i;
  return idx;
}

export function tierForTrophies(trophies: number): TierDef {
  return TIERS[tierIndexFor(trophies)];
}

export function nextTier(trophies: number): TierDef | null {
  return TIERS[tierIndexFor(trophies) + 1] ?? null;
}

/** 티어 안의 단계: 구간을 반으로 나눠 I → II (마스터는 1200 부터 II) */
export function divisionFor(trophies: number): 'I' | 'II' {
  const cur = tierForTrophies(trophies);
  const next = nextTier(trophies);
  const mid = next ? (cur.min + next.min) / 2 : cur.min + 200;
  return trophies >= mid ? 'II' : 'I';
}

/** "브론즈 II" 같은 표시용 이름 */
export function tierLabel(trophies: number): string {
  return `${tierForTrophies(trophies).name} ${divisionFor(trophies)}`;
}

/** 현재 티어 구간 진행도 0~1 (마스터는 1) */
export function tierProgress(trophies: number): number {
  const cur = tierForTrophies(trophies);
  const next = nextTier(trophies);
  if (!next) return 1;
  return (trophies - cur.min) / (next.min - cur.min);
}

export const WIN_TROPHIES = 30;
export const LOSE_TROPHIES = -20;

/** 승리 +30 (+연승 보너스 최대 +10), 패배 -20, 무승부 0 */
export function trophyDelta(outcome: MatchOutcome, winStreakBefore: number): number {
  if (outcome === 'win') return WIN_TROPHIES + Math.min(5, Math.max(0, winStreakBefore)) * 2;
  if (outcome === 'lose') return LOSE_TROPHIES;
  return 0;
}

export function applyTrophies(trophies: number, delta: number): number {
  return Math.max(0, trophies + delta);
}

/** 시즌 종료 소프트 리셋: 실버 기준선 위의 트로피 절반 유지 */
export function seasonSoftReset(trophies: number): number {
  const floor = TIERS[1].min;
  if (trophies <= floor) return trophies;
  return Math.round(floor + (trophies - floor) * 0.5);
}
