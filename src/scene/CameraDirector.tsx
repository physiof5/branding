import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PlayerIndex } from '../game/types';
import { actionTiming, battleEvents, isSpecialTurn, useBattleStore, type BattleState } from '../store/battleStore';
import { useSettingsStore } from '../store/settingsStore';
import { knockbackFor } from './fighterPose';
import { baseXFor, dirFor } from './layout';

// ─────────────────────────────────────────────────────────────
// 카메라 연출 감독
//  - 페이즈/판정 결과별 '샷'을 고르고, cut 샷은 즉시 전환 / 나머지는 감쇠 보간
//  - 타격 순간: trauma 기반 카메라 쉐이크 + FOV 펀치 (설정에서 강도 조절)
//  - 화면 비율(세로 모바일)에 맞게 거리를 자동 보정
// ─────────────────────────────────────────────────────────────

type V3 = [number, number, number];

interface Shot {
  id: string;
  pos: V3;
  look: V3;
  /** 16:9 기준 세로 FOV */
  fov: number;
  roll?: number;
  cut?: boolean;
  /** 보간 속도 (클수록 빠르게 따라감) */
  speed?: number;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const eIO = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(k));

const WIDE: Shot = { id: 'wide', pos: [0, 2.0, 6.8], look: [0, 1.05, 0], fov: 36, speed: 2.6 };

function attackerOf(s: BattleState): PlayerIndex | null {
  const r = s.result;
  if (!r) return null;
  const a0 = r.outcomes[0].action === 'attack';
  const a1 = r.outcomes[1].action === 'attack';
  if (a0 && !a1) return 0;
  if (a1 && !a0) return 1;
  return null;
}

export function planShot(s: BattleState): Shot {
  const t = s.clock - s.phaseStart;
  switch (s.phase) {
    case 'idle':
      return WIDE;
    case 'intro': {
      const k = eIO(t / 1700);
      const th = lerp(-1.15, 0, k);
      const r = lerp(9.5, 6.8, k);
      return { id: 'intro', pos: [Math.sin(th) * r, lerp(4.4, 2.0, k), Math.cos(th) * r], look: [0, lerp(2.2, 1.05, k), 0], fov: 36, speed: 8 };
    }
    case 'select': {
      const p = clamp(t / Math.max(...s.turnDurations));
      const late = clamp((p - 0.66) / 0.34);
      return {
        id: 'select',
        pos: [0.35 * Math.sin(s.clock * 0.0005), 2.0 - 0.28 * p, 6.8 - 1.6 * p],
        look: [0, 1.1, 0],
        fov: 36 - 3 * p,
        roll: 0.03 * late * late,
        speed: 2.2,
      };
    }
    case 'reveal': {
      const k = clamp(t / 750);
      return { id: 'reveal', pos: [0, 0.62, 4.7 - 0.35 * k], look: [0, 1.35, 0], fov: 44, cut: true, speed: 6 };
    }
    case 'action':
      return actionShot(s, t);
    case 'aftermath':
      return { ...WIDE, speed: 2.4 };
    case 'ko':
    case 'finished': {
      const w = s.winner;
      const tt = s.phase === 'ko' ? t : t + 3000;
      if (w === null || w === 'draw') return { ...WIDE, id: 'end-wide' };
      const l: PlayerIndex = w === 0 ? 1 : 0;
      const wx = baseXFor(w);
      if (s.finishReason === 'ko' && tt < 1300 && s.result) {
        const lx = baseXFor(l) - dirFor(l) * knockbackFor(s.result.outcomes[l], isSpecialTurn(s.result));
        const th = lerp(0.5, 1.1, tt / 1300) * -dirFor(l);
        return { id: 'ko-orbit', pos: [lx + Math.sin(th) * 3.0, 1.35, Math.cos(th) * 3.0], look: [lx, 0.35, 0], fov: 38, cut: true, speed: 5 };
      }
      const th = s.clock * 0.00018;
      return {
        id: 'winner',
        pos: [wx + Math.sin(th) * 0.6, 1.5, 3.7 + Math.cos(th) * 0.2],
        look: [wx, 1.15, 0],
        fov: 36,
        cut: s.finishReason === 'ko',
        speed: 2,
      };
    }
  }
}

function actionShot(s: BattleState, t: number): Shot {
  const r = s.result!;
  const { impactMs: I } = actionTiming(r);
  const [o0, o1] = r.outcomes;

  if (isSpecialTurn(r)) {
    const a: PlayerIndex = o0.tier === 'special' ? 0 : 1;
    const v: PlayerIndex = a === 0 ? 1 : 0;
    const ax = baseXFor(a);
    const vx = baseXFor(v);
    const da = dirFor(a);
    if (t < 1150) {
      const th = lerp(-0.9, 0.9, eIO(t / 1150)) * -da;
      return { id: 'sp-orbit', pos: [ax + Math.sin(th) * 3.2, 1.3 + 0.5 * (t / 1150), Math.cos(th) * 3.2], look: [ax, 1.35, 0], fov: 38, cut: true, speed: 9 };
    }
    if (t < I) {
      const k = clamp((t - 1150) / (I - 1150));
      return { id: 'sp-leap', pos: [(ax + vx) / 2 - da * 0.2, 0.35, 4.4], look: [lerp(ax, vx, k), lerp(1.6, 2.4, Math.sin(Math.PI * k)), 0], fov: 50, cut: true, speed: 7 };
    }
    if (t < I + 950) return { id: 'sp-impact', pos: [vx - da * 0.6, 1.5, 4.1], look: [vx, 0.55, 0], fov: 42, cut: true, speed: 4 };
    return WIDE;
  }

  const a = attackerOf(s);
  if (a !== null) {
    const v: PlayerIndex = a === 0 ? 1 : 0;
    const ax = baseXFor(a);
    const vx = baseXFor(v);
    const da = dirFor(a);
    const dodged = r.outcomes[a].attackResult === 'dodged';
    const before = dodged ? I - 200 : I;
    if (t < before) {
      // 공격자 쪽 뒤에서: 엉덩이부터 돌진하는 결연한 얼굴 + 뒤편 상대
      return { id: 'atk-track', pos: [ax - da * 2.2, 1.5, 4.3], look: [(ax + vx) / 2 + da * 0.3, 1.05, 0], fov: 38, speed: 5 };
    }
    if (dodged && t < I + 520) {
      return { id: 'dodge-cam', pos: [vx + da * 0.15, 0.95, 3.3], look: [vx, 1.1, 0], fov: 40, cut: true, speed: 5 };
    }
    if (!dodged && t < I + 650) {
      const cx = vx - da * 0.34;
      const power = r.kind === 'power';
      return { id: 'impact-close', pos: [vx - da * 0.15, 1.25, power ? 2.9 : 3.2], look: [cx, 1.0, 0], fov: power ? 34 : 37, cut: true, speed: 5 };
    }
    return WIDE;
  }

  const bothAttack = o0.action === 'attack' && o1.action === 'attack';
  if (bothAttack) {
    if (t < I) return { id: 'clash-low', pos: [0, 0.95, 5.2], look: [0, 1.0, 0], fov: 40, cut: true, speed: 6 };
    if (t < I + 600) return { id: 'clash-top', pos: [0, 3.4, 3.5], look: [0, 0.8, 0], fov: 40, cut: true, speed: 5 };
    return WIDE;
  }

  // 공격 없는 턴: 천천히 돌리는 돌리 샷 (둘 다 기 모으면 로우 앵글)
  const k = clamp(t / 1550);
  const bothCharge = o0.action === 'charge' && o1.action === 'charge';
  return {
    id: 'quiet',
    pos: [lerp(-1.6, 1.6, k), bothCharge ? 0.9 : 1.75, bothCharge ? 5.0 : 5.8],
    look: [0, bothCharge ? 1.3 : 1.15, 0],
    fov: 38,
    speed: 3,
  };
}

/** 화면이 16:9 보다 좁으면 가로 시야를 유지하도록 FOV/거리를 보정 */
function fitAspect(shot: Shot, aspect: number, outPos: THREE.Vector3, outLook: THREE.Vector3): number {
  const ref = 16 / 9;
  outLook.set(...shot.look);
  outPos.set(...shot.pos);
  if (aspect >= ref) return shot.fov;
  const half = THREE.MathUtils.degToRad(shot.fov / 2);
  const hHalf = Math.atan(Math.tan(half) * ref);
  const wantV = 2 * Math.atan(Math.tan(hHalf) / aspect);
  const capV = THREE.MathUtils.degToRad(64);
  const v = Math.min(wantV, capV);
  if (wantV > capV) {
    // FOV 한계를 넘으면 뒤로 물러난다 (약간의 크롭은 허용)
    const k = Math.pow(Math.tan(hHalf) / (aspect * Math.tan(capV / 2)), 0.72);
    outPos.sub(outLook).multiplyScalar(k).add(outLook);
  }
  return THREE.MathUtils.radToDeg(v);
}

const noise = (t: number, seed: number) =>
  Math.sin(t * 13.1 + seed * 1.7) * 0.5 + Math.sin(t * 27.7 + seed * 4.3) * 0.3 + Math.sin(t * 51.3 + seed * 9.1) * 0.2;

export function CameraDirector() {
  const camera = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  const size = useThree((st) => st.size);
  const cur = useRef({ pos: new THREE.Vector3(0, 4, 10), look: new THREE.Vector3(0, 1.5, 0), fov: 40, roll: 0, shot: '' });
  const trauma = useRef(0);
  const punch = useRef(0);
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() }), []);

  useEffect(
    () =>
      battleEvents.on((e) => {
        const add = (v: number) => (trauma.current = Math.min(1, trauma.current + v));
        if (e.type === 'impact') {
          const k = e.result.kind;
          const amt =
            k === 'special' ? 1 : k === 'power' || k === 'overpower' ? 0.78 : k === 'clash' ? 0.62 : k === 'hit' ? 0.5 : k === 'blocked' ? 0.42 : k === 'dodge' ? 0.12 : 0.05;
          add(amt);
          punch.current = amt;
          if (e.result.ko[0] || e.result.ko[1]) trauma.current = 1;
        }
        if (e.type === 'countdown' && e.seconds === 1) add(0.14);
        if (e.type === 'phase' && e.phase === 'select' && e.turn === 1) add(0.35);
        if (e.type === 'phase' && e.phase === 'action') {
          const r = useBattleStore.getState().result;
          if (isSpecialTurn(r)) add(0.25);
        }
        if (e.type === 'item') add(0.18);
        if (e.type === 'overtime' && e.first) add(0.4);
      }),
    [],
  );

  useFrame((state, dt) => {
    const s = useBattleStore.getState();
    const shot = planShot(s);
    const fov = fitAspect(shot, size.width / Math.max(1, size.height), tmp.pos, tmp.look);
    const c = cur.current;
    if (shot.cut && shot.id !== c.shot) {
      c.pos.copy(tmp.pos);
      c.look.copy(tmp.look);
      c.fov = fov;
    } else {
      const k = 1 - Math.exp(-Math.min(dt, 0.05) * (shot.speed ?? 3));
      c.pos.lerp(tmp.pos, k);
      c.look.lerp(tmp.look, k);
      c.fov += (fov - c.fov) * k;
    }
    c.roll += ((shot.roll ?? 0) - c.roll) * 0.1;
    c.shot = shot.id;

    // 특수: 필살기 기 모을 때 지속 진동
    if (s.phase === 'action' && isSpecialTurn(s.result) && s.clock - s.phaseStart < 1150) {
      trauma.current = Math.max(trauma.current, 0.32);
    }
    trauma.current = Math.max(0, trauma.current - dt * 1.45);
    punch.current = Math.max(0, punch.current - dt * 3.5);
    const shake = trauma.current ** 2 * useSettingsStore.getState().cameraShake;
    const tt = state.clock.elapsedTime;

    camera.position.copy(c.pos);
    camera.lookAt(c.look);
    camera.translateX(noise(tt, 1) * 0.3 * shake);
    camera.translateY(noise(tt, 2) * 0.24 * shake);
    camera.rotateZ(c.roll + noise(tt, 3) * 0.07 * shake);
    const targetFov = c.fov - punch.current * 7 * useSettingsStore.getState().cameraShake;
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
