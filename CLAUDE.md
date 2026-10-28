# frontend/CLAUDE.md — React

루트 `CLAUDE.md`와 `docs/`를 먼저 따른다. 이 파일은 프론트엔드 전용 규칙이다.

## 상위 문서 위치 (이 폴더에서 Claude Code를 실행할 때)

이 폴더를 IDE 프로젝트 루트로 열고 여기서 Claude Code를 실행하는 경우:
- 상위의 `../CLAUDE.md`는 자동으로 함께 로드된다.
- 루트 CLAUDE.md에 적힌 `docs/...` 경로는 여기서 보면 **`../docs/...`** 이다.
- 작업 전에 관련 문서를 직접 읽는다: `../docs/PRD.md`, `../docs/API_SPEC.md`, `../docs/ROADMAP.md` 
- API 명세, DB 스키마, 로드맵 체크박스를 바꿀 때도 `../docs/`의 파일을 수정한다.

## 명령어

```bash
npm install
npm run dev        # http://localhost:5173 (/api → localhost:8080 프록시)
npm run build      # 타입 체크 + 빌드
npm run lint
npm run test       # Vitest
```

## 스택과 선택 이유

| 영역 | 라이브러리 | 이유 |
|---|---|---|
| 빌드 | **Vite + React + TypeScript** | 백엔드가 Spring Boot라 SSR이 필요한 Next.js보다 가볍고 단순한 SPA가 맞음 |
| 라우팅 | **React Router** | `/`, `/trips/new`, `/trips/:tripId` 정도의 단순 라우팅 |
| 서버 상태 | **TanStack Query** | API 캐시, 로딩/에러 상태, 일정 변경 시 낙관적 업데이트 |
| 클라이언트 상태 | **Zustand** | 입국 소요 시간 같은 UI 설정, 소유 토큰 등 가벼운 전역 상태 |
| UI | **Tailwind CSS + shadcn/ui** | 날짜 범위 선택(Calendar), Select, Tabs, Dialog, Toast를 바로 사용 |
| 폼 | **react-hook-form + zod** | 편명 정규식·날짜 범위 검증을 스키마로 선언 |
| 날짜·시간대 | **date-fns + date-fns-tz** | 공항 현지 시각 표시, `+1` 날짜 넘김 계산 |
| 드래그 앤 드롭 | **dnd-kit** | 일정 순서 변경·날짜 간 이동, 모바일 터치 지원 |
| 지도 | **@vis.gl/react-google-maps** | Google 공식 React 래퍼, 마커·폴리라인 |
| API 타입 | **openapi-typescript** (선택) | springdoc의 `/v3/api-docs`에서 타입 자동 생성 |
| 테스트 | **Vitest + Testing Library + MSW** | API 목킹으로 화면 단위 테스트 |
| 린트 | ESLint + Prettier | |

## 폴더 구조 (기능 단위)

```
src/
├── main.tsx, App.tsx, router.tsx
├── api/              # fetch 래퍼(client.ts), 엔드포인트별 함수, 생성된 타입
├── features/
│   ├── trip-create/  # 생성 폼, 편명 미리보기, 수동 입력 모드
│   ├── trip-list/
│   ├── transfer/     # ArrivalTab, DepartureTab, TransferCard, DepartureChips, Timeline
│   └── itinerary/    # PlacePicker, DayColumn, ItineraryItemCard, DayMap
├── components/ui/    # shadcn/ui 생성 컴포넌트 (직접 수정 최소화)
├── components/       # 공용 컴포넌트
├── hooks/
├── stores/           # zustand
├── lib/              # time.ts(현지 시각 포맷), format.ts(통화), storage.ts(localStorage try/catch)
└── mocks/            # MSW 핸들러
```

## 코드 규칙

- 함수 컴포넌트 + TypeScript `strict`. `any` 금지.
- 서버 데이터는 TanStack Query로만 다룬다 (Zustand에 서버 데이터 복사 금지). Query key는 `api/queryKeys.ts`에 모은다.
- API 호출은 `api/` 함수만 통한다. 컴포넌트에서 `fetch` 직접 호출 금지.
- 모든 여행 API 요청에 `X-Owner-Token` 헤더를 붙이는 로직은 `api/client.ts` 한 곳에서 처리한다.
- **시간 표시**: 서버가 준 ISO 오프셋 시각을 그대로 공항/도시 timezone으로 포맷한다. 브라우저 로컬 시간대로 변환하지 않는다. `lib/time.ts`의 `formatLocal(iso, tz)`, `dayDiff(base, target, tz)`만 사용한다.
- 폼 검증 스키마(zod)의 편명 정규식은 백엔드와 동일하게 `^[A-Z0-9]{2}\d{1,4}$` (입력 시 대문자·공백 제거 정규화).
- localStorage 접근은 `lib/storage.ts`를 통해 try/catch로 감싼다.
- 문구는 컴포넌트에 흩뿌리지 말고 `constants/messages.ts`에 모은다 (추후 다국어 대비).

## UI 원칙

- **모바일 우선** (375px 기준 설계 → 데스크톱 확장). 공항에서 한 손으로 보는 상황을 가정.
- 여행 상세는 탭 3개: **도착일 / 일정 / 귀국일**.
- 도착일 상단 타임라인: `착륙 → 입국 완료 → 추천편 출발 → 숙소 도착`.
- 귀국일 상단 강조 문구: **"늦어도 HH:mm에는 숙소에서 출발하세요"**.
- 상태는 색 + 텍스트/아이콘을 함께 쓴다 (예: 추천 ✅, 탑승 어려움, 운행 종료).
- 로딩은 스켈레톤, 에러는 재시도 버튼 포함.

## 환경변수

- `VITE_GOOGLE_MAPS_BROWSER_KEY` — 지도 표시용 (Referrer 제한된 키만). **다른 비밀값은 `VITE_` 접두어로 절대 넣지 않는다** (번들에 노출됨).

## 하지 말 것

- 외부 API(AeroDataBox, Places, Routes)를 프론트에서 직접 호출
- 서버 키를 `.env`의 `VITE_` 변수로 노출
- `dangerouslySetInnerHTML` 사용
