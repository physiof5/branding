import { TIMING } from '../game/constants';
import type { ActionType, FighterOutcome, PlayerIndex, TurnResult } from '../game/types';
import { actionTiming, isSpecialTurn, type BattlePhase, type FinishReason, type Winner } from '../store/battleStore';

// ─────────────────────────────────────────────────────────────
// 포즈 계산 (순수 함수)  — 두 캐릭터는 서로 '엉덩이를 마주하고' 바깥을 보고 선다.
//  · 공격: 상체를 숙이며 엉덩이를 뒤로 쭉 내밀어 상대 엉덩이를 들이받음 (돌지 않음)
//  · 피하기: 골반을 앞으로 쭉 빼고 상체를 뒤로 젖혀 엉덩이를 거둬들임
//  · 피격: 뒤에서 밀려 앞으로 휘청 → KO 면 앞으로 엎어짐
//  배틀 시계 + 판정 결과 → 이 프레임의 포즈. 타임라인(ms)은 TIMING 의 impact 시점 기준.
// ─────────────────────────────────────────────────────────────

export interface Pose {
  x: number;
  y: number;
  z: number;
  /** 기본 방향에 더하는 회전 */
  yaw: number;
  /** 상체 앞(+)/뒤(-) 기울기 — 앞으로 숙일수록 엉덩이가 뒤로 나온다 */
  lean: number;
  tilt: number;
  squash: number;
  hipSway: number;
  buttPop: number;
  /** 골반 앞으로 내밀기 0~1 (피하기) */
  pelvis: number;
  armL: number;
  armR: number;
  armFwd: number;
  /** 0~1 앞으로 엎어짐 (KO) */
  fall: number;
  flash: number;
  flashColor: string;
  aura: number;
  dizzy: boolean;
  headTilt: number;
  lookUp: number;
  /** 어깨 너머로 상대(뒤)를 돌아보기 0~1 */
  headYaw: number;
  /** 눈 크기 (1 보통, 0 감음, >1 놀람) */
  eyes: number;
}

export const restPose = (): Pose => ({
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  lean: 0,
  tilt: 0,
  squash: 1,
  hipSway: 0,
  buttPop: 1,
  pelvis: 0,
  armL: 0,
  armR: 0,
  armFwd: 0,
  fall: 0,
  flash: 0,
  flashColor: '#ff3b3b',
  aura: 0,
  dizzy: false,
  headTilt: 0,
  lookUp: 0,
  headYaw: 0,
  eyes: 1,
});

export interface PoseInput {
  index: PlayerIndex;
  phase: BattlePhase;
  /** 현재 페이즈 시작 후 경과 ms (배틀 시계) */
  t: number;
  clock: number;
  turn: number;
  result: TurnResult | null;
  choice: ActionType | null;
  locked: boolean;
  /** 선택 시간 진행도 0~1 */
  selectProgress: number;
  hp: number;
  winner: Winner | null;
  finishReason: FinishReason | null;
  baseX: number;
  /** 상대가 있는 x 방향 (캐릭터는 그 반대를 보고 선다) */
  dir: 1 | -1;
  oppBaseX: number;
  /** 내/상대 엉덩이 돌출 거리 */
  myDepth: number;
  oppDepth: number;
  /** 카메라 정면을 보기 위한 yaw (승리 포즈) */
  faceCameraYaw: number;
  /** 팀전 교체로 막 등장한 주자인가 */
  entering: boolean;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const eOutC = (k: number) => 1 - (1 - k) ** 3;
const eInC = (k: number) => k * k * k;
const eIO = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k);
const bump = (t: number, a: number, b: number) => Math.sin(Math.PI * seg(t, a, b));
const eOutBack = (k: number) => {
  const c1 = 1.9;
  return 1 + (c1 + 1) * (k - 1) ** 3 + c1 * (k - 1) ** 2;
};
const eOutBounce = (k: number) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (k < 1 / d1) return n1 * k * k;
  if (k < 2 / d1) return n1 * (k -= 1.5 / d1) * k + 0.75;
  if (k < 2.5 / d1) return n1 * (k -= 2.25 / d1) * k + 0.9375;
  return n1 * (k -= 2.625 / d1) * k + 0.984375;
};

/** 엎어졌을 때 몸이 바닥에 닿도록 올리는 높이 */
const FALL_LIFT = 0.45;

/** 엉덩이끼리 맞닿는 중심 간 거리 */
const contactGap = (i: PoseInput) => (i.myDepth + i.oppDepth) * 0.92 + 0.02;

/** KO 시 밀려난 거리 (액션/여운/KO 페이즈에서 일관되게 사용) */
export function knockbackFor(o: FighterOutcome, special: boolean): number {
  if (special) return 1.3;
  if (o.damageTaken >= 50) return 0.85;
  return 0.48;
}

/** 자연스러운 깜빡임 (약 3.7초마다) */
function blink(clock: number, index: number): number {
  const p = (clock + index * 1700) % 3700;
  return p < 110 ? 0.12 : 1;
}

export function computePose(i: PoseInput): Pose {
  const p = restPose();
  p.x = i.baseX;
  const breath = Math.sin(i.clock * 0.004 + i.index * 1.7);
  p.squash = 1 + 0.012 * breath;
  p.eyes = blink(i.clock, i.index);

  switch (i.phase) {
    case 'idle':
      break;
    case 'intro':
      intro(p, i, 0);
      break;
    case 'swap':
      if (i.entering) intro(p, i, -400);
      else taunt(p, i.t, 300);
      break;
    case 'select':
      select(p, i);
      break;
    case 'reveal':
      reveal(p, i);
      break;
    case 'action':
      action(p, i);
      break;
    case 'aftermath':
    case 'ko':
    case 'finished':
      ending(p, i);
      break;
  }
  return p;
}

/** 엉덩이 도발: 뒤돌아보며 씰룩 */
function taunt(p: Pose, t: number, start: number): void {
  const on = seg(t, start, start + 200) * (1 - seg(t, start + 700, start + 900));
  p.hipSway = 0.15 * Math.sin((t - start) * 0.032) * on;
  p.buttPop = 1 + 0.18 * on;
  p.lean = 0.3 * on;
  p.headYaw = on;
  p.armL = p.armR = 0.3 * on;
}

function intro(p: Pose, i: PoseInput, shift: number): void {
  const land = (i.index === 0 ? 420 : 760) + shift;
  const k = seg(i.t, land - 480, land);
  p.y = 5 * (1 - k * k);
  const since = i.t - land;
  if (since >= 0) p.squash = 1 - 0.3 * Math.exp(-since / 110) * Math.cos(since / 55);
  else p.squash = 1.08;
  taunt(p, i.t, 1250 + shift + i.index * 180);
}

function select(p: Pose, i: PoseInput): void {
  const pr = i.selectProgress;
  p.squash -= 0.05 * pr;
  p.lean = 0.14 * pr;
  p.hipSway = 0.03 * Math.sin(i.clock * 0.012 + i.index);
  if (i.locked) {
    p.armL = p.armR = 0.25;
    p.squash -= 0.03;
    return;
  }
  // 눈치: 주기적으로 어깨 너머 상대를 힐끔
  const cyc = (i.clock + i.index * 900) % 2300;
  p.headYaw = 0.85 * bump(cyc, 0, 700);
}

function reveal(p: Pose, i: PoseInput): void {
  const k = eOutC(seg(i.t, 0, 320));
  switch (i.choice) {
    case 'charge':
      p.armL = p.armR = 0.6 * k;
      p.squash = 1 - 0.06 * k;
      break;
    case 'dodge':
      p.pelvis = 0.25 * k;
      p.lean = -0.12 * k;
      break;
    case 'attack':
      p.lean = 0.35 * k;
      p.buttPop = 1 + 0.1 * k;
      p.squash = 1 - 0.08 * k;
      p.headYaw = k;
      break;
    case 'idle':
      p.tilt = 0.1 * Math.sin(i.clock * 0.004);
      p.headTilt = 0.25 * k;
      p.eyes = 0.35;
      break;
    default:
      break;
  }
}

function action(p: Pose, i: PoseInput): void {
  const r = i.result;
  if (!r) return;
  const me = r.outcomes[i.index];
  const opp = r.outcomes[i.index === 0 ? 1 : 0];
  const special = isSpecialTurn(r);
  const { impactMs: I } = actionTiming(r);

  if (me.action === 'attack') {
    if (me.tier === 'special') specialAttack(p, i, opp, I);
    else buttThrust(p, i, me, opp, I);
  } else if (me.action === 'charge') chargeAnim(p, i, me, I);
  else if (me.action === 'dodge') dodgeAnim(p, i, I, special);
  else {
    p.tilt = 0.08 * Math.sin(i.clock * 0.003);
    p.headTilt = 0.25;
    p.eyes = 0.35;
  }

  // 피격 리액션
  const victimOfSpecial = special && opp.tier === 'special' && me.damageTaken > 0;
  if (victimOfSpecial) specialVictim(p, i, me, I);
  else if (me.damageTaken > 0) hitReaction(p, i, me, I);
  if (me.shieldBlocked && i.t >= I) {
    const a = i.t - I;
    p.flash = Math.max(p.flash, 0.8 * Math.exp(-a / 160));
    p.flashColor = '#7fe3ff';
    p.x -= i.dir * 0.12 * bump(i.t, I, I + 400);
  }
  if (me.stackGained && i.t >= I) {
    const a = i.t - I;
    if (p.flash < 0.28 * Math.exp(-a / 140)) {
      p.flash = 0.28 * Math.exp(-a / 140);
      p.flashColor = '#ffd76a';
    }
  }
}

/** 엉덩이 들이받기: 숙이며 뒤로 돌진 */
function buttThrust(p: Pose, i: PoseInput, me: FighterOutcome, opp: FighterOutcome, I: number): void {
  const t = i.t;
  const bothAttack = opp.action === 'attack';
  const blocked = me.attackResult === 'blocked';
  const impactX = bothAttack
    ? -i.dir * (i.myDepth * 0.92 + 0.01)
    : blocked
      ? i.oppBaseX - i.dir * (i.myDepth * 0.92 + 1.15)
      : i.oppBaseX - i.dir * contactGap(i);
  const power = me.tier === 'power';
  const popPeak = power ? 0.7 : 0.32;

  // 준비: 뒤돌아 조준 + 웅크림
  p.headYaw = eOutC(seg(t, 0, 200));
  p.squash = 1 - 0.1 * bump(t, 40, 300);
  p.lean = 0.55 * eOutC(seg(t, 60, I));
  // 뒤로 돌진 (엉덩이부터)
  const dash = eInC(seg(t, 230, I));
  p.x = lerp(i.baseX, impactX, dash);
  p.y = 0.07 * bump(t, 230, I);
  p.buttPop = 1 + popPeak * eOutC(seg(t, 260, I));
  p.armL = p.armR = 0.55 * seg(t, 200, I);
  p.armFwd = 0.5 * seg(t, 200, I);

  if (t < I) return;
  const a = t - I;
  const res = me.attackResult;
  if (res === 'hit') {
    p.x = lerp(impactX, i.baseX, eOutC(seg(t, I + 120, I + 560)));
    p.buttPop = 1 + popPeak * (1 - seg(t, I, I + 320)) + 0.15 * Math.sin(a * 0.06) * Math.exp(-a / 160);
  } else if (res === 'dodged') {
    // 허공을 들이받고 휘청
    const over = eOutC(seg(t, I, I + 180));
    const ret = eIO(seg(t, I + 340, I + 820));
    p.x = lerp(lerp(impactX, impactX + i.dir * 0.45, over), i.baseX, ret);
    p.lean = 0.55 + 0.35 * bump(t, I, I + 520);
    p.tilt = 0.22 * bump(t, I, I + 620) * -i.dir;
    p.buttPop = 1 + popPeak * (1 - seg(t, I, I + 400));
  } else {
    // 상쇄/방어막/압도당함: 엉덩이끼리 튕겨 앞으로
    p.x = lerp(impactX, i.baseX, eOutBack(seg(t, I, I + 520)));
    p.squash = 1 - 0.24 * Math.exp(-a / 120) * Math.cos(a / 40);
    p.buttPop = 1 + popPeak * (1 - seg(t, I, I + 260)) + 0.22 * Math.sin(a * 0.07) * Math.exp(-a / 140);
  }
  const settle = 1 - seg(t, I + 200, I + 600);
  p.lean *= settle;
  p.armL = p.armR = 0.55 * settle;
  p.armFwd *= settle;
  p.headYaw *= 1 - seg(t, I + 250, I + 650);
}

function chargeAnim(p: Pose, i: PoseInput, me: FighterOutcome, I: number): void {
  const t = i.t;
  const up = eOutC(seg(t, 0, 260));
  const down = seg(t, I + 220, I + 600);
  // 맞으면 오라가 잠깐 흩어졌다가 (기는 쌓임) 다시 정리
  const cut = me.hitWhileCharging ? clamp(1 - (t - I) / 70) : 1;
  const env = up * (1 - down) * cut;
  p.squash = 1 - 0.11 * env;
  p.y = -0.03 * env;
  p.armL = p.armR = 1.05 * env;
  p.armFwd = 0.45 * env;
  p.x += Math.sin(i.clock * 0.09) * 0.022 * env;
  p.aura = env;
  p.lookUp = 0.18 * env;
  p.eyes = 1 - 0.35 * env;
}

/** 피하기: 골반을 앞으로 쭉 빼며 상체를 뒤로 젖힘 → 엉덩이가 쏙 들어감 */
function dodgeAnim(p: Pose, i: PoseInput, I: number, special: boolean): void {
  const a = seg(i.t, I - 400, I + 360);
  const env = Math.sin(Math.PI * a);
  const k = special ? 0.6 : 1;
  p.pelvis = env * k;
  p.lean = -0.5 * env * k;
  p.lookUp = 0.22 * env;
  p.x += -i.dir * 0.14 * env * k;
  p.armL = p.armR = 0.75 * env;
  p.armFwd = -0.35 * env;
  p.squash = 1 - 0.04 * env;
  p.eyes = 1 + 0.2 * env;
}

/** 뒤에서 엉덩이에 밀려 앞으로 휘청 (KO 면 앞으로 엎어짐) */
function hitReaction(p: Pose, i: PoseInput, me: FighterOutcome, I: number): void {
  if (i.t < I) return;
  const a = i.t - I;
  const kb = knockbackFor(me, false);
  const ko = me.hpAfter <= 0;
  p.flash = Math.max(p.flash, Math.exp(-a / 150));
  p.flashColor = '#ff4040';
  const out = eOutC(seg(i.t, I, I + 260));
  const back = ko ? 0 : eIO(seg(i.t, I + 430, I + 880));
  p.x += -i.dir * kb * out * (1 - back);
  p.y += (me.damageTaken >= 50 ? 0.32 : 0.12) * bump(i.t, I, I + 380);
  p.lean = 0.6 * bump(i.t, I, I + 520);
  p.squash *= 1 - 0.14 * Math.exp(-a / 100);
  p.armL = p.armR = 1.0 * bump(i.t, I, I + 520);
  p.armFwd = -0.6 * bump(i.t, I, I + 520);
  p.headYaw = 0;
  p.eyes = 0.18;
  p.aura = 0;
  if (ko) {
    p.fall = eOutBounce(seg(i.t, I + 120, I + 720));
    p.y += FALL_LIFT * p.fall;
    p.lean = lerp(p.lean, 0, p.fall);
    p.dizzy = i.t > I + 650;
  }
}

/** 필살기: 기 폭발 → 높이 뛰어 뒤로 날아가 상대 위로 엉덩방아 */
function specialAttack(p: Pose, i: PoseInput, opp: FighterOutcome, I: number): void {
  const t = i.t;
  const clash = opp.tier === 'special';
  const targetX = clash ? -i.dir * 0.42 : i.oppBaseX - i.dir * 0.1;
  p.aura = 1;
  p.y = 0.2 * eOutC(seg(t, 0, 500));
  p.armL = p.armR = 2.4 * eOutC(seg(t, 100, 600));
  p.buttPop = 1 + 0.9 * eOutC(seg(t, 200, 1150));
  p.x += Math.sin(i.clock * 0.11) * 0.03 * seg(t, 0, 1150);
  p.squash = 1 - 0.08 * bump(t, 900, 1180);
  p.headYaw = seg(t, 600, 1000);
  p.eyes = 1.15;
  if (t >= 1150) {
    const leap = seg(t, 1150, 1550);
    const slam = seg(t, 1700, I);
    p.x = lerp(i.baseX, targetX, eIO(seg(t, 1150, 1650)));
    const topY = 3.2;
    const landY = clash ? 1.7 : 0.12;
    p.y = t < 1700 ? Math.max(0.2, eOutC(leap) * topY) : lerp(topY, landY, eInC(slam));
    p.armL = p.armR = 2.4 - 1.3 * leap;
    p.lean = 0.55 * slam;
    p.buttPop = 1.9 + 0.3 * slam;
    p.squash = 1 + 0.12 * bump(t, 1150, 1500);
  }
  if (t >= I) {
    const a = t - I;
    const bounce = seg(t, I + 150, I + 650);
    const home = eIO(seg(t, I + 300, I + 1050));
    const bx = clash ? targetX - i.dir * 1.0 : targetX - i.dir * 0.45;
    p.x = lerp(lerp(targetX, bx, bounce), i.baseX, home);
    p.y = clash ? lerp(1.7, 0, eOutBounce(seg(t, I, I + 750))) : (0.12 + 1.1 * Math.sin(Math.PI * bounce)) * (1 - home);
    p.squash = 1 - 0.32 * Math.exp(-a / 110);
    p.buttPop = lerp(2.2, 1, seg(t, I + 100, I + 820));
    p.lean = 0.55 * (1 - seg(t, I, I + 400));
    p.armL = p.armR = 1.1 * (1 - seg(t, I + 200, I + 700));
    p.aura = 1 - seg(t, I, I + 500);
    p.headYaw *= 1 - seg(t, I + 300, I + 800);
  }
}

function specialVictim(p: Pose, i: PoseInput, me: FighterOutcome, I: number): void {
  const t = i.t;
  // 공포에 떨며 어깨 너머로 올려다봄
  const fear = seg(t, 300, 1200);
  p.x += Math.sin(i.clock * 0.13) * 0.025 * fear;
  p.headYaw = seg(t, 900, 1300);
  p.lookUp = 0.55 * seg(t, 1250, 1700);
  p.eyes = 1 + 0.35 * fear;
  p.z = 0;
  p.pelvis = 0;
  p.lean = 0;
  // 엉덩방아에 납작
  const pre = seg(t, I - 110, I);
  p.squash = lerp(p.squash, 0.26, eInC(pre));
  if (t < I) return;
  const a = t - I;
  const flat = 1 - seg(t, I + 380, I + 520);
  p.squash = lerp(1, 0.26, flat);
  const fly = seg(t, I + 450, I + 920);
  p.x = i.baseX - i.dir * knockbackFor(me, true) * eOutC(fly);
  p.y = 1.3 * Math.sin(Math.PI * fly);
  p.fall = eOutBounce(seg(t, I + 620, I + 1180));
  p.y += FALL_LIFT * p.fall;
  p.flash = Math.exp(-a / 220);
  p.flashColor = '#ffffff';
  p.dizzy = t > I + 1000;
  p.lookUp = 0;
  p.headYaw = 0;
  p.eyes = 0.15;
  p.armL = p.armR = 1.2 * bump(t, I + 400, I + 1100);
}

function ending(p: Pose, i: PoseInput): void {
  const r = i.result;
  const me = r?.outcomes[i.index];
  if (i.hp <= 0 && me) {
    p.fall = 1;
    p.y = FALL_LIFT;
    p.dizzy = true;
    p.eyes = 0.15;
    p.x = i.baseX - i.dir * knockbackFor(me, isSpecialTurn(r) && me.damageTaken >= 100);
    p.squash = 1;
    return;
  }
  if (i.phase === 'aftermath') return;
  if (i.phase === 'ko' && i.winner === null) {
    // 팀전 중간 KO: 살아남은 쪽은 숨 고르기
    p.armL = p.armR = 0.2;
    return;
  }

  const t = i.phase === 'ko' ? i.t : i.t + TIMING.koMs;
  if (i.winner === i.index) {
    const hop = Math.abs(Math.sin(i.clock * 0.0075));
    // 0~1.3초: 카메라 보며 만세 / 이후: 등 돌려 엉덩이 세레머니
    const face = eIO(seg(t, 0, 320));
    const turn = eIO(seg(t, 1300, 1650));
    p.yaw = lerp(lerp(0, i.faceCameraYaw, face), i.faceCameraYaw + Math.PI, turn);
    p.y = 0.32 * hop * (1 - 0.7 * turn);
    p.armL = p.armR = lerp(2.5, 0.5, turn);
    p.squash = 1 - 0.07 * (1 - hop);
    p.hipSway = 0.19 * Math.sin(i.clock * 0.024) * turn;
    p.buttPop = 1 + (0.12 + 0.1 * Math.sin(i.clock * 0.024)) * turn;
    p.lean = 0.25 * turn;
    p.eyes = 1.1;
  } else if (i.winner === 'draw') {
    p.armR = 2.2;
    p.headTilt = 0.2 * Math.sin(i.clock * 0.003);
  } else {
    // 판정패/기권: 시무룩
    p.lean = 0.35;
    p.headTilt = 0.15;
    p.squash = 0.95;
    p.eyes = 0.5;
  }
}
