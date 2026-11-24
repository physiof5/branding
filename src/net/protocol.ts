import type { Appearance } from '../data/appearance';
import type { BattleItemId } from '../data/items';
import type { MapId } from '../data/maps';
import type { ActionType, ChosenAction, PlayerIndex } from '../game/types';

// ─────────────────────────────────────────────────────────────
// 온라인 매칭 프로토콜 (서버 권위 모델)
//
// 심리전 게임은 "상대 선택을 먼저 보면 안 된다"가 핵심이므로
// 클라이언트는 자기 선택만 서버에 보내고, 서버가 두 선택이 모두 모이면(또는 3초 마감 시)
// 한 번에 공개(reveal)한다. 판정은 src/game/rules.ts 의 resolveTurn 을 서버/클라가 공유한다.
// ─────────────────────────────────────────────────────────────

export interface PublicProfile {
  nickname: string;
  appearance: Appearance;
  trophies: number;
}

export type ClientMessage =
  | { t: 'queue'; profile: PublicProfile }
  | { t: 'cancelQueue' }
  | { t: 'choose'; matchId: string; turn: number; action: ChosenAction }
  | { t: 'item'; matchId: string; turn: number; item: BattleItemId }
  | { t: 'leave'; matchId: string };

export type ServerMessage =
  | { t: 'queued'; position: number }
  | { t: 'matched'; matchId: string; you: PlayerIndex; opponent: PublicProfile; mapId: MapId }
  | { t: 'turnStart'; turn: number; deadlineMs: number }
  | { t: 'opponentLocked'; turn: number }
  | { t: 'opponentItem'; turn: number; item: BattleItemId }
  /** 서버가 두 선택(시간 초과는 'idle')을 동시에 공개 */
  | { t: 'reveal'; turn: number; actions: [ActionType, ActionType] }
  | { t: 'opponentLeft' }
  | { t: 'error'; message: string };
