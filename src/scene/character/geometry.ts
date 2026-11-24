import * as THREE from 'three';
import {
  BASE,
  FACE,
  HEAD_A,
  HEAD_CHIN,
  HEAD_N,
  HEAD_TOP,
  HEAD_ZB,
  HEAD_ZF,
  sample,
  SHOE,
  TORSO_N,
  TORSO_RINGS,
} from './profiles';

// ─────────────────────────────────────────────────────────────
// 부위별 형상 함수 → BufferGeometry
//  · 초타원 단면  |x/a|^n + |z/b|^n = 1  (n 이 클수록 각진 박스, 2 = 타원)
//  · 로프트: 높이별 단면(반폭 a, 앞 zf, 뒤 zb)을 이어 붙인 몸통/골반/다리
//  · 머리: 정이십면체 구(detail 2) 를 측정 프로파일로 변형 → 레퍼런스의 큼직한 삼각 패싯
// ─────────────────────────────────────────────────────────────

/** 초타원 단면 위의 단위 점 (φ=0 → +x, φ=π/2 → +z 정면) */
export function superellipse(phi: number, n: number): [number, number] {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const e = 2 / n;
  return [Math.sign(c) * Math.abs(c) ** e, Math.sign(s) * Math.abs(s) ** e];
}

/** 초타원의 앞면 z: 반폭 a, 앞 깊이 zf, 가로 위치 x */
export function superFrontZ(x: number, a: number, zf: number, n: number): number {
  const t = Math.min(1, Math.abs(x) / Math.max(1e-6, a));
  return zf * Math.pow(1 - Math.pow(t, n), 1 / n);
}

export interface Ring {
  y: number;
  a: number;
  zf: number;
  /** 음수 */
  zb: number;
  cx?: number;
  cz?: number;
}

/** 단면 링들을 이어 만든 로프트 메쉬 (링은 y 오름차순) */
export function loft(rings: readonly Ring[], segs: number, n: number, caps: { top?: number; bottom?: number } = {}): THREE.BufferGeometry {
  const pos: number[] = [];
  const index: number[] = [];
  for (const r of rings) {
    for (let k = 0; k < segs; k++) {
      const phi = Math.PI / 2 + (k / segs) * Math.PI * 2;
      const [ux, uz] = superellipse(phi, n);
      pos.push((r.cx ?? 0) + ux * r.a, r.y, (r.cz ?? 0) + (uz >= 0 ? uz * r.zf : uz * -r.zb));
    }
  }
  // 바깥을 향하도록 감는 방향 결정
  const p = (i: number) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  const a0 = p(0);
  const b0 = p(1);
  const c0 = p(segs);
  const nrm = new THREE.Vector3().subVectors(b0, a0).cross(new THREE.Vector3().subVectors(c0, a0));
  const radial = new THREE.Vector3(a0.x - (rings[0].cx ?? 0), 0, a0.z - (rings[0].cz ?? 0));
  const flip = nrm.dot(radial) < 0;
  const quad = (a: number, b: number, c: number, d: number) => {
    if (flip) index.push(a, c, b, a, d, c);
    else index.push(a, b, c, a, c, d);
  };
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < segs; k++) {
      const k1 = (k + 1) % segs;
      quad(i * segs + k, i * segs + k1, (i + 1) * segs + k1, (i + 1) * segs + k);
    }
  }
  const cap = (ringIdx: number, lift: number, top: boolean) => {
    const r = rings[ringIdx];
    const center = pos.length / 3;
    pos.push(r.cx ?? 0, r.y + lift, (r.cz ?? 0) + (r.zf + r.zb) / 2);
    for (let k = 0; k < segs; k++) {
      const a = ringIdx * segs + k;
      const b = ringIdx * segs + ((k + 1) % segs);
      if (top !== flip) index.push(a, b, center);
      else index.push(b, a, center);
    }
  };
  if (caps.top !== undefined) cap(rings.length - 1, caps.top, true);
  if (caps.bottom !== undefined) cap(0, -caps.bottom, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** 구 정점을 함수로 옮겨 만드는 형상 (단위 구 방향 → 목표 위치) */
function deformSphere(detail: number, fn: (v: THREE.Vector3) => [number, number, number], smooth = false): THREE.BufferGeometry {
  const g = smooth ? new THREE.SphereGeometry(1, 30, 18) : new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const [x, y, z] = fn(v);
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

// ── 머리 ─────────────────────────────────────────────────────
export const headA = (y: number) => sample(HEAD_A, y);
export const headZF = (y: number) => sample(HEAD_ZF, y);
export const headZB = (y: number) => sample(HEAD_ZB, y);

/** 머리 표면 점 (높이 y, 방위 φ) — 머리카락·모자도 같은 함수로 만든다 */
export function headSurface(y: number, phi: number, grow = 0): [number, number, number] {
  const [ux, uz] = superellipse(phi, HEAD_N);
  const a = headA(y) + grow;
  const zf = headZF(y) + grow;
  const zb = headZB(y) - grow;
  return [ux * a, y, uz >= 0 ? uz * zf : uz * -zb];
}

/** 얼굴 앞면 z (x, y) */
export function headFrontZ(x: number, y: number): number {
  return superFrontZ(x, headA(y), headZF(y), HEAD_N);
}

/** 얼굴 표면 방향 (파츠를 표면에 붙일 때의 회전) */
export function headSurfaceAngles(x: number, y: number): { yaw: number; pitch: number } {
  const e = 0.004;
  const dzdx = (headFrontZ(x + e, y) - headFrontZ(x - e, y)) / (2 * e);
  const dzdy = (headFrontZ(x, y + e) - headFrontZ(x, y - e)) / (2 * e);
  return { yaw: Math.atan2(-dzdx, 1), pitch: Math.atan(dzdy) };
}

/** 머리 (정수리 2.25 → 턱 1.335). pivotY 를 원점으로 옮긴 로컬 좌표 */
export function buildHead(pivotY: number): THREE.BufferGeometry {
  return deformSphere(2, (v) => {
    const y = HEAD_CHIN + ((v.y + 1) / 2) * (HEAD_TOP - HEAD_CHIN);
    const rh = Math.hypot(v.x, v.z);
    if (rh < 1e-6) return [0, y - pivotY, (headZF(y) + headZB(y)) / 2];
    const [x, , z] = headSurface(y, Math.atan2(v.z, v.x));
    return [x, y - pivotY, z];
  });
}

/** 코: 정면은 위가 좁은 사다리꼴, 측면은 아래로 튀어나온 쐐기 */
export function buildNose(pivotY: number): THREE.BufferGeometry {
  const n = FACE.nose;
  const zA = headFrontZ(0, n.yTop) - 0.012;
  const zC = headFrontZ(0, n.yBottom) - 0.012;
  const v = (x: number, y: number, z: number) => [x, y - pivotY, z];
  const AL = v(-n.wTop / 2, n.yTop, zA);
  const AR = v(n.wTop / 2, n.yTop, zA);
  const BL = v(-n.wBottom / 2, n.yTip, n.zTip);
  const BR = v(n.wBottom / 2, n.yTip, n.zTip);
  const CL = v(-n.wBottom * 0.45, n.yBottom, zC);
  const CR = v(n.wBottom * 0.45, n.yBottom, zC);
  const tris = [
    [AL, BL, BR], [AL, BR, AR], // 콧등
    [BL, CL, CR], [BL, CR, BR], // 콧바닥
    [AL, CL, BL], [AR, BR, CR], // 옆면
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(2), 3));
  g.computeVertexNormals();
  return g;
}

/**
 * 입술: 매끈한 쿠션 두 개를 맞붙인 형태.
 *  · 윗입술: 위 가장자리 가운데가 살짝 꺼진 M자(큐피드 활), 아랫면은 평평
 *  · 아랫입술: 더 도톰하고 윗면이 평평 → 두 면이 입선(mouthY)에서 맞닿아 얇은 주름만 보임
 *  · 양 끝(입꼬리)으로 갈수록 얇아짐:  두께 × (1 - 0.45|x|³)
 */
export function buildLip(kind: 'upper' | 'lower', pivotY: number): THREE.BufferGeometry {
  const L = kind === 'upper' ? FACE.upperLip : FACE.lowerLip;
  const depth = kind === 'upper' ? 0.068 : 0.074;
  const zc = L.zFront - depth * 1.16;
  return deformSphere(
    0,
    (v) => {
      const ax = Math.abs(v.x);
      const thin = 1 - 0.45 * ax ** 3;
      let y = v.y;
      if (kind === 'upper') {
        if (y < -L.flat) y = -L.flat; // 맞닿는 아랫면
        if (y > 0) y -= 0.36 * Math.exp(-((v.x / 0.18) ** 2)) * y;
      } else if (y > L.flat) y = L.flat; // 맞닿는 윗면
      const front = v.z > 0 ? 1 + 0.16 * (1 - v.x * v.x) : 1;
      const z = zc + v.z * depth * front * (1 - 0.25 * ax ** 2);
      return [v.x * L.hw, L.y + y * L.hh * thin - pivotY, z];
    },
    true,
  );
}

/** 귀: 머리 옆에서 뒤로 살짝 젖혀진 납작한 판 (안쪽 끝은 머리에 박힘) */
export function buildEar(): THREE.BufferGeometry {
  const e = FACE.ear;
  return deformSphere(1, (v) => {
    const lobe = v.y < -0.35 ? 1 - 0.3 * (-v.y - 0.35) : 1;
    return [v.x * e.w * 0.5 * lobe, v.y * e.h * 0.5, v.z * e.t * 0.5];
  });
}

// ── 몸통 ─────────────────────────────────────────────────────
export function torsoRingAt(y: number): { a: number; zf: number; zb: number } {
  const r = TORSO_RINGS;
  if (y <= r[0][0]) return { a: r[0][1], zf: r[0][2], zb: r[0][3] };
  for (let i = 0; i < r.length - 1; i++) {
    if (y <= r[i + 1][0]) {
      const t = (y - r[i][0]) / (r[i + 1][0] - r[i][0]);
      return {
        a: r[i][1] + (r[i + 1][1] - r[i][1]) * t,
        zf: r[i][2] + (r[i + 1][2] - r[i][2]) * t,
        zb: r[i][3] + (r[i + 1][3] - r[i][3]) * t,
      };
    }
  }
  const l = r[r.length - 1];
  return { a: l[1], zf: l[2], zb: l[3] };
}

/** 몸통 앞면 z (기본 체형 기준) */
export function torsoFrontZ(x: number, y: number): number {
  const r = torsoRingAt(y);
  return superFrontZ(x, r.a, r.zf, TORSO_N);
}

/** 신발: 바닥 평평, 앞코가 둥글고 약간 넓은 덩어리 */
export function buildShoe(): THREE.BufferGeometry {
  const hl = (SHOE.zFront - SHOE.zBack) / 2;
  const zc = (SHOE.zFront + SHOE.zBack) / 2;
  return deformSphere(1, (v) => {
    const y = v.y < -0.25 ? 0 : ((v.y + 0.25) / 1.25) * SHOE.h;
    const toe = 1 + 0.1 * v.z;
    return [v.x * SHOE.hw * toe, y, zc + v.z * hl];
  });
}

/** 받침대: 13각 원반 + 모서리 깎기 */
export function buildBase(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.0001, -BASE.depth),
    new THREE.Vector2(BASE.rBottom, -BASE.depth),
    new THREE.Vector2(BASE.rMid, -BASE.depth * 0.45),
    new THREE.Vector2(BASE.rTop + 0.035, -0.012),
    new THREE.Vector2(BASE.rTop, 0),
    new THREE.Vector2(0.0001, 0),
  ];
  return new THREE.LatheGeometry(pts, BASE.segments);
}

// ── 머리카락 캡 ──────────────────────────────────────────────
/**
 * 머리 프로파일을 grow 만큼 부풀린 캡. 헤어라인 높이는 방위별 함수:
 * front(정면) / side(옆) / back(뒤) 높이 사이를 sin(φ) 로 블렌딩.
 */
export function buildHairCap(
  pivotY: number,
  hairline: { front: number; side: number; back: number },
  grow: number,
  segs = 18,
  rows = 7,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const index: number[] = [];
  const lineY = (phi: number) => {
    const s = Math.sin(phi);
    return s >= 0 ? hairline.side + (hairline.front - hairline.side) * s : hairline.side + (hairline.back - hairline.side) * -s;
  };
  for (let r = 0; r <= rows; r++) {
    for (let k = 0; k < segs; k++) {
      const phi = Math.PI / 2 + (k / segs) * Math.PI * 2;
      const t = r / rows; // 0 = 정수리 부근, 1 = 헤어라인
      const y = HEAD_TOP - 0.004 - (HEAD_TOP - 0.004 - lineY(phi)) * Math.pow(t, 0.9);
      const [x, , z] = headSurface(y, phi, grow);
      pos.push(x, y + grow * (1 - t) * 0.8 - pivotY, z);
    }
  }
  const top = pos.length / 3;
  pos.push(0, HEAD_TOP + grow - pivotY, 0.02);
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < segs; k++) {
      const k1 = (k + 1) % segs;
      const a = r * segs + k;
      const b = r * segs + k1;
      const c = (r + 1) * segs + k1;
      const d = (r + 1) * segs + k;
      index.push(a, c, b, a, d, c);
    }
  }
  for (let k = 0; k < segs; k++) index.push(top, (k + 1) % segs, k);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
