import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { HairStyleId } from '../../data/appearance';
import { capGeometry, GEO } from '../geometries';
import { HEAD_SX, HEAD_SY, HEAD_SZ } from './head';

interface Props {
  style: HairStyleId;
  material: THREE.Material;
}

const capScale = (k: number): [number, number, number] => [HEAD_SX * k, HEAD_SY * k, HEAD_SZ * k];

function CurlyHair({ material }: { material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const points = useMemo(() => {
    // 위쪽 반구에 피보나치 분포로 뽀글이 덩어리 배치
    const pts: THREE.Vector3[] = [];
    const n = 120;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const v = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
      // 이마 쪽은 높게, 뒤통수는 낮게 덮는다
      const limit = 0.05 + v.z * 0.5;
      if (v.y > limit) pts.push(v);
    }
    return pts;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    points.forEach((p, i) => {
      const s = 0.105 + ((i * 37) % 7) * 0.006;
      m.compose(
        new THREE.Vector3(p.x * HEAD_SX * 1.0, p.y * HEAD_SY * 1.0, p.z * HEAD_SZ * 1.0),
        q.setFromEuler(new THREE.Euler(i, i * 0.7, 0)),
        new THREE.Vector3(s, s, s),
      );
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [points]);

  return <instancedMesh ref={ref} args={[GEO.ico1, material, points.length]} castShadow />;
}

export function Hair({ style, material }: Props) {
  switch (style) {
    case 'bald':
      return null;
    case 'buzz':
      return <mesh geometry={capGeometry(1.2)} material={material} scale={capScale(1.03)} rotation={[-0.32, 0, 0]} castShadow />;
    case 'sidePart':
      return (
        <group>
          <mesh geometry={capGeometry(1.22)} material={material} scale={capScale(1.06)} rotation={[-0.3, 0, 0]} castShadow />
          {/* 2:8 가르마 앞머리 볼륨 */}
          <mesh geometry={GEO.ico1} material={material} position={[0.1, 0.4, 0.26]} rotation={[0.5, 0.2, -0.35]} scale={[0.34, 0.12, 0.22]} castShadow />
          <mesh geometry={GEO.ico1} material={material} position={[-0.27, 0.3, 0.18]} rotation={[0.3, 0, 0.6]} scale={[0.12, 0.16, 0.18]} />
        </group>
      );
    case 'bowl':
      return (
        <group>
          <mesh geometry={capGeometry(1.18)} material={material} scale={capScale(1.09)} castShadow />
          {/* 뒤통수·옆머리는 더 길게 (앞은 첫 캡 안쪽에 숨음) */}
          <mesh geometry={capGeometry(1.5)} material={material} scale={capScale(1.07)} rotation={[-0.55, 0, 0]} position={[0, -0.02, -0.02]} />
        </group>
      );
    case 'bun':
      return (
        <group>
          <mesh geometry={capGeometry(1.2)} material={material} scale={capScale(1.03)} rotation={[-0.3, 0, 0]} castShadow />
          <mesh geometry={GEO.ico1} material={material} position={[0, HEAD_SY * 1.02, -0.12]} scale={0.19} castShadow />
          <mesh geometry={GEO.torus} material={material} position={[0, HEAD_SY * 0.9, -0.1]} rotation={[Math.PI / 2 - 0.25, 0, 0]} scale={0.13} />
        </group>
      );
    case 'curly':
      return <CurlyHair material={material} />;
  }
}
