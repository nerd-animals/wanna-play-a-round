# ScrimFinder — AI/Dev 빠른 참조

LoL 5인 스크림 매칭. Discord OAuth로 로그인 → 팀 생성 + invite 링크 자동 발급 → 5명이 Riot Sign-On으로 가입 → Discord 길드 멤버인 owner만 매치 등록.

## 레이어 책임 (한 줄씩)

- **`src/shared/`** — server↔client REST 계약. Slim view + `ActionResult` envelope + typed Endpoint. **다른 어디서도 import 받지 않음, 다른 곳을 import 하지도 않음**.
- **`src/server/`** — 가상 백엔드. `handlers/`가 shared 계약을 구현. **모든 파일 `import "server-only"` 시작**.
- **`src/client/`** — UI 컴포넌트. server 도달은 **`fetch('/api/...')`만**.
- **`src/app/`** — Next.js 라우팅. route handler가 body 파싱 → server handler 호출 → JSON 직렬화.

## 불변식 (위반 = PR 거절)

- `shared/*`는 `server/`, `client/`, `app/` import 0건
- actor 식별자는 항상 세션에서 도출 — Request body에 `ownerUserId`/`actorUserId` 안 받음
- handler는 `ActionResult<T>` 반환 — `throw` 금지
- 권한 체크는 `server/authz.ts` wrapper에서만 — handler 본문 X
- DB 접근은 `server/db/queries.ts` 객체 통해서 — handler가 supabase 직접 호출 X
- HTTP status는 `statusFromError(code)` 한 함수만 — route마다 분기 X

## 호출 경로

| 호출자 | 경로 |
|---|---|
| RSC 페이지 (`app/*/page.tsx`) | `server/handlers/*` 직접 import (server→server) |
| Browser Client Component | `fetch('/api/...')` |
| `<form action="...">` | API route 직접 |

## 워크플로 (TDD)

1. `shared/contracts/<feature>.ts`에 `*Request`/`*Response`/`*Endpoint`/`*ErrorCode` 정의
2. inner handler (`_xxx`) 테스트 작성 — fake queries 객체 주입 (실패 확인)
3. inner handler 구현 — 도메인 규칙만 (권한 체크 X)
4. authz wrapper로 감싸 `xxx` export
5. `app/api/*/route.ts` 와이어링 + e2e 흐름 확인

## 어디서 더 봐야 하나

- 결정 근거 (왜 REST/왜 queries 객체/왜 wrapper authz 등): [docs/decisions/](./docs/decisions/)
- 레이어 다이어그램 + cross-layer 흐름: [docs/architecture.md](./docs/architecture.md)
- 비즈니스 컨텍스트: [docs/domain.md](./docs/domain.md)
- Discord 게이트 상세 설계: [docs/superpowers/specs/2026-04-19-discord-membership-gate-design.md](./docs/superpowers/specs/2026-04-19-discord-membership-gate-design.md)
