import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import { MAPS } from '../data/maps';
import { useBattleStore } from '../store/battleStore';
import { Arena } from './arenas/Arena';
import { CameraDirector } from './CameraDirector';
import { ImpactEffects } from './effects/ImpactEffects';
import { Fighter } from './Fighter';
import { GEO } from './geometries';
import { baseXFor, PLAYER_COLORS } from './layout';
import { ScreenSpaceSync } from './screenSpace';

function FloorMarkers() {
  return (
    <>
      {([0, 1] as const).map((i) => (
        <mesh key={i} geometry={GEO.ring} rotation={[-Math.PI / 2, 0, 0]} position={[baseXFor(i), 0.02, 0]} scale={0.62}>
          <meshBasicMaterial color={PLAYER_COLORS[i]} transparent opacity={0.75} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

/** 3D 배틀 씬 */
export function BattleCanvas() {
  const mapId = useBattleStore((s) => s.config?.mapId ?? 'classroom');
  const ready = useBattleStore((s) => s.phase !== 'idle');
  const map = MAPS[mapId];
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, powerPreference: 'high-performance' }}
      camera={{ position: [0, 4, 10], fov: 40, near: 0.1, far: 120 }}
    >
      <color attach="background" args={[map.sky]} />
      <fog attach="fog" args={[map.fog.color, map.fog.near, map.fog.far]} />
      <Suspense fallback={null}>
        <Arena id={mapId} />
        <FloorMarkers />
        {ready && (
          <>
            <Fighter index={0} />
            <Fighter index={1} />
          </>
        )}
        <ImpactEffects />
      </Suspense>
      <CameraDirector />
      <ScreenSpaceSync />
    </Canvas>
  );
}
