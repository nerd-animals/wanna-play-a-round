# 0003: Wrapper 기반 Authorization

Status: Accepted (2026-05-12)

## Context

기존 패턴: handler 본문에 inline 권한 체크 (`if (team.ownerUserId !== input.actorUserId) throw new Error("FORBIDDEN")`).
- 파일마다 흩어짐
- 같은 패턴 반복
- 새 endpoint 추가 시 권한 체크 누락 위험
- 도메인 규칙과 권한 정책이 한 함수에 섞여 가독성 떨어짐

## Decision

`server/authz.ts`에 wrapper 3종:

- `withSession(handler)` — 로그인 필요한 모든 endpoint
- `withTeamOwner(handler)` — 팀 owner만 가능 (매치 등록, 초대 생성 등)
- `withTeamMember(handler)` — 팀 멤버만 가능 (조회 등)

Handler는 inner/wrapped 페어로 export:

```ts
// inner: 권한 통과 가정, 도메인 규칙만
export const _registerMatchPost = async (
  req: RegisterMatchPostRequest & { teamId: string },
  ctx: { actor: SessionUser; team: TeamRow },
  db: Queries = queries,
): Promise<ActionResult<MatchPostView>> => { ... };

// wrapped: route handler용
export const registerMatchPost = withTeamOwner(_registerMatchPost);
```

`_xxx`는 테스트용, `xxx`는 route용. Route handler는 wrapped 버전만 호출.

## Rejected alternatives

### Handler 내부 inline 체크 (기존)
- 권한 누락 위험
- 도메인 규칙과 정책 혼재
- **거부**

### RLS만 의존 (server 코드에서 권한 체크 X)
- 정책 변경 시 SQL 마이그레이션 필요
- 비즈니스 에러 코드 매핑 어려움 — RLS 거부는 generic `FORBIDDEN`만 던질 수 있음
- 한 endpoint가 여러 검증 (소속 + 정원 + Discord 길드 등) 조합 시 RLS로 표현 한계
- **거부 — RLS는 방어선으로 유지**

### 점진 도입 (3회 반복되면 wrapper 추출)
- 시점마다 패턴 갈림 → 일관성 깨짐
- "지금 inline, 나중에 wrapper" 판단이 개발자별로 갈림
- **거부**

## Tradeoffs accepted

- Wrapper 3종으로 충분 — 더 필요해지면 (역할별 권한, 팀별 세분화 등) 재설계.
- TypeScript generic + ActionResult union 합성에서 일부 `as const` 또는 cast 필요할 수 있음.
- Inner handler 시그니처가 `ctx`로 늘어남 (직관성 약간 손해, 책임 분리로 상쇄).

## RLS 관계

Supabase RLS = defense-in-depth. `authz.ts`가 1차 계약, RLS는 누락/우회 방어. 정책의 진실원은 `authz.ts`이므로 변경은 거기서만 일어남.

## Enforcement

- Route handler가 inner (`_xxx`)를 직접 호출하면 PR 리뷰 거절 (wrapped 버전만 사용)
- 권한 체크가 wrapper로 표현 불가능한 특수 케이스 발견 시 ADR 추가 검토
