import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { EFFECTS, type EffectId } from '../../data/effects';
import type { PlayerIndex } from '../../game/types';
import { battleEvents, useBattleStore, type BattleState } from '../../store/battleStore';
import { GEO } from '../geometries';
import type { Pose } from '../fighterPose';

const additive = (color: string, opacity = 0.9) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

/** 사람 플레이어가 먹물에 맞아 이 파이터의 기를 볼 수 없는가 */
export function stacksHiddenFor(s: BattleState, index: PlayerIndex): boolean {
  const viewer: PlayerIndex = index === 0 ? 1 : 0;
  const v = s.fighters[viewer];
  if (v.inkTurns <= 0) return false;
  // AI 대전은 화면 주인이 P1 → P1 이 먹물이면 P2 의 기가 가려짐. 로컬은 공유 화면이라 둘 다 적용
  return s.config?.mode === 'local' || viewer === 0;
}

/** 기 모으기 오라: 나선으로 솟는 파편 + 발밑 링 + 포인트 라이트 */
export function ChargeAura({ index, poseRef, effectId }: { index: PlayerIndex; poseRef: RefObject<Pose>; effectId: EffectId }) {
  const fx = EFFECTS[effectId];
  const N = 18;
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const mats = useMemo(() => ({ a: additive(fx.colors[0]), b: additive(fx.colors[1]), ring: additive(fx.colors[1], 0.6) }), [fx]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const seeds = useMemo(() => Array.from({ length: N }, (_, k) => ({ off: k / N, ang: k * 2.39996, speed: 0.75 + (k % 5) * 0.12 })), []);

  useFrame(() => {
    const s = useBattleStore.getState();
    const pose = poseRef.current;
    if (!pose) return;
    const stacks = s.fighters[index].stacks;
    const hidden = stacksHiddenFor(s, index);
    const idleGlow = s.phase === 'idle' || hidden ? 0 : stacks >= 10 ? 0.75 : stacks >= 3 ? 0.28 : 0;
    const level = Math.max(pose.aura, idleGlow * (pose.fall > 0.5 ? 0 : 1));
    const big = stacks >= 10 ? 1.45 : 1;
    const c = s.clock;
    seeds.forEach((sd, k) => {
      const m = meshes.current[k];
      if (!m) return;
      const prog = (c * 0.00055 * sd.speed + sd.off) % 1;
      const ang = sd.ang + prog * 4 + c * 0.001;
      const rad = (0.62 - 0.25 * prog) * big;
      m.position.set(Math.cos(ang) * rad, 0.1 + prog * 2.3, Math.sin(ang) * rad);
      const sc = level * (1 - prog) * 0.07 * big;
      m.scale.setScalar(Math.max(0.0001, sc));
      m.rotation.set(prog * 6, ang, 0);
    });
    if (fx.rainbow) {
      mats.a.color.setHSL((c * 0.00025) % 1, 0.9, 0.62);
      mats.b.color.setHSL((c * 0.00025 + 0.33) % 1, 0.9, 0.62);
      mats.ring.color.setHSL((c * 0.00025 + 0.66) % 1, 0.9, 0.6);
    }
    if (ring.current) {
      ring.current.scale.setScalar((0.75 + 0.06 * Math.sin(c * 0.01)) * big);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = level * 0.75;
      ring.current.visible = level > 0.01;
    }
    if (light.current) light.current.intensity = level * 1.1;
  });

  return (
    <group>
      {seeds.map((_, k) => (
        <mesh key={k} ref={(m) => void (meshes.current[k] = m)} geometry={k % 3 === 0 ? GEO.tetra : GEO.oct} material={k % 2 ? mats.a : mats.b} />
      ))}
      <mesh ref={ring} geometry={GEO.ring} material={mats.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} />
      <pointLight ref={light} color={fx.colors[0]} position={[0, 1.1, 0.4]} distance={4} decay={1.6} intensity={0} />
    </group>
  );
}

/** 보유한 기(스택)를 허리 주변을 도는 구슬로 표시 — 3개부터 강력, 10개면 필살 */
export function StackOrbs({ index, poseRef, effectId }: { index: PlayerIndex; poseRef: RefObject<Pose>; effectId: EffectId }) {
  const fx = EFFECTS[effectId];
  const orbs = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useMemo(
    () => ({ low: additive(fx.colors[0], 0.85), power: additive('#ff7a2f', 0.95), max: additive('#fff1a8', 1) }),
    [fx],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useFrame(() => {
    const s = useBattleStore.getState();
    const stacks = s.fighters[index].stacks;
    const pose = poseRef.current;
    const hidden = s.phase === 'idle' || (pose?.fall ?? 0) > 0.3 || stacksHiddenFor(s, index);
    const mat = stacks >= 10 ? mats.max : stacks >= 3 ? mats.power : mats.low;
    for (let k = 0; k < 10; k++) {
      const m = orbs.current[k];
      if (!m) continue;
      const vis = !hidden && k < stacks;
      m.visible = vis;
      if (!vis) continue;
      const ang = s.clock * 0.0021 + (k / Math.max(1, stacks)) * Math.PI * 2;
      const r = 0.72 + (stacks >= 10 ? 0.1 : 0);
      m.position.set(Math.cos(ang) * r, 0.75 + 0.07 * Math.sin(s.clock * 0.004 + k), Math.sin(ang) * r);
      m.scale.setScalar(stacks >= 10 ? 0.085 : stacks >= 3 ? 0.07 : 0.055);
      m.rotation.set(s.clock * 0.004, s.clock * 0.003, 0);
      m.material = mat;
    }
  });

  return (
    <group>
      {Array.from({ length: 10 }, (_, k) => (
        <mesh key={k} ref={(m) => void (orbs.current[k] = m)} geometry={GEO.oct} material={mats.low} visible={false} />
      ))}
    </group>
  );
}

/** 방어막 버블 + 막았을 때 깨지는 연출 */
export function ShieldBubble({ index }: { index: PlayerIndex }) {
  const mesh = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.Mesh>(null);
  const shatterAt = useRef(-1e9);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.22, emissive: '#2fb8ff', emissiveIntensity: 0.6, flatShading: true, depthWrite: false }),
    [],
  );
  const wireMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#bff3ff', wireframe: true, transparent: true, opacity: 0.55 }), []);
  useEffect(() => () => (mat.dispose(), wireMat.dispose()), [mat, wireMat]);

  useEffect(
    () =>
      battleEvents.on((e) => {
        if (e.type === 'impact') {
          const o = e.result.outcomes[index];
          if (o.shieldBlocked || o.shieldPierced) shatterAt.current = useBattleStore.getState().clock;
        }
        if (e.type === 'start') shatterAt.current = -1e9;
      }),
    [index],
  );

  useFrame(() => {
    const s = useBattleStore.getState();
    const active = s.fighters[index].shield && s.phase !== 'idle';
    const k = (s.clock - shatterAt.current) / 450;
    const shattering = k >= 0 && k < 1;
    const vis = active || shattering;
    if (!mesh.current || !wire.current) return;
    mesh.current.visible = wire.current.visible = vis;
    if (!vis) return;
    const scale = shattering ? 1 + 0.7 * k : 1 + 0.03 * Math.sin(s.clock * 0.006);
    mesh.current.scale.set(1.0 * scale, 1.22 * scale, 1.0 * scale);
    wire.current.scale.set(1.02 * scale, 1.24 * scale, 1.02 * scale);
    mat.opacity = shattering ? 0.4 * (1 - k) : 0.22;
    wireMat.opacity = shattering ? 0.8 * (1 - k) : 0.5;
    wire.current.rotation.y = s.clock * 0.0008;
  });

  return (
    <group position={[0, 1.12, 0]}>
      <mesh ref={mesh} geometry={GEO.ico1} material={mat} visible={false} />
      <mesh ref={wire} geometry={GEO.ico1} material={wireMat} visible={false} />
    </group>
  );
}

/** KO 머리 위 빙글빙글 별 */
export function DizzyStars({ poseRef }: { poseRef: RefObject<Pose> }) {
  const group = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe25a' }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.visible = !!poseRef.current?.dizzy;
    g.rotation.y = clock.elapsedTime * 3;
  });
  return (
    <group ref={group} position={[0, 0, 0]} visible={false}>
      {[0, 1, 2].map((k) => (
        <mesh key={k} geometry={GEO.oct} material={mat} position={[Math.cos((k * Math.PI * 2) / 3) * 0.42, 0, Math.sin((k * Math.PI * 2) / 3) * 0.42]} scale={[0.07, 0.11, 0.07]} />
      ))}
    </group>
  );
}
