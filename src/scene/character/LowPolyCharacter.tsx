import { useEffect, useImperativeHandle, useMemo, useRef, type ReactNode, type Ref } from 'react';
import * as THREE from 'three';
import { buttScale, clamp01, type Appearance } from '../../data/appearance';
import { COSTUMES, type Accessory, type CostumeDef } from '../../data/costumes';
import { GEO } from '../geometries';
import {
  buildBase,
  buildEar,
  buildHead,
  buildLip,
  buildNose,
  buildShoe,
  headA,
  headFrontZ,
  headSurfaceAngles,
  headZB,
  headZF,
  loft,
  torsoFrontZ,
  torsoRingAt,
  type Ring,
} from './geometry';
import { Hair } from './Hair';
import { useCharacterMaterials, type CharacterMaterials } from './materials';
import { ARM, BADGE, COLLAR_Y, FACE, HEAD_N, HEAD_TOP, LEG_N, LEG_RINGS, LEG_X, PELVIS_RINGS, SLEEVE, TORSO_N, TORSO_RINGS, VNECK } from './profiles';

// ─────────────────────────────────────────────────────────────
// 기본 캐릭터 디자인 재현 (profiles.ts 의 측정 프로파일 → geometry.ts 의 형상 함수)
//   얼굴: 프로파일로 변형한 다면체 머리 · 직사각 눈썹 · 세로 타원 눈+하이라이트 · 쐐기 코+콧구멍 · 볼터치 · 쿠션 입술
//   몸통: 초타원 로프트 스크럽(밑단이 퍼짐) · V넥 · 사원증
//   어깨/팔: 비스듬한 반팔 소매 · 굵은 팔 · 벙어리장갑 손
//   골반/다리/발: 바지 로프트 · 발목으로 가늘어지는 다리 · 둥근 신발 · 각진 받침대
// 체형/키/엉덩이 볼륨은 폭·길이 배율로만 반영 (전투 스탯과 무관)
// ─────────────────────────────────────────────────────────────

/** 기준 좌표의 목 회전축 높이 */
export const HEAD_PIVOT = 1.36;

export interface CharacterRig {
  hips: THREE.Group;
  butt: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  eyes: THREE.Group[];
  materials: THREE.MeshStandardMaterial[];
}

export interface BodyLayout {
  /** 폭 배율 (체형) */
  w: number;
  /** 키 배율 (목 아래) */
  hs: number;
  /** 엉덩이 배율 */
  bs: number;
  hipY: number;
  pelvisY: number;
  waistY: number;
  collarY: number;
  headLift: number;
  headPivotY: number;
  height: number;
  shoulder: [number, number];
  /** 골반 중심에서 엉덩이 끝까지 (뒤쪽) */
  buttDepth: number;
  butt: { x: number; z: number; r: number };
}

export function bodyLayout(a: Pick<Appearance, 'bodyType' | 'height' | 'buttVolume'>): BodyLayout {
  const hs = 0.92 + 0.16 * clamp01(a.height);
  const w = 1 + (clamp01(a.bodyType) - 0.4) * 0.75;
  const bs = buttScale(a.buttVolume);
  const collarY = COLLAR_Y * hs;
  const headLift = collarY - COLLAR_Y;
  // 기본 볼륨(≈1)에선 레퍼런스처럼 바지 안에 묻혀 평평, 볼륨을 올리면 뒤로 크게 튀어나온다
  const r = 0.09 + 0.06 * (bs - 1);
  const protrude = Math.max(0, 0.16 * (bs - 1));
  const butt = { x: 0.1 * w, z: -(0.16 * w + protrude - r * 0.92), r };
  return {
    w,
    hs,
    bs,
    hipY: 0.535 * hs,
    pelvisY: 0.6 * hs,
    waistY: 0.68 * hs,
    collarY,
    headLift,
    headPivotY: HEAD_PIVOT + headLift,
    height: HEAD_TOP + headLift,
    shoulder: [ARM.shoulder[0] * w, ARM.shoulder[1] * hs],
    buttDepth: -butt.z + butt.r * 0.92,
    butt,
  };
}

// 체형과 무관한 머리/얼굴/신발/받침대 형상은 한 번만 만든다
const STATIC = {
  head: buildHead(HEAD_PIVOT),
  nose: buildNose(HEAD_PIVOT),
  upperLip: buildLip('upper', HEAD_PIVOT),
  lowerLip: buildLip('lower', HEAD_PIVOT),
  ear: buildEar(),
  shoe: buildShoe(),
  base: buildBase(),
  eye: new THREE.SphereGeometry(1, 18, 12),
};
const BASE_MAT = new THREE.MeshStandardMaterial({ color: '#e6cdc6', flatShading: true, roughness: 0.95 });

type V3 = [number, number, number];

/** 얼굴 표면에 붙는 파츠 위치/회전 (머리 로컬 좌표) */
function onFace(x: number, yRef: number, lift = 0): { position: V3; rotation: THREE.Euler } {
  const z = headFrontZ(x, yRef);
  const { yaw, pitch } = headSurfaceAngles(x, yRef);
  return {
    position: [x + Math.sin(yaw) * lift, yRef - HEAD_PIVOT, z + Math.cos(yaw) * lift],
    // YXZ: 표면을 따라 돌리되 눈썹·눈이 기울지(roll) 않게 — 레퍼런스처럼 수평 유지
    rotation: new THREE.Euler(pitch, yaw, 0, 'YXZ'),
  };
}

const LONG_TOPS = new Set(['robe', 'coat']);
const LONG_SLEEVES = new Set(['blazer', 'zip', 'hoodie', 'coat', 'robe']);

function ringsFrom(table: readonly (readonly [number, number, number, number])[], L: BodyLayout, pivot: number, wk = 1): Ring[] {
  return table.map(([y, a, zf, zb]) => ({ y: y * L.hs - pivot, a: a * L.w * wk, zf: zf * L.w * wk, zb: zb * L.w * wk }));
}

/** 체형에 따라 바뀌는 몸 형상 */
function useBodyGeometry(L: BodyLayout, costume: CostumeDef) {
  const g = useMemo(() => {
    const legW = Math.pow(L.w, 0.85);
    const torso = loft(ringsFrom(TORSO_RINGS, L, L.waistY), 16, TORSO_N, { top: -0.01, bottom: 0.02 });
    const pelvis = loft(ringsFrom(PELVIS_RINGS, L, L.pelvisY), 14, 2.6, { bottom: 0.0 });
    const leg = loft(
      LEG_RINGS.map(([y, a, zf, zb]) => ({ y: y * L.hs - L.hipY, a: a * legW, zf: zf * legW, zb: zb * legW })),
      10,
      LEG_N,
      { bottom: 0 },
    );
    const skirtBottom = costume.topStyle === 'robe' ? 0.16 : costume.topStyle === 'coat' ? 0.36 : null;
    const skirt =
      skirtBottom === null
        ? null
        : loft(
            [
              { y: skirtBottom * L.hs - L.pelvisY, a: 0.31 * L.w, zf: 0.235 * L.w, zb: -(0.245 * L.w + 0.06 * L.bs) },
              { y: 0.5 * L.hs - L.pelvisY, a: 0.29 * L.w, zf: 0.22 * L.w, zb: -(0.225 * L.w + 0.05 * L.bs) },
              { y: 0.7 * L.hs - L.pelvisY, a: 0.272 * L.w, zf: 0.205 * L.w, zb: -0.21 * L.w },
            ],
            16,
            TORSO_N,
          );
    // V넥 (피부색 삼각형) — 몸통 앞면에 살짝 띄움
    const tf = (x: number, y: number, lift = 0.004): V3 => [x * L.w, y * L.hs - L.waistY, torsoFrontZ(x, y) * L.w + lift];
    const tri = (a: V3, b: V3, c: V3) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
      geo.computeVertexNormals();
      return geo;
    };
    const vneck = tri(tf(-VNECK.halfTop, VNECK.yTop, VNECK.lift), tf(0, VNECK.yTip, VNECK.lift * 0.5), tf(VNECK.halfTop, VNECK.yTop, VNECK.lift));
    const shirtV = tri(tf(-0.115, VNECK.yTop, 0.003), tf(0, 1.08, 0.003), tf(0.115, VNECK.yTop, 0.003));
    const band = (y: number, h: number, grow: number) => {
      const r0 = torsoRingAt(y - h / 2);
      const r1 = torsoRingAt(y + h / 2);
      return loft(
        [
          { y: (y - h / 2) * L.hs - L.waistY, a: (r0.a + grow) * L.w, zf: (r0.zf + grow) * L.w, zb: (r0.zb - grow) * L.w },
          { y: (y + h / 2) * L.hs - L.waistY, a: (r1.a + grow) * L.w, zf: (r1.zf + grow) * L.w, zb: (r1.zb - grow) * L.w },
        ],
        16,
        TORSO_N,
      );
    };
    const stripes = costume.topStyle === 'stripe' ? [0.76, 0.88, 1.0, 1.12].map((y) => band(y, 0.045, 0.006)) : [];
    const belt = costume.topStyle === 'robe' ? band(0.72, 0.06, 0.012) : null;
    return { torso, pelvis, leg, skirt, vneck, shirtV, stripes, belt };
  }, [L, costume]);
  useEffect(
    () => () => {
      [g.torso, g.pelvis, g.leg, g.skirt, g.vneck, g.shirtV, g.belt, ...g.stripes].forEach((x) => x?.dispose());
    },
    [g],
  );
  return g;
}

/** 머리 프로파일을 따라 감기는 띠 (머리띠·고글 밴드) */
function useHeadBand(y0: number, y1: number, grow: number) {
  const geo = useMemo(
    () =>
      loft(
        [
          { y: y0 - HEAD_PIVOT, a: headA(y0) + grow, zf: headZF(y0) + grow, zb: headZB(y0) - grow },
          { y: y1 - HEAD_PIVOT, a: headA(y1) + grow, zf: headZF(y1) + grow, zb: headZB(y1) - grow },
        ],
        20,
        HEAD_N,
      ),
    [y0, y1, grow],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

function Stick({ a, b, r, material }: { a: V3; b: V3; r: number; material: THREE.Material }) {
  const t = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { pos: va.add(vb).multiplyScalar(0.5), len, q };
  }, [a, b]);
  return <mesh geometry={GEO.box} material={material} position={t.pos} quaternion={t.q} scale={[r, t.len, r]} />;
}

const Y = (yRef: number) => yRef - HEAD_PIVOT;
const GAT: { l: [V3, V3]; r: [V3, V3] } = {
  l: [[-0.45, Y(2.12), 0.16], [-0.16, Y(1.39), 0.33]],
  r: [[0.45, Y(2.12), 0.16], [0.16, Y(1.39), 0.33]],
};

function Headwear({ accessories, m }: { accessories: readonly Accessory[]; m: CharacterMaterials }) {
  const headband = useHeadBand(2.04, 2.09, 0.02);
  const goggleBand = useHeadBand(2.07, 2.11, 0.025);
  return (
    <>
      {accessories.map((acc) => {
        switch (acc) {
          case 'headband': {
            const f = onFace(0, 2.07, 0.03);
            return (
              <group key={acc}>
                <mesh geometry={headband} material={m.red} />
                <mesh geometry={GEO.box} material={m.white} position={f.position} rotation={f.rotation} scale={[0.17, 0.05, 0.012]} />
              </group>
            );
          }
          case 'tangerineHat':
            return (
              <group key={acc}>
                <mesh geometry={GEO.ico1} material={m.orange} position={[0, Y(2.13), 0.01]} scale={[0.43, 0.24, 0.43]} castShadow />
                <mesh geometry={GEO.cyl8} material={m.leaf} position={[0, Y(2.39), 0.01]} scale={[0.022, 0.07, 0.022]} />
                <mesh geometry={GEO.ico0} material={m.leaf} position={[0.1, Y(2.41), 0.01]} rotation={[0, 0.3, -0.5]} scale={[0.14, 0.028, 0.075]} />
              </group>
            );
          case 'sailorHat':
            return (
              <group key={acc} rotation={[-0.14, 0, 0]} position={[0, 0, 0.02]}>
                <mesh geometry={GEO.flare16} material={m.white} position={[0, Y(2.24), 0]} scale={[0.34, 0.17, 0.34]} castShadow />
                <mesh geometry={GEO.cyl16} material={m.navy} position={[0, Y(2.17), 0]} scale={[0.315, 0.05, 0.315]} />
              </group>
            );
          case 'gat':
            return (
              <group key={acc}>
                <mesh geometry={GEO.cyl16} material={m.gatBrim} position={[0, Y(2.13), 0.01]} scale={[0.64, 0.016, 0.64]} castShadow />
                <mesh geometry={GEO.cyl12} material={m.gatBrim} position={[0, Y(2.3), 0.01]} scale={[0.2, 0.32, 0.2]} castShadow />
                <mesh geometry={GEO.cyl12} material={m.dark} position={[0, Y(2.465), 0.01]} scale={[0.19, 0.015, 0.19]} />
                <Stick a={GAT.l[0]} b={GAT.l[1]} r={0.012} material={m.dark} />
                <Stick a={GAT.r[0]} b={GAT.r[1]} r={0.012} material={m.dark} />
              </group>
            );
          case 'goggles':
            return (
              <group key={acc}>
                <mesh geometry={goggleBand} material={m.dark} />
                {[-1, 1].map((s) => {
                  const f = onFace(s * 0.12, 2.1, 0.035);
                  return (
                    <group key={s} position={f.position} rotation={f.rotation}>
                      <mesh geometry={GEO.cyl12} material={m.glass} rotation={[Math.PI / 2, 0, 0]} scale={[0.085, 0.05, 0.085]} />
                      <mesh geometry={GEO.torus} material={m.dark} scale={[0.09, 0.09, 0.4]} />
                    </group>
                  );
                })}
              </group>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

/** 얼굴: 눈썹 · 눈 · 코 · 콧구멍 · 볼터치 · 입술 · 귀 · 귀걸이 */
function Face({ m, eyes }: { m: CharacterMaterials; eyes: React.RefObject<(THREE.Group | null)[]> }) {
  const F = FACE;
  return (
    <>
      {[-1, 1].map((s) => {
        const b = onFace(s * F.brow.x, F.brow.y, 0.004);
        return <mesh key={`brow${s}`} geometry={GEO.box} material={m.brow} position={b.position} rotation={b.rotation} scale={[F.brow.w, F.brow.h, F.brow.d]} />;
      })}
      {[-1, 1].map((s, k) => {
        const e = onFace(s * F.eye.x, F.eye.y, -0.006);
        return (
          <group key={`eye${s}`} position={e.position} rotation={e.rotation} ref={(g) => void (eyes.current[k] = g)}>
            <mesh geometry={STATIC.eye} material={m.eye} scale={[F.eye.w / 2, F.eye.h / 2, F.eye.d / 2]} />
            <mesh geometry={STATIC.eye} material={m.white} position={[F.eye.hiX, F.eye.hiY, F.eye.d / 2 - 0.002]} scale={[F.eye.hiR, F.eye.hiR, 0.006]} />
          </group>
        );
      })}
      <mesh geometry={STATIC.nose} material={m.skin} castShadow />
      {[-1, 1].map((s) => (
        <mesh
          key={`nostril${s}`}
          geometry={STATIC.eye}
          material={m.nostril}
          position={[s * F.nostril.x, F.nose.yTip - HEAD_PIVOT + 0.004, F.nose.zTip - 0.004]}
          rotation={[0.5, 0, 0]}
          scale={[F.nostril.w / 2, F.nostril.h / 2, 0.01]}
        />
      ))}
      {[-1, 1].map((s) => {
        const b = onFace(s * F.blush.x, F.blush.y, 0.003);
        return <mesh key={`blush${s}`} geometry={GEO.disc} material={m.blush} position={b.position} rotation={b.rotation} scale={[F.blush.w / 2, F.blush.h / 2, 1]} />;
      })}
      <mesh geometry={STATIC.upperLip} material={m.lipUpper} castShadow />
      <mesh geometry={STATIC.lowerLip} material={m.lipLower} castShadow />
      {[-1, 1].map((s) => (
        <group key={`ear${s}`}>
          <mesh
            geometry={STATIC.ear}
            material={m.skin}
            position={[s * (headA(F.ear.y) + F.ear.out - 0.025), F.ear.y - HEAD_PIVOT, F.ear.z]}
            rotation={[0, s * F.ear.yaw, s * -0.06]}
            castShadow
          />
          <mesh geometry={GEO.ico0} material={m.dark} position={[s * F.earring.x, F.earring.y - HEAD_PIVOT, F.earring.z]} scale={F.earring.r} />
        </group>
      ))}
    </>
  );
}

function Badge({ L, m }: { L: BodyLayout; m: CharacterMaterials }) {
  const x = BADGE.x;
  const y = BADGE.y;
  const e = 0.004;
  const yaw = Math.atan2(-(torsoFrontZ(x + e, y) - torsoFrontZ(x - e, y)) / (2 * e), 1);
  return (
    <group position={[x * L.w, y * L.hs - L.waistY, torsoFrontZ(x, y) * L.w + 0.008]} rotation={[0, yaw, 0]}>
      <mesh geometry={GEO.box} material={m.badge} scale={[BADGE.w, BADGE.h, 0.012]} />
      <mesh geometry={GEO.box} material={m.badgeInk} position={[-0.042, -0.004, 0.007]} scale={[0.036, 0.052, 0.004]} />
      <mesh geometry={GEO.box} material={m.skinShade} position={[-0.042, 0.004, 0.009]} scale={[0.018, 0.022, 0.004]} />
      {[0.022, 0, -0.022].map((dy) => (
        <mesh key={dy} geometry={GEO.box} material={m.badgeInk} position={[0.026, dy, 0.007]} scale={[0.058, 0.008, 0.004]} />
      ))}
      <mesh geometry={GEO.box} material={m.dark} position={[0, BADGE.h / 2 + 0.012, 0]} scale={[0.036, 0.026, 0.016]} />
    </group>
  );
}

function TorsoDetails({ L, m, costume, g }: { L: BodyLayout; m: CharacterMaterials; costume: CostumeDef; g: ReturnType<typeof useBodyGeometry> }) {
  const tf = (x: number, y: number, lift = 0.006): V3 => [x * L.w, y * L.hs - L.waistY, torsoFrontZ(x, y) * L.w + lift];
  const parts: ReactNode[] = [];
  const vneck = <mesh key="v" geometry={g.vneck} material={m.skin} />;
  switch (costume.topStyle) {
    case 'vneck':
    case 'stripe':
      parts.push(vneck);
      break;
    case 'coat':
      parts.push(vneck);
      parts.push(<mesh key="inner" geometry={GEO.box} material={m.topAccent} position={tf(0, 0.93)} scale={[0.11, 0.42 * L.hs, 0.012]} />);
      for (const s of [-1, 1])
        parts.push(<mesh key={`lapel${s}`} geometry={GEO.box} material={m.badge} position={tf(s * 0.085, 1.16, 0.01)} rotation={[0, 0, s * 0.42]} scale={[0.04, 0.26, 0.012]} />);
      break;
    case 'blazer':
      parts.push(<mesh key="shirt" geometry={g.shirtV} material={m.topAccent} />);
      parts.push(<mesh key="knot" geometry={GEO.box} material={m.red} position={tf(0, 1.255, 0.02)} scale={[0.07, 0.055, 0.03]} />);
      parts.push(<mesh key="tie" geometry={GEO.box} material={m.red} position={tf(0, 1.04, 0.014)} rotation={[0.1, 0, 0]} scale={[0.055, 0.4 * L.hs, 0.02]} />);
      for (const s of [-1, 1])
        parts.push(<mesh key={`lapel${s}`} geometry={GEO.box} material={m.navy} position={tf(s * 0.09, 1.14, 0.008)} rotation={[0, 0, s * 0.42]} scale={[0.03, 0.27, 0.012]} />);
      for (const y of [0.92, 0.8]) parts.push(<mesh key={`btn${y}`} geometry={GEO.ico0} material={m.gold} position={tf(0.035, y, 0.008)} scale={0.022} />);
      break;
    case 'zip':
      parts.push(<mesh key="zip" geometry={GEO.box} material={m.topAccent} position={tf(0, 0.98)} scale={[0.018, 0.6 * L.hs, 0.012]} />);
      parts.push(<mesh key="collar" geometry={GEO.cyl8} material={m.top} position={[0, 1.29 * L.hs - L.waistY, 0]} scale={[0.15 * L.w, 0.07, 0.13 * L.w]} />);
      break;
    case 'hoodie':
      parts.push(<mesh key="hood" geometry={GEO.ico1} material={m.top} position={[0, 1.28 * L.hs - L.waistY, -0.13 * L.w]} scale={[0.27 * Math.sqrt(L.w), 0.15, 0.15]} castShadow />);
      parts.push(<mesh key="pocket" geometry={GEO.box} material={m.topAccent} position={tf(0, 0.8)} scale={[0.32 * L.w, 0.13, 0.025]} />);
      for (const s of [-1, 1]) parts.push(<mesh key={`str${s}`} geometry={GEO.cyl6} material={m.white} position={tf(s * 0.055, 1.17, 0.014)} scale={[0.012, 0.15, 0.012]} />);
      break;
    case 'tee':
      parts.push(<mesh key="collar" geometry={GEO.cyl8} material={m.skin} position={[0, 1.285 * L.hs - L.waistY, 0]} scale={[0.12, 0.04, 0.1]} />);
      parts.push(<mesh key="orange" geometry={GEO.ico1} material={m.orange} position={tf(-0.11, 1.06, 0.04)} scale={0.065} />);
      parts.push(<mesh key="leaf" geometry={GEO.ico0} material={m.leaf} position={tf(-0.08, 1.13, 0.045)} rotation={[0, 0, -0.5]} scale={[0.045, 0.014, 0.028]} />);
      break;
    case 'robe':
      parts.push(<mesh key="trim" geometry={g.shirtV} material={m.topAccent} />);
      parts.push(<mesh key="collar" geometry={g.vneck} material={m.white} position={[0, 0, 0.003]} />);
      if (g.belt) parts.push(<mesh key="belt" geometry={g.belt} material={m.topAccent} />);
      parts.push(<mesh key="tie1" geometry={GEO.box} material={m.topAccent} position={tf(0.08, 0.6, 0.03)} rotation={[0, 0, 0.1]} scale={[0.025, 0.26, 0.012]} />);
      break;
  }
  g.stripes.forEach((geo, k) => parts.push(<mesh key={`st${k}`} geometry={geo} material={m.topAccent} />));
  if (costume.accessories.includes('badge')) parts.push(<Badge key="badge" L={L} m={m} />);
  return <>{parts}</>;
}

interface Props {
  appearance: Appearance;
  ref?: Ref<CharacterRig>;
  /** 레퍼런스처럼 받침대 위에 세우기 (로비/꾸미기 미리보기) */
  showBase?: boolean;
  /** 머리 그룹 안에 붙일 추가 요소 */
  headSlot?: ReactNode;
}

export function LowPolyCharacter({ appearance: a, ref, showBase, headSlot }: Props) {
  const m = useCharacterMaterials(a);
  const costume = COSTUMES[a.costumeId];
  const L = useMemo(() => bodyLayout(a), [a.bodyType, a.height, a.buttVolume]);
  const g = useBodyGeometry(L, costume);
  const hips = useRef<THREE.Group>(null);
  const butt = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const eyes = useRef<(THREE.Group | null)[]>([]);

  useImperativeHandle(
    ref,
    () => ({
      hips: hips.current!,
      butt: butt.current!,
      torso: torso.current!,
      head: head.current!,
      armL: armL.current!,
      armR: armR.current!,
      legL: legL.current!,
      legR: legR.current!,
      eyes: eyes.current.filter((e): e is THREE.Group => !!e),
      materials: m.all,
    }),
    [m],
  );

  const isLong = LONG_TOPS.has(costume.topStyle);
  const longSleeve = LONG_SLEEVES.has(costume.topStyle);
  const lowerMat = isLong ? m.top : m.bottom;
  const armW = Math.pow(L.w, 0.6);
  const sleeveLen = Math.hypot(SLEEVE.bottom[0] - SLEEVE.top[0], SLEEVE.bottom[1] - SLEEVE.top[1]) * L.hs;
  const sleeveTilt = Math.atan2(SLEEVE.bottom[0] - SLEEVE.top[0], SLEEVE.top[1] - SLEEVE.bottom[1]);
  const jointToSleeveMid: [number, number] = [
    ((SLEEVE.top[0] + SLEEVE.bottom[0]) / 2 - ARM.shoulder[0]) * L.w,
    ((SLEEVE.top[1] + SLEEVE.bottom[1]) / 2 - ARM.shoulder[1]) * L.hs,
  ];
  const forearmLen = (ARM.yTop - ARM.yWrist) * L.hs;
  const armDx = (ARM.x - ARM.shoulder[0]) * L.w;

  return (
    <group>
      {showBase && <mesh geometry={STATIC.base} material={BASE_MAT} receiveShadow castShadow />}

      {/* 다리 + 신발 (회전축 = 고관절) */}
      {[-1, 1].map((s) => (
        <group key={`leg${s}`} ref={s === 1 ? legL : legR} position={[s * LEG_X * L.w, L.hipY, 0]}>
          <mesh geometry={g.leg} material={lowerMat} castShadow />
          {costume.bottomStripe && (
            <mesh geometry={GEO.box} material={m.stripe} position={[s * 0.1 * Math.pow(L.w, 0.85), -L.hipY / 2, 0]} scale={[0.012, L.hipY * 0.85, 0.035]} />
          )}
          <mesh geometry={STATIC.shoe} material={m.shoes} position={[0, -L.hipY, 0]} castShadow />
        </group>
      ))}

      {/* 골반 + 엉덩이 */}
      <group ref={hips} position={[0, L.pelvisY, 0]}>
        <mesh geometry={g.pelvis} material={lowerMat} castShadow />
        {g.skirt && <mesh geometry={g.skirt} material={m.top} castShadow />}
        {costume.topStyle === 'coat' &&
          [-1, 1].map((s) => (
            <mesh key={`pk${s}`} geometry={GEO.box} material={m.badge} position={[s * 0.15 * L.w, 0.45 * L.hs - L.pelvisY, 0.24 * L.w]} scale={[0.1, 0.08, 0.01]} />
          ))}
        <group ref={butt} position={[0, 0.02, 0]}>
          {[-1, 1].map((s) => (
            <mesh
              key={`cheek${s}`}
              geometry={GEO.ico1}
              material={lowerMat}
              position={[s * L.butt.x, 0, L.butt.z]}
              scale={[L.butt.r * 1.05, L.butt.r, L.butt.r * 0.92]}
              castShadow
            />
          ))}
        </group>
      </group>

      {/* 몸통 (회전축 = 허리) */}
      <group ref={torso} position={[0, L.waistY, 0]}>
        <mesh geometry={g.torso} material={m.top} castShadow />
        <mesh geometry={GEO.cyl8} material={m.neck} position={[0, (1.26 * L.hs + HEAD_PIVOT + L.headLift) / 2 - L.waistY, -0.01]} scale={[0.092, 0.14, 0.088]} />
        <TorsoDetails L={L} m={m} costume={costume} g={g} />

        {/* 팔 (회전축 = 어깨): 반팔 소매 + 팔 + 벙어리장갑 손 */}
        {[-1, 1].map((s) => (
          <group key={`arm${s}`} ref={s === 1 ? armL : armR} position={[s * L.shoulder[0], L.shoulder[1] - L.waistY, -0.01]}>
            <mesh
              geometry={GEO.taper8}
              material={m.top}
              position={[s * jointToSleeveMid[0], jointToSleeveMid[1], 0]}
              rotation={[0, 0, s * sleeveTilt]}
              scale={[SLEEVE.rBottom * armW * (longSleeve ? 0.95 : 1), sleeveLen * (longSleeve ? 2.2 : 1), SLEEVE.rBottom * armW * SLEEVE.depth]}
              castShadow
            />
            {!longSleeve && (
              <mesh
                geometry={GEO.taperDown8}
                material={m.skin}
                position={[s * armDx, ((ARM.yTop + ARM.yWrist) / 2) * L.hs - L.shoulder[1], 0.012]}
                rotation={[-0.08, 0, 0]}
                scale={[ARM.rTop * armW, forearmLen, ARM.rTop * armW * 0.95]}
                castShadow
              />
            )}
            {costume.topStyle === 'zip' && (
              <mesh geometry={GEO.box} material={m.topAccent} position={[s * (armDx + 0.06 * armW), -0.2 * L.hs, 0]} scale={[0.012, 0.36 * L.hs, 0.03]} />
            )}
            <mesh
              geometry={GEO.ico1}
              material={m.skin}
              position={[s * (armDx - 0.004), ARM.handY * L.hs - L.shoulder[1], 0.03]}
              rotation={[0.08, 0, s * 0.14]}
              scale={[ARM.hand[0] * armW, ARM.hand[1], ARM.hand[2] * armW]}
              castShadow
            />
          </group>
        ))}

        {/* 머리 (회전축 = 목) */}
        <group ref={head} position={[0, L.headPivotY - L.waistY, 0]}>
          <mesh geometry={STATIC.head} material={m.skin} castShadow />
          <Face m={m} eyes={eyes} />
          <Hair style={a.hairStyle} material={m.hair} pivotY={HEAD_PIVOT} />
          <Headwear accessories={costume.accessories} m={m} />
          {headSlot}
        </group>
      </group>
    </group>
  );
}
