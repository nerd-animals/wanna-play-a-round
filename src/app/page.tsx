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
    title: "팀장 로그인",
    description: "디스코드 계정으로 팀 운영 권한을 확인합니다.",
  },
  {
    title: "팀 생성",
    description: "팀 이름, 소개, 활동 시간을 등록합니다.",
  },
  {
    title: "초대 링크 발급",
    description: "팀원에게 공유할 합류 링크를 만듭니다.",
  },
  {
    title: "상대 팀 신청",
    description: "모집글을 올리고 조건이 맞는 팀에 신청합니다.",
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
            <Badge>ScrimFinder</Badge>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold text-balance sm:text-5xl lg:text-6xl">
                스크림을 잡기 위한 팀 등록, 모집, 신청 흐름을 한 곳에서 처리합니다.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                디스코드로 팀장을 확인하고, 5인 로스터를 만든 뒤, 조건이 맞는 상대 팀 모집글에 수동
                매칭 신청을 보낼 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {user ? (
                <Button asChild size="lg">
                  <Link href={team ? "/matches" : "/dashboard"}>
                    {team ? "매칭 탐색" : "운영 홈"}
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
                description="디스코드 로그인 후 팀을 만들고 스크림 모집을 시작할 수 있습니다."
              />
            )}
          </div>

          <div className="grid gap-4 self-start">
            <StatCard
              label="현재 상태"
              value={user ? (team ? "매칭 준비 중" : "팀 생성 대기") : "로그인 필요"}
              hint={user ? "운영 홈에서 다음 행동을 확인할 수 있습니다." : "디스코드 로그인이 필요합니다."}
            />
            <StatCard
              label="핵심 흐름"
              value="Roster + Match"
              hint="5인 로스터와 OPEN 모집글이 신청 조건입니다."
            />
            <StatCard
              label="매칭 방식"
              value="Manual"
              hint="상대 팀장이 수락하면 매칭이 확정됩니다."
            />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>시작 순서</CardTitle>
            <CardDescription>팀장이 처음 들어왔을 때 이어가면 되는 기본 흐름입니다.</CardDescription>
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
            <CardTitle>현재 가능한 일</CardTitle>
            <CardDescription>자동 매칭보다 수동 매칭 흐름을 먼저 안정화합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="인증" value={<ShieldCheck className="size-5" />} hint="Discord OAuth 기반" />
              <StatCard label="팀 운영" value={<Users className="size-5" />} hint="팀 생성, 멤버 합류" />
              <StatCard label="스크림" value={<Swords className="size-5" />} hint="모집글 탐색, 신청, 수락" />
            </div>
            <Separator />
            <p className="text-sm leading-7 text-muted-foreground">
              지금은 팀장이 직접 모집글을 보고 신청하거나 수락하는 흐름에 집중합니다. 자동 매칭은
              수동 매칭 사용감이 충분히 안정된 뒤 붙이는 것이 맞습니다.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="space-y-6 px-6 py-6">
          <SectionHeader
            eyebrow="Quick Checks"
            title="사용자 관점 체크"
            description="처음 사용하는 팀장이 화면에서 확인해야 하는 핵심 상태입니다."
          />
          <div className="grid gap-3 lg:grid-cols-2">
            <CheckItem title="운영 홈에서 다음 행동이 바로 보여야 합니다." done={Boolean(user)} />
            <CheckItem title="팀 생성 후 팀 관리 화면에서 초대 링크를 만들 수 있어야 합니다." done={Boolean(team)} />
            <CheckItem title="팀원이 링크로 합류하면 로스터 수가 증가해야 합니다." />
            <CheckItem title="로스터 5명이 되면 모집글을 등록할 수 있어야 합니다." />
            <CheckItem title="매칭 탐색에서 상대 팀을 찾고 신청할 수 있어야 합니다." />
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
