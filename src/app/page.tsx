import Link from "next/link";
import { ArrowRight, ShieldCheck, Swords, Users } from "lucide-react";
import { AppShell } from "@/client/components/app-shell";
import { CheckItem } from "@/client/components/check-item";
import { SectionHeader } from "@/client/components/section-header";
import { StatCard } from "@/client/components/stat-card";
import { StatusAlert } from "@/client/components/status-alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Separator } from "@/client/components/ui/separator";
import { _getMyTeams } from "@/server/handlers/team";
import { getCurrentUser } from "@/server/session";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

const quickFlow = [
  {
    title: "Discord 로그인",
    description: "팀장 세션을 만들고 현재 사용자 상태를 고정합니다.",
  },
  {
    title: "팀 생성",
    description: "팀 이름과 운영 정보를 저장해 관리 화면의 기준점을 만듭니다.",
  },
  {
    title: "초대 링크 발급",
    description: "합류 링크를 만들고 멤버 유입 플로우를 검증합니다.",
  },
  {
    title: "매칭 등록",
    description: "활성 팀 상태를 바탕으로 OPEN 스크림 글을 등록합니다.",
  },
];

export default async function Home({ searchParams }: Props) {
  const user = await getCurrentUser();
  const query = await searchParams;
  const teamsResult = user ? await _getMyTeams({}, { actor: user }) : null;
  const team = teamsResult?.ok ? (teamsResult.data[0] ?? null) : null;

  return (
    <AppShell>
      <Card className="overflow-hidden">
        <CardContent className="grid gap-8 px-6 py-8 lg:grid-cols-[1.25fr_0.9fr] lg:px-10 lg:py-10">
          <div className="space-y-6">
            <Badge>Scrim Finder MVP</Badge>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold text-balance sm:text-5xl lg:text-6xl">
                팀 운영과 스크림 모집 흐름을 한 화면에서 검증하는 e-sports control room.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                현재 범위는 Discord 로그인, 팀 생성, 초대 링크 발급, 링크 기반 팀 합류, 매칭 등록까지입니다.
                Riot 연동 전 단계의 운영 플로우를 먼저 검증합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {user ? (
                <Button asChild size="lg">
                  <Link href={team ? `/teams/${team.id}` : "/dashboard"}>
                    {team ? "팀 관리 열기" : "대시보드 이동"}
                    <ArrowRight />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <a href="/api/auth/discord/login">
                    디스코드 로그인 시작
                    <ArrowRight />
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <Link href="/dashboard">현재 상태 보기</Link>
              </Button>
            </div>
            {query.error ? (
              <StatusAlert
                title="로그인 오류"
                tone="destructive"
                description={
                  <>
                    {query.error}. <code>DISCORD_CLIENT_ID</code>, <code>DISCORD_CLIENT_SECRET</code>,
                    <code> DISCORD_REDIRECT_URI</code> 설정을 확인하세요.
                  </>
                }
              />
            ) : null}
            {user ? (
              <StatusAlert
                title="세션 활성"
                tone="success"
                description={
                  <>
                    현재 로그인 사용자 <strong>{user.username}</strong>
                    {team ? ` / 연결된 팀 ${team.name}` : " / 아직 생성한 팀 없음"}
                  </>
                }
              />
            ) : (
              <StatusAlert
                title="세션 없음"
                description="아직 로그인하지 않았습니다. 먼저 Discord 로그인으로 팀장 세션을 만든 뒤 관리 플로우를 검증하세요."
              />
            )}
          </div>

          <div className="grid gap-4 self-start">
            <StatCard
              label="현재 상태"
              value={user ? (team ? "팀 운영 가능" : "팀 생성 대기") : "로그인 필요"}
              hint={user ? "세션이 활성화되어 있습니다." : "대시보드 접근 전 인증이 필요합니다."}
            />
            <StatCard
              label="핵심 검증"
              value="Invite + Match"
              hint="초대 링크 발급과 OPEN 매칭 등록이 현재 MVP의 핵심입니다."
            />
            <StatCard
              label="저장 계층"
              value="Supabase"
              hint="환경변수가 설정돼야 동작합니다."
            />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>가장 짧은 검증 경로</CardTitle>
            <CardDescription>실제 운영 감각으로 빠르게 시스템을 통과시키는 추천 순서입니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {quickFlow.map((item, index) => (
              <CheckItem
                key={item.title}
                title={`${index + 1}. ${item.title}`}
                description={item.description}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>현재 제약</CardTitle>
            <CardDescription>지금은 팀과 운영 플로우 검증이 우선이고, Riot 연동은 다음 단계입니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="인증" value={<ShieldCheck className="size-5" />} hint="Discord OAuth 기반" />
              <StatCard label="팀 운영" value={<Users className="size-5" />} hint="팀 생성, 멤버 합류" />
              <StatCard label="스크림" value={<Swords className="size-5" />} hint="OPEN 매칭 등록" />
            </div>
            <Separator />
            <p className="text-sm leading-7 text-muted-foreground">
              RSO는 API 키와 권한 준비 후 다시 붙일 예정입니다. 이번 리디자인에서는 팀 관리와 매칭
              등록 흐름이 더 선명하게 보이는 것이 목표입니다.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="space-y-6 px-6 py-6">
          <SectionHeader
            eyebrow="Quick Checks"
            title="수동 확인 포인트"
            description="첫 검증에서 꼭 확인해야 하는 행동 기준입니다."
          />
          <div className="grid gap-3 lg:grid-cols-2">
            <CheckItem title="로그인 후 `/dashboard` 에서 사용자명이 보여야 합니다." done={Boolean(user)} />
            <CheckItem title="팀 생성 후 팀 상세 페이지로 이동해야 합니다." done={Boolean(team)} />
            <CheckItem title="초대 링크 생성 후 `/join/{token}` 경로가 열려야 합니다." />
            <CheckItem title="합류 후 팀 상세의 멤버 수가 증가해야 합니다." />
            <CheckItem title="매칭 등록 후 팀 페이지에 OPEN 상태 글이 보여야 합니다." />
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
