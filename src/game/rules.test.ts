import { describe, expect, it } from 'vitest';
import { attackTierFor, resolveTurn } from './rules';
import type { ActionType, CombatState } from './types';

const S = (stacks = 0, hp = 100, shield = false): CombatState => ({ hp, stacks, shield });
const run = (a: CombatState, b: CombatState, x: ActionType, y: ActionType) => resolveTurn([a, b], [x, y]);

describe('attackTierFor', () => {
  it('0~2 스택은 일반, 3~9 는 강력, 10 은 필살기', () => {
    expect([0, 1, 2].map(attackTierFor)).toEqual(['normal', 'normal', 'normal']);
    expect([3, 5, 9].map(attackTierFor)).toEqual(['power', 'power', 'power']);
    expect(attackTierFor(10)).toBe('special');
  });
});

describe('resolveTurn — 기본 삼각 상성', () => {
  it('기 모으기 vs 기 모으기 → 둘 다 +1', () => {
    const r = run(S(), S(), 'charge', 'charge');
    expect(r.outcomes.map((o) => o.stacksAfter)).toEqual([1, 1]);
    expect(r.kind).toBe('quiet');
  });

  it('공격(일반) vs 기 모으기 → 무방비라 10 데미지, 기는 그대로 +1', () => {
    const r = run(S(1), S(2), 'attack', 'charge');
    expect(r.outcomes[1].damageTaken).toBe(10);
    expect(r.outcomes[1].hpAfter).toBe(90);
    expect(r.outcomes[1].hitWhileCharging).toBe(true);
    expect(r.outcomes[1].stacksAfter).toBe(3);
    expect(r.outcomes[0].stacksAfter).toBe(1); // 일반 공격은 기 소모 없음
    expect(r.kind).toBe('hit');
    expect(r.attacker).toBe(0);
  });

  it('피하기는 일반/강력 공격을 무효화', () => {
    const n = run(S(0), S(), 'attack', 'dodge');
    expect(n.outcomes[1].damageTaken).toBe(0);
    expect(n.outcomes[1].dodgedAttack).toBe(true);
    expect(n.outcomes[0].attackResult).toBe('dodged');

    const p = run(S(4), S(), 'attack', 'dodge');
    expect(p.outcomes[1].damageTaken).toBe(0);
    expect(p.outcomes[0].stacksAfter).toBe(1); // 강력 공격은 빗나가도 3 소모
    expect(p.kind).toBe('dodge');
  });

  it('기 모으기 vs 피하기 → 모은 쪽만 +1', () => {
    const r = run(S(), S(), 'charge', 'dodge');
    expect(r.outcomes[0].stacksAfter).toBe(1);
    expect(r.outcomes[1].stacksAfter).toBe(0);
  });

  it('멍때리기(시간 초과)는 무방비', () => {
    const r = run(S(3), S(), 'attack', 'idle');
    expect(r.outcomes[1].damageTaken).toBe(50);
    expect(r.outcomes[1].action).toBe('idle');
  });
});

describe('resolveTurn — 강력 공격 / 필살기', () => {
  it('3스택 강력 공격: 50 데미지, 3 소모', () => {
    const r = run(S(3), S(), 'attack', 'charge');
    expect(r.outcomes[1].hpAfter).toBe(50);
    expect(r.outcomes[0].stacksAfter).toBe(0);
    expect(r.kind).toBe('power');
  });

  it('10스택 필살기: 피하기 불가, 100 데미지 즉사, 10 소모', () => {
    const r = run(S(10), S(), 'attack', 'dodge');
    expect(r.outcomes[1].damageTaken).toBe(100);
    expect(r.outcomes[1].dodgedAttack).toBe(false);
    expect(r.ko).toEqual([false, true]);
    expect(r.outcomes[0].stacksAfter).toBe(0);
    expect(r.kind).toBe('special');
  });

  it('필살기는 방어막도 관통', () => {
    const r = run(S(10), S(0, 100, true), 'attack', 'charge');
    expect(r.outcomes[1].damageTaken).toBe(100);
    expect(r.outcomes[1].shieldPierced).toBe(true);
    expect(r.outcomes[1].shieldAfter).toBe(false);
  });
});

describe('resolveTurn — 동시 공격', () => {
  it('같은 단계끼리는 상쇄 (데미지 없음, 기 소모는 그대로)', () => {
    const r = run(S(0), S(1), 'attack', 'attack');
    expect(r.kind).toBe('clash');
    expect(r.outcomes.map((o) => o.damageTaken)).toEqual([0, 0]);

    const p = run(S(5), S(3), 'attack', 'attack');
    expect(p.kind).toBe('clash');
    expect(p.outcomes.map((o) => o.stacksAfter)).toEqual([2, 0]);
  });

  it('높은 단계가 압도: 강력 vs 일반 → 일반 쪽만 50', () => {
    const r = run(S(0), S(3), 'attack', 'attack');
    expect(r.kind).toBe('overpower');
    expect(r.outcomes[0].damageTaken).toBe(50);
    expect(r.outcomes[0].attackResult).toBe('overpowered');
    expect(r.outcomes[1].damageTaken).toBe(0);
    expect(r.attacker).toBe(1);
  });

  it('필살기 vs 강력 → 필살기 승', () => {
    const r = run(S(10), S(4), 'attack', 'attack');
    expect(r.kind).toBe('special');
    expect(r.ko).toEqual([false, true]);
  });

  it('필살기 vs 필살기 → 상쇄', () => {
    const r = run(S(10), S(10), 'attack', 'attack');
    expect(r.kind).toBe('clash');
    expect(r.topTier).toBe('special');
    expect(r.ko).toEqual([false, false]);
  });
});

describe('resolveTurn — 방어막', () => {
  it('방어막은 공격 1회 무효화 (데미지 0, 기 모으기는 그대로)', () => {
    const r = run(S(3), S(2, 100, true), 'attack', 'charge');
    expect(r.outcomes[1].damageTaken).toBe(0);
    expect(r.outcomes[1].shieldBlocked).toBe(true);
    expect(r.outcomes[1].shieldAfter).toBe(false);
    expect(r.outcomes[1].stacksAfter).toBe(3);
    expect(r.outcomes[0].attackResult).toBe('blocked');
    expect(r.kind).toBe('blocked');
  });

  it('피하기가 먼저 적용되어 방어막은 소모되지 않음', () => {
    const r = run(S(0), S(0, 100, true), 'attack', 'dodge');
    expect(r.outcomes[1].shieldAfter).toBe(true);
    expect(r.kind).toBe('dodge');
  });

  it('압도당한 공격자도 방어막이 있으면 막힘', () => {
    const r = run(S(0, 100, true), S(3), 'attack', 'attack');
    expect(r.outcomes[0].damageTaken).toBe(0);
    expect(r.kind).toBe('blocked');
  });
});

describe('resolveTurn — 경계값', () => {
  it('스택은 10 을 넘지 않는다', () => {
    const r = run(S(10), S(), 'charge', 'dodge');
    expect(r.outcomes[0].stacksAfter).toBe(10);
  });
  it('체력은 0 아래로 내려가지 않는다', () => {
    const r = run(S(3), S(0, 20), 'attack', 'charge');
    expect(r.outcomes[1].hpAfter).toBe(0);
    expect(r.ko).toEqual([false, true]);
  });
});
