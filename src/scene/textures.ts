import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export const FONT = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif';

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/** 캔버스 2D 로 그린 텍스처 (한글 간판/칠판 글씨 등). 웹폰트 로드 후 한 번 더 그린다. */
export function makeCanvasTexture(draw: Draw, w = 512, h = 256, repeat?: [number, number]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  if (typeof document !== 'undefined' && document.fonts?.load) {
    document.fonts
      .load(`32px ${FONT}`)
      .then(() => {
        ctx.clearRect(0, 0, w, h);
        draw(ctx, w, h);
        tex.needsUpdate = true;
      })
      .catch(() => undefined);
  }
  return tex;
}

export function useCanvasTexture(draw: Draw, w = 512, h = 256, repeat?: [number, number]): THREE.CanvasTexture {
  // draw 는 모듈 상수 함수로 넘긴다 (렌더마다 새 함수면 텍스처가 재생성됨)
  const tex = useMemo(() => makeCanvasTexture(draw, w, h, repeat), [draw, w, h, repeat?.[0], repeat?.[1]]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** 가운데 정렬 텍스트 한 줄 */
export function fillText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  opts: { stroke?: string; strokeWidth?: number; glow?: string; align?: CanvasTextAlign } = {},
): void {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = 'middle';
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = size * 0.45;
  }
  if (opts.stroke) {
    ctx.lineWidth = opts.strokeWidth ?? size * 0.12;
    ctx.strokeStyle = opts.stroke;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}
