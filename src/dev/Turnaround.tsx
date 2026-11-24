import { Canvas, useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import * as THREE from 'three';
import { DEFAULT_APPEARANCE, type Appearance } from '../data/appearance';
import { LowPolyCharacter } from '../scene/character/LowPolyCharacter';

/** 개발용: 기본 캐릭터 디자인 시트와 같은 각도(정면·45°·측면·후면)로 렌더해 비교 */
function LookAt() {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.lookAt(0, 1.02, 0);
  }, [camera]);
  return null;
}

const VIEWS = [0, -Math.PI / 4, -Math.PI / 2, Math.PI];

export function Turnaround({ appearance = DEFAULT_APPEARANCE }: { appearance?: Appearance }) {
  return (
    <div style={{ display: 'flex', background: '#fcfcfc', width: '100%', height: '100%' }}>
      {VIEWS.map((yaw, i) => (
        <div key={i} style={{ flex: 1, height: '100%' }}>
          <Canvas
            shadows="percentage"
            dpr={1}
            camera={{ position: [0, 2.0, 11], fov: 13.5 }}
            gl={{ toneMapping: THREE.NeutralToneMapping, preserveDrawingBuffer: true }}
          >
            <LookAt />
            <color attach="background" args={['#fcfcfc']} />
            <hemisphereLight args={['#ffffff', '#d8c3ba', 1.7]} />
            <directionalLight position={[2.5, 5, 7]} intensity={1.7} castShadow />
            <directionalLight position={[-5, 2, 2]} intensity={0.45} />
            <group rotation-y={yaw}>
              <LowPolyCharacter appearance={appearance} showBase />
            </group>
          </Canvas>
        </div>
      ))}
    </div>
  );
}
