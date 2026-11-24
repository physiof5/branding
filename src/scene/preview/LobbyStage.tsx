import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useLayoutEffect } from 'react';
import * as THREE from 'three';
import type { Appearance } from '../../data/appearance';
import { MAPS, type MapId } from '../../data/maps';
import { Arena } from '../arenas/Arena';
import { PreviewModel } from './CharacterPreview';

function LookAt({ y }: { y: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    // 세로로 긴 화면에선 조금 물러나서 받침대까지 다 보이게
    const aspect = size.width / Math.max(1, size.height);
    const dist = aspect < 0.8 ? 6.4 : 5.4;
    camera.position.set(0, 1.85, dist);
    camera.lookAt(0, y, 0);
  }, [camera, size, y]);
  return null;
}

/** 로비 무대: 현재 티어의 랭크 맵 배경 + 받침대 위 내 캐릭터. 캐릭터를 누르면 onTap */
export function LobbyStage({ appearance, mapId, wiggleKey, onTap }: { appearance: Appearance; mapId: MapId; wiggleKey: number; onTap: () => void }) {
  const map = MAPS[mapId];
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}
      camera={{ position: [0, 1.85, 5.4], fov: 38, near: 0.1, far: 100 }}
      onPointerMissed={() => undefined}
    >
      <color attach="background" args={[map.sky]} />
      <fog attach="fog" args={[map.fog.color, map.fog.near + 3, map.fog.far + 6]} />
      <LookAt y={1.15} />
      <Suspense fallback={null}>
        <Arena id={mapId} />
        <group
          onClick={(e) => {
            e.stopPropagation();
            onTap();
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <PreviewModel appearance={appearance} wiggleKey={wiggleKey} />
        </group>
      </Suspense>
    </Canvas>
  );
}
