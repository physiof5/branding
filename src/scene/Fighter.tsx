import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PlayerIndex } from '../game/types';
import { useBattleStore } from '../store/battleStore';
import { bodyLayout, LowPolyCharacter, type CharacterRig } from './character/LowPolyCharacter';
import { ChargeAura, DizzyStars, ShieldBubble, StackOrbs } from './effects/FighterFx';
import { computePose, restPose, type Pose, type PoseInput } from './fighterPose';
import { baseXFor, baseYawFor, dirFor } from './layout';

/** 배틀 스토어 상태 → 매 프레임 포즈 계산 → 캐릭터 리그에 적용 */
export function Fighter({ index }: { index: PlayerIndex }) {
  const appearance = useBattleStore((s) => s.fighters[index].appearance);
  const oppAppearance = useBattleStore((s) => s.fighters[index === 0 ? 1 : 0].appearance);
  const rig = useRef<CharacterRig>(null);
  const root = useRef<THREE.Group>(null);
  const yawG = useRef<THREE.Group>(null);
  const fallG = useRef<THREE.Group>(null);
  const squashG = useRef<THREE.Group>(null);
  const stars = useRef<THREE.Group>(null);
  const poseRef = useRef<Pose>(restPose());
  const lastFlash = useRef({ v: -1, c: '' });
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const baseX = baseXFor(index);
  const dir = dirFor(index);
  const baseYaw = baseYawFor(index);
  const oppBaseX = baseXFor(index === 0 ? 1 : 0);
  const layout = useMemo(() => bodyLayout(appearance), [appearance]);
  const oppDepth = useMemo(() => bodyLayout(oppAppearance).buttDepth, [oppAppearance]);

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
      myDepth: layout.buttDepth,
      oppDepth,
      faceCameraYaw: -baseYaw,
      entering: s.phase === 'swap' && s.swapSides[index],
    };
    const pose = computePose(input);
    poseRef.current = pose;

    root.current?.position.set(pose.x, pose.y, pose.z);
    if (yawG.current) yawG.current.rotation.y = baseYaw + pose.yaw;
    // 앞으로 엎어짐 (뒤에서 엉덩이에 밀리므로)
    fallG.current?.rotation.set(pose.fall * Math.PI * 0.49, 0, pose.tilt);
    const sq = Math.max(0.2, pose.squash);
    const inv = 1 / Math.sqrt(sq);
    squashG.current?.scale.set(inv, sq, inv);

    const r = rig.current;
    if (!r) return;
    // 골반 앞으로 내밀기: 골반·상체를 앞으로 옮기고 다리는 고관절에서 기울여 발은 제자리
    const shift = 0.22 * pose.pelvis;
    const legTilt = Math.asin(Math.min(0.9, shift / Math.max(0.2, layout.hipY)));
    r.hips.position.set(pose.hipSway, layout.pelvisY, shift);
    r.hips.rotation.set(-0.35 * pose.pelvis, 0, pose.hipSway * 1.3);
    r.torso.position.set(pose.hipSway * 0.35, layout.waistY, shift);
    r.torso.rotation.set(pose.lean, 0, -pose.hipSway * 0.6);
    r.legL.position.z = shift;
    r.legR.position.z = shift;
    r.legL.rotation.x = legTilt;
    r.legR.rotation.x = legTilt;
    r.butt.scale.setScalar(pose.buttPop);
    r.armL.rotation.set(-pose.armFwd, 0, pose.armL);
    r.armR.rotation.set(-pose.armFwd, 0, -pose.armR);
    // 어깨 너머로 상대 쪽(카메라 방향으로) 돌아보기
    r.head.rotation.set(-pose.lookUp, pose.headYaw * 1.2 * (index === 0 ? 1 : -1), pose.headTilt);
    const ey = Math.max(0.08, Math.min(1.4, pose.eyes));
    for (const e of r.eyes) e.scale.set(ey > 1 ? ey : 1, ey, 1);

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
      // 머리 중심(목 회전축 위 0.45) 위쪽 월드 공간에 별
      r.head.localToWorld(tmp.set(0, 0.45, 0));
      stars.current.position.set(tmp.x, tmp.y + 0.55, tmp.z);
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
