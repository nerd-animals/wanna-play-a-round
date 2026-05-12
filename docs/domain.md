# Domain

ScrimFinder는 League of Legends 5인 스크림 매칭 도구. 핵심 차별점: **Discord 길드 멤버십 게이트** — 매치 등록이 외부 Discord 커뮤니티 참여를 강제함으로써 unaffiliated 모집을 차단.

## 엔티티 관계

```
users (Discord OAuth 1차 식별자, 추후 Riot 1개 링크)
  └── teams (1 owner; 1 user는 여러 팀 owner 가능)
        ├── team_members (실제 로스터, 5명 fixed)
        ├── team_invite_links (팀당 1개, 재사용 가능)
        └── match_posts (1 OPEN/팀)
```

`users.id`가 application 식별자. Discord OAuth로 처음 만들어지고, Riot Sign-On은 그 user에 link만 추가.

## 인증 계층

- **Discord OAuth**: 모든 application 세션의 1차 인증
- **Riot Sign-On**: invite 기반 팀 가입 흐름에서만 사용 — 일반 로그인/조회에는 불필요
- **Discord 길드 멤버십 체크**: 매치 등록 시점에 owner에 한해 조회 (bot API)

## 핵심 플로우

### 팀 생성

Discord 로그인 → 팀 shell + 재사용 invite 링크 자동 생성. **Owner는 자동으로 로스터에 안 들어감** — 5인 안에 들고 싶으면 직접 invite 사용해서 Riot Sign-On 거쳐 가입해야 함.

### 가입 (invite → 로스터)

Invite 링크 열기 → Discord 세션 확인 (없으면 인증) → Riot Sign-On → 완료 시 ACTIVE 멤버 생성. **선착순 5명**. 6번째 Riot 완료는 `TEAM_FULL`.

Invite 링크 열기만으론 멤버 안 됨. Riot 완료가 트리거.

### 매치 등록 (owner 전용)

두 조건 **동시** 만족해야:
1. 팀 active 멤버 = 정확히 5
2. Owner가 설정된 Discord 길드의 멤버

조건 미달:
- 정원 미달 → 페이지 진입 거부
- Discord 길드 미가입 → `DISCORD_GUILD_MEMBERSHIP_REQUIRED`

두 체크는 페이지 진입과 POST 처리 양쪽에서 다 실행 (route + form 우회 동시 차단).

## 비즈니스 제약

- 팀 정원: 5명 고정 (별도 cached flag 없이 active 멤버 카운트로 계산)
- 팀당 1 OPEN 매치 (`OPEN_MATCH_ALREADY_EXISTS` 방어)
- 1 user가 여러 팀 owner/소속 가능
- 1 user당 1 Riot 계정 링크
- Owner의 로스터 가입은 선택 — 다른 멤버와 동일하게 invite 흐름 사용
- 시트 배정: first-complete, first-invited 아님 (Riot 완료 순서)

## 상세 설계 참조

전체 product 설계 (인증 boundary, 데이터 흐름, error 모델, 테스트 시나리오, 환경 변수)는:
**[Discord Membership Gate Design](./superpowers/specs/2026-04-19-discord-membership-gate-design.md)** ← 활성 spec

이 문서는 그 spec의 high-level 요약. 상세나 회의록은 spec에서.

## 외부 의존성

| 시스템 | 용도 | 위치 |
|---|---|---|
| Discord OAuth | 1차 인증 | `server/services/discord-oauth.ts` |
| Discord Bot API | 길드 멤버십 조회 | `server/services/discord-bot.ts` |
| Riot Sign-On + Riot API | invite 가입 흐름 | `server/services/riot.ts` |
| Supabase | DB + RLS (방어선) | `server/db/client.ts` |
