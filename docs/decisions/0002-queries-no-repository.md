# 0002: queries 객체 — Repository 인터페이스 X

Status: Accepted (2026-05-12)

## Context

기존 구조: `repositories/{contracts, memory, supabase, index}.ts` 4파일.
- Production 구현: supabase 1개
- Memory 구현: 테스트 전용
- 인터페이스 추상화 비용 > 가치

테스트 격리는 다른 방식으로 달성 가능한지가 결정 포인트.

## Decision

`server/db/queries.ts`에 **단일 `queries` 객체** export. Handler 시그니처가 default 인자로 받음:

```ts
export const queries = {
  findTeamByOwnerId: async (ownerId: string): Promise<TeamRow | null> => { /* supabase */ },
  insertTeam: async (row: NewTeamRow): Promise<TeamRow> => { /* supabase */ },
  // ...
};
export type Queries = typeof queries;

export async function _createTeam(
  req: CreateTeamRequest,
  ctx: { actor: SessionUser },
  db: Queries = queries,
) { ... }
```

테스트는 필요한 메서드만 가진 fake 객체를 인자로 전달:

```ts
const db = { findTeamByOwnerId: async () => existingRow } as Queries;
const res = await _createTeam({ name: 'Foo' }, { actor }, db);
```

## Rejected alternatives

### Repository 인터페이스 + Supabase 구현 (기존)
- Production 구현 1개짜리 추상화 = 구조적 비용만
- 인터페이스 정의 + 구현 클래스 + DI 등록 3중 변경 필요
- **거부**

### MSW로 handler 단위 테스트에서 supabase-js HTTP 직접 mock
- `.single()` vs `.maybeSingle()`이 0건일 때 `406` vs `200/null` — MSW handler에서 재현 어려움
- `rpc()`와 일반 쿼리의 URL shape 다름
- 동적 `select`/`filter`/`order` 패턴까지 따라가야 함
- RLS 시뮬레이션 불가
- **handler 단위 테스트 용도로는 거부** (queries.ts 자체의 통합 테스트에서는 사용 가능)

### Supabase Local Docker로 모든 테스트
- CI 시간 증가, seed/teardown 비용
- 단위 테스트 직관성 손해 ("이 handler 동작을 검증한다"가 흐려짐)
- **거부** (queries.ts 소수 통합 테스트에서만 사용)

## Tradeoffs accepted

- Handler 단위 테스트는 supabase wire quirks를 의도적으로 안 잡음. queries.ts가 wire 정확도 책임, handler는 도메인 규칙 책임.
- Fake 객체에 메서드 누락 시 `as Queries` cast 필요 (구조적 타이핑 한계).
- queries 객체가 커지면 한 파일이 비대해질 위험 — 도메인별 namespace 분할은 필요 시 도입 (e.g. `queries.team.findByOwnerId`).
