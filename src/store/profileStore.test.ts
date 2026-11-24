import { beforeEach, describe, expect, it } from 'vitest';
import { CHALLENGE_DAILY_GAMES, todayKey, type MatchSummary } from '../game/rewards';
import { useBattleStore } from './battleStore';
import { consumePendingBattle, launchMatch } from './matchmaking';
import { INITIAL_PROFILE, useProfileStore } from './profileStore';
import { useUIStore } from './uiStore';

const summary = (kind: MatchSummary['kind'], outcome: MatchSummary['outcome']): Omit<MatchSummary, 'winStreakBefore'> => ({
  kind,
  outcome,
  finisher: 'normal',
  perfect: false,
  forfeit: false,
});

describe('profileStore: 모드별 결과 반영', () => {
  beforeEach(() => {
    useProfileStore.setState({ ...INITIAL_PROFILE });
    useUIStore.getState().go('lobby');
    consumePendingBattle();
  });

  it('클래식 도전: 판수·승수 기록, 이기면 아이템 1개 지급, 트로피는 그대로', () => {
    const before = useProfileStore.getState().inventory;
    const report = useProfileStore.getState().applyMatch(summary('challenge', 'win'));
    const s = useProfileStore.getState();
    expect(s.trophies).toBe(0);
    expect(s.challenge).toMatchObject({ date: todayKey(), played: 1, wins: 1 });
    expect(report.item).not.toBeNull();
    expect(s.inventory[report.item!]).toBe(before[report.item!] + 1);
    expect(s.challenge.rewards).toEqual([report.item]);

    const lose = useProfileStore.getState().applyMatch(summary('challenge', 'lose'));
    expect(lose.item).toBeNull();
    expect(useProfileStore.getState().challenge).toMatchObject({ played: 2, wins: 1 });
  });

  it('날짜가 바뀌면 오늘의 도전 기록은 0부터', () => {
    useProfileStore.setState({ challenge: { date: '2000-01-01', played: 10, wins: 4, rewards: ['jam'] } });
    expect(useProfileStore.getState().challengeToday()).toMatchObject({ date: todayKey(), played: 0, wins: 0, rewards: [] });
    useProfileStore.getState().applyMatch(summary('challenge', 'lose'));
    expect(useProfileStore.getState().challenge).toMatchObject({ date: todayKey(), played: 1, wins: 0 });
  });

  it('자유 랭크전은 솔로/듀오와 별도 트로피', () => {
    useProfileStore.getState().applyMatch(summary('flex', 'win'));
    const s = useProfileStore.getState();
    expect(s.flexTrophies).toBeGreaterThan(0);
    expect(s.bestFlexTrophies).toBe(s.flexTrophies);
    expect(s.trophies).toBe(0);
  });

  it('클래식 1v1(로컬)은 전적·재화 변동 없음', () => {
    useProfileStore.getState().applyMatch(summary('local', 'win'));
    const s = useProfileStore.getState();
    expect(s.gold).toBe(INITIAL_PROFILE.gold);
    expect(s.stats.wins).toBe(0);
    expect(s.trophies).toBe(0);
  });

  it('오늘 도전 10판을 다 하면 클래식 도전은 시작되지 않음', () => {
    useProfileStore.setState({ challenge: { date: todayKey(), played: CHALLENGE_DAILY_GAMES, wins: 0, rewards: [] } });
    launchMatch({ mode: 'challenge', catalyst: [false, false] });
    expect(consumePendingBattle()).toBeNull();
    expect(useBattleStore.getState().phase).toBe('idle');
  });

  it('기폭제는 전투 준비에서 고른 경우에만 소모되고 시작 기 +1', () => {
    launchMatch({ mode: 'ranked', queue: 'solo', catalyst: [true, false] });
    const cfg = consumePendingBattle();
    expect(cfg?.kind).toBe('ranked');
    expect(cfg?.teams[0][0].startStacks).toBe(1);
    expect(useProfileStore.getState().inventory.catalyst).toBe(INITIAL_PROFILE.inventory.catalyst - 1);

    useUIStore.getState().go('lobby');
    launchMatch({ mode: 'ranked', queue: 'duo', catalyst: [false, false] });
    const duo = consumePendingBattle();
    expect(duo?.teams[0]).toHaveLength(2);
    expect(duo?.teams[1]).toHaveLength(2);
    expect(duo?.teams[0][0].startStacks).toBe(0);
  });
});
