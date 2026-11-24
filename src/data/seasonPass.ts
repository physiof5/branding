import { COSTUMES, type CostumeId } from './costumes';
import { EFFECTS, type EffectId } from './effects';
import { ITEMS, type ItemId } from './items';

export type PassReward =
  | { kind: 'gold'; amount: number }
  | { kind: 'item'; itemId: ItemId; amount: number }
  | { kind: 'costume'; costumeId: CostumeId }
  | { kind: 'effect'; effectId: EffectId };

export type PassTrack = 'free' | 'premium';

export interface PassLevel {
  level: number;
  free: PassReward | null;
  premium: PassReward;
}

export const PASS_XP_PER_LEVEL = 150;
export const PASS_MAX_LEVEL = 20;

const g = (amount: number): PassReward => ({ kind: 'gold', amount });
const it = (itemId: ItemId, amount: number): PassReward => ({ kind: 'item', itemId, amount });
const co = (costumeId: CostumeId): PassReward => ({ kind: 'costume', costumeId });
const fx = (effectId: EffectId): PassReward => ({ kind: 'effect', effectId });

export const PASS_LEVELS: readonly PassLevel[] = [
  { level: 1, free: g(50), premium: g(100) },
  { level: 2, free: it('catalyst', 1), premium: it('shield', 2) },
  { level: 3, free: g(80), premium: g(150) },
  { level: 4, free: it('shield', 1), premium: it('jam', 2) },
  { level: 5, free: g(100), premium: fx('gold') },
  { level: 6, free: it('jam', 1), premium: g(200) },
  { level: 7, free: g(100), premium: it('catalyst', 3) },
  { level: 8, free: fx('sakura'), premium: g(200) },
  { level: 9, free: g(120), premium: it('shield', 3) },
  { level: 10, free: it('catalyst', 2), premium: co('labcoat') },
  { level: 11, free: g(120), premium: g(250) },
  { level: 12, free: it('shield', 1), premium: it('jam', 3) },
  { level: 13, free: g(150), premium: g(250) },
  { level: 14, free: it('jam', 1), premium: it('catalyst', 3) },
  { level: 15, free: co('seonbi'), premium: fx('galaxy') },
  { level: 16, free: g(150), premium: g(300) },
  { level: 17, free: it('catalyst', 2), premium: it('shield', 3) },
  { level: 18, free: g(200), premium: fx('rainbow') },
  { level: 19, free: it('shield', 2), premium: g(400) },
  { level: 20, free: g(300), premium: co('goldScrubs') },
];

/** 누적 XP → 도달 레벨 (0 ~ 20) */
export function passLevelFor(xp: number): number {
  return Math.min(PASS_MAX_LEVEL, Math.floor(Math.max(0, xp) / PASS_XP_PER_LEVEL));
}

/** 다음 레벨까지 진행도 0~1 */
export function passLevelProgress(xp: number): number {
  if (passLevelFor(xp) >= PASS_MAX_LEVEL) return 1;
  return (Math.max(0, xp) % PASS_XP_PER_LEVEL) / PASS_XP_PER_LEVEL;
}

export function rewardLabel(r: PassReward): string {
  switch (r.kind) {
    case 'gold':
      return `${r.amount} 골드`;
    case 'item':
      return `${ITEMS[r.itemId].name} ×${r.amount}`;
    case 'costume':
      return COSTUMES[r.costumeId].name;
    case 'effect':
      return EFFECTS[r.effectId].name;
  }
}

export function rewardEmoji(r: PassReward): string {
  switch (r.kind) {
    case 'gold':
      return '🪙';
    case 'item':
      return ITEMS[r.itemId].emoji;
    case 'costume':
      return '👕';
    case 'effect':
      return '✨';
  }
}
