# 공부는 엉덩이 싸움 — 아키텍처 설계

> 3D 1:1 턴제 심리전 엉덩이 배틀. Vite + React 19 + TypeScript + React Three Fiber + Zustand + Tailwind v4.

## 1. 설계 원칙

| 원칙 | 구현 |
| --- | --- |
| **로직과 표현 분리** | 판정·AI·랭크는 `src/game/*` 순수 TS (React/Three 의존 0) → Vitest 로 바로 검증, 서버와 공유 가능 |
| **단일 시간축** | 배틀은 `clock`(배틀 시계) 하나로 진행. 일시정지/슬로모션/히트스톱 = 시계 속도 조절. 로직·3D 애니메이션·HUD 가 같은 시간을 본다 |
| **이벤트 기반 연출** | 스토어가 `battleEvents` 로 `phase / countdown / lock / item / impact / finish` 를 발행 → 사운드·카메라·이펙트가 구독. 연출을 추가해도 로직은 안 건드린다 |
| **데이터 주도 콘텐츠** | 코스튬·맵·아이템·패스 보상은 `src/data/*` 데이터만 추가하면 상점/패스/커스터마이저/3D 에 자동 반영 |
| **공정한 밸런스** | 외형(`Appearance`)은 전투 계산에 절대 들어가지 않는다. 모든 유저 HP 100·동일 판정 |

## 2. 폴더 구조

```
.
├── index.html
├── vite.config.ts            # build / build:single(단일 HTML) 모드
├── vitest.config.ts
├── docs/ARCHITECTURE.md
└── src/
    ├── main.tsx              # 엔트리 (첫 입력에서 오디오 unlock)
    ├── App.tsx               # 화면 라우터 (lobby/customize/shop/pass/battle) + 모달/토스트
    ├── index.css             # Tailwind v4 + 게임 키프레임
    │
    ├── game/                 # ★ 순수 게임 로직 (테스트 대상)
    │   ├── types.ts          # ActionType, AttackTier, CombatState, TurnResult …
    │   ├── constants.ts      # HP 100, 데미지 10/50/100, 기 3/10, TIMING(3초 등)
    │   ├── rules.ts          # resolveTurn() — 동시 판정, attackTierFor()
    │   ├── ai.ts             # 심리전 AI (상황 정책 + 패턴 학습 + 기대값 softmax)
    │   ├── rank.ts           # 티어/트로피/시즌 리셋, 티어→맵/AI 레벨
    │   ├── rewards.ts        # 골드·XP·트로피 보상 계산
    │   ├── describe.ts       # 판정 → 한국어 헤드라인/로그
    │   ├── events.ts         # 타입 안전 이벤트 버스
    │   ├── rng.ts            # 시드 RNG (테스트 재현)
    │   └── *.test.ts
    │
    ├── data/                 # 콘텐츠 카탈로그
    │   ├── appearance.ts     # 피부/헤어/체형/엉덩이 볼륨 옵션, 기본 외형
    │   ├── costumes.ts       # 지역·학교 테마 코스튬 (theme.kind: school|region|pass)
    │   ├── effects.ts        # 오라 이펙트
    │   ├── items.ts          # 방어막 / 먹물 폭탄 / 기폭제
    │   ├── maps.ts           # 6개 티어 맵 메타
    │   └── seasonPass.ts     # 로열 패스 20레벨 무료/프리미엄 보상
    │
    ├── store/                # Zustand
    │   ├── battleStore.ts    # ★ 배틀 상태 머신 + battleEvents
    │   ├── profileStore.ts   # 영구 저장: 외형·골드·트로피·인벤토리·패스
    │   ├── settingsStore.ts  # 영구 저장: 볼륨·카메라 흔들림
    │   ├── uiStore.ts        # 현재 화면·모달·토스트
    │   ├── matchmaking.ts    # 랭크전/로컬전 config 조립 → 배틀 시작
    │   └── safeStorage.ts    # localStorage 실패 시 메모리 폴백
    │
    ├── net/                  # 온라인 매칭 구조 (서버 권위 모델)
    │   ├── protocol.ts       # Client/Server 메시지 타입
    │   └── OnlineMatchClient.ts
    │
    ├── audio/
    │   ├── SoundEngine.ts    # Web Audio 합성 SFX + BGM 시퀀서, 파일 override
    │   └── useBattleAudio.ts # battleEvents → 효과음/템포
    │
    ├── scene/                # React Three Fiber
    │   ├── BattleCanvas.tsx  # 3D 배틀 씬 루트
    │   ├── Fighter.tsx       # 스토어 → 포즈 → 리그 적용
    │   ├── fighterPose.ts    # ★ 순수 포즈 함수 (공격/회피/기/필살/KO 타임라인)
    │   ├── CameraDirector.tsx# ★ 샷 연출 + 트라우마 쉐이크 + FOV 펀치 + 세로화면 보정
    │   ├── character/        # 로폴리 캐릭터 (레퍼런스 디자인 재현), 헤어, 재질
    │   ├── effects/          # 기 오라, 스택 구슬, 방어막, 임팩트 파티클
    │   ├── arenas/           # 티어별 맵 6종 + 프롭 키트
    │   ├── preview/          # 로비/꾸미기 미리보기 (받침대 피규어)
    │   ├── screenSpace.ts    # 3D→화면 좌표 (HUD 라벨이 캐릭터를 따라다님)
    │   └── geometries.ts / textures.ts / layout.ts
    │
    ├── hooks/
    │   ├── useBattleLoop.ts     # rAF → battleStore.tick(dt)
    │   └── useBattleControls.ts # 키보드 (e.code 기반, 한글 IME 대응)
    │
    └── ui/
        ├── screens/          # Lobby / Customize / Shop / Pass / Battle
        ├── hud/              # BattleHud(체력·기·타이머·버튼), WorldLabels, Overlays(결과/일시정지)
        └── components/       # Button, FaceIcon, Modal, Help/Settings/LocalSetup
```

## 3. Zustand 상태 설계

### 3-1. 스토어 맵

```
┌──────────────── 영구 저장 (persist, localStorage) ───────────────┐
│ useProfileStore   외형 · 골드 · 트로피 · 인벤토리 · 코스튬 · 패스 │
│ useSettingsStore  볼륨 · 음소거 · 카메라 흔들림                   │
└──────────────────────────────────────────────────────────────────┘
┌──────────────── 휘발 (세션) ─────────────────────────────────────┐
│ useBattleStore    배틀 상태 머신 (매 프레임 tick)                 │
│ useUIStore        화면 라우팅 · 모달 · 토스트                      │
└──────────────────────────────────────────────────────────────────┘
        ▲ matchmaking.ts 가 Profile → BattleConfig 를 조립해 배틀 시작
        ▼ 'finish' 이벤트 → BattleScreen 이 profile.applyMatch() 1회 호출
```

배틀 스토어는 프로필 스토어를 **직접 참조하지 않는다** (단방향). 배틀 시작 시 필요한 값(외형·아이템 수·기폭제)을 `BattleConfig` 로 받고, 끝나면 이벤트로 결과만 내보낸다 → 온라인 모드에서도 같은 스토어를 그대로 쓸 수 있다.

### 3-2. `useBattleStore` (핵심)

```ts
interface BattleState {
  config: BattleConfig | null;          // mode(ai|local), mapId, aiLevel, fighters[2] 셋업
  phase: 'idle'|'intro'|'select'|'reveal'|'action'|'aftermath'|'ko'|'finished';
  clock: number;                        // 배틀 시계 ms (일시정지/슬로모 반영)
  slowmo: { until: number; scale: number }; // 히트스톱 · 회피 슬로모 · KO 슬로모
  phaseStart: number;
  turn: number;                         // 최대 30턴 → 체력 판정
  fighters: [FighterRuntime, FighterRuntime]; // hp, stacks, shield, items, history, jammed …
  choices: [ActionType|null, ActionType|null]; // 선택 단계엔 서로에게 비공개
  deadlines: [number, number];          // 플레이어별 마감 (먹물 맞으면 1.5초)
  result: TurnResult | null;            // resolveTurn() 결과 (reveal → action 진입 시 계산)
  impactDone: boolean;                  // 임팩트 시점에 HP/기 반영
  log: TurnLogEntry[];
  winner: 0|1|'draw'|null; finishReason: 'ko'|'timeover'|'forfeit'|null;
  paused: boolean;

  start(config); choose(p, action, source?); useItem(p, item);
  tick(realDtMs); setPaused(b); forfeit(p); exit();
}
```

**상태 머신**

```
idle ─start()→ intro(2.6s) → select(3s) ─둘 다 확정/마감→ reveal(0.75s)
         ┌──────────────────────────────────────────────────────┘
         ▼
      action(1.55s / 필살 3.3s)  ─ impact 시점: HP·기 반영 + 'impact' 이벤트 + 히트스톱
         ▼
      aftermath(0.65s) ─ KO? → ko(2.8s) → finished
                       ─ 30턴? → ko(판정) → finished
                       ─ else → select (turn+1)   ※ 15턴부터 select 진입 시 양쪽 기 +1 ('overtime' 이벤트)
```

- **3초 카운트다운**: `select` 진입 시 `deadlines[p] = clock + 3000`. 마감까지 못 고르면 `'idle'`(멍때리기, 무방비).
- **AI 선택**: `select` 진입 순간 상대 기록만 보고 결정 → 0.4~1.4초 뒤 '선택 완료' 표시 (사람 선택을 절대 엿보지 않음).
- **비공개 선택**: `select` 동안 3D 포즈/말풍선은 "선택 완료"만 보여주고 무엇을 골랐는지는 `reveal` 에서 공개.

### 3-3. `useProfileStore` (persist: `sbb-profile`)

```ts
{
  nickname, appearance: { skin, hairStyle, hairColor, bodyType, height, buttVolume, costumeId, effectId },
  gold, trophies, bestTrophies, seasonId,
  stats: { wins, losses, draws, winStreak, bestStreak, specialFinishes },
  inventory: { shield, jam, catalyst }, useCatalyst,
  ownedCostumes, ownedEffects,
  pass: { xp, premium, claimed: { free: number[], premium: number[] } },
  // actions
  updateAppearance, buyItem, buyCostume, consumeItem, applyMatch, claimPassReward, unlockPremium, resetProfile
}
```
`partialize` 로 데이터만 저장, `merge` 로 새 필드가 생겨도 안전하게 깊은 병합.

### 3-4. 이벤트 버스 (`battleEvents`)

| 이벤트 | 구독자 |
| --- | --- |
| `phase` | 사운드(READY/FIGHT/공개음), 카메라(필살 진동), HUD 아나운서 |
| `countdown` | 틱 사운드, 마지막 1초 카메라 펄스, BGM 템포 업 |
| `overtime` | 야자 타임 아나운스, 카메라 펄스, BGM 위기 템포 |
| `lock` | 선택 완료 효과음 |
| `item` | 방어막/먹물 효과음, 인벤토리 차감, 아나운서 |
| `impact` | 타격음, 카메라 쉐이크 + FOV 펀치, 파티클/의성어, 화면 섬광 |
| `finish` | 승패 팡파르, 보상 정산(`applyMatch`) |

## 4. 판정 규칙 (`game/rules.ts`)

| 내 행동 \ 상대 | 기 모으기 | 피하기 | 공격 |
| --- | --- | --- | --- |
| **기 모으기** | 둘 다 +1 | 나만 +1 | 무방비라 내가 맞음 (기는 +1) |
| **피하기** | 상대만 +1 | 무 | 일반/강력 회피 (필살기는 불가) |
| **공격** | 상대 맞음 (상대 기 +1) | 빗나감 | 같은 단계 상쇄 / 높은 단계 압도 |

- 공격 단계: 기 0~2 일반 10 · 기 3+ 강력 50 (3 소모) · 기 10 필살기 100 (10 소모, 회피·방어 불가)
- 방어막: 필살기 제외 공격 1회 무효
- 🌙 야자 타임 (`OVERTIME_TURN = 15`): 턴 시작 시 두 사람 모두 기 +1 → 후반 필살기 심리전으로 결판
- 30턴 경과 시 체력 판정

## 5. 확장 포인트

- **온라인 PvP**: `net/protocol.ts` 의 서버 권위 모델. 서버가 두 선택을 모아 `reveal` 로 동시에 공개하고 `resolveTurn` 을 공유. 클라이언트는 상대 슬롯을 `controller: 'remote'` 로 두고 `choose(p, action, 'remote')` 로 주입.
- **사운드 에셋**: `sound.register('hit', '/sfx/hit.mp3')` — 등록된 효과음만 파일로 재생, 나머지는 합성음 폴백.
- **결제**: `unlockPremium()` 은 데모용. 실제 결제(PG/인앱결제) 성공 콜백에서 호출하도록 교체.
- **새 맵/코스튬**: `data/maps.ts` + `scene/arenas/*`, `data/costumes.ts` 에 항목 추가.
