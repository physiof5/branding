import { useFrame } from '@react-three/fiber';
import { useEffect, type RefObject } from 'react';
import * as THREE from 'three';

/**
 * 3D → 화면 좌표 공유. Canvas 안의 <ScreenSpaceSync/> 가 매 프레임 카메라/크기를 기록하고,
 * HUD(DOM) 쪽 라벨들은 useFollowWorld 로 월드 좌표를 투영해 따라다닌다.
 * (drei <Html> 처럼 라벨마다 React root 를 만들지 않아 가볍고 안정적)
 */
export const view: { camera: THREE.Camera | null; width: number; height: number } = { camera: null, width: 1, height: 1 };

export function ScreenSpaceSync() {
  useFrame(({ camera, size }) => {
    view.camera = camera;
    view.width = size.width;
    view.height = size.height;
  });
  return null;
}

const tmp = new THREE.Vector3();

export function projectToScreen(p: readonly [number, number, number]): { x: number; y: number; visible: boolean } | null {
  if (!view.camera) return null;
  tmp.set(p[0], p[1], p[2]).project(view.camera);
  return { x: ((tmp.x + 1) / 2) * view.width, y: ((1 - tmp.y) / 2) * view.height, visible: tmp.z < 1 };
}

/** DOM 요소를 월드 좌표에 붙인다 (rAF 로 transform 갱신) */
export function useFollowWorld(ref: RefObject<HTMLElement | null>, world: () => readonly [number, number, number] | null): void {
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = ref.current;
      const p = world();
      const s = p ? projectToScreen(p) : null;
      if (el) {
        if (s) {
          el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
          el.style.visibility = s.visible ? 'visible' : 'hidden';
        } else el.style.visibility = 'hidden';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // world 는 매 프레임 새로 호출되는 getter 라 의존성에 넣지 않는다
  }, [ref]);
}
