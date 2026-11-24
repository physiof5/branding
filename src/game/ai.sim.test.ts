import { describe, expect, it } from 'vitest';
import { decideAiAction } from './ai';
import { MAX_STACKS, OVERTIME_TURN, TIMING } from './constants';
import { createRng } from './rng';
import { resolveTurn } from './rules';
import type { ActionType, CombatState } from './types';

/** AI vs AI 시뮬레이션 (야자 타임 포함): 난이도가 높을수록 이기고, 판이 KO 로 결판나는지 확인 */
function simulate(levelA: number, levelB: number, games: number, seed: number) {
  const rng = createRng(seed);
  let winsA = 0;
  let winsB = 0;
  let turnsTotal = 0;
  let kos = 0;
  for (let g = 0; g < games; g++) {
    let a: CombatState = { hp: 100, stacks: 0, shield: false };
    let b: CombatState = { hp: 100, stacks: 0, shield: false };
    const histA: ActionType[] = [];
    const histB: ActionType[] = [];
    let turn = 0;
    while (a.hp > 0 && b.hp > 0 && turn < TIMING.maxTurns) {
      turn++;
      if (turn >= OVERTIME_TURN) {
        a = { ...a, stacks: Math.min(MAX_STACKS, a.stacks + 1) };
        b = { ...b, stacks: Math.min(MAX_STACKS, b.stacks + 1) };
      }
      const actA = decideAiAction({ self: a, opp: b, oppHistory: histB, level: levelA, rng });
      const actB = decideAiAction({ self: b, opp: a, oppHistory: histA, level: levelB, rng });
      const r = resolveTurn([a, b], [actA, actB]);
      a = { hp: r.outcomes[0].hpAfter, stacks: r.outcomes[0].stacksAfter, shield: r.outcomes[0].shieldAfter };
      b = { hp: r.outcomes[1].hpAfter, stacks: r.outcomes[1].stacksAfter, shield: r.outcomes[1].shieldAfter };
      histA.push(actA);
      histB.push(actB);
    }
    turnsTotal += turn;
    if (a.hp <= 0 || b.hp <= 0) kos++;
    if (a.hp > b.hp) winsA++;
    else if (b.hp > a.hp) winsB++;
  }
  return { winsA, winsB, avgTurns: turnsTotal / games, koRate: kos / games };
}

describe('AI 밸런스 시뮬레이션', () => {
  it('마스터 AI 는 새내기 AI 를 확실히 이긴다', () => {
    const r = simulate(3, 0, 300, 42);
    console.log('L3 vs L0', r);
    expect(r.winsA).toBeGreaterThan(r.winsB * 1.5);
  });

  it('같은 난이도끼리는 비슷하고, 대부분 KO 로 결판난다', () => {
    const r = simulate(2, 2, 300, 7);
    console.log('L2 vs L2', r);
    expect(Math.abs(r.winsA - r.winsB)).toBeLessThan(60);
    expect(r.koRate).toBeGreaterThan(0.65);
    expect(r.avgTurns).toBeLessThan(25);
  });
});
