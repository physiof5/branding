import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from '../data/appearance';
import { INK_TURNS, OVERTIME_TURN, TIMING } from '../game/constants';
import type { ChosenAction } from '../game/types';
import { battleEvents, perceivedStacks, teamRemaining, useBattleStore, type BattleConfig, type BattleEvent, type Controller, type FighterSetup } from './battleStore';

const member = (name: string, controller: Controller, items = { shield: 0, jam: 0 }): FighterSetup => ({
  name,
  appearance: DEFAULT_APPEARANCE,
  controller,
  items,
  startStacks: 0,
});

const config = (c1: Controller = 'human', c2: Controller = 'human', items = { shield: 0, jam: 0 }): BattleConfig => ({
  mode: c2 === 'ai' ? 'ai' : 'local',
  kind: c2 === 'ai' ? 'ranked' : 'local',
  mapId: 'classroom',
  aiLevel: 2,
  teams: [[member('P1', c1, items)], [member('P2', c2, items)]],
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

  it(`먹물 폭탄: 맞은 쪽은 ${INK_TURNS}턴 동안 상대 기 게이지가 멈춰 보인다`, () => {
    store().start(config('human', 'human', { shield: 0, jam: 1 }));
    untilPhase('select');
    store().useItem(0, 'jam');
    expect(store().fighters[1].inkTurns).toBe(INK_TURNS);
    store().choose(0, 'charge');
    store().choose(1, 'dodge');
    untilPhase('aftermath');
    // P1 은 기가 1 이 됐지만 먹물 맞은 P2 눈에는 0 으로 보인다
    expect(store().fighters[0].stacks).toBe(1);
    expect(perceivedStacks(store(), 1)).toBe(0);
    expect(perceivedStacks(store(), 0)).toBe(0);
    for (let i = 0; i < INK_TURNS - 1; i++) playTurn('charge', 'dodge');
    untilPhase('select');
    expect(store().fighters[1].inkTurns).toBe(0);
    expect(perceivedStacks(store(), 1)).toBe(INK_TURNS);
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
    expect(store().turnDurations).toEqual([TIMING.overtimeTurnMs, TIMING.overtimeTurnMs]);
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

  it('팀 릴레이: 쓰러지면 다음 주자가 나오고, 전멸하면 패배', () => {
    const swaps: BattleEvent[] = [];
    battleEvents.on((e) => e.type === 'swap' && swaps.push(e));
    store().start({
      mode: 'local',
      kind: 'local',
      mapId: 'classroom',
      aiLevel: 0,
      teams: [[member('A1', 'human'), member('A2', 'human')], [member('B1', 'human')]],
    });
    for (let i = 0; i < 10; i++) playTurn('charge', 'attack');
    expect(untilPhase('swap')).toBe(true);
    expect(swaps).toHaveLength(1);
    expect(store().fighters[0].name).toBe('A2');
    expect(store().fighters[0].hp).toBe(100);
    expect(store().fighters[1].hp).toBe(100);
    expect(store().fighters[1].stacks).toBe(0);
    expect(teamRemaining(store(), 0)).toBe(1);
    expect(untilPhase('select')).toBe(true);
    expect(store().turn).toBe(1);
    for (let i = 0; i < 10; i++) playTurn('charge', 'attack');
    expect(untilPhase('finished')).toBe(true);
    expect(store().winner).toBe(1);
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
