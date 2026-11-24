import { describe, expect, it } from 'vitest';
import { decideAiAction, decideAiItem, evaluateActions, observedDistribution, predictOpponent } from './ai';
import { createRng } from './rng';
import type { CombatState } from './types';

const S = (stacks = 0, hp = 100, shield = false): CombatState => ({ hp, stacks, shield });

describe('AI', () => {
  it('항상 유효한 행동을 고른다', () => {
    const rng = createRng(7);
    for (let i = 0; i < 300; i++) {
      const a = decideAiAction({ self: S(i % 11), opp: S((i * 3) % 11), oppHistory: [], level: i % 4, rng });
      expect(['charge', 'dodge', 'attack']).toContain(a);
    }
  });

  it('필살기가 준비되면 공격한다', () => {
    const rng = createRng(1);
    let attacks = 0;
    for (let i = 0; i < 100; i++) {
      if (decideAiAction({ self: S(10), opp: S(2), oppHistory: [], level: 3, rng }) === 'attack') attacks++;
    }
    expect(attacks).toBeGreaterThan(90);
  });

  it('상대가 기 모으기만 반복하면(무방비) 강력 공격 가치가 가장 높다', () => {
    const ev = evaluateActions({ self: S(3), opp: S(2), oppHistory: Array(8).fill('charge'), level: 3 });
    expect(ev.attack).toBeGreaterThan(ev.charge);
    expect(ev.attack).toBeGreaterThan(ev.dodge);
  });

  it('상대가 피하기만 반복하면 공격 대신 기를 모은다', () => {
    const ev = evaluateActions({ self: S(1), opp: S(1), oppHistory: Array(8).fill('dodge'), level: 3 });
    expect(ev.charge).toBeGreaterThan(ev.attack);
    expect(ev.charge).toBeGreaterThan(ev.dodge);
  });

  it('상대의 반복 패턴을 학습한다 (마스터)', () => {
    const history = Array.from({ length: 8 }, () => 'charge' as const);
    const pred = predictOpponent({ self: S(), opp: S(0), oppHistory: history, level: 3 });
    expect(pred.charge).toBeGreaterThan(0.6);
    const obs = observedDistribution(['attack', 'dodge', 'attack', 'dodge', 'attack']);
    expect(obs?.dist.dodge).toBeGreaterThan(0.3);
  });

  it('브론즈 AI 는 아이템을 쓰지 않는다', () => {
    const item = decideAiItem({
      self: S(),
      opp: S(9),
      oppHistory: [],
      level: 0,
      items: { shield: 1, jam: 1 },
      planned: 'charge',
      rng: () => 0,
    });
    expect(item).toBeNull();
  });

  it('먹물에 맞으면(confused) 무작위', () => {
    const rng = createRng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(decideAiAction({ self: S(10), opp: S(), oppHistory: [], level: 3, confused: true, rng }));
    expect(seen.size).toBe(3);
  });
});
