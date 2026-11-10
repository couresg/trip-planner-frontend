# Trip Planner Frontend

여행 도착/출발 플래너의 React SPA. 백엔드는 별도 저장소(`backend/`)다.
요구사항·API 문서는 모노레포 루트의 `docs/`에 있다 (이 폴더에서는 `../docs/`).

## 스택

React, TypeScript, Vite, React Router, TanStack Query, Zustand, Tailwind CSS + shadcn/ui, react-hook-form + zod, date-fns + date-fns-tz, dnd-kit, @vis.gl/react-google-maps.
테스트: Vitest, Testing Library, MSW.

## 사전 준비

- Node.js와 npm
- 백엔드가 `http://localhost:8080`에서 실행 중이어야 한다 (`backend/README.md` 참고)

## 실행

```bash
npm install
npm run dev     # http://localhost:5173
```

개발 서버(`vite.config.ts`)는 `/api` 요청을 `http://localhost:8080`으로 프록시한다.

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (포트 5173) |
| `npm run build` | 타입 체크(`tsc -b`) + 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | ESLint |
| `npm run test` | Vitest 1회 실행 |
| `npm run test:watch` | Vitest 감시 모드 |
| `npm run format` | Prettier |

## 환경변수

`.env.example`을 `.env`로 복사해 쓴다 (`.env`는 커밋 금지).

| 변수 | 용도 |
|---|---|
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | 일정 탭 지도용 Maps JavaScript API 키. 반드시 HTTP Referrer 제한을 건 키만 사용 |

| `VITE_USE_MSW` | `true`면 개발 서버(`npm run dev`)에서 백엔드 대신 MSW 목업 응답을 쓴다. 빌드 결과에서는 무시된다. 먼저 `npx msw init public`으로 `public/mockServiceWorker.js`를 만들어야 한다 |

키가 없으면 지도 대신 안내 문구가 표시된다.
`VITE_` 변수는 번들에 노출된다. 다른 비밀값은 절대 `VITE_` 접두어로 넣지 않는다.

## 규칙 요약

- 외부 API(AeroDataBox, Places, Routes)를 프론트에서 직접 호출하지 않는다. 모든 호출은 `src/api/`를 통해 백엔드로 보낸다.
- 서버 데이터는 TanStack Query로만 다룬다.
- 시간은 서버가 준 ISO 오프셋 시각을 공항/도시 timezone으로 표시한다 (브라우저 로컬 시간대 변환 금지).
- 모바일 우선 (375px 기준).
- 요청 횟수 제한으로 `429`(`RATE_LIMITED`)를 받으면 안내 문구를 보여주고 자동 재시도하지 않는다.

자세한 규칙과 폴더 구조는 `CLAUDE.md`.
