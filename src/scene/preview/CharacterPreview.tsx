import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Appearance } from '../../data/appearance';
import { LowPolyCharacter, type CharacterRig } from '../character/LowPolyCharacter';

/** 받침대 위 캐릭터: 숨쉬기 · 눈 깜빡임 · (wiggleKey 변경 시) 뒤돌아 엉덩이 씰룩 */
export function PreviewModel({ appearance, wiggleKey }: { appearance: Appearance; wiggleKey: number }) {
  const rig = useRef<CharacterRig>(null);
  const group = useRef<THREE.Group>(null);
  const wiggleStart = useRef(-1e9);

  useEffect(() => {
    if (wiggleKey > 0) wiggleStart.current = performance.now();
  }, [wiggleKey]);

  useFrame(({ clock }, dt) => {
    const r = rig.current;
    if (!r || !group.current) return;
    const t = clock.elapsedTime;
    const w = (performance.now() - wiggleStart.current) / 1000;
    // 흔들 때는 엉덩이가 보이도록 3/4 뒷모습으로 돌았다가 복귀
    const targetYaw = w >= 0 && w < 1.9 ? 2.5 : 0;
    group.current.rotation.y += (targetYaw - group.current.rotation.y) * (1 - Math.exp(-dt * 7));
    const ww = w - 0.25;
    const env = ww >= 0 && ww < 1.4 ? Math.sin((Math.PI * ww) / 1.4) : 0;
    const sway = Math.sin(ww * 17) * 0.13 * env;
    r.hips.position.x = sway;
    r.hips.rotation.z = sway * 1.3;
    r.torso.position.x = sway * 0.4;
    r.torso.rotation.z = -sway * 0.5;
    r.butt.scale.setScalar(1 + 0.14 * env * Math.abs(Math.sin(ww * 17)));
    r.armL.rotation.z = 0.03 * Math.sin(t * 1.6) + env * 0.5;
    r.armR.rotation.z = -(0.03 * Math.sin(t * 1.6 + 1) + env * 0.5);
    r.head.rotation.z = Math.sin(t * 0.9) * 0.04;
    const blink = (t * 1000) % 3600 < 110 ? 0.12 : 1;
    for (const e of r.eyes) e.scale.set(1, blink, 1);
    group.current.scale.y = 1 + Math.sin(t * 2.2) * 0.01;
  });

  return (
    <group ref={group}>
      <LowPolyCharacter ref={rig} appearance={appearance} showBase />
    </group>
  );
}

interface Props {
  appearance: Appearance;
  /** 값이 바뀌면 엉덩이 흔들기 */
  wiggleKey?: number;
  autoRotate?: boolean;
  /** 카메라 방위각 (0 = 정면) */
  azimuth?: number;
  interactive?: boolean;
}

/** 꾸미기 화면용: 빈 배경 + 받침대 피규어 (드래그로 회전) */
export function CharacterPreview({ appearance, wiggleKey = 0, autoRotate = true, azimuth = 0.55, interactive = true }: Props) {
  const dist = 5.6;
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
      camera={{ position: [Math.sin(azimuth) * dist, 1.75, Math.cos(azimuth) * dist], fov: 30 }}
      style={{ touchAction: 'pan-y' }}
    >
      <hemisphereLight args={['#ffffff', '#d8c3ba', 1.8]} />
      <directionalLight position={[2.5, 5, 6]} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 2, -3]} intensity={0.7} color="#d6e4ff" />
      <PreviewModel appearance={appearance} wiggleKey={wiggleKey} />
      <OrbitControls
        enableRotate={interactive}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={1.05}
        maxPolarAngle={1.7}
        target={[0, 1.1, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={1.4}
      />
    </Canvas>
  );
}
