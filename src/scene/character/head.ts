/** 머리(타원체) 치수와 얼굴 파츠 배치 헬퍼 */
export const HEAD_R = 0.5;
export const HEAD_SX = HEAD_R;
export const HEAD_SY = HEAD_R * 1.05;
export const HEAD_SZ = HEAD_R * 0.97;

/** 머리 표면의 z (정면 기준) */
export function surfZ(x: number, y: number): number {
  const v = 1 - (x / HEAD_SX) ** 2 - (y / HEAD_SY) ** 2;
  return HEAD_SZ * Math.sqrt(Math.max(0, v));
}

/** 표면 법선 방향으로 파츠를 살짝 돌리기 위한 y 회전 */
export function faceYaw(x: number, y: number): number {
  return Math.atan2(x / HEAD_SX, Math.max(0.05, surfZ(x, y) / HEAD_SZ));
}
