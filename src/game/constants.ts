import type { AttackTier } from './types';

/** 모든 유저 동일 스탯 (커스터마이징은 외형에만 영향) */
export const MAX_HP = 100;
export const MAX_STACKS = 10;

export const POWER_STACKS = 3;
export const SPECIAL_STACKS = 10;

export const ATTACK_DAMAGE: Record<AttackTier, number> = {
  normal: 10,
  power: 50,
  special: 100,
};

export const ATTACK_COST: Record<AttackTier, number> = {
  normal: 0,
  power: POWER_STACKS,
  special: SPECIAL_STACKS,
};

/** 동시 공격 시 우열 비교용 */
export const TIER_RANK: Record<AttackTier, number> = {
  normal: 0,
  power: 1,
  special: 2,
};

/** 턴 진행 타이밍 (배틀 시계 기준 ms) */
export const TIMING = {
  introMs: 2600,
  /** 기본 선택 제한 시간 3초 */
  turnMs: 3000,
  /** 🌙 야자 타임에는 선택 시간 1.5초 */
  overtimeTurnMs: 1500,
  revealMs: 750,
  actionMs: 1550,
  impactMs: 640,
  specialActionMs: 3300,
  specialImpactMs: 2050,
  aftermathMs: 650,
  koMs: 2800,
  /** 팀전: 다음 주자 등장 */
  swapMs: 1900,
  /** 팀전에서 다음 주자가 남아 있을 때의 짧은 KO 연출 */
  koShortMs: 1700,
  /** 무한 눈치싸움 방지 — 이 턴 수가 지나면 체력 판정 */
  maxTurns: 30,
} as const;

/**
 * 🌙 야자 타임 (막판 스퍼트): 이 턴부터
 *  · 선택 시간 3초 → 1.5초
 *  · 매 턴 시작 시 두 사람 모두 기 +1
 * 기획 수치(체력·데미지)는 그대로 두고 후반을 빠른 필살기 심리전으로 몰아 결판을 낸다.
 * AI 대 AI 시뮬레이션 기준 KO 종료율 ~85%, 평균 ~20턴. 끄려면 Infinity.
 */
export const OVERTIME_TURN = 15;

/** 🦑 먹물 폭탄: 맞은 쪽은 이 턴 수 동안 상대의 기 게이지를 볼 수 없다 (게이지가 멈춰 보임) */
export const INK_TURNS = 3;
