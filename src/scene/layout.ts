import { buttScale, type Appearance } from '../data/appearance';
import type { PlayerIndex } from '../game/types';

/** 두 캐릭터는 고정 위치에서 마주 본다 (x축) */
export const BASE_X = 1.3;
/** 카메라 쪽으로 살짝 돌려서 얼굴이 3/4 로 보이게 */
export const FACE_TURN = 0.42;

export const baseXFor = (i: PlayerIndex): number => (i === 0 ? -BASE_X : BASE_X);
/** 상대를 향하는 x 방향 */
export const dirFor = (i: PlayerIndex): 1 | -1 => (i === 0 ? 1 : -1);
export const baseYawFor = (i: PlayerIndex): number => dirFor(i) * (Math.PI / 2 - FACE_TURN);

/** 골반 중심에서 엉덩이 끝까지 거리 (모델과 일치) */
export const buttDepthFor = (a: Appearance): number => 0.15 + 0.215 * buttScale(a.buttVolume);

export const PLAYER_COLORS: readonly [string, string] = ['#4da3ff', '#ff5a6e'];
