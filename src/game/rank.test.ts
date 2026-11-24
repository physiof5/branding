import { describe, expect, it } from 'vitest';
import { applyTrophies, nextTier, seasonSoftReset, tierForTrophies, tierProgress, trophyDelta } from './rank';
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
    expect(computeRewards({ mode: 'local', outcome: 'win', finisher: 'special', perfect: true, winStreakBefore: 3, forfeit: false }).gold).toBe(0);
    const r = computeRewards({ mode: 'ai', outcome: 'win', finisher: 'special', perfect: true, winStreakBefore: 0, forfeit: false });
    expect(r.gold).toBe(60 + 40 + 30);
    expect(r.trophies).toBe(30);
  });

  it('패스 레벨', () => {
    expect(passLevelFor(0)).toBe(0);
    expect(passLevelFor(149)).toBe(0);
    expect(passLevelFor(150)).toBe(1);
    expect(passLevelFor(99999)).toBe(20);
    expect(passLevelProgress(225)).toBeCloseTo(0.5);
  });
});
