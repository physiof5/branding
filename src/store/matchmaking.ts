import { randomAppearance, RIVAL_NAMES } from '../data/appearance';
import { COSTUME_ORDER } from '../data/costumes';
import { EFFECT_ORDER } from '../data/effects';
import { ITEMS } from '../data/items';
import type { MapId } from '../data/maps';
import { tierForTrophies } from '../game/rank';
import { pick } from '../game/rng';
import { useBattleStore, type BattleConfig } from './battleStore';
import { useProfileStore } from './profileStore';
import { useUIStore } from './uiStore';

export type MatchKind = { kind: 'ranked' } | { kind: 'local'; mapId: MapId };

let lastMatch: MatchKind = { kind: 'ranked' };
let pending: BattleConfig | null = null;
export const getLastMatch = (): MatchKind => lastMatch;

/**
 * 배틀 화면이 이미 떠 있으면 바로 시작, 아니면 화면 전환 후 BattleScreen 이
 * 사운드/카메라/HUD 구독을 마친 뒤 시작하도록 예약한다 (첫 이벤트 누락 방지).
 */
function launch(config: BattleConfig): void {
  const ui = useUIStore.getState();
  if (ui.screen === 'battle') {
    useBattleStore.getState().start(config);
  } else {
    pending = config;
    ui.go('battle');
  }
}

export function consumePendingBattle(): BattleConfig | null {
  const c = pending;
  pending = null;
  return c;
}

/** AI 랭크전: 티어 → 맵/AI 난이도 자동 결정 */
export function startRankedBattle(): void {
  const profile = useProfileStore.getState();
  const tier = tierForTrophies(profile.trophies);
  const useCatalyst = profile.useCatalyst && profile.inventory.catalyst > 0;
  if (useCatalyst) profile.consumeItem('catalyst');
  const rival = randomAppearance(Math.random, COSTUME_ORDER, EFFECT_ORDER);
  lastMatch = { kind: 'ranked' };
  launch({
    mode: 'ai',
    mapId: tier.mapId,
    aiLevel: tier.aiLevel,
    fighters: [
      {
        name: profile.nickname,
        appearance: profile.appearance,
        controller: 'human',
        items: {
          shield: Math.min(profile.inventory.shield, ITEMS.shield.maxPerBattle),
          jam: Math.min(profile.inventory.jam, ITEMS.jam.maxPerBattle),
        },
        startStacks: useCatalyst ? 1 : 0,
      },
      {
        name: pick(RIVAL_NAMES),
        appearance: rival,
        controller: 'ai',
        items: { shield: tier.aiLevel >= 1 ? 1 : 0, jam: tier.aiLevel >= 2 ? 1 : 0 },
        startStacks: tier.aiLevel >= 3 && Math.random() < 0.35 ? 1 : 0,
      },
    ],
  });
}

/** 로컬 2인 대전 (한 기기, 숨김 선택, 친선전) */
export function startLocalBattle(mapId: MapId): void {
  const profile = useProfileStore.getState();
  lastMatch = { kind: 'local', mapId };
  launch({
    mode: 'local',
    mapId,
    aiLevel: 0,
    fighters: [
      { name: '1P', appearance: profile.appearance, controller: 'human', items: { shield: 0, jam: 0 }, startStacks: 0 },
      {
        name: '2P',
        appearance: { ...randomAppearance(Math.random, COSTUME_ORDER), effectId: 'basic' },
        controller: 'human',
        items: { shield: 0, jam: 0 },
        startStacks: 0,
      },
    ],
  });
}

export function rematch(): void {
  const m = lastMatch;
  if (m.kind === 'local') startLocalBattle(m.mapId);
  else startRankedBattle();
}
