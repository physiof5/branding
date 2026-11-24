import type { PassReward } from './seasonPass';

/** 트로피 로드: 50 트로피마다 보상 (최고 기록 기준으로 한 번씩 받기) */
export interface RoadStep {
  trophies: number;
  reward: PassReward;
}

const g = (amount: number): PassReward => ({ kind: 'gold', amount });

export const TROPHY_ROAD: readonly RoadStep[] = [
  { trophies: 50, reward: { kind: 'item', itemId: 'catalyst', amount: 1 } },
  { trophies: 100, reward: g(150) },
  { trophies: 150, reward: { kind: 'item', itemId: 'shield', amount: 1 } },
  { trophies: 200, reward: { kind: 'item', itemId: 'jam', amount: 1 } },
  { trophies: 250, reward: { kind: 'costume', costumeId: 'uniform' } },
  { trophies: 300, reward: g(200) },
  { trophies: 350, reward: { kind: 'item', itemId: 'shield', amount: 2 } },
  { trophies: 400, reward: { kind: 'item', itemId: 'catalyst', amount: 2 } },
  { trophies: 450, reward: g(300) },
  { trophies: 500, reward: { kind: 'item', itemId: 'jam', amount: 2 } },
  { trophies: 550, reward: { kind: 'item', itemId: 'shield', amount: 2 } },
  { trophies: 600, reward: g(300) },
  { trophies: 650, reward: { kind: 'item', itemId: 'catalyst', amount: 3 } },
  { trophies: 700, reward: { kind: 'costume', costumeId: 'hoodie' } },
  { trophies: 750, reward: g(400) },
  { trophies: 800, reward: { kind: 'item', itemId: 'shield', amount: 3 } },
  { trophies: 850, reward: { kind: 'item', itemId: 'jam', amount: 3 } },
  { trophies: 900, reward: g(500) },
  { trophies: 950, reward: { kind: 'item', itemId: 'catalyst', amount: 3 } },
  { trophies: 1000, reward: g(1000) },
];
