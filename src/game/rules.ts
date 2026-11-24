import { ATTACK_COST, ATTACK_DAMAGE, MAX_STACKS, POWER_STACKS, SPECIAL_STACKS, TIER_RANK } from './constants';
import type {
  ActionType,
  AttackTier,
  CombatState,
  FighterOutcome,
  PlayerIndex,
  TurnKind,
  TurnResult,
} from './types';

/** 공격 버튼을 눌렀을 때 현재 기(스택)로 결정되는 공격 단계 */
export function attackTierFor(stacks: number): AttackTier {
  if (stacks >= SPECIAL_STACKS) return 'special';
  if (stacks >= POWER_STACKS) return 'power';
  return 'normal';
}

const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

function initOutcome(state: CombatState, action: ActionType): FighterOutcome {
  const tier = action === 'attack' ? attackTierFor(state.stacks) : null;
  return {
    action,
    tier,
    hpBefore: state.hp,
    hpAfter: state.hp,
    stacksBefore: state.stacks,
    // 공격 단계에 맞는 기를 즉시 소모 (일반 공격은 소모 없음)
    stacksAfter: tier ? state.stacks - ATTACK_COST[tier] : state.stacks,
    shieldBefore: state.shield,
    shieldAfter: state.shield,
    damageTaken: 0,
    stackGained: false,
    hitWhileCharging: false,
    dodgedAttack: false,
    shieldBlocked: false,
    shieldPierced: false,
    attackResult: null,
  };
}

/**
 * 한 턴 동시 판정.
 *
 * 가위바위보 삼각형:  공격 ▶ 기 모으기 ▶ 피하기 ▶ 공격
 *  - 기 모으기: +1 스택. 단, 무방비라 공격을 맞으면 데미지 (기는 그대로 쌓임)
 *  - 피하기: 일반/강력 공격 회피. 필살기는 회피 불가
 *  - 공격: 0~2스택 일반(10) / 3스택 소모 강력(50) / 10스택 소모 필살기(100, 회피·방어 불가)
 *  - 동시 공격: 같은 단계면 상쇄, 다르면 높은 단계가 압도(높은 쪽 데미지만 적용)
 *  - 방어막: 필살기를 제외한 공격 1회 무효화
 */
export function resolveTurn(
  states: readonly [CombatState, CombatState],
  actions: readonly [ActionType, ActionType],
): TurnResult {
  const out: [FighterOutcome, FighterOutcome] = [
    initOutcome(states[0], actions[0]),
    initOutcome(states[1], actions[1]),
  ];

  // 클로저 안에서 갱신되므로 객체로 보관 (TS 제어 흐름 좁히기 회피)
  const st: { kind: TurnKind; attacker: PlayerIndex | null } = { kind: 'quiet', attacker: null };

  /** attackerIdx 의 공격을 상대에게 전달 */
  const deliver = (a: PlayerIndex, tier: AttackTier): void => {
    const d = other(a);
    const def = out[d];
    const atk = out[a];

    if (tier !== 'special' && actions[d] === 'dodge') {
      def.dodgedAttack = true;
      atk.attackResult = 'dodged';
      st.kind = 'dodge';
      return;
    }
    if (states[d].shield) {
      if (tier !== 'special') {
        def.shieldBlocked = true;
        def.shieldAfter = false;
        atk.attackResult = 'blocked';
        st.kind = 'blocked';
        return;
      }
      // 필살기는 방어막까지 관통
      def.shieldPierced = true;
      def.shieldAfter = false;
    }

    def.damageTaken += ATTACK_DAMAGE[tier];
    // 기획서: 기 모으기는 무방비 → 맞으면 데미지는 받지만 기는 그대로 쌓인다
    if (actions[d] === 'charge') def.hitWhileCharging = true;
    atk.attackResult = 'hit';
    st.attacker = a;
    st.kind = tier === 'special' ? 'special' : tier === 'power' ? 'power' : 'hit';
  };

  const t0 = out[0].tier;
  const t1 = out[1].tier;

  if (t0 && t1) {
    if (TIER_RANK[t0] === TIER_RANK[t1]) {
      out[0].attackResult = 'clash';
      out[1].attackResult = 'clash';
      st.kind = 'clash';
    } else {
      const winner: PlayerIndex = TIER_RANK[t0] > TIER_RANK[t1] ? 0 : 1;
      const winTier = winner === 0 ? t0 : t1;
      out[other(winner)].attackResult = 'overpowered';
      deliver(winner, winTier);
      if (st.kind !== 'special' && st.kind !== 'blocked') st.kind = 'overpower';
    }
  } else if (t0) {
    deliver(0, t0);
  } else if (t1) {
    deliver(1, t1);
  }

  // 기 모으기 (맞더라도 +1, 최대 10)
  for (const i of [0, 1] as const) {
    const o = out[i];
    if (o.action === 'charge') {
      o.stacksAfter = Math.min(MAX_STACKS, o.stacksAfter + 1);
      o.stackGained = true;
    }
    o.hpAfter = Math.max(0, o.hpBefore - o.damageTaken);
  }

  const topTier: AttackTier | null =
    t0 && t1 ? (TIER_RANK[t0] >= TIER_RANK[t1] ? t0 : t1) : (t0 ?? t1);

  return {
    outcomes: out,
    kind: st.kind,
    attacker: st.attacker,
    topTier,
    ko: [out[0].hpAfter <= 0, out[1].hpAfter <= 0],
  };
}

/** 공격 버튼에 표시할 정보 */
export function attackPreview(stacks: number): { tier: AttackTier; damage: number; cost: number } {
  const tier = attackTierFor(stacks);
  return { tier, damage: ATTACK_DAMAGE[tier], cost: ATTACK_COST[tier] };
}
