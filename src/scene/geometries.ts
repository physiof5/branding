import * as THREE from 'three';

/** 공유 지오메트리 — 모든 로폴리 파츠는 단위 지오메트리를 scale 해서 쓴다 (메모리/드로우 절약) */
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  oct: new THREE.OctahedronGeometry(1, 0),
  tetra: new THREE.TetrahedronGeometry(1, 0),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
  cyl16: new THREE.CylinderGeometry(1, 1, 1, 16),
  /** 위가 살짝 좁은 몸통 */
  taper8: new THREE.CylinderGeometry(0.86, 1, 1, 8),
  /** 위가 넓은 (모자 등) */
  flare16: new THREE.CylinderGeometry(1, 0.86, 1, 16),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  torus: new THREE.TorusGeometry(1, 0.07, 6, 20),
  ring: new THREE.RingGeometry(0.82, 1, 40),
  disc: new THREE.CircleGeometry(1, 40),
  plane: new THREE.PlaneGeometry(1, 1),
};

const capCache = new Map<string, THREE.SphereGeometry>();

/** 머리카락용 구 캡 (위에서부터 thetaLength 만큼) */
export function capGeometry(thetaLength: number): THREE.SphereGeometry {
  const key = thetaLength.toFixed(3);
  let g = capCache.get(key);
  if (!g) {
    g = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, thetaLength);
    capCache.set(key, g);
  }
  return g;
}
