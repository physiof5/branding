import { useImperativeHandle, useMemo, useRef, type ReactNode, type Ref } from 'react';
import * as THREE from 'three';
import { buttScale, type Appearance } from '../../data/appearance';
import { COSTUMES, type Accessory, type CostumeDef } from '../../data/costumes';
import { GEO } from '../geometries';
import { faceYaw, HEAD_R, HEAD_SX, HEAD_SY, HEAD_SZ, surfZ } from './head';
import { Hair } from './Hair';
import { useCharacterMaterials, type CharacterMaterials } from './materials';

// ─────────────────────────────────────────────────────────────
// 로폴리 캐릭터 (사용자 레퍼런스: 민머리 · 굵은 눈썹 · 큰 빨간 입술 · 네이비 스크럽 · 사원증 · 받침대)
// 모델 정면 = +z, 발바닥 = y 0. 체형/키/엉덩이 볼륨은 비율로만 반영 (전투 스탯과 무관)
// ─────────────────────────────────────────────────────────────

export interface CharacterRig {
  hips: THREE.Group;
  butt: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
}

export interface BodyDims {
  w: number;
  bs: number;
  legLen: number;
  hipY: number;
  waistY: number;
  torsoH: number;
  rx: number;
  rz: number;
  headY: number;
  legR: number;
  armR: number;
  shoulderX: number;
  shoulderY: number;
}

export function bodyDims(a: Pick<Appearance, 'bodyType' | 'height' | 'buttVolume'>): BodyDims {
  const w = 0.86 + a.bodyType * 0.5;
  const hs = 0.9 + a.height * 0.2;
  const legLen = 0.38 * hs;
  const hipY = 0.09 + legLen;
  const torsoH = 0.5 * hs;
  const rx = 0.3 * w;
  return {
    w,
    bs: buttScale(a.buttVolume),
    legLen,
    hipY,
    waistY: hipY + 0.05,
    torsoH,
    rx,
    rz: 0.235 * w,
    headY: torsoH + 0.05 + HEAD_R * 0.93,
    legR: 0.105 * Math.pow(w, 0.75),
    armR: 0.09 * Math.pow(w, 0.6),
    shoulderX: rx * 0.9 + 0.045,
    shoulderY: torsoH - 0.08,
  };
}

/** 몸통(8각 테이퍼) 정면 z */
const frontZ = (d: BodyDims, y: number): number => d.rz * (1 - 0.14 * (y / d.torsoH));

const LONG_TOPS = new Set(['robe', 'coat']);
/** 레퍼런스의 살구색 받침대 */
const BASE_MAT = new THREE.MeshStandardMaterial({ color: '#e3cbc3', flatShading: true, roughness: 0.9 });
const LONG_SLEEVES = new Set(['blazer', 'zip', 'hoodie', 'coat', 'robe']);

/** 두 점을 잇는 얇은 막대 (갓끈 등) */
function Stick({ a, b, r, material }: { a: [number, number, number]; b: [number, number, number]; r: number; material: THREE.Material }) {
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

const GAT_L: [number, number, number] = [-0.46, 0.4, 0.16];
const GAT_LC: [number, number, number] = [-0.17, -0.36, 0.36];
const GAT_R: [number, number, number] = [0.46, 0.4, 0.16];
const GAT_RC: [number, number, number] = [0.17, -0.36, 0.36];

function Headwear({ accessories, m }: { accessories: readonly Accessory[]; m: CharacterMaterials }) {
  return (
    <>
      {accessories.map((acc) => {
        switch (acc) {
          case 'headband':
            return (
              <group key={acc}>
                <mesh geometry={GEO.torus} material={m.red} position={[0, 0.25, 0]} rotation={[Math.PI / 2 - 0.12, 0, 0]} scale={[0.46, 0.445, 0.46]} />
                <mesh geometry={GEO.box} material={m.white} position={[0, 0.27, surfZ(0, 0.27) + 0.03]} rotation={[-0.45, 0, 0]} scale={[0.17, 0.065, 0.012]} />
              </group>
            );
          case 'tangerineHat':
            return (
              <group key={acc}>
                <mesh geometry={GEO.ico1} material={m.orange} position={[0, 0.36, -0.02]} scale={[0.42, 0.3, 0.42]} castShadow />
                <mesh geometry={GEO.cyl8} material={m.leaf} position={[0, 0.67, -0.02]} scale={[0.022, 0.07, 0.022]} />
                <mesh geometry={GEO.ico0} material={m.leaf} position={[0.1, 0.69, -0.02]} rotation={[0, 0.3, -0.5]} scale={[0.14, 0.028, 0.075]} />
              </group>
            );
          case 'sailorHat':
            return (
              <group key={acc} rotation={[-0.14, 0, 0]}>
                <mesh geometry={GEO.flare16} material={m.white} position={[0, 0.49, -0.02]} scale={[0.36, 0.17, 0.36]} castShadow />
                <mesh geometry={GEO.cyl16} material={m.navy} position={[0, 0.42, -0.02]} scale={[0.335, 0.05, 0.335]} />
              </group>
            );
          case 'gat':
            return (
              <group key={acc}>
                <mesh geometry={GEO.cyl16} material={m.gatBrim} position={[0, 0.43, 0]} scale={[0.62, 0.016, 0.62]} castShadow />
                <mesh geometry={GEO.cyl12} material={m.gatBrim} position={[0, 0.6, 0]} scale={[0.19, 0.32, 0.19]} castShadow />
                <mesh geometry={GEO.cyl12} material={m.dark} position={[0, 0.765, 0]} scale={[0.18, 0.015, 0.18]} />
                <Stick a={GAT_L} b={GAT_LC} r={0.012} material={m.dark} />
                <Stick a={GAT_R} b={GAT_RC} r={0.012} material={m.dark} />
              </group>
            );
          case 'goggles':
            return (
              <group key={acc}>
                <mesh geometry={GEO.torus} material={m.dark} position={[0, 0.31, -0.02]} rotation={[Math.PI / 2 - 0.3, 0, 0]} scale={[0.44, 0.43, 0.6]} />
                {[-1, 1].map((s) => {
                  const x = s * 0.115;
                  const y = 0.335;
                  return (
                    <group key={s} position={[x, y, surfZ(x, y) + 0.035]} rotation={[Math.PI / 2 - 0.45, 0, s * -0.25]}>
                      <mesh geometry={GEO.cyl12} material={m.glass} scale={[0.085, 0.05, 0.085]} />
                      <mesh geometry={GEO.torus} material={m.dark} rotation={[Math.PI / 2, 0, 0]} scale={[0.09, 0.09, 0.4]} />
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

function Head({ a, m, costume }: { a: Appearance; m: CharacterMaterials; costume: CostumeDef }) {
  const browY = 0.19;
  const eyeY = 0.04;
  return (
    <>
      <mesh geometry={GEO.ico2} material={m.skin} scale={[HEAD_SX, HEAD_SY, HEAD_SZ]} castShadow />
      {[-1, 1].map((s) => (
        <group key={`ear${s}`}>
          <mesh geometry={GEO.ico1} material={m.skin} position={[s * (HEAD_SX - 0.015), -0.02, -0.03]} rotation={[0, s * 0.35, 0]} scale={[0.055, 0.11, 0.085]} castShadow />
          <mesh geometry={GEO.ico0} material={m.dark} position={[s * (HEAD_SX + 0.032), -0.12, 0]} scale={0.02} />
        </group>
      ))}
      {[-1, 1].map((s) => {
        const x = s * 0.165;
        return (
          <mesh
            key={`brow${s}`}
            geometry={GEO.box}
            material={m.brow}
            position={[x, browY, surfZ(x, browY) + 0.005]}
            rotation={[-0.3, faceYaw(x, browY), -s * 0.07]}
            scale={[0.2, 0.062, 0.07]}
          />
        );
      })}
      {[-1, 1].map((s) => {
        const x = s * 0.155;
        return (
          <group key={`eye${s}`} position={[x, eyeY, surfZ(x, eyeY) - 0.012]} rotation={[0, faceYaw(x, eyeY), 0]}>
            <mesh geometry={GEO.ico1} material={m.eye} scale={[0.068, 0.078, 0.04]} />
            <mesh geometry={GEO.ico0} material={m.white} position={[0.022, 0.027, 0.03]} scale={0.019} />
          </group>
        );
      })}
      <mesh geometry={GEO.ico1} material={m.skinShade} position={[0, -0.07, surfZ(0, -0.07) + 0.022]} scale={[0.065, 0.085, 0.07]} />
      {[-1, 1].map((s) => {
        const x = s * 0.275;
        const y = -0.1;
        return (
          <mesh key={`blush${s}`} geometry={GEO.ico1} material={m.blush} position={[x, y, surfZ(x, y) - 0.012]} rotation={[0, faceYaw(x, y), 0]} scale={[0.088, 0.056, 0.04]} />
        );
      })}
      {/* 큰 빨간 입술: 윗입술 두 덩어리(큐피드 활) + 아랫입술 */}
      {[-1, 1].map((s) => (
        <mesh
          key={`lip${s}`}
          geometry={GEO.ico1}
          material={m.lipUpper}
          position={[s * 0.072, -0.2, surfZ(s * 0.072, -0.2) + 0.05]}
          rotation={[0, 0, -s * 0.12]}
          scale={[0.13, 0.062, 0.09]}
        />
      ))}
      <mesh geometry={GEO.ico1} material={m.lipLower} position={[0, -0.268, surfZ(0, -0.268) + 0.042]} scale={[0.18, 0.078, 0.098]} />
      <Hair style={a.hairStyle} material={m.hair} />
      <Headwear accessories={costume.accessories} m={m} />
    </>
  );
}

function Badge({ d, m }: { d: BodyDims; m: CharacterMaterials }) {
  const y = d.torsoH * 0.62;
  return (
    <group position={[0.11 * d.w, y, frontZ(d, y) * 0.86 + 0.012]} rotation={[0, 0.39, 0]}>
      <mesh geometry={GEO.box} material={m.badge} scale={[0.115, 0.085, 0.012]} />
      <mesh geometry={GEO.box} material={m.skinShade} position={[-0.03, 0, 0.007]} scale={[0.03, 0.042, 0.004]} />
      <mesh geometry={GEO.box} material={m.dark} position={[0.02, 0.013, 0.007]} scale={[0.045, 0.008, 0.004]} />
      <mesh geometry={GEO.box} material={m.dark} position={[0.02, -0.01, 0.007]} scale={[0.045, 0.008, 0.004]} />
      <mesh geometry={GEO.box} material={m.dark} position={[0, 0.05, 0]} scale={[0.03, 0.02, 0.014]} />
    </group>
  );
}

function TorsoDetails({ d, m, costume, skin }: { d: BodyDims; m: CharacterMaterials; costume: CostumeDef; skin: THREE.Material }) {
  const H = d.torsoH;
  const fz = (y: number) => frontZ(d, y);
  const diamond = (mat: THREE.Material, size: number, y: number, key: string, dz = 0) => (
    <mesh key={key} geometry={GEO.box} material={mat} position={[0, y, fz(y) - 0.012 + dz]} rotation={[0, 0, Math.PI / 4]} scale={[size, size, 0.03]} />
  );
  const parts: ReactNode[] = [];
  switch (costume.topStyle) {
    case 'vneck':
      parts.push(diamond(skin, 0.15, H - 0.02, 'v'));
      break;
    case 'blazer':
      parts.push(diamond(m.topAccent, 0.21, H - 0.04, 'shirt'));
      parts.push(<mesh key="knot" geometry={GEO.box} material={m.red} position={[0, H - 0.06, fz(H - 0.06) + 0.02]} scale={[0.07, 0.055, 0.03]} />);
      parts.push(<mesh key="tie" geometry={GEO.box} material={m.red} position={[0, H * 0.6, fz(H * 0.6) + 0.012]} rotation={[0.12, 0, 0]} scale={[0.055, H * 0.52, 0.02]} />);
      for (const s of [-1, 1])
        parts.push(
          <mesh key={`lapel${s}`} geometry={GEO.box} material={m.navy} position={[s * 0.085, H * 0.74, fz(H * 0.74) + 0.006]} rotation={[0, 0, s * 0.42]} scale={[0.03, H * 0.5, 0.012]} />,
        );
      for (const y of [0.32, 0.16])
        parts.push(<mesh key={`btn${y}`} geometry={GEO.ico0} material={m.gold} position={[0.03, H * y, fz(H * y) + 0.008]} scale={0.022} />);
      break;
    case 'zip':
      parts.push(<mesh key="zip" geometry={GEO.box} material={m.topAccent} position={[0, H * 0.48, fz(H * 0.48) + 0.006]} scale={[0.018, H * 0.92, 0.012]} />);
      parts.push(<mesh key="collar" geometry={GEO.cyl8} material={m.top} position={[0, H + 0.01, 0]} scale={[0.17, 0.08, 0.15]} />);
      break;
    case 'hoodie':
      parts.push(<mesh key="hood" geometry={GEO.ico1} material={m.top} position={[0, H + 0.02, -d.rz * 0.72]} scale={[0.3 * Math.sqrt(d.w), 0.17, 0.17]} castShadow />);
      parts.push(<mesh key="pocket" geometry={GEO.box} material={m.topAccent} position={[0, H * 0.25, fz(H * 0.25) + 0.004]} scale={[d.rx * 1.1, 0.13, 0.025]} />);
      for (const s of [-1, 1])
        parts.push(<mesh key={`str${s}`} geometry={GEO.cyl6} material={m.white} position={[s * 0.055, H * 0.8, fz(H * 0.8) + 0.012]} scale={[0.012, 0.16, 0.012]} />);
      break;
    case 'stripe':
      parts.push(diamond(skin, 0.13, H - 0.02, 'v'));
      for (const k of [0.18, 0.38, 0.58, 0.78])
        parts.push(
          <mesh key={`st${k}`} geometry={GEO.cyl8} material={m.topAccent} position={[0, H * k, 0]} scale={[d.rx * (1 - 0.14 * k) * 1.025, 0.04, d.rz * (1 - 0.14 * k) * 1.035]} />,
        );
      break;
    case 'tee':
      parts.push(<mesh key="collar" geometry={GEO.cyl8} material={skin} position={[0, H + 0.0, 0.01]} scale={[0.12, 0.04, 0.11]} />);
      parts.push(<mesh key="orange" geometry={GEO.ico1} material={m.orange} position={[-0.1, H * 0.6, fz(H * 0.6) * 0.86 + 0.04]} scale={0.07} />);
      parts.push(<mesh key="leaf" geometry={GEO.ico0} material={m.leaf} position={[-0.07, H * 0.6 + 0.07, fz(H * 0.6) * 0.86 + 0.045]} rotation={[0, 0, -0.5]} scale={[0.045, 0.014, 0.028]} />);
      break;
    case 'robe':
      parts.push(diamond(m.topAccent, 0.22, H - 0.03, 'trim'));
      parts.push(diamond(m.white, 0.16, H - 0.01, 'collar', 0.004));
      parts.push(<mesh key="belt" geometry={GEO.cyl8} material={m.topAccent} position={[0, 0.03, 0]} scale={[d.rx * 1.04, 0.05, d.rz * 1.08]} />);
      parts.push(<mesh key="tie1" geometry={GEO.box} material={m.topAccent} position={[0.08, -0.13, fz(0) + 0.03]} rotation={[0, 0, 0.1]} scale={[0.025, 0.28, 0.012]} />);
      break;
    case 'coat':
      parts.push(diamond(skin, 0.15, H - 0.02, 'v'));
      parts.push(<mesh key="inner" geometry={GEO.box} material={m.topAccent} position={[0, H * 0.46, fz(H * 0.46) + 0.004]} scale={[0.12, H * 0.84, 0.012]} />);
      for (const s of [-1, 1])
        parts.push(
          <mesh key={`lapel${s}`} geometry={GEO.box} material={m.badge} position={[s * 0.09, H * 0.74, fz(H * 0.74) + 0.008]} rotation={[0, 0, s * 0.4]} scale={[0.04, H * 0.5, 0.012]} />,
        );
      break;
  }
  if (costume.accessories.includes('badge')) parts.push(<Badge key="badge" d={d} m={m} />);
  return <>{parts}</>;
}

interface Props {
  appearance: Appearance;
  ref?: Ref<CharacterRig>;
  /** 레퍼런스처럼 받침대 위에 세우기 (로비 미리보기) */
  showBase?: boolean;
  /** 머리 그룹 안에 붙일 추가 요소 (기절 별 등) */
  headSlot?: ReactNode;
}

export function LowPolyCharacter({ appearance: a, ref, showBase, headSlot }: Props) {
  const m = useCharacterMaterials(a);
  const costume = COSTUMES[a.costumeId];
  const d = useMemo(() => bodyDims(a), [a]);
  const hips = useRef<THREE.Group>(null);
  const butt = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);

  useImperativeHandle(
    ref,
    () => ({
      hips: hips.current!,
      butt: butt.current!,
      torso: torso.current!,
      head: head.current!,
      armL: armL.current!,
      armR: armR.current!,
      materials: m.all,
    }),
    [m],
  );

  const isLong = LONG_TOPS.has(costume.topStyle);
  const longSleeve = LONG_SLEEVES.has(costume.topStyle);
  const wide = costume.topStyle === 'robe' ? 1.55 : 1;
  const sleeveLen = longSleeve ? 0.37 : 0.18;
  const buttMat = isLong ? m.top : m.bottom;
  const skirtBottom = costume.topStyle === 'robe' ? 0.16 : d.hipY - d.legLen * 0.55;
  const skirtTop = 0.08;
  const skirtH = skirtTop - (skirtBottom - d.hipY);

  return (
    <group>
      {showBase && <mesh geometry={GEO.cyl12} material={BASE_MAT} position={[0, -0.1, 0]} scale={[0.95, 0.2, 0.95]} receiveShadow castShadow />}

      {[-1, 1].map((s) => (
        <group key={`leg${s}`} position={[s * 0.13 * d.w, d.hipY, 0]}>
          <mesh geometry={GEO.cyl8} material={m.bottom} position={[0, -d.legLen / 2 + 0.01, 0]} scale={[d.legR, d.legLen + 0.02, d.legR]} castShadow />
          {costume.bottomStripe && (
            <mesh geometry={GEO.box} material={m.stripe} position={[s * d.legR * 0.97, -d.legLen / 2, 0]} scale={[0.014, d.legLen * 0.95, 0.035]} />
          )}
          <mesh geometry={GEO.ico1} material={m.shoes} position={[0, -d.legLen - 0.02, 0.05]} scale={[0.115 * Math.min(d.w, 1.15), 0.075, 0.175]} castShadow />
        </group>
      ))}

      <group ref={hips} position={[0, d.hipY, 0]}>
        <mesh geometry={GEO.cyl8} material={buttMat} position={[0, 0.03, 0]} scale={[d.rx * 0.92, 0.2, d.rz * 0.92]} castShadow />
        {isLong && (
          <mesh
            geometry={GEO.taper8}
            material={m.top}
            position={[0, skirtTop - skirtH / 2, 0]}
            scale={[d.rx * 1.1, skirtH, Math.max(d.rz * 1.18, 0.1 * d.w + 0.12 * d.bs)]}
            castShadow
          />
        )}
        {costume.topStyle === 'coat' &&
          [-1, 1].map((s) => (
            <mesh key={`pk${s}`} geometry={GEO.box} material={m.badge} position={[s * 0.15 * d.w, skirtBottom - d.hipY + 0.14, d.rz * 1.02]} scale={[0.1, 0.08, 0.01]} />
          ))}
        <group ref={butt} position={[0, 0.06, -0.12 * d.w]}>
          {[-1, 1].map((s) => {
            const r = 0.145 * d.bs;
            return (
              <mesh
                key={`cheek${s}`}
                geometry={GEO.ico1}
                material={buttMat}
                position={[s * (0.095 * d.w + 0.025 * d.bs), 0, -(0.02 + 0.075 * d.bs)]}
                scale={[r * 1.05, r * 0.95, r * 0.95]}
                castShadow
              />
            );
          })}
        </group>
      </group>

      <group ref={torso} position={[0, d.waistY, 0]}>
        <mesh geometry={GEO.taper8} material={m.top} position={[0, d.torsoH / 2, 0]} scale={[d.rx, d.torsoH, d.rz]} castShadow />
        {a.bodyType > 0.35 && (
          <mesh
            geometry={GEO.ico1}
            material={m.top}
            position={[0, d.torsoH * 0.36, d.rz * 0.42]}
            scale={[d.rx * 0.84, d.torsoH * 0.42, d.rz * (0.62 + (a.bodyType - 0.35) * 0.55)]}
            castShadow
          />
        )}
        <mesh geometry={GEO.cyl8} material={m.skin} position={[0, d.torsoH + 0.04, 0]} scale={[0.1, 0.12, 0.1]} />
        <TorsoDetails d={d} m={m} costume={costume} skin={m.skin} />

        {[-1, 1].map((s) => (
          <group key={`arm${s}`} ref={s === 1 ? armL : armR} position={[s * d.shoulderX, d.shoulderY, 0]} rotation={[0, 0, s * 0.14]}>
            <mesh geometry={GEO.cyl8} material={m.top} position={[0, -sleeveLen / 2 + 0.03, 0]} scale={[d.armR * wide, sleeveLen, d.armR * wide]} castShadow />
            {!longSleeve && <mesh geometry={GEO.cyl8} material={m.skin} position={[0, -0.29, 0]} scale={[0.068, 0.24, 0.068]} castShadow />}
            {costume.topStyle === 'zip' && (
              <mesh geometry={GEO.box} material={m.topAccent} position={[s * d.armR * 0.98, -sleeveLen / 2 + 0.03, 0]} scale={[0.012, sleeveLen * 0.9, 0.03]} />
            )}
            <mesh geometry={GEO.ico1} material={m.skin} position={[0, -0.44, 0.01]} scale={0.078} castShadow />
          </group>
        ))}

        <group ref={head} position={[0, d.headY, 0]}>
          <Head a={a} m={m} costume={costume} />
          {headSlot}
        </group>
      </group>
    </group>
  );
}
