import * as THREE from 'three';
import { GEO } from '../geometries';
import { useCanvasTexture, type Draw } from '../textures';

export type V3 = [number, number, number];

interface PrimProps {
  p?: V3;
  s?: V3 | number;
  r?: V3;
  c: string;
  /** 발광 색 */
  e?: string;
  ei?: number;
  o?: number;
  metal?: number;
  rough?: number;
  cast?: boolean;
  receive?: boolean;
}

function Prim({ geo, p, s, r, c, e, ei, o, metal, rough, cast = true, receive = true }: PrimProps & { geo: THREE.BufferGeometry }) {
  return (
    <mesh geometry={geo} position={p} scale={s} rotation={r} castShadow={cast} receiveShadow={receive}>
      <meshStandardMaterial
        color={c}
        flatShading
        roughness={rough ?? 0.82}
        metalness={metal ?? 0}
        emissive={e ?? '#000000'}
        emissiveIntensity={e ? (ei ?? 1) : 0}
        transparent={o !== undefined}
        opacity={o ?? 1}
        depthWrite={o === undefined || o > 0.6}
      />
    </mesh>
  );
}

export const Box = (props: PrimProps) => <Prim geo={GEO.box} {...props} />;
export const Cyl = (props: PrimProps & { seg?: 6 | 8 | 12 | 16 }) => (
  <Prim geo={props.seg === 6 ? GEO.cyl6 : props.seg === 12 ? GEO.cyl12 : props.seg === 16 ? GEO.cyl16 : GEO.cyl8} {...props} />
);
export const Ball = (props: PrimProps & { detail?: 0 | 1 }) => <Prim geo={props.detail === 0 ? GEO.ico0 : GEO.ico1} {...props} />;
export const Cone = (props: PrimProps & { four?: boolean }) => <Prim geo={props.four ? GEO.cone4 : GEO.cone8} {...props} />;

/** 캔버스 텍스처를 붙인 판 (간판/칠판/포스터). glow=true 면 조명과 무관하게 발광 */
export function Panel({
  p,
  s,
  r,
  draw,
  w = 512,
  h = 256,
  glow = false,
  glowIntensity = 1.2,
}: {
  p: V3;
  s: [number, number];
  r?: V3;
  draw: Draw;
  w?: number;
  h?: number;
  glow?: boolean;
  glowIntensity?: number;
}) {
  const tex = useCanvasTexture(draw, w, h);
  return (
    <mesh geometry={GEO.plane} position={p} rotation={r} scale={[s[0], s[1], 1]} receiveShadow={!glow}>
      {glow ? (
        <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={glowIntensity} transparent toneMapped={false} />
      ) : (
        <meshStandardMaterial map={tex} roughness={0.9} transparent />
      )}
    </mesh>
  );
}

/** 반복 패턴 바닥 */
export function Floor({ draw, size = [44, 30], repeat = [8, 6], z = -3, rough = 0.9, metal = 0, emissive }: {
  draw: Draw;
  size?: [number, number];
  repeat?: [number, number];
  z?: number;
  rough?: number;
  metal?: number;
  emissive?: boolean;
}) {
  const tex = useCanvasTexture(draw, 256, 256, repeat);
  return (
    <mesh geometry={GEO.plane} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, z]} scale={[size[0], size[1], 1]} receiveShadow>
      <meshStandardMaterial
        map={tex}
        roughness={rough}
        metalness={metal}
        emissiveMap={emissive ? tex : null}
        emissive={emissive ? '#ffffff' : '#000000'}
        emissiveIntensity={emissive ? 0.35 : 0}
      />
    </mesh>
  );
}

/** 맵 공통 조명: 반구광 + 그림자 드리우는 태양광 */
export function Lights({
  sky,
  ground,
  hemi,
  sun,
  sunColor = '#ffffff',
  sunPos = [4, 9, 7],
}: {
  sky: string;
  ground: string;
  hemi: number;
  sun: number;
  sunColor?: string;
  sunPos?: V3;
}) {
  return (
    <>
      <hemisphereLight args={[sky, ground, hemi]} />
      <directionalLight
        position={sunPos}
        intensity={sun}
        color={sunColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
      />
    </>
  );
}

export function Desk({ p, r = 0, top = '#c8945a', leg = '#5b5f6b' }: { p: V3; r?: number; top?: string; leg?: string }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[0, 0.74, 0]} s={[1.1, 0.06, 0.65]} c={top} />
      <Box p={[0, 0.6, -0.05]} s={[1.0, 0.2, 0.5]} c={leg} />
      {[-0.48, 0.48].map((x) => (
        <Box key={x} p={[x, 0.37, 0]} s={[0.05, 0.74, 0.55]} c={leg} />
      ))}
    </group>
  );
}

export function Chair({ p, r = 0, seat = '#c8945a', leg = '#5b5f6b' }: { p: V3; r?: number; seat?: string; leg?: string }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box p={[0, 0.45, 0]} s={[0.5, 0.05, 0.48]} c={seat} />
      <Box p={[0, 0.78, -0.22]} s={[0.5, 0.38, 0.05]} c={seat} />
      {[-0.22, 0.22].map((x) =>
        [-0.2, 0.2].map((z) => <Box key={`${x}${z}`} p={[x, 0.22, z]} s={[0.04, 0.45, 0.04]} c={leg} />),
      )}
    </group>
  );
}

export function Tree({ p, s = 1, leaf = '#4caf50', trunk = '#7a5233' }: { p: V3; s?: number; leaf?: string; trunk?: string }) {
  return (
    <group position={p} scale={s}>
      <Cyl p={[0, 0.8, 0]} s={[0.16, 1.6, 0.16]} c={trunk} seg={6} />
      <Ball detail={0} p={[0, 2.2, 0]} s={[1.05, 1.0, 1.05]} c={leaf} />
      <Ball detail={0} p={[0.45, 1.75, 0.2]} s={0.7} c={leaf} />
      <Ball detail={0} p={[-0.4, 1.85, -0.15]} s={0.65} c={leaf} />
    </group>
  );
}

export function BookStack({ p, colors }: { p: V3; colors: string[] }) {
  return (
    <group position={p}>
      {colors.map((c, k) => (
        <Box key={k} p={[(k % 2) * 0.03, 0.035 + k * 0.07, 0]} s={[0.32 - k * 0.02, 0.06, 0.24]} r={[0, k * 0.15, 0]} c={c} />
      ))}
    </group>
  );
}
