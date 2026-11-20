@AGENTS.md

# 주식 가격대별 매물대·수급·공시 분석 웹앱

크라우드 펀딩 데모 및 추후 토스 미니앱(WebView) 전환을 목표로 하는 Next.js(App Router) + TypeScript + Tailwind CSS 프로젝트.

## 구조
- `src/types/stock.ts` — 공용 타입 (`MarketType`, `CandleData`, `DisclosureEvent`, `VolumeBin`, `StockProfileResult` 등)
- `src/lib/volumeCalculator.ts` — `buildVolumeProfile()` 매물대 계산 (클라이언트·서버 공용, 순수 함수)
- `src/data/mockStocks.ts` — 005930 / 000660 / NVDA / TSLA 180일 샘플 생성기 (`MOCK_STOCKS`)
- `src/lib/server/**` — 외부 API 클라이언트 (KIS, Open DART, Polygon, SEC EDGAR). **서버 전용** (`import 'server-only'`)
- `src/app/api/search`, `src/app/api/profile` — Route Handler
- `src/components/**` — 클라이언트 UI (`max-w-[480px]` 모바일 우선)

## 용어·표현 규칙 (필수)
- 실제 계좌 보유자 수(명)는 외부 데이터로 알 수 없다. UI·문구에 **"투자자 N명", "N명이 보유" 같은 표현 금지**.
- 다음 용어를 사용한다:
  - "구간별 누적 체결량 비중(%)"
  - "현재가 상방/하방 누적 거래량 비중"
  - "구간별 순매수 수급" (외국인/기관/개인)
  - "지분 공시 이벤트"
- "매물대 = 물려 있는 투자자" 식의 단정적 해석, 목표가·매수/매도 추천 문구 금지.

## 시장별 처리
- 국내(KR): KIS 일봉(FHKST01010400, 30일 초과분은 FHKST03010100 보충) + 투자자별 순매수(FHKST01010900) + Open DART 지분공시(대량보유상황보고서, 임원ㆍ주요주주특정증권등소유상황보고서).
- 미국(US): 투자자별 수급이 공개되지 않으므로 **거래량 급증 양봉(20일 평균 대비 1.5배 이상)** 에만 기관 추정 수급을 부여하고, **SEC Form 4 내부자 신고(P 매수 / S 매도)** 를 공시 이벤트로 사용한다.
- API 키가 없거나 조회 실패 시 `MOCK_STOCKS`로 폴백하고 응답 `source`(`live` | `hybrid-sec` | `mock`)로 표시한다.

## 보안
- API 키/비밀값(`KIS_APP_KEY`, `KIS_APP_SECRET`, `OPENDART_API_KEY`, `POLYGON_API_KEY`, `SEC_USER_AGENT` 등)은 **`src/app/api/**`, `src/lib/server/**` 에서만** `process.env`로 참조한다.
- 클라이언트 컴포넌트에서 `src/lib/server/**`를 import 하지 않는다. `NEXT_PUBLIC_` 접두사로 비밀값을 노출하지 않는다.

## 고정 유의사항 (화면 하단 항상 노출)
> 본 화면은 과거 체결 거래량 분포와 공개 공시·수급 데이터를 시각화한 참고 자료이며, 특정 계좌의 실제 보유 잔고나 투자 권유가 아닙니다. 투자 판단과 그 결과에 대한 책임은 투자자 본인에게 있습니다.

## 검증
- `npx tsc --noEmit`
- `npm run build`
