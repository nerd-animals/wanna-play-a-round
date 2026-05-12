# 0004: HTTP status — ErrorCode 명명 규칙으로 도출

Status: Accepted (2026-05-12)

## Context

ActionResult의 ErrorCode를 HTTP status로 매핑하는 정책이 필요. 후보:

1. 모든 에러 → 400 통일 — Sentry 알람/401 redirect/CDN retry/캐싱 다 깨짐
2. `Record<ActionErrorCode, number>` 매핑 테이블 — ErrorCode 추가마다 중앙 수정 = merge hotspot
3. 명명 규칙으로 자동 도출 — 추가 시 매핑 업데이트 불필요

핵심 제약: feature 추가마다 충돌 hotspot이 생기면 두 개발자 분업 비용이 누적됨.

## Decision

`shared/api.ts`의 `statusFromError(code: ActionErrorCode): number`가 명명 규칙으로 status 추론:

| 패턴 | Status |
|---|---|
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN`, `*_MEMBER_REQUIRED` | 403 |
| `*_NOT_FOUND` | 404 |
| `*_ALREADY_EXISTS` | 409 |
| `INTERNAL_ERROR` | 500 |
| (그 외) | 422 |

Route handler는 한 줄로 통일:

```ts
return NextResponse.json(result, {
  status: result.ok ? 200 : statusFromError(result.code),
});
```

새 ErrorCode 추가 시 명명만 규칙대로 → 매핑 업데이트 0.

## Rejected alternatives

### `Record<ActionErrorCode, number>` 매핑 테이블
- ErrorCode 추가마다 테이블 수정 강제 = merge hotspot
- Feature 두 개를 두 개발자가 동시 추가하면 git conflict 빈발
- **거부**

### 모든 에러 → 400 통일
- Sentry "4xx 비율 > 5%" 알람이 사용자 입력 실수까지 카운트 → 알람 피로
- Client에서 401 자동 redirect 깨짐 (수동으로 매번 `result.code === 'UNAUTHORIZED'` 체크 필요)
- CDN/Vercel은 5xx만 자동 retry — 일시적 supabase 장애가 400으로 떨어지면 retry 안 됨
- DevTools Network 탭에서 200 status에 `ok:false` 박힘 = 빨간색 안 보여 디버깅 어려움
- **거부**

## Tradeoffs accepted

- 명명 규칙 어긴 ErrorCode는 silent하게 422로 fallback — 의미 손실 작음 (client는 `result.code` 봄)
- 도메인 특수 케이스 일부는 규칙에 포함시켜야 함 (e.g. `OWNER_MEMBER_REQUIRED` → 403은 `*_MEMBER_REQUIRED` 규칙으로 커버)
- 7가지 status (200/401/403/404/409/422/500)만 사용 — 표현력 손해 < 일관성 이득

## Enforcement

- 새 ErrorCode 추가 시 PR 리뷰 항목: 명명 규칙 준수
- 명명 drift 발생 시 ESLint custom rule 도입 검토
