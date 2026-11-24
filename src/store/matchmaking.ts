import { randomAppearance, RIVAL_NAMES } from '../data/appearance';
import { COSTUME_ORDER } from '../data/costumes';
import { EFFECT_ORDER } from '../data/effects';
import { ITEMS } from '../data/items';
import type { MapId } from '../data/maps';
import { tierForTrophies } from '../game/rank';
import type { MatchKind } from '../game/rewards';
import { useBattleStore, type BattleConfig, type FighterSetup } from './battleStore';
import { useProfileStore } from './profileStore';
import { useUIStore } from './uiStore';

// ─────────────────────────────────────────────────────────────
// 모드별 팀 구성 → BattleConfig
//  · 클래식 랭크전: 솔로(1:1) / 듀오(2:2 릴레이, 파트너 1명)
//  · 자유 랭크전: 1~3인 파티 릴레이 (별도 자유 랭크 트로피)
//  · 클래식 도전: 하루 10판, 이길 때마다 아이템 (AI 한 단계 강함)
//  · 클래식 1v1: 한 기기 2인 친선전
// 파트너는 'AI 파트너' 또는 '같은 기기 친구'(자기 차례에 기기를 넘겨받아 조작)
// ─────────────────────────────────────────────────────────────

export type PartnerKind = 'ai' | 'friend';

export interface MatchOptions {
  mode: MatchKind;
  /** 클래식 랭크전 큐 */
  queue?: 'solo' | 'duo';
  /** 자유 랭크전 파티 인원 1~3 */
  partySize?: number;
  /** 파트너별 조작 방식 (나 제외) */
  partners?: PartnerKind[];
  /** 기폭제 사용 [1P, 2P(로컬)] — 전투 준비 화면에서 결정 */
  catalyst: [boolean, boolean];
  /** 클래식 1v1 무대 */
  mapId?: MapId;
}

let lastOptions: MatchOptions | null = null;
let pending: BattleConfig | null = null;
export const getLastOptions = (): MatchOptions | null => lastOptions;

/** 배틀 화면이 떠 있으면 바로 시작, 아니면 화면 전환 후 구독이 붙은 뒤 시작 (첫 이벤트 누락 방지) */
function launch(config: BattleConfig): void {
  const ui = useUIStore.getState();
  if (ui.screen === 'battle') useBattleStore.getState().start(config);
  else {
    pending = config;
    ui.go('battle');
  }
}

export function consumePendingBattle(): BattleConfig | null {
  const c = pending;
  pending = null;
  return c;
}

const NO_ITEMS = { shield: 0, jam: 0 };

function pickNames(n: number): string[] {
  const pool = [...RIVAL_NAMES];
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0] ?? `라이벌 ${i + 1}`);
  return out;
}

function rivalTeam(n: number, aiLevel: number): FighterSetup[] {
  return pickNames(n).map((name, i) => ({
    name,
    appearance: randomAppearance(Math.random, COSTUME_ORDER, EFFECT_ORDER),
    controller: 'ai',
    items: { shield: aiLevel >= 1 ? 1 : 0, jam: aiLevel >= 2 ? 1 : 0 },
    startStacks: i === 0 && aiLevel >= 3 && Math.random() < 0.35 ? 1 : 0,
  }));
}

/** 팀 인원 (나 포함) */
export function teamSizeFor(o: Pick<MatchOptions, 'mode' | 'queue' | 'partySize'>): number {
  if (o.mode === 'ranked') return o.queue === 'duo' ? 2 : 1;
  if (o.mode === 'flex') return Math.max(1, Math.min(3, o.partySize ?? 2));
  return 1;
}

export function launchMatch(o: MatchOptions): void {
  const profile = useProfileStore.getState();
  lastOptions = o;
  const flex = o.mode === 'flex';
  const ladder = flex ? profile.flexTrophies : profile.trophies;
  const tier = tierForTrophies(ladder);
  const aiLevel = o.mode === 'challenge' ? Math.min(3, tier.aiLevel + 1) : tier.aiLevel;

  // 기폭제는 전투 준비 화면에서 고른 만큼만 인벤토리에서 차감
  let catalysts = profile.inventory.catalyst;
  const useCat = (want: boolean) => {
    if (!want || catalysts <= 0) return 0;
    catalysts--;
    profile.consumeItem('catalyst');
    return 1;
  };
  const myItems = {
    shield: Math.min(profile.inventory.shield, ITEMS.shield.maxPerBattle),
    jam: Math.min(profile.inventory.jam, ITEMS.jam.maxPerBattle),
  };
  const me: FighterSetup = {
    name: o.mode === 'local' ? '1P' : profile.nickname,
    appearance: profile.appearance,
    controller: 'human',
    items: o.mode === 'local' ? NO_ITEMS : myItems,
    startStacks: useCat(o.catalyst[0]),
  };

  if (o.mode === 'local') {
    launch({
      mode: 'local',
      kind: 'local',
      mapId: o.mapId ?? 'classroom',
      aiLevel: 0,
      teams: [
        [me],
        [
          {
            name: '2P',
            appearance: { ...randomAppearance(Math.random, COSTUME_ORDER), effectId: 'basic' },
            controller: 'human',
            items: NO_ITEMS,
            startStacks: useCat(o.catalyst[1]),
          },
        ],
      ],
    });
    return;
  }

  const size = teamSizeFor(o);
  const partners: FighterSetup[] = Array.from({ length: size - 1 }, (_, i) => {
    const kind = o.partners?.[i] ?? 'ai';
    return {
      name: kind === 'friend' ? `친구 ${i + 1}` : `AI 파트너 ${i + 1}`,
      appearance: randomAppearance(Math.random, COSTUME_ORDER, EFFECT_ORDER),
      controller: kind === 'friend' ? 'human' : 'ai',
      items: NO_ITEMS,
      startStacks: 0,
    };
  });

  launch({
    mode: 'ai',
    kind: o.mode,
    mapId: tier.mapId,
    aiLevel,
    teams: [[me, ...partners], rivalTeam(size, aiLevel)],
  });
}

export function rematch(): void {
  if (!lastOptions) return;
  const profile = useProfileStore.getState();
  // 기폭제는 재고가 있을 때만 같은 선택 유지
  const catalyst: [boolean, boolean] = [
    lastOptions.catalyst[0] && profile.inventory.catalyst > 0,
    lastOptions.catalyst[1] && profile.inventory.catalyst > (lastOptions.catalyst[0] ? 1 : 0),
  ];
  if (lastOptions.mode === 'challenge' && profile.challengeToday().played >= 10) {
    useUIStore.getState().showToast('오늘 클래식 도전 10판을 모두 했어요!');
    return;
  }
  launchMatch({ ...lastOptions, catalyst });
}
