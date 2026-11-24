import type { Appearance } from '../data/appearance';
import { bodyLayout } from './character/LowPolyCharacter';
import type { PlayerIndex } from '../game/types';

/** 두 캐릭터는 고정 위치에서 '엉덩이를 마주하고' 바깥을 보고 선다 (x축) */
export const BASE_X = 1.05;
/** 카메라 쪽으로 살짝 돌려서 얼굴이 3/4 로 보이게 */
export const FACE_TURN = 0.42;

export const baseXFor = (i: PlayerIndex): number => (i === 0 ? -BASE_X : BASE_X);
/** 상대가 있는 x 방향 (캐릭터는 이 반대쪽을 본다) */
export const dirFor = (i: PlayerIndex): 1 | -1 => (i === 0 ? 1 : -1);
/** 바깥(상대 반대편)을 보되 카메라 쪽으로 FACE_TURN 만큼 돌린 방향 */
export const baseYawFor = (i: PlayerIndex): number => -dirFor(i) * (Math.PI / 2 - FACE_TURN);

/** 골반 중심에서 엉덩이 끝까지 거리 (모델과 일치) */
export const buttDepthFor = (a: Appearance): number => bodyLayout(a).buttDepth;

export const PLAYER_COLORS: readonly [string, string] = ['#4da3ff', '#ff5a6e'];
