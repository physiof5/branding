import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clamp01, DEFAULT_APPEARANCE, randomAppearance, type Appearance } from '../data/appearance';
import { COSTUMES, type CostumeId } from '../data/costumes';
import type { EffectId } from '../data/effects';
import { ITEMS, type ItemId } from '../data/items';
import { PASS_LEVELS, passLevelFor, type PassReward, type PassTrack } from '../data/seasonPass';
import { TROPHY_ROAD } from '../data/trophyRoad';
import { applyTrophies, SEASON, tierForTrophies, type TierDef } from '../game/rank';
import { computeRewards, todayKey, type MatchSummary, type RewardSummary } from '../game/rewards';
import { safeJSONStorage } from './safeStorage';

export interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestStreak: number;
  specialFinishes: number;
}

export interface PassProgress {
  xp: number;
  premium: boolean;
  claimed: Record<PassTrack, number[]>;
}

/** 클래식 도전 오늘 기록 (날짜가 바뀌면 초기화) */
export interface ChallengeDay {
  date: string;
  played: number;
  wins: number;
  rewards: ItemId[];
}

export interface MatchReport extends RewardSummary {
  kind: MatchSummary['kind'];
  trophiesBefore: number;
  trophiesAfter: number;
  tierBefore: TierDef;
  tierAfter: TierDef;
  passLevelBefore: number;
  passLevelAfter: number;
}

export interface ProfileData {
  nickname: string;
  appearance: Appearance;
  gold: number;
  /** 클래식 랭크전(솔로/듀오) 트로피 */
  trophies: number;
  bestTrophies: number;
  /** 자유 랭크전(1~3인 파티) 트로피 */
  flexTrophies: number;
  bestFlexTrophies: number;
  seasonId: number;
  stats: PlayerStats;
  inventory: Record<ItemId, number>;
  challenge: ChallengeDay;
  /** 받은 트로피 로드 보상 (트로피 기준값) */
  roadClaimed: number[];
  ownedCostumes: CostumeId[];
  ownedEffects: EffectId[];
  pass: PassProgress;
}

export interface ProfileActions {
  setNickname(name: string): void;
  updateAppearance(patch: Partial<Appearance>): void;
  resetAppearance(): void;
  randomizeAppearance(): void;
  buyItem(id: ItemId): boolean;
  buyCostume(id: CostumeId): boolean;
  consumeItem(id: ItemId): boolean;
  /** 경기 결과 반영 (골드·트로피·패스 XP·전적·도전 보상) */
  applyMatch(summary: Omit<MatchSummary, 'winStreakBefore'>): MatchReport;
  claimPassReward(track: PassTrack, level: number): PassReward | null;
  claimRoadReward(trophies: number): PassReward | null;
  /** 오늘 클래식 도전 기록 (날짜 바뀌면 0부터) */
  challengeToday(): ChallengeDay;
  /** 데모: 실제 결제 연동 전, 프리미엄 트랙 해금 */
  unlockPremium(): void;
  resetProfile(): void;
}

export type ProfileState = ProfileData & ProfileActions;

export const INITIAL_PROFILE: ProfileData = {
  nickname: '엉덩이 수험생',
  appearance: DEFAULT_APPEARANCE,
  gold: 300,
  trophies: 0,
  bestTrophies: 0,
  flexTrophies: 0,
  bestFlexTrophies: 0,
  seasonId: SEASON.id,
  stats: { wins: 0, losses: 0, draws: 0, winStreak: 0, bestStreak: 0, specialFinishes: 0 },
  // 첫 판부터 아이템을 체험할 수 있도록 웰컴 키트 지급
  inventory: { shield: 1, jam: 1, catalyst: 1 },
  challenge: { date: '', played: 0, wins: 0, rewards: [] },
  roadClaimed: [],
  ownedCostumes: ['scrubs'],
  ownedEffects: ['basic'],
  pass: { xp: 0, premium: false, claimed: { free: [], premium: [] } },
};

function grant(state: ProfileData, reward: PassReward): Partial<ProfileData> {
  switch (reward.kind) {
    case 'gold':
      return { gold: state.gold + reward.amount };
    case 'item':
      return { inventory: { ...state.inventory, [reward.itemId]: state.inventory[reward.itemId] + reward.amount } };
    case 'costume':
      return state.ownedCostumes.includes(reward.costumeId)
        ? { gold: state.gold + 300 } // 중복 보상은 골드로 환급
        : { ownedCostumes: [...state.ownedCostumes, reward.costumeId] };
    case 'effect':
      return state.ownedEffects.includes(reward.effectId)
        ? { gold: state.gold + 200 }
        : { ownedEffects: [...state.ownedEffects, reward.effectId] };
  }
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      ...INITIAL_PROFILE,

      setNickname: (name) => set({ nickname: name.trim().slice(0, 12) || INITIAL_PROFILE.nickname }),

      updateAppearance: (patch) =>
        set((s) => {
          const next: Appearance = { ...s.appearance, ...patch };
          next.bodyType = clamp01(next.bodyType);
          next.height = clamp01(next.height);
          next.buttVolume = clamp01(next.buttVolume);
          if (!s.ownedCostumes.includes(next.costumeId)) next.costumeId = s.appearance.costumeId;
          if (!s.ownedEffects.includes(next.effectId)) next.effectId = s.appearance.effectId;
          return { appearance: next };
        }),

      resetAppearance: () => set({ appearance: DEFAULT_APPEARANCE }),

      randomizeAppearance: () =>
        set((s) => ({ appearance: randomAppearance(Math.random, s.ownedCostumes, s.ownedEffects) })),

      buyItem: (id) => {
        const s = get();
        const price = ITEMS[id].price;
        if (s.gold < price) return false;
        set({ gold: s.gold - price, inventory: { ...s.inventory, [id]: s.inventory[id] + 1 } });
        return true;
      },

      buyCostume: (id) => {
        const s = get();
        const price = COSTUMES[id].price;
        if (price === null || s.ownedCostumes.includes(id) || s.gold < price) return false;
        set({ gold: s.gold - price, ownedCostumes: [...s.ownedCostumes, id] });
        return true;
      },

      consumeItem: (id) => {
        const s = get();
        if (s.inventory[id] <= 0) return false;
        set({ inventory: { ...s.inventory, [id]: s.inventory[id] - 1 } });
        return true;
      },

      applyMatch: (summary) => {
        const s = get();
        const flex = summary.kind === 'flex';
        const ranked = summary.kind === 'ranked' || flex;
        const rewards = computeRewards({ ...summary, winStreakBefore: s.stats.winStreak });
        const before = flex ? s.flexTrophies : s.trophies;
        const after = ranked ? applyTrophies(before, rewards.trophies) : before;
        const stats = { ...s.stats };
        if (summary.kind !== 'local') {
          if (summary.outcome === 'win') {
            stats.wins++;
            stats.winStreak++;
            stats.bestStreak = Math.max(stats.bestStreak, stats.winStreak);
            if (summary.finisher === 'special') stats.specialFinishes++;
          } else if (summary.outcome === 'lose') {
            stats.losses++;
            stats.winStreak = 0;
          } else {
            stats.draws++;
          }
        }
        const patch: Partial<ProfileData> = {
          gold: s.gold + rewards.gold,
          stats,
          pass: { ...s.pass, xp: s.pass.xp + rewards.xp },
        };
        if (flex) Object.assign(patch, { flexTrophies: after, bestFlexTrophies: Math.max(s.bestFlexTrophies, after) });
        else if (ranked) Object.assign(patch, { trophies: after, bestTrophies: Math.max(s.bestTrophies, after) });
        if (summary.kind === 'challenge') {
          const day = get().challengeToday();
          patch.challenge = {
            ...day,
            played: day.played + 1,
            wins: day.wins + (summary.outcome === 'win' ? 1 : 0),
            rewards: rewards.item ? [...day.rewards, rewards.item] : day.rewards,
          };
          if (rewards.item) patch.inventory = { ...s.inventory, [rewards.item]: s.inventory[rewards.item] + 1 };
        }
        set(patch);
        return {
          ...rewards,
          kind: summary.kind,
          trophiesBefore: before,
          trophiesAfter: after,
          tierBefore: tierForTrophies(before),
          tierAfter: tierForTrophies(after),
          passLevelBefore: passLevelFor(s.pass.xp),
          passLevelAfter: passLevelFor(s.pass.xp + rewards.xp),
        };
      },

      challengeToday: () => {
        const c = get().challenge;
        const today = todayKey();
        return c.date === today ? c : { date: today, played: 0, wins: 0, rewards: [] };
      },

      claimRoadReward: (trophies) => {
        const s = get();
        const step = TROPHY_ROAD.find((r) => r.trophies === trophies);
        if (!step || s.bestTrophies < trophies || s.roadClaimed.includes(trophies)) return null;
        set({ ...grant(s, step.reward), roadClaimed: [...s.roadClaimed, trophies] });
        return step.reward;
      },

      claimPassReward: (track, level) => {
        const s = get();
        const def = PASS_LEVELS.find((l) => l.level === level);
        if (!def) return null;
        const reward = track === 'free' ? def.free : def.premium;
        if (!reward) return null;
        if (passLevelFor(s.pass.xp) < level) return null;
        if (track === 'premium' && !s.pass.premium) return null;
        if (s.pass.claimed[track].includes(level)) return null;
        set({
          ...grant(s, reward),
          pass: { ...s.pass, claimed: { ...s.pass.claimed, [track]: [...s.pass.claimed[track], level] } },
        });
        return reward;
      },

      unlockPremium: () => set((s) => ({ pass: { ...s.pass, premium: true } })),

      resetProfile: () => set({ ...INITIAL_PROFILE }),
    }),
    {
      name: 'sbb-profile',
      storage: safeJSONStorage,
      version: 1,
      // 액션은 저장하지 않고 데이터만 저장
      partialize: (s): ProfileData => ({
        nickname: s.nickname,
        appearance: s.appearance,
        gold: s.gold,
        trophies: s.trophies,
        bestTrophies: s.bestTrophies,
        flexTrophies: s.flexTrophies,
        bestFlexTrophies: s.bestFlexTrophies,
        seasonId: s.seasonId,
        stats: s.stats,
        inventory: s.inventory,
        challenge: s.challenge,
        roadClaimed: s.roadClaimed,
        ownedCostumes: s.ownedCostumes,
        ownedEffects: s.ownedEffects,
        pass: s.pass,
      }),
      // 저장본에 새 필드가 없을 때를 대비해 기본값과 깊게 병합
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProfileData>;
        return {
          ...current,
          ...p,
          appearance: { ...DEFAULT_APPEARANCE, ...p.appearance },
          stats: { ...INITIAL_PROFILE.stats, ...p.stats },
          inventory: { ...INITIAL_PROFILE.inventory, ...p.inventory },
          challenge: { ...INITIAL_PROFILE.challenge, ...p.challenge },
          roadClaimed: p.roadClaimed ?? [],
          pass: {
            ...INITIAL_PROFILE.pass,
            ...p.pass,
            claimed: { ...INITIAL_PROFILE.pass.claimed, ...p.pass?.claimed },
          },
        };
      },
    },
  ),
);
