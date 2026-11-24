# 공부는 엉덩이 싸움 — 아키텍처 설계

> 3D 1:1 턴제 심리전 엉덩이 배틀 (등을 맞댄 스탠스, 릴레이 팀전 지원). Vite + React 19 + TypeScript + React Three Fiber + Zustand + Tailwind v4.

## 1. 설계 원칙

| 원칙 | 구현 |
| --- | --- |
| **로직과 표현 분리** | 판정·AI·랭크는 `src/game/*` 순수 TS (React/Three 의존 0) → Vitest 로 바로 검증, 서버와 공유 가능 |
| **단일 시간축** | 배틀은 `clock`(배틀 시계) 하나로 진행. 일시정지/슬로모션/히트스톱 = 시계 속도 조절. 로직·3D 애니메이션·HUD 가 같은 시간을 본다 |
| **이벤트 기반 연출** | 스토어가 `battleEvents` 로 `phase / countdown / overtime / lock / item / impact / swap / finish` 를 발행 → 사운드·카메라·이펙트가 구독. 연출을 추가해도 로직은 안 건드린다 |
| **측정 기반 캐릭터** | 레퍼런스 시트를 측정한 프로파일 표 + 보간 함수로 부위별 지오메트리를 만든다 (`scene/character/profiles.ts`) |
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
    ├── App.tsx               # 화면 라우터 (lobby/customize/shop/pass/road/battle) + 하단 탭 + 시트/모달/토스트
    ├── dev/Turnaround.tsx    # (개발용 ?turnaround) 캐릭터 4방향 턴어라운드
    ├── index.css             # Tailwind v4 + 게임 키프레임
    │
    ├── game/                 # ★ 순수 게임 로직 (테스트 대상)
    │   ├── types.ts          # ActionType, AttackTier, CombatState, TurnResult …
    │   ├── constants.ts      # HP 100, 데미지 10/50/100, 기 3/10, TIMING(3초 등)
    │   ├── rules.ts          # resolveTurn() — 동시 판정, attackTierFor()
    │   ├── ai.ts             # 심리전 AI (상황 정책 + 패턴 학습 + 기대값 softmax)
    │   ├── rank.ts           # 티어/트로피/시즌 리셋, 티어→맵/AI 레벨, I/II 단계 표시
    │   ├── rewards.ts        # 모드별 보상 (랭크·자유랭크·도전 아이템·친선전), 도전 일일 10판
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
    │   ├── modes.ts          # 게임 모드 카탈로그 (클래식 랭크전/자유 랭크전/클래식 도전/클래식 1v1)
    │   ├── trophyRoad.ts     # 트로피 로드 보상 (50트로피 간격)
    │   └── seasonPass.ts     # 로열 패스 20레벨 무료/프리미엄 보상
    │
    ├── store/                # Zustand
    │   ├── battleStore.ts    # ★ 배틀 상태 머신 (릴레이 교대 포함) + battleEvents
    │   ├── profileStore.ts   # 영구 저장: 외형·골드·트로피(솔로/듀오·자유)·인벤토리·도전 기록·패스
    │   ├── settingsStore.ts  # 영구 저장: 볼륨·카메라 흔들림·마지막 모드 선택
    │   ├── uiStore.ts        # 현재 화면·모드 시트·전투 준비 시트·모달·토스트
    │   ├── matchmaking.ts    # 모드/큐/파티/기폭제 → BattleConfig(teams) 조립 → 배틀 시작
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
    │   ├── character/
    │   │   ├── profiles.ts   # ★ 레퍼런스 측정값: 두상/얼굴 부위/몸통·골반·다리 링 표, 색
    │   │   ├── geometry.ts   # ★ 슈퍼엘립스 로프트·두상 변형·코/입술/귀/신발 생성 함수
    │   │   ├── LowPolyCharacter.tsx # 부위 조립 + 리그 (hips/torso/head/arms/legs/butt)
    │   │   ├── Hair.tsx / materials.ts
    │   ├── effects/          # 기 오라, 스택 구슬, 방어막, 임팩트 파티클 (먹물 시 상대 기 숨김)
    │   ├── arenas/           # 티어별 맵 6종 + 프롭 키트
    │   ├── preview/          # 로비 무대(티어 맵 + 캐릭터), 꾸미기 미리보기
    │   ├── screenSpace.ts    # 3D→화면 좌표 (HUD 라벨이 캐릭터를 따라다님)
    │   └── geometries.ts / textures.ts / layout.ts
    │
    ├── hooks/
    │   ├── useBattleLoop.ts     # rAF → battleStore.tick(dt)
    │   └── useBattleControls.ts # 키보드 (e.code 기반, 한글 IME 대응)
    │
    └── ui/
        ├── screens/          # Lobby(고정 한 화면) / Customize / Shop / Pass / TrophyRoad / Battle
        ├── hud/              # BattleHud(체력·기·타이머·버튼·팀 표시), WorldLabels, Overlays(결과/일시정지)
        └── components/       # BottomNav, GameModeSheet, LoadoutSheet(전투 준비), Button, FaceIcon, Modal, Help/Settings
```

## 3. Zustand 상태 설계

### 3-1. 스토어 맵

```
┌──────────────── 영구 저장 (persist, localStorage) ───────────────┐
│ useProfileStore   외형 · 골드 · 트로피(솔로/듀오·자유) · 인벤토리  │
│                   · 오늘의 도전 · 트로피 로드 · 코스튬 · 패스       │
│ useSettingsStore  볼륨 · 음소거 · 카메라 흔들림 · 모드/큐/파티 선택 │
└──────────────────────────────────────────────────────────────────┘
┌──────────────── 휘발 (세션) ─────────────────────────────────────┐
│ useBattleStore    배틀 상태 머신 (매 프레임 tick)                 │
│ useUIStore        화면 라우팅 · 모달 · 토스트                      │
└──────────────────────────────────────────────────────────────────┘
        ▲ matchmaking.ts 가 Profile → BattleConfig 를 조립해 배틀 시작
        ▼ 'finish' 이벤트 → BattleScreen 이 profile.applyMatch() 1회 호출
```

배틀 스토어는 프로필 스토어를 **직접 참조하지 않는다** (단방향). 배틀 시작 시 필요한 값(팀 구성·외형·아이템 수·기폭제로 인한 시작 기)을 `BattleConfig` 로 받고, 끝나면 이벤트로 결과만 내보낸다 → 온라인 모드에서도 같은 스토어를 그대로 쓸 수 있다.

**전투 준비 흐름**: 로비 `전투!` → `LoadoutSheet`(큐·파티·파트너·기폭제 선택) → `launchMatch(options)` 가 기폭제를 인벤토리에서 차감하고 `teams` 를 조립 → `BattleScreen` 이 시작. 클래식 도전은 오늘 10판을 채우면 시작되지 않는다.

### 3-2. `useBattleStore` (핵심)

```ts
interface BattleState {
  config: BattleConfig | null;          // mode(ai|local), kind(ranked|flex|challenge|local), mapId, aiLevel, teams[2][]
  phase: 'idle'|'intro'|'select'|'reveal'|'action'|'aftermath'|'ko'|'swap'|'finished';
  clock: number;                        // 배틀 시계 ms (일시정지/슬로모 반영)
  slowmo: { until: number; scale: number }; // 히트스톱 · 회피 슬로모 · KO 슬로모
  phaseStart: number;
  turn: number;                         // 현재 대결(bout)의 턴, 최대 30턴 → 체력 판정
  totalTurns: number;                   // 릴레이 전체 턴 수
  fighters: [FighterRuntime, FighterRuntime]; // 현재 출전 중인 두 명: hp, stacks, shield, items, history, inkTurns, inkSeen, member
  activeIdx / eliminated / swapSides;   // 릴레이: 팀별 출전 순번 · 탈락 수 · 교대 입장 연출
  choices: [ActionType|null, ActionType|null]; // 선택 단계엔 서로에게 비공개
  deadlines: [number, number];          // 플레이어별 마감 (3초, 야자 타임 1.5초)
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
      aftermath(0.65s) ─ KO? → 팀에 다음 주자 있음 → ko(1.7s) → swap(1.9s, 교대 입장) → select(turn 1)
                       │        └ 마지막 주자 → ko(2.8s) → finished
                       ─ 30턴? → 체력 낮은 쪽 탈락 (위와 동일하게 교대/종료)
                       ─ else → select (turn+1)   ※ 15턴부터 select 1.5초 + 양쪽 기 +1 ('overtime' 이벤트)
```

- **릴레이**: 이긴 쪽은 남은 체력을 유지하고 기만 초기화, 진 쪽은 다음 주자가 기 0 으로 입장. 내 팀 AI 파트너 차례엔 AI 가, 친구 파트너 차례엔 같은 기기에서 사람이 조작 (`SeatBanner` 가 차례 안내).
- **먹물 폭탄**: 사용 시 상대의 `inkTurns = 3`, `inkSeen = 내 현재 기`. 그동안 상대 화면(로컬/AI 판단 모두)에는 내 기 게이지가 그 값에서 멈춰 보인다 (`perceivedStacks`). HUD 는 `??` + 먹물 얼룩, 3D 스택 구슬/오라도 숨김.

- **3초 카운트다운**: `select` 진입 시 `deadlines[p] = clock + 3000` (야자 타임 1500). 마감까지 못 고르면 `'idle'`(멍때리기, 무방비). 판정 로그 문구는 화면에 띄우지 않는다 (헤드라인 아나운서만).
- **AI 선택**: `select` 진입 순간 상대 기록만 보고 결정 → 0.4~1.4초 뒤 '선택 완료' 표시 (사람 선택을 절대 엿보지 않음).
- **비공개 선택**: `select` 동안 3D 포즈/말풍선은 "선택 완료"만 보여주고 무엇을 골랐는지는 `reveal` 에서 공개.

### 3-3. `useProfileStore` (persist: `sbb-profile`)

```ts
{
  nickname, appearance: { skin, hairStyle, hairColor, bodyType, height, buttVolume, costumeId, effectId },
  gold, trophies, bestTrophies, flexTrophies, bestFlexTrophies, seasonId,
  stats: { wins, losses, draws, winStreak, bestStreak, specialFinishes },
  inventory: { shield, jam, catalyst },
  challenge: { date, played, wins, rewards },   // 오늘의 클래식 도전 (날짜 바뀌면 0부터)
  roadClaimed: number[],                         // 받은 트로피 로드 보상
  ownedCostumes, ownedEffects,
  pass: { xp, premium, claimed: { free: number[], premium: number[] } },
  // actions
  updateAppearance, buyItem, buyCostume, consumeItem, applyMatch(kind별 정산), challengeToday,
  claimRoadReward, claimPassReward, unlockPremium, resetProfile
}
```
컴포넌트에서는 `useChallengeToday()` 훅(메모이즈)으로 오늘 기록을 읽는다 — 셀렉터 안에서 새 객체를 만들면 무한 렌더가 나므로 주의.
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
| `swap` | 릴레이 교대: 다음 주자 입장 카메라, FIGHT 사운드, 아나운서 |
| `finish` | 승패 팡파르, 보상 정산(`applyMatch`) |

## 4. 판정 규칙 (`game/rules.ts`)

| 내 행동 \ 상대 | 기 모으기 | 피하기 | 공격 |
| --- | --- | --- | --- |
| **기 모으기** | 둘 다 +1 | 나만 +1 | 무방비라 내가 맞음 (기는 +1) |
| **피하기** | 상대만 +1 | 무 | 일반/강력 회피 (필살기는 불가) |
| **공격** | 상대 맞음 (상대 기 +1) | 빗나감 | 같은 단계 상쇄 / 높은 단계 압도 |

- 공격 단계: 기 0~2 일반 10 · 기 3+ 강력 50 (3 소모) · 기 10 필살기 100 (10 소모, 회피·방어 불가)
- 방어막: 필살기 제외 공격 1회 무효
- 🌙 야자 타임 (`OVERTIME_TURN = 15`): 선택 시간 1.5초, 턴 시작 시 두 사람 모두 기 +1 → 후반 필살기 심리전으로 결판
- 30턴 경과 시 체력 판정

### 연출 (등을 맞댄 스탠스, `scene/fighterPose.ts`)

두 캐릭터는 x 축 양쪽에서 **바깥을 보고**(카메라 쪽으로 `FACE_TURN` 만큼 돌림) 엉덩이를 마주한다.

| 행동 | 포즈 |
| --- | --- |
| 공격 | 상체를 숙이며 뒤로 돌진 → 엉덩이끼리 접촉 (`contactGap` = 두 사람 엉덩이 깊이 합) |
| 피하기 | 골반을 앞으로 쭉 빼고(`pelvis`) 상체를 뒤로 젖힘 → 비운 자리를 공격자가 헛치고 휘청 (몸을 뚫지 않게 공격자가 물러날 때까지 버팀) |
| 피격 / KO | 뒤에서 밀려 앞으로 휘청, KO 는 앞으로 엎어짐 |

## 5. 캐릭터 모델링 함수 (`scene/character`)

레퍼런스(`기본 캐릭터 디자인.png`, 정면/3/4/측면/후면)를 픽셀 측정해 **바닥 y=0, 정수리 y=2.25** 좌표계의 표로 옮기고, 단조 3차 보간(`sample`, Fritsch–Carlson)으로 연속 함수화했다.

| 부위 | 데이터 (`profiles.ts`) | 생성 함수 (`geometry.ts`) |
| --- | --- | --- |
| 두상 | `HEAD_A`(반폭) · `HEAD_ZF/ZB`(앞/뒤 깊이) 높이별 표, `HEAD_N` | `headSurface(y, φ)` 슈퍼엘립스 단면 → `buildHead()` 아이코스피어 변형 |
| 표정 | `FACE`: 눈썹·눈(하이라이트)·코(위/끝/아래)·콧구멍·볼터치·윗/아랫입술·귀·귀걸이 | `buildNose()` 쐐기, `buildLip()` 큐피드 활 + 맞닿는 평면, `buildEar()`; 얼굴 표면 법선에 맞춰 `onFace()` 로 배치 |
| 몸통·어깨 | `TORSO_RINGS` (높이, 반폭, 앞, 뒤), `VNECK`, `BADGE`, `SLEEVE` | `loft(rings, segs, n)` 슈퍼엘립스 로프트 |
| 팔 | `ARM` (어깨→손목 반지름, 손 크기) | 테이퍼 원기둥 + 손 |
| 골반·엉덩이 | `PELVIS_RINGS`, 엉덩이 볼륨 → `bodyLayout()` | 로프트 + 볼륨 구 (`buttDepth` 는 판정 연출의 접촉 거리에도 사용) |
| 다리·발 | `LEG_RINGS`, `SHOE` | 로프트, `buildShoe()` |

색은 `REF_COLORS` (피부 `#ecc9bc`, 스크럽 `#62647f`/`#5e607c`, 입술 `#bf645d`/`#cd6f68` …), 재질은 무광 + `flatShading` 으로 로폴리 면 질감을 재현한다. `?turnaround` 로 4방향을 렌더해 시트와 나란히 비교하며 맞췄다.

## 6. 확장 포인트

- **온라인 PvP**: `net/protocol.ts` 의 서버 권위 모델. 서버가 두 선택을 모아 `reveal` 로 동시에 공개하고 `resolveTurn` 을 공유. 클라이언트는 상대 슬롯을 `controller: 'remote'` 로 두고 `choose(p, action, 'remote')` 로 주입. 듀오/플렉스의 원격 파트너도 같은 방식으로 팀 슬롯에 들어간다.
- **사운드 에셋**: `sound.register('hit', '/sfx/hit.mp3')` — 등록된 효과음만 파일로 재생, 나머지는 합성음 폴백.
- **결제**: `unlockPremium()` 은 데모용. 실제 결제(PG/인앱결제) 성공 콜백에서 호출하도록 교체.
- **새 맵/코스튬**: `data/maps.ts` + `scene/arenas/*`, `data/costumes.ts` 에 항목 추가.
