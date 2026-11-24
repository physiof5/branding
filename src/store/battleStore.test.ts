import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from '../data/appearance';
import { OVERTIME_TURN, TIMING } from '../game/constants';
import type { ChosenAction } from '../game/types';
import { battleEvents, useBattleStore, type BattleConfig, type BattleEvent, type Controller } from './battleStore';

const config = (c1: Controller = 'human', c2: Controller = 'human', items = { shield: 0, jam: 0 }): BattleConfig => ({
  mode: c2 === 'ai' ? 'ai' : 'local',
  mapId: 'classroom',
  aiLevel: 2,
  fighters: [
    { name: 'P1', appearance: DEFAULT_APPEARANCE, controller: c1, items, startStacks: 0 },
    { name: 'P2', appearance: DEFAULT_APPEARANCE, controller: c2, items, startStacks: 0 },
  ],
});

const store = () => useBattleStore.getState();
/** 배틀 시계를 ms 만큼 16ms 단위로 진행 */
const advance = (ms: number) => {
  for (let t = 0; t < ms; t += 16) store().tick(16);
};
const untilPhase = (phase: string, limitMs = 20000) => {
  let spent = 0;
  while (store().phase !== phase && spent < limitMs) {
    store().tick(16);
    spent += 16;
  }
  return store().phase === phase;
};
const playTurn = (a: ChosenAction | null, b: ChosenAction | null) => {
  expect(untilPhase('select')).toBe(true);
  if (a) store().choose(0, a);
  if (b) store().choose(1, b);
  expect(untilPhase('aftermath')).toBe(true);
};

afterEach(() => {
  store().exit();
  battleEvents.clear();
});

describe('battleStore 상태 머신', () => {
  it('intro → select → reveal → action → aftermath → 다음 턴', () => {
    const phases: string[] = [];
    battleEvents.on((e: BattleEvent) => e.type === 'phase' && phases.push(e.phase));
    store().start(config());
    expect(store().phase).toBe('intro');
    advance(TIMING.introMs + 20);
    expect(store().phase).toBe('select');
    store().choose(0, 'charge');
    store().choose(1, 'charge');
    advance(20);
    expect(store().phase).toBe('reveal');
    expect(untilPhase('select')).toBe(true);
    expect(store().turn).toBe(2);
    expect(store().fighters.map((f) => f.stacks)).toEqual([1, 1]);
    expect(phases).toEqual(['intro', 'select', 'reveal', 'action', 'aftermath', 'select']);
  });

  it('3초 안에 안 고르면 멍때리기(idle)로 처리', () => {
    store().start(config());
    untilPhase('select');
    store().choose(1, 'attack');
    advance(TIMING.turnMs + 50);
    expect(store().timedOut[0]).toBe(true);
    expect(store().choices[0]).toBe('idle');
    untilPhase('aftermath');
    expect(store().fighters[0].hp).toBe(90);
  });

  it('데미지는 임팩트 시점에 적용된다', () => {
    store().start(config());
    untilPhase('select');
    store().choose(0, 'attack');
    store().choose(1, 'charge');
    untilPhase('action');
    expect(store().fighters[1].hp).toBe(100);
    advance(TIMING.impactMs + 40);
    expect(store().fighters[1].hp).toBe(90);
  });

  it('계속 맞으면 KO → finished, 승자 기록', () => {
    const finishes: BattleEvent[] = [];
    battleEvents.on((e) => e.type === 'finish' && finishes.push(e));
    store().start(config());
    for (let i = 0; i < 10; i++) playTurn('charge', 'attack');
    expect(store().fighters[0].hp).toBe(0);
    expect(untilPhase('finished')).toBe(true);
    expect(store().winner).toBe(1);
    expect(store().finishReason).toBe('ko');
    expect(finishes).toHaveLength(1);
  });

  it('필살기 즉사', () => {
    store().start(config());
    for (let i = 0; i < 10; i++) playTurn('charge', 'dodge');
    expect(store().fighters[0].stacks).toBe(10);
    playTurn('attack', 'dodge');
    expect(store().fighters[1].hp).toBe(0);
    expect(untilPhase('finished')).toBe(true);
    expect(store().winner).toBe(0);
  });

  it('방어막 아이템: 1회 무효 + 사용 횟수 차감', () => {
    store().start(config('human', 'human', { shield: 1, jam: 0 }));
    untilPhase('select');
    store().useItem(1, 'shield');
    expect(store().fighters[1].shield).toBe(true);
    expect(store().fighters[1].items.shield).toBe(0);
    store().choose(0, 'attack');
    store().choose(1, 'charge');
    untilPhase('aftermath');
    expect(store().fighters[1].hp).toBe(100);
    expect(store().fighters[1].stacks).toBe(1);
    expect(store().fighters[1].shield).toBe(false);
  });

  it('먹물 아이템: 상대의 다음 턴 선택 시간이 1.5초로 단축', () => {
    store().start(config('human', 'human', { shield: 0, jam: 1 }));
    untilPhase('select');
    store().useItem(0, 'jam');
    store().choose(0, 'charge');
    store().choose(1, 'charge');
    untilPhase('aftermath');
    untilPhase('select');
    expect(store().turn).toBe(2);
    expect(store().fighters[1].jammed).toBe(true);
    expect(store().turnDurations).toEqual([TIMING.turnMs, TIMING.jammedTurnMs]);
  });

  it('AI 컨트롤러는 스스로 선택을 확정한다', () => {
    store().start(config('human', 'ai'));
    untilPhase('select');
    store().choose(0, 'dodge');
    expect(untilPhase('reveal', 2000)).toBe(true);
    expect(['charge', 'dodge', 'attack']).toContain(store().choices[1]);
  });

  it(`야자 타임: ${OVERTIME_TURN}턴부터 매 턴 시작 시 두 사람 모두 기 +1`, () => {
    const overtimes: BattleEvent[] = [];
    battleEvents.on((e) => e.type === 'overtime' && overtimes.push(e));
    store().start(config());
    for (let i = 1; i < OVERTIME_TURN; i++) playTurn('dodge', 'dodge');
    expect(untilPhase('select')).toBe(true);
    expect(store().turn).toBe(OVERTIME_TURN);
    expect(store().fighters.map((f) => f.stacks)).toEqual([1, 1]);
    playTurn('dodge', 'dodge');
    untilPhase('select');
    expect(store().fighters.map((f) => f.stacks)).toEqual([2, 2]);
    expect(overtimes).toHaveLength(2);
    expect(overtimes[0]).toMatchObject({ first: true });
  });

  it('일시정지 중엔 시계가 멈춘다', () => {
    store().start(config());
    untilPhase('select');
    store().setPaused(true);
    const clock = store().clock;
    advance(5000);
    expect(store().clock).toBe(clock);
    store().setPaused(false);
    advance(100);
    expect(store().clock).toBeGreaterThan(clock);
  });

  it('기권하면 상대 승리', () => {
    store().start(config());
    untilPhase('select');
    store().forfeit(0);
    expect(store().phase).toBe('finished');
    expect(store().winner).toBe(1);
    expect(store().finishReason).toBe('forfeit');
  });
});
