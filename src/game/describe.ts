import type { ActionType, AttackTier, PlayerIndex, TurnResult } from './types';

export const ACTION_LABEL: Record<ActionType, string> = {
  charge: '기 모으기',
  dodge: '피하기',
  attack: '공격',
  idle: '멍때리기',
};

export const ACTION_EMOJI: Record<ActionType, string> = {
  charge: '🔥',
  dodge: '💨',
  attack: '🍑',
  idle: '💤',
};

export const TIER_LABEL: Record<AttackTier, string> = {
  normal: '일반 공격',
  power: '강력 공격',
  special: '필살기',
};

export type HeadlineTone = 'neutral' | 'good' | 'bad' | 'epic';

export interface TurnDescription {
  headline: string;
  /** 1인칭 시점(AI 대전에서 P1 기준)으로 본 결과 톤 */
  tone: HeadlineTone;
  log: string;
}

function actionText(r: TurnResult, p: PlayerIndex): string {
  const o = r.outcomes[p];
  if (o.action === 'attack' && o.tier) return TIER_LABEL[o.tier];
  return ACTION_LABEL[o.action];
}

/**
 * 턴 결과를 한국어 문장으로.
 * @param me 시점 플레이어 (로컬 2인 대전이면 null → 중립 톤)
 */
export function describeTurn(
  r: TurnResult,
  names: readonly [string, string],
  me: PlayerIndex | null,
): TurnDescription {
  const [o0, o1] = r.outcomes;
  const toneFor = (beneficiary: PlayerIndex | null): HeadlineTone =>
    me === null || beneficiary === null ? 'neutral' : beneficiary === me ? 'good' : 'bad';

  let headline = '눈치 싸움…';
  let tone: HeadlineTone = 'neutral';

  switch (r.kind) {
    case 'special': {
      const a = r.attacker!;
      headline = `${names[a]}의 엉덩이 필살기!!!`;
      tone = 'epic';
      break;
    }
    case 'power': {
      const a = r.attacker!;
      headline = `${names[a]} 강력 공격 적중!!`;
      tone = toneFor(a);
      break;
    }
    case 'hit': {
      const a = r.attacker!;
      const victim = r.outcomes[a === 0 ? 1 : 0];
      headline = victim.hitWhileCharging ? `${names[a]} 무방비 공격 적중!` : `${names[a]} 공격 적중!`;
      tone = toneFor(a);
      break;
    }
    case 'overpower': {
      const a = r.attacker!;
      headline = `${names[a]} 힘으로 압도!`;
      tone = toneFor(a);
      break;
    }
    case 'clash':
      headline = r.topTier === 'special' ? '필살기 정면충돌!!' : r.topTier === 'power' ? '강력 엉덩이 상쇄!' : '엉덩이 상쇄!';
      tone = 'neutral';
      break;
    case 'dodge': {
      const d: PlayerIndex = o0.dodgedAttack ? 0 : 1;
      headline = `${names[d]} 회피 성공!`;
      tone = toneFor(d);
      break;
    }
    case 'blocked': {
      const d: PlayerIndex = o0.shieldBlocked ? 0 : 1;
      headline = `${names[d]} 방어막 발동!`;
      tone = toneFor(d);
      break;
    }
    case 'quiet':
    default:
      if (o0.action === 'charge' && o1.action === 'charge') headline = '둘 다 기 모으기!';
      else if (o0.action === 'idle' && o1.action === 'idle') headline = '둘 다 멍때림…';
      else if (o0.action === 'idle') headline = `${names[0]} 멍때림…`;
      else if (o1.action === 'idle') headline = `${names[1]} 멍때림…`;
      else if (o0.action === 'dodge' && o1.action === 'dodge') headline = '허공에 엉덩이 흔들기…';
      else headline = '조용한 눈치 싸움…';
      tone = 'neutral';
  }

  const dmg = (p: PlayerIndex) => (r.outcomes[p].damageTaken ? ` -${r.outcomes[p].damageTaken}` : '');
  const gain = (p: PlayerIndex) => (r.outcomes[p].stackGained ? ' 기+1' : '');
  const log = `${names[0]}: ${actionText(r, 0)}${dmg(0)}${gain(0)} · ${names[1]}: ${actionText(r, 1)}${dmg(1)}${gain(1)}`;

  return { headline, tone, log };
}
