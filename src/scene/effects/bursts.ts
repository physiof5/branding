import type { PlayerIndex, TurnResult } from '../../game/types';
import { baseXFor, dirFor } from '../layout';

/** 임팩트 연출 정의 (3D 파티클 + HUD 의성어가 함께 사용) */
export interface Burst {
  id: number;
  start: number;
  pos: [number, number, number];
  color: string;
  text: string | null;
  textColor: string;
  size: number;
  ground: boolean;
  count: number;
}

let seq = 0;

/** 판정 결과 → 임팩트 지점/의성어/색 */
export function burstFor(r: TurnResult, clock: number): Burst | null {
  const base = { id: ++seq, start: clock, ground: false, count: 22 };
  const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);
  switch (r.kind) {
    case 'hit':
    case 'power':
    case 'overpower': {
      const a = r.attacker!;
      const v = other(a);
      // 엉덩이끼리 맞닿는 지점 (등을 맞댄 두 캐릭터 사이)
      const x = r.kind === 'overpower' ? 0 : baseXFor(v) - dirFor(a) * 0.22;
      const power = r.kind !== 'hit';
      return {
        ...base,
        pos: [x, 0.72, 0.15],
        color: power ? '#ff7a2f' : '#ffd23f',
        text: r.kind === 'hit' ? '퍽!' : r.kind === 'power' ? '콰앙!!' : '뻐억!!',
        textColor: power ? '#ff5a2f' : '#ffd23f',
        size: power ? 1.6 : 1,
        count: power ? 34 : 22,
      };
    }
    case 'special': {
      const v = other(r.attacker!);
      return {
        ...base,
        pos: [baseXFor(v), 0.3, 0],
        color: '#ffe66b',
        text: '쿠콰콰쾅!!!',
        textColor: '#ffe66b',
        size: 2.4,
        ground: true,
        count: 48,
      };
    }
    case 'clash':
      return {
        ...base,
        pos: [0, 0.72, 0.15],
        color: r.topTier === 'special' ? '#ffe66b' : '#8fe0ff',
        text: r.topTier === 'special' ? '콰과광!!!' : '띠요옹~!',
        textColor: '#8fe0ff',
        size: r.topTier === 'special' ? 2.2 : 1.3,
        count: 30,
      };
    case 'blocked': {
      const d: PlayerIndex = r.outcomes[0].shieldBlocked ? 0 : 1;
      return { ...base, pos: [baseXFor(d) + dirFor(d) * 1.0, 0.9, 0.15], color: '#7fe3ff', text: '팅!', textColor: '#7fe3ff', size: 1.1 };
    }
    case 'dodge': {
      const d: PlayerIndex = r.outcomes[0].dodgedAttack ? 0 : 1;
      return { ...base, pos: [baseXFor(d) + dirFor(d) * 0.3, 0.8, 0.3], color: '#bfefff', text: '쏙~', textColor: '#e8fbff', size: 0.8, count: 10 };
    }
    default:
      return null;
  }
}

