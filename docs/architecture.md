# Architecture

## 레이어 의존성

```
┌──────────────────────────────┐
│  src/client (UI)             │ ───fetch('/api/...')──┐
└──────────────────────────────┘                       │
                                                       │
┌──────────────────────────────┐                       ▼
│  src/shared (계약)           │ ◄────양쪽이 type 참조─┤
│  • domain (slim views,enum)  │                       │
│  • api (ActionResult, etc)   │                       │
│  • contracts/<feature>       │                       │
└──────────────────────────────┘                       │
   ▲ zero internal dep                                 │
                                                       │
┌──────────────────────────────┐                       │
│  src/app (Next.js routing)   │                       │
│  • app/api/*/route.ts        │ ──┐                   │
│  • app/*/page.tsx (RSC)      │ ──┼──server handler───┤
└──────────────────────────────┘   │ 직접 import       │
                                   ▼                   │
┌──────────────────────────────┐                       │
│  src/server (server-only)    │ ◄─────────────────────┘
│  • handlers (계약 구현)      │
│  • authz (wrapper)           │
│  • db.queries (DB 인터페이스)│
│  • services (외부 API)       │
└──────────────────────────────┘
                │
                ▼ supabase-js (PostgREST)
            Supabase (RLS: 방어선)
```

## Cross-layer 흐름

### Browser POST (정상 경로)

1. Client: `fetch('/api/teams', { method: 'POST', body: JSON.stringify(request) })`
2. `app/api/teams/route.ts`: body 파싱 → 세션에서 actor 도출
3. `server/handlers/team.createTeam` 호출 (authz wrapper 적용된 export)
4. Wrapper: 세션 확인 → 실패 시 `{ ok: false, code: 'UNAUTHORIZED' }`
5. Inner handler: `queries`로 DB 조회 → 도메인 규칙 검증 → `queries`로 DB 쓰기 → `rowToTeamView` 매핑
6. Route: `statusFromError`로 status 결정 → JSON 응답
7. Client: `if (!res.ok) switch(res.code)`

### RSC (server→server, HTTP 우회)

RSC 페이지는 `server/handlers/*`를 직접 import. session/actor도 서버 측에서 도출. 호출 결과는 똑같이 `ActionResult<T>` — page는 `.ok` 분기로 렌더링.

이유: 같은 프로세스 안에서 HTTP roundtrip 비용 회피. wire는 client 전용.

## Authz 책임 위치

`server/authz.ts`가 단독 책임. Wrapper 3종:

- `withSession` — 로그인 필요
- `withTeamOwner` — 팀 owner만
- `withTeamMember` — 팀 멤버만

Inner handler는 권한 통과를 *가정*하고 도메인 규칙에만 집중. Wrapper에서 actor/team 컨텍스트를 미리 검증해서 inner의 `ctx` 인자로 주입.

Supabase RLS는 **defense-in-depth** — 1차 체크 아님. authz가 누락된 경우 RLS가 막아줄 수도 있지만 그것에 의존하지 않음. 권한 정책의 진실원은 `authz.ts`.

## Error 흐름

```
handler return → { ok: false, code: 'TEAM_NOT_FOUND' }
                 ↓
route handler → statusFromError('TEAM_NOT_FOUND') → 404
                 ↓
HTTP response → status: 404, body: { ok: false, code: 'TEAM_NOT_FOUND' }
                 ↓
client → res.status로 자동 처리 (401 redirect 등)
       → res.json().code로 UI 분기
```

`statusFromError`는 ErrorCode 명명 규칙으로 status 추론. 매핑 테이블 없음. 자세히는 [decisions/0004](./decisions/0004-error-status-by-naming.md).

## Test 경계

| Test 종류 | 대상 | 방식 |
|---|---|---|
| Inner handler 단위 | `_xxx` 함수 | fake `queries` 객체 주입, ActionResult 검증 |
| Authz wrapper 단위 | `withSession`/`withTeamOwner`/`withTeamMember` | 권한 시나리오 직접 호출 |
| Queries 통합 (소수) | `server/db/queries.ts` | supabase local 또는 dev DB 1회 통과 — `.single()` 등 quirks 검증 |
| E2E (Playwright) | 사용자 시나리오 | 실제 RLS 포함 통합 동작 |

Handler 단위 테스트는 supabase wire quirks를 **의도적으로** 안 잡음 — queries.ts가 그 책임.

## 외부 의존성 위치

- Discord OAuth: `server/services/discord-oauth.ts`
- Discord Bot (길드 멤버십 조회): `server/services/discord-bot.ts`
- Riot Sign-On + Riot API: `server/services/riot.ts`
- Supabase: `server/db/client.ts` (싱글톤)

각 service는 외부 API 응답 정규화만 책임 — 비즈니스 로직 X.
