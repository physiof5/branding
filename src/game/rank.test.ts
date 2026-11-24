import { describe, expect, it } from 'vitest';
import { applyTrophies, nextTier, seasonSoftReset, tierForTrophies, tierLabel, tierProgress, trophyDelta } from './rank';
import { computeRewards } from './rewards';
import { passLevelFor, passLevelProgress } from '../data/seasonPass';

describe('rank', () => {
  it('트로피 → 티어 & 맵', () => {
    expect(tierForTrophies(0).id).toBe('bronze');
    expect(tierForTrophies(99).mapId).toBe('classroom');
    expect(tierForTrophies(100).mapId).toBe('readingRoom');
    expect(tierForTrophies(250).mapId).toBe('scienceHigh');
    expect(tierForTrophies(450).mapId).toBe('academyStreet');
    expect(tierForTrophies(700).mapId).toBe('campus');
    expect(tierForTrophies(5000).mapId).toBe('lab');
    expect(nextTier(5000)).toBeNull();
    expect(tierProgress(175)).toBeCloseTo(0.5);
  });

  it('승패 트로피 & 0 하한', () => {
    expect(trophyDelta('win', 0)).toBe(30);
    expect(trophyDelta('win', 9)).toBe(40);
    expect(trophyDelta('lose', 3)).toBe(-20);
    expect(applyTrophies(10, -20)).toBe(0);
  });

  it('시즌 소프트 리셋', () => {
    expect(seasonSoftReset(80)).toBe(80);
    expect(seasonSoftReset(1100)).toBe(600);
  });

  it('보상 계산: 로컬은 친선전', () => {
    expect(computeRewards({ kind: 'local', outcome: 'win', finisher: 'special', perfect: true, winStreakBefore: 3, forfeit: false }).gold).toBe(0);
    const r = computeRewards({ kind: 'ranked', outcome: 'win', finisher: 'special', perfect: true, winStreakBefore: 0, forfeit: false });
    expect(r.gold).toBe(60 + 40 + 30);
    expect(r.trophies).toBe(30);
  });

  it('클래식 도전: 이기면 아이템 1개, 트로피 변동 없음', () => {
    const win = computeRewards({ kind: 'challenge', outcome: 'win', finisher: null, perfect: false, winStreakBefore: 0, forfeit: false }, () => 0.1);
    expect(win.item).toBe('shield');
    expect(win.trophies).toBe(0);
    const lose = computeRewards({ kind: 'challenge', outcome: 'lose', finisher: null, perfect: false, winStreakBefore: 0, forfeit: false });
    expect(lose.item).toBeNull();
  });

  it('티어 단계 표시', () => {
    expect(tierLabel(0)).toBe('브론즈 I');
    expect(tierLabel(60)).toBe('브론즈 II');
    expect(tierLabel(130)).toBe('실버 I');
  });

  it('패스 레벨', () => {
    expect(passLevelFor(0)).toBe(0);
    expect(passLevelFor(149)).toBe(0);
    expect(passLevelFor(150)).toBe(1);
    expect(passLevelFor(99999)).toBe(20);
    expect(passLevelProgress(225)).toBeCloseTo(0.5);
  });
});
