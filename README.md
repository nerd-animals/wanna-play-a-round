# ScrimFinder

League of Legends 5인 스크림 매칭 도구. Discord 길드 멤버십 게이트가 차별점.

## Stack

Next.js 15 · TypeScript · Supabase · Tailwind v4 · Vitest + Playwright + MSW

## Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run build
npm run test         # vitest
npm run test:e2e     # playwright
npm run lint
```

환경 변수는 `.env.example` 참조.

## Docs

- [Architecture](./docs/architecture.md) — 레이어 책임과 cross-layer 흐름
- [Domain](./docs/domain.md) — 비즈니스 컨텍스트와 핵심 플로우
- [Decisions](./docs/decisions/) — 주요 설계 결정의 근거
- [AI/Dev 빠른 참조](./CLAUDE.md)
