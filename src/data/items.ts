/** 인게임 재화(골드)로 사는 소모성 아이템 */
export type ItemId = 'shield' | 'jam' | 'catalyst';
export type BattleItemId = Exclude<ItemId, 'catalyst'>;

export interface ItemDef {
  id: ItemId;
  name: string;
  emoji: string;
  description: string;
  price: number;
  /** preBattle: 전투 시작 시 자동 발동 / inBattle: 선택 시간 중 버튼으로 사용 */
  usage: 'preBattle' | 'inBattle';
  /** 한 판에 쓸 수 있는 최대 개수 */
  maxPerBattle: number;
  hotkey?: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  shield: {
    id: 'shield',
    name: '방어막',
    emoji: '🛡️',
    description: '공격 1회를 무효화해요 — 안심하고 기 모으기! (필살기는 관통)',
    price: 120,
    usage: 'inBattle',
    maxPerBattle: 1,
    hotkey: 'Q',
  },
  jam: {
    id: 'jam',
    name: '먹물 폭탄',
    emoji: '🦑',
    description: '상대 시야를 먹물로 가려요. 다음 턴 상대 선택 시간 3초 → 1.5초 (AI는 판단력 저하)',
    price: 100,
    usage: 'inBattle',
    maxPerBattle: 1,
    hotkey: 'E',
  },
  catalyst: {
    id: 'catalyst',
    name: '기폭제',
    emoji: '⚡',
    description: '전투 시작과 동시에 기 +1 스택. 로비에서 켜 두면 자동 사용',
    price: 80,
    usage: 'preBattle',
    maxPerBattle: 1,
  },
};

export const BATTLE_ITEMS: readonly BattleItemId[] = ['shield', 'jam'];
export const ITEM_ORDER: readonly ItemId[] = ['shield', 'jam', 'catalyst'];
