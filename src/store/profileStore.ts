import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clamp01, DEFAULT_APPEARANCE, randomAppearance, type Appearance } from '../data/appearance';
import { COSTUMES, type CostumeId } from '../data/costumes';
import type { EffectId } from '../data/effects';
import { ITEMS, type ItemId } from '../data/items';
import { PASS_LEVELS, passLevelFor, type PassReward, type PassTrack } from '../data/seasonPass';
import { applyTrophies, SEASON, tierForTrophies, type TierDef } from '../game/rank';
import { computeRewards, type MatchSummary, type RewardSummary } from '../game/rewards';
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

export interface MatchReport extends RewardSummary {
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
  trophies: number;
  bestTrophies: number;
  seasonId: number;
  stats: PlayerStats;
  inventory: Record<ItemId, number>;
  /** 로비 토글: 다음 랭크전에 기폭제 자동 사용 */
  useCatalyst: boolean;
  ownedCostumes: CostumeId[];
  ownedEffects: EffectId[];
  pass: PassProgress;
}

export interface ProfileActions {
  setNickname(name: string): void;
  updateAppearance(patch: Partial<Appearance>): void;
  resetAppearance(): void;
  randomizeAppearance(): void;
  setUseCatalyst(on: boolean): void;
  buyItem(id: ItemId): boolean;
  buyCostume(id: CostumeId): boolean;
  consumeItem(id: ItemId): boolean;
  /** 경기 결과 반영 (골드·트로피·패스 XP·전적) */
  applyMatch(summary: Omit<MatchSummary, 'winStreakBefore'>): MatchReport;
  claimPassReward(track: PassTrack, level: number): PassReward | null;
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
  seasonId: SEASON.id,
  stats: { wins: 0, losses: 0, draws: 0, winStreak: 0, bestStreak: 0, specialFinishes: 0 },
  // 첫 판부터 아이템을 체험할 수 있도록 웰컴 키트 지급
  inventory: { shield: 1, jam: 1, catalyst: 1 },
  useCatalyst: false,
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

      setUseCatalyst: (on) => set({ useCatalyst: on }),

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
        const rewards = computeRewards({ ...summary, winStreakBefore: s.stats.winStreak });
        const trophiesAfter = applyTrophies(s.trophies, rewards.trophies);
        const stats = { ...s.stats };
        if (summary.mode === 'ai') {
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
        const xpAfter = s.pass.xp + rewards.xp;
        set({
          gold: s.gold + rewards.gold,
          trophies: trophiesAfter,
          bestTrophies: Math.max(s.bestTrophies, trophiesAfter),
          stats,
          pass: { ...s.pass, xp: xpAfter },
        });
        return {
          ...rewards,
          trophiesBefore: s.trophies,
          trophiesAfter,
          tierBefore: tierForTrophies(s.trophies),
          tierAfter: tierForTrophies(trophiesAfter),
          passLevelBefore: passLevelFor(s.pass.xp),
          passLevelAfter: passLevelFor(xpAfter),
        };
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
        seasonId: s.seasonId,
        stats: s.stats,
        inventory: s.inventory,
        useCatalyst: s.useCatalyst,
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
