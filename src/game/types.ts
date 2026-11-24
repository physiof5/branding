// ─────────────────────────────────────────────────────────────
// 게임 도메인 타입 (React/Three 에 의존하지 않는 순수 타입)
// ─────────────────────────────────────────────────────────────

export type PlayerIndex = 0 | 1;

/** 플레이어가 고를 수 있는 3가지 행동 */
export type ChosenAction = 'charge' | 'dodge' | 'attack';

/** 실제 판정에 들어가는 행동. 'idle' = 3초 안에 못 고름(멍때리기, 무방비) */
export type ActionType = ChosenAction | 'idle';

/** 공격 단계는 '공격' 시점의 기(스택)로 자동 결정된다 */
export type AttackTier = 'normal' | 'power' | 'special';

/** 판정에 필요한 최소 전투 상태 */
export interface CombatState {
  hp: number;
  stacks: number;
  /** 방어막 활성 여부 — 필살기를 제외한 공격 1회를 무효화 */
  shield: boolean;
}

/** 내 공격이 어떻게 처리됐는가 */
export type AttackResult =
  | 'hit' // 적중
  | 'dodged' // 상대가 피함
  | 'blocked' // 상대 방어막에 막힘
  | 'clash' // 같은 단계 공격끼리 상쇄
  | 'overpowered'; // 더 센 공격에 밀림

export interface FighterOutcome {
  action: ActionType;
  tier: AttackTier | null;
  hpBefore: number;
  hpAfter: number;
  stacksBefore: number;
  stacksAfter: number;
  shieldBefore: boolean;
  shieldAfter: boolean;
  /** 이번 턴에 받은 데미지 */
  damageTaken: number;
  /** 기 모으기 성공 (+1) */
  stackGained: boolean;
  /** 기 모으는 중(무방비) 맞음 — 데미지는 받지만 기는 쌓인다 */
  hitWhileCharging: boolean;
  /** 피하기로 상대 공격을 흘려냄 */
  dodgedAttack: boolean;
  /** 방어막이 상대 공격을 막음 */
  shieldBlocked: boolean;
  /** 필살기가 방어막을 깨뜨림 */
  shieldPierced: boolean;
  /** 내 공격의 결과 (공격하지 않았으면 null) */
  attackResult: AttackResult | null;
}

/** 연출/사운드/카메라가 참고하는 턴 요약 종류 */
export type TurnKind =
  | 'quiet' // 아무 일도 없음 (기 모으기/피하기 끼리)
  | 'hit' // 일반 공격 적중
  | 'power' // 강력 공격 적중
  | 'special' // 필살기 적중
  | 'clash' // 동시 공격 상쇄
  | 'overpower' // 더 센 공격이 압도
  | 'dodge' // 회피 성공
  | 'blocked'; // 방어막 발동

export interface TurnResult {
  outcomes: [FighterOutcome, FighterOutcome];
  kind: TurnKind;
  /** 데미지를 준 쪽 (없으면 null) */
  attacker: PlayerIndex | null;
  /** 이번 턴 판정에서 가장 높은 공격 단계 (연출 강도용) */
  topTier: AttackTier | null;
  ko: [boolean, boolean];
}

export type MatchOutcome = 'win' | 'lose' | 'draw';
