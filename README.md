# 가격대별 매물대·수급·공시 분석 웹앱

국내·미국 주식의 **과거 체결 거래량을 가격 구간별로 나눠** 보여 주고, 각 구간의 **순매수 수급**과 **지분 공시 이벤트**를 함께 표시하는 모바일 우선 웹앱입니다.
크라우드 펀딩 데모와 토스 미니앱(WebView) 전환을 목표로 합니다.

- Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4
- 국내: 한국투자증권(KIS) Open API + Open DART
- 미국: Polygon.io + SEC EDGAR (Form 4)
- API 키가 없거나 조회에 실패하면 샘플 데이터(`MOCK_STOCKS`)로 자동 대체

> 본 화면은 과거 체결 거래량 분포와 공개 공시·수급 데이터를 시각화한 참고 자료이며, 특정 계좌의 실제 보유 잔고나 투자 권유가 아닙니다.

---

## 로컬 실행

```bash
npm install
cp .env.local.example .env.local   # 키 입력 (비워두면 샘플 데이터로 동작)
npm run dev                         # http://localhost:3000
# 운영 빌드: npm run build && npm start
```

Node.js 20.9 이상이 필요합니다. 키 없이 실행해도 삼성전자(005930), SK하이닉스(000660), NVDA, TSLA 샘플 데이터(180일)로 모든 화면을 확인할 수 있습니다.

검증 명령:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

---

## 환경변수 (`.env.local`)

| 키 | 용도 | 비워두면 |
|---|---|---|
| `KIS_APP_KEY`, `KIS_APP_SECRET` | 국내 일봉 시세, 투자자별 순매수 | 국내 종목은 샘플 데이터 |
| `KIS_BASE_URL` | 실전 `https://openapi.koreainvestment.com:9443` / 모의 `https://openapivts.koreainvestment.com:29443` | 실전 주소 사용 |
| `OPENDART_API_KEY` | 고유번호(corpCode) 맵, 지분 공시, 국내 종목 검색 | 공시 생략, 국내 검색은 샘플 2종목만 |
| `OPENDART_CORP_MAP_JSON` | (선택) 종목코드→고유번호 맵 덮어쓰기. 인라인 JSON 또는 JSON 파일 경로 | — |
| `SEC_USER_AGENT` | SEC 요청 필수 헤더. **실제 연락 가능한 이메일**을 넣으세요 | 기본값 사용(SEC가 차단할 수 있음) |
| `POLYGON_API_KEY` | 미국 일봉 시세 | 미국 종목은 샘플 시세 (+ Form 4가 조회되면 `hybrid-sec`) |

`OPENDART_CORP_MAP_JSON` 예시:

```bash
OPENDART_CORP_MAP_JSON={"005930":"00126380","000660":{"corp_code":"00164779","corp_name":"SK하이닉스"}}
# 또는 파일 경로
OPENDART_CORP_MAP_JSON=./data/corp-map.json
```

**보안:** 모든 키는 서버 코드(`src/app/api/**`, `src/lib/server/**`)에서만 읽습니다. `src/lib/server/**` 파일은 `import 'server-only'`로 보호되어 클라이언트 컴포넌트에서 불러오면 빌드가 실패합니다. `NEXT_PUBLIC_` 접두사는 사용하지 않습니다. `.env.local`은 `.gitignore`에 포함되어 있습니다.

---

## 실데이터 확인 (`curl`)

`npm run dev` 실행 후 응답의 `source` 값으로 데이터 출처를 확인합니다.

| `source` | 의미 |
|---|---|
| `live` | 시세를 실제 API에서 가져옴 (국내 KIS / 미국 Polygon) |
| `hybrid-sec` | 미국: 시세는 샘플, 내부자 거래는 실제 SEC Form 4 |
| `mock` | 전부 샘플 데이터. 실패 이유는 `notes`에 기록됨 |

```bash
# 국내 — KIS + DART (source: "live" 기대)
curl -s 'http://localhost:3000/api/profile?ticker=005930&market=KR&period=120&bins=24' \
  | jq '{source, name, currentPrice, aboveVolumeShare, belowVolumeShare, notes,
         disclosures: [.bins[].disclosures[]] | length}'

# 미국 — Polygon + SEC Form 4
curl -s 'http://localhost:3000/api/profile?ticker=NVDA&market=US&period=180&bins=24' \
  | jq '{source, name, notes, form4: [.bins[].disclosures[] | {date, action, reporter, shares, price}]}'

# 종목 검색 (국내 corpCode 맵 + SEC 티커 목록)
curl -s 'http://localhost:3000/api/search?q=%EC%82%BC%EC%84%B1&market=ALL' | jq   # q=삼성
curl -s 'http://localhost:3000/api/search?q=AAPL&market=US' | jq
```

`source`가 `mock`이면 `notes` 배열에 원인(키 미설정, HTTP 오류, KIS 토큰 발급 실패 등)이 들어 있습니다.

### API 파라미터

| 엔드포인트 | 파라미터 |
|---|---|
| `GET /api/profile` | `ticker`(필수), `market`=`KR`\|`US`(생략 시 6자리 숫자면 KR), `period`=20~250(기본 120), `bins`=8~40(기본 24) |
| `GET /api/search` | `q`(필수), `market`=`ALL`\|`KR`\|`US` — 정확 일치 > 접두사 > 부분 포함 순으로 상위 10개 |

---

## 주요 구현 특이사항

### 매물대 계산 (`src/lib/volumeCalculator.ts`)
- 최근 `period`일 일봉의 최고가~최저가 범위를 `bins`개 구간으로 나눕니다.
- 각 일봉의 거래량과 순매수 수급을 **고가~저가 범위와 각 구간이 겹치는 비율**(`overlap / candleSpan`)만큼 나눠 담습니다. 장중 실제 체결 가격 분포가 아니라 **균등 분포를 가정한 추정치**입니다.
- 현재가 상방/하방 비중은 구간 중심가(`midPrice`)를 현재가와 비교해 계산합니다.

### 국내 (KIS · DART)
- **KIS 30일 제한:** `FHKST01010400`(일자별 시세)은 최근 30거래일만 제공합니다. 60일 이상 조회하면 `FHKST03010100`(기간별 시세, 1회 최대 100건)으로 과거 구간을 채웁니다.
- **수급도 30일 제한:** `FHKST01010900`(투자자별 순매수)도 최근 약 30거래일만 제공합니다. 그 이전 구간은 수급이 0으로 집계되며, 응답 `notes`에 안내됩니다. 장중 당일 값은 비어 있어 건너뜁니다.
- **KIS 토큰:** `/oauth2/tokenP` 접근 토큰을 만료 10분 전까지 메모리에 캐싱합니다. KIS는 토큰 재발급을 분당 1회로 제한하므로, `next dev`에서 핫 리로드가 잦으면 일시적으로 발급이 실패할 수 있습니다.
- **DART 공시 단가 추정:** Open DART 지분 공시(`대량보유상황보고서`, `임원ㆍ주요주주특정증권등소유상황보고서`)에는 **체결 단가가 없습니다.**
  - 매수/매도 방향과 변동 수량은 `majorstock.json`(`stkqy_irds`), `elestock.json`(`sp_stock_lmp_irds_cnt`)의 증감으로 판정합니다. 증감이 0이거나 상세를 찾지 못한 공시는 제외합니다.
  - 단가는 **공시일(또는 직전 거래일) 종가로 추정**합니다(`priceBasis: "CLOSE_ESTIMATE"`). 화면에는 "추정 단가 · 공시일 종가 기준 추정"으로 표시됩니다.
- **고유번호 맵:** `corpCode.xml` ZIP을 내려받아 `adm-zip`으로 풀고, 상장사(`stock_code` 6자리)만 추립니다. 24시간 메모리 캐시 + `os.tmpdir()` 디스크 캐시를 쓰고, 동시 요청은 하나의 다운로드를 공유합니다.

### 미국 (Polygon · SEC EDGAR)
- 미국은 투자자별 순매수 데이터가 공개되지 않습니다. **최근 20일 평균 거래량의 1.5배 이상인 양봉**에만 `초과 거래량 × 몸통 비율`로 **기관 추정 수급**을 부여하고, 외국인·개인 칸은 `N/A`로 표시합니다.
- **SEC Form 4:** `company_tickers.json`으로 티커→10자리 CIK를 찾고(24시간 캐시), `submissions/CIK{cik10}.json`에서 최근 Form 4(최대 40건)의 원본 XML을 파싱합니다.
  - 거래 코드 `P`(장내 매수) / `S`(장내 매도)만 사용하며, 한 신고서의 여러 거래는 **수량 가중평균 단가**로 합칩니다(`priceBasis: "REPORTED"`).
  - SEC 권고에 따라 `User-Agent`에 연락처를 넣고, 동시 요청은 4개로 제한합니다. 결과는 1시간 캐싱합니다.

### UI (`src/components`)
- `max-w-[480px]` 모바일 우선 레이아웃(토스 미니앱 WebView 대응).
- **검색창 한글 입력 처리** (`TickerSearchBox`):
  - 입력이 바뀌는 즉시 `isSearching`을 켜서, 응답 전에 "검색 결과가 없습니다"가 깜빡이지 않고 "검색 중…"이 표시됩니다.
  - `onCompositionStart`/`onCompositionEnd`로 조합 상태를 추적합니다. 조합 중에는 디바운스를 350ms로 늘려 자모마다 요청하지 않고, 음절이 확정되면 즉시 요청합니다. 같은 검색어 중복 요청은 건너뜁니다.
  - 조합 중 Enter는 글자 확정용이므로 종목 선택으로 처리하지 않습니다.
  - 미국 주요 종목은 한글명(테슬라, 엔비디아 등)으로도 검색됩니다.
- 매물대 차트의 `▲`(매수·보유 증가) / `▼`(매도·보유 감소) 마커가 있는 구간을 누르면 하단 **선택 구간** 카드로 스크롤됩니다. 카드에는 보고자, 공시일, 변동 수량, 단가(체결 단가 또는 추정 단가 안내)가 표시됩니다.

---

## 프로젝트 구조

```
src/
├─ app/
│  ├─ api/profile/route.ts     # 매물대 프로필 (KIS+DART / Polygon+SEC / mock 폴백)
│  ├─ api/search/route.ts      # 한·미 통합 종목 검색
│  ├─ layout.tsx, page.tsx
├─ components/
│  ├─ VolumeProfileDashboard.tsx
│  └─ TickerSearchBox.tsx
├─ data/mockStocks.ts          # 005930 / 000660 / NVDA / TSLA 180일 샘플 생성기
├─ lib/
│  ├─ volumeCalculator.ts      # buildVolumeProfile()
│  └─ server/                  # 서버 전용 API 클라이언트 (server-only)
│     ├─ corpCodeMap.ts, dartClient.ts, kisClient.ts
│     ├─ usMarketClient.ts, secEdgarClient.ts
└─ types/stock.ts
```

## 표현 규칙

실제 계좌 보유자 수는 외부 데이터로 알 수 없으므로 "투자자 N명" 같은 표현은 쓰지 않습니다. 대신 "구간별 누적 체결량 비중(%)", "현재가 상방/하방 누적 거래량 비중", "구간별 순매수 수급", "지분 공시 이벤트"라는 용어를 사용합니다. 자세한 규칙은 `CLAUDE.md`를 참고하세요.
