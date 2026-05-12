# 0001: REST contract over Server Actions

Status: Accepted (2026-05-12)

## Context

Server와 client 개발자가 분리된 두 사람. `shared/`가 둘 사이의 핸드오버 계약 문서가 돼야 함.

핵심 제약: **client 개발자가 server 구현 없이도 독립적으로 작업 가능해야 함** (MSW로 응답 mocking).

## Decision

- 와이어 프로토콜: **REST (JSON over HTTP)** — browser client는 항상 fetch
- 함수 반환 모양: **`ActionResult<T>` envelope** — `{ ok: true; data: T } | { ok: false; code: ActionErrorCode }`
- ActionResult는 함수 반환값과 HTTP body 양쪽에 같은 모양 (RSC 직접 호출과 fetch 결과가 wire-동등)
- **Typed Endpoint 레코드**: `method`/`path`/`request`/`response`를 한 인터페이스로 묶어 contract drift 방지

## Rejected alternatives

### Server Actions (`'use server'`)
- Next.js에 종속 — 미래의 모바일/외부 client 차단
- Client 개발자가 MSW로 mock 불가 (MSW는 fetch 가로채기, Server Action은 import 패턴)
- **거부**

### HTTP error semantics만 (envelope 없이)
- Client에서 switch exhaustiveness 손해 — 어떤 코드가 올 수 있는지 타입으로 안 보임
- 4xx body 모양이 endpoint마다 갈릴 위험
- **거부**

## Tradeoffs accepted

- `ActionResult`는 TypeScript 전용 — OpenAPI/JSON Schema 자동 export 없음. 외부 API 통합 도구가 필요해지면 별도 어댑터 작성 필요.
- RSC 페이지의 server handler 직접 import는 허용 — 같은 기능에 두 호출 경로 공존 (browser fetch + RSC import). 둘 다 같은 `ActionResult<T>` 모양이라 client 코드 일관성은 유지.
