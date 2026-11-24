import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { HairStyleId } from '../../data/appearance';
import { GEO } from '../geometries';
import { buildHairCap, headSurface } from './geometry';
import { HEAD_TOP } from './profiles';

interface Props {
  style: HairStyleId;
  material: THREE.Material;
  /** 머리 로컬 좌표의 원점 높이 (기준 좌표) */
  pivotY: number;
}

/** 스타일별 헤어라인 (정면/옆/뒤 높이) 과 두께 — 머리 프로파일을 그대로 감싼다 */
const CAPS: Partial<Record<HairStyleId, { line: { front: number; side: number; back: number }; grow: number }>> = {
  buzz: { line: { front: 2.085, side: 1.88, back: 1.6 }, grow: 0.014 },
  sidePart: { line: { front: 2.09, side: 1.87, back: 1.58 }, grow: 0.04 },
  bowl: { line: { front: 2.04, side: 1.83, back: 1.6 }, grow: 0.05 },
  bun: { line: { front: 2.085, side: 1.88, back: 1.62 }, grow: 0.018 },
};

function CurlyHair({ material, pivotY }: { material: THREE.Material; pivotY: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const points = useMemo(() => {
    // 머리 표면 위에 뽀글이 덩어리를 고르게 배치 (이마는 높게, 뒤통수는 낮게)
    const pts: THREE.Vector3[] = [];
    for (let ring = 0; ring < 8; ring++) {
      const count = 6 + ring * 4;
      for (let k = 0; k < count; k++) {
        const phi = (k / count) * Math.PI * 2 + ring * 0.37;
        const s = Math.sin(phi);
        const floor = s >= 0 ? 1.88 + 0.2 * s : 1.88 - 0.25 * -s;
        const y = HEAD_TOP - 0.02 - (HEAD_TOP - 0.02 - floor) * (ring / 7);
        const [x, , z] = headSurface(y, phi, 0.03);
        pts.push(new THREE.Vector3(x, y - pivotY, z));
      }
    }
    return pts;
  }, [pivotY]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    points.forEach((p, i) => {
      const s = 0.085 + ((i * 37) % 7) * 0.006;
      m.compose(p, q.setFromEuler(new THREE.Euler(i, i * 0.7, 0)), new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [points]);

  return <instancedMesh ref={ref} args={[GEO.ico1, material, points.length]} castShadow />;
}

function Cap({ style, material, pivotY }: { style: HairStyleId; material: THREE.Material; pivotY: number }) {
  const def = CAPS[style]!;
  const geo = useMemo(() => buildHairCap(pivotY, def.line, def.grow), [pivotY, def]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={material} castShadow />;
}

export function Hair({ style, material, pivotY }: Props) {
  const Y = (y: number) => y - pivotY;
  switch (style) {
    case 'bald':
      return null;
    case 'buzz':
    case 'bowl':
      return <Cap style={style} material={material} pivotY={pivotY} />;
    case 'sidePart':
      return (
        <group>
          <Cap style="sidePart" material={material} pivotY={pivotY} />
          {/* 2:8 가르마 앞머리 볼륨 */}
          <mesh geometry={GEO.ico1} material={material} position={[0.08, Y(2.16), 0.27]} rotation={[0.55, 0.2, -0.32]} scale={[0.3, 0.1, 0.2]} castShadow />
          <mesh geometry={GEO.ico1} material={material} position={[-0.26, Y(2.06), 0.2]} rotation={[0.3, 0, 0.55]} scale={[0.1, 0.13, 0.15]} />
        </group>
      );
    case 'bun':
      return (
        <group>
          <Cap style="bun" material={material} pivotY={pivotY} />
          <mesh geometry={GEO.ico1} material={material} position={[0, Y(2.3), -0.1]} scale={0.17} castShadow />
          <mesh geometry={GEO.torus} material={material} position={[0, Y(2.2), -0.08]} rotation={[Math.PI / 2 - 0.25, 0, 0]} scale={0.12} />
        </group>
      );
    case 'curly':
      return <CurlyHair material={material} pivotY={pivotY} />;
  }
}
