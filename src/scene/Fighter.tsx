import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PlayerIndex } from '../game/types';
import { useBattleStore } from '../store/battleStore';
import { LowPolyCharacter, type CharacterRig } from './character/LowPolyCharacter';
import { ChargeAura, DizzyStars, ShieldBubble, StackOrbs } from './effects/FighterFx';
import { computePose, restPose, type Pose, type PoseInput } from './fighterPose';
import { baseXFor, baseYawFor, buttDepthFor, dirFor } from './layout';

/** 배틀 스토어 상태 → 매 프레임 포즈 계산 → 캐릭터 리그에 적용 */
export function Fighter({ index }: { index: PlayerIndex }) {
  const appearance = useBattleStore((s) => s.fighters[index].appearance);
  const rig = useRef<CharacterRig>(null);
  const root = useRef<THREE.Group>(null);
  const yawG = useRef<THREE.Group>(null);
  const fallG = useRef<THREE.Group>(null);
  const squashG = useRef<THREE.Group>(null);
  const stars = useRef<THREE.Group>(null);
  const poseRef = useRef<Pose>(restPose());
  const lastFlash = useRef({ v: -1, c: '' });
  const headWorld = useMemo(() => new THREE.Vector3(), []);

  const baseX = baseXFor(index);
  const dir = dirFor(index);
  const baseYaw = baseYawFor(index);
  const oppBaseX = baseXFor(index === 0 ? 1 : 0);
  const buttDepth = useMemo(() => buttDepthFor(appearance), [appearance]);

  useFrame(() => {
    const s = useBattleStore.getState();
    const f = s.fighters[index];
    const t = s.clock - s.phaseStart;
    const dur = s.turnDurations[index] || 3000;
    const input: PoseInput = {
      index,
      phase: s.phase,
      t,
      clock: s.clock,
      turn: s.turn,
      result: s.result,
      // 선택 단계에선 '무엇을 골랐는지'를 포즈에 반영하지 않는다 (심리전 정보 차단)
      choice: s.phase === 'select' ? null : s.choices[index],
      locked: s.phase === 'select' && s.choices[index] !== null,
      selectProgress: s.phase === 'select' ? Math.min(1, t / dur) : 0,
      hp: f.hp,
      winner: s.winner,
      finishReason: s.finishReason,
      baseX,
      dir,
      oppBaseX,
      buttDepth,
      faceCameraYaw: -baseYaw,
    };
    const pose = computePose(input);
    poseRef.current = pose;

    root.current?.position.set(pose.x, pose.y, pose.z);
    if (yawG.current) yawG.current.rotation.y = baseYaw + pose.yaw;
    fallG.current?.rotation.set(-pose.fall * Math.PI * 0.49, 0, pose.tilt);
    const sq = Math.max(0.2, pose.squash);
    const inv = 1 / Math.sqrt(sq);
    squashG.current?.scale.set(inv, sq, inv);

    const r = rig.current;
    if (r) {
      r.torso.rotation.x = pose.lean;
      r.torso.rotation.z = -pose.hipSway * 0.6;
      r.torso.position.x = pose.hipSway * 0.35;
      r.hips.position.x = pose.hipSway;
      r.hips.rotation.z = pose.hipSway * 1.3;
      r.butt.scale.setScalar(pose.buttPop);
      r.armL.rotation.set(-pose.armFwd, 0, 0.14 + pose.armL);
      r.armR.rotation.set(-pose.armFwd, 0, -(0.14 + pose.armR));
      r.head.rotation.set(-pose.lookUp, 0, pose.headTilt);
      const lf = lastFlash.current;
      if (Math.abs(pose.flash - lf.v) > 0.004 || pose.flashColor !== lf.c) {
        for (const m of r.materials) {
          m.emissive.set(pose.flashColor);
          m.emissiveIntensity = pose.flash * 0.85;
        }
        lf.v = pose.flash;
        lf.c = pose.flashColor;
      }
      if (stars.current) {
        r.head.getWorldPosition(headWorld);
        stars.current.position.set(headWorld.x, headWorld.y + 0.05, headWorld.z);
      }
    }
  });

  return (
    <>
      <group ref={root}>
        <group ref={yawG}>
          <group ref={fallG}>
            <group ref={squashG}>
              <LowPolyCharacter ref={rig} appearance={appearance} />
            </group>
          </group>
        </group>
        <ChargeAura index={index} poseRef={poseRef} effectId={appearance.effectId} />
        <StackOrbs index={index} poseRef={poseRef} effectId={appearance.effectId} />
        <ShieldBubble index={index} />
      </group>
      <group ref={stars}>
        <DizzyStars poseRef={poseRef} />
      </group>
    </>
  );
}
