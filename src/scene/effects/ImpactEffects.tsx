import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { battleEvents, useBattleStore } from '../../store/battleStore';
import { GEO } from '../geometries';
import { burstFor, type Burst } from './bursts';

function BurstFx({ b }: { b: Burst }) {
  const inst = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  const parts = useMemo(
    () =>
      Array.from({ length: b.count }, () => {
        const th = Math.random() * Math.PI * 2;
        const ph = (Math.random() - 0.3) * Math.PI * 0.9;
        const sp = (2.2 + Math.random() * 3.2) * Math.sqrt(b.size);
        return {
          v: new THREE.Vector3(Math.cos(th) * Math.cos(ph) * sp, Math.sin(ph) * sp + 1.5, Math.sin(th) * Math.cos(ph) * sp * 0.6),
          rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
          s: 0.05 + Math.random() * 0.07,
        };
      }),
    [b],
  );
  const mats = useMemo(
    () => ({
      p: new THREE.MeshBasicMaterial({ color: b.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      r: new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    }),
    [b.color],
  );
  useEffect(() => () => (mats.p.dispose(), mats.r.dispose()), [mats]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame(() => {
    const t = (useBattleStore.getState().clock - b.start) / 1000;
    const g = group.current;
    if (!g) return;
    g.visible = t >= 0 && t < 1.3;
    if (!g.visible) return;
    const mesh = inst.current;
    if (mesh) {
      parts.forEach((pt, k) => {
        tmp.p.copy(pt.v).multiplyScalar(t);
        tmp.p.y -= 4.9 * t * t;
        const sc = pt.s * Math.max(0, 1 - t / 1.1) * b.size ** 0.5;
        tmp.s.setScalar(Math.max(0.0001, sc));
        tmp.q.setFromEuler(new THREE.Euler(pt.rot.x + t * 8, pt.rot.y + t * 6, 0));
        tmp.m.compose(tmp.p, tmp.q, tmp.s);
        mesh.setMatrixAt(k, tmp.m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (ring.current) {
      ring.current.scale.setScalar((0.25 + t * 3.6) * b.size);
      mats.r.opacity = Math.max(0, 0.9 - t * 2.2);
    }
  });

  return (
    <group ref={group} position={b.pos}>
      <instancedMesh ref={inst} args={[GEO.tetra, mats.p, b.count]} frustumCulled={false} />
      <mesh ref={ring} geometry={GEO.ring} material={mats.r} rotation={b.ground ? [-Math.PI / 2, 0, 0] : [0, 0, 0]} />
    </group>
  );
}

export function ImpactEffects() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(
    () =>
      battleEvents.on((e) => {
        if (e.type === 'impact') {
          const clock = useBattleStore.getState().clock;
          const b = burstFor(e.result, clock);
          if (b) setBursts((list) => [...list.filter((x) => clock - x.start < 1500), b]);
        }
        if (e.type === 'start' || e.type === 'exit') setBursts([]);
      }),
    [],
  );
  return (
    <>
      {bursts.map((b) => (
        <BurstFx key={b.id} b={b} />
      ))}
    </>
  );
}
