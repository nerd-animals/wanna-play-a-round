import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, LogOut, Shield, Users } from "lucide-react";
import { AppShell } from "@/client/components/app-shell";
import { CheckItem } from "@/client/components/check-item";
import { StatCard } from "@/client/components/stat-card";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { _getMyTeams } from "@/server/handlers/team";
import { getCurrentUser } from "@/server/session";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const teamsResult = await _getMyTeams({}, { actor: user });
  const team = teamsResult.ok ? (teamsResult.data[0] ?? null) : null;

  return (
    <AppShell>
      <Card>
        <CardContent className="space-y-8 px-6 py-8 lg:px-10 lg:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <Badge>Owner Dashboard</Badge>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{user.username}</h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  Discord 로그인으로 팀장을 식별하고 팀 생성, 초대 링크, 매칭 등록 흐름을 순서대로
                  검증하는 운영 대시보드입니다.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {team ? (
                <>
                  <Button asChild size="lg">
                    <Link href={`/teams/${team.id}`}>팀 관리로 이동</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href={`/teams/${team.id}/matches/new`}>매칭 등록</Link>
                  </Button>
                </>
              ) : (
                <Button asChild size="lg">
                  <Link href="/teams/new">팀 생성 시작</Link>
                </Button>
              )}
              <form action="/api/auth/logout" method="post">
                <Button variant="ghost" size="lg" type="submit">
                  <LogOut />
                  로그아웃
                </Button>
              </form>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <StatCard label="User ID" value={user.id} hint="세션을 식별하는 기본 키" />
            <StatCard
              label="팀 상태"
              value={team ? "생성 완료" : "아직 없음"}
              hint={team ? `${team.name} 운영 중` : "먼저 팀을 생성해야 다음 단계가 열립니다."}
            />
            <StatCard
              label="운영 흐름"
              value={team ? "Invite / Match Ready" : "Team Setup"}
              hint="팀이 있으면 초대 링크와 매칭 등록을 바로 테스트할 수 있습니다."
            />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>현재 확인할 것</CardTitle>
            <CardDescription>Owner 권한에서 제일 먼저 깨져야 하는 지점을 모아 둔 체크 패널입니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <CheckItem title="Discord 계정과 현재 사용자명이 일치하는지 확인합니다." done />
            <CheckItem title="팀이 없으면 생성 버튼만 보여야 합니다." done={!team} />
            <CheckItem title="팀이 있으면 팀 관리와 매칭 등록 버튼이 보여야 합니다." done={Boolean(team)} />
            <CheckItem title="로그아웃 후 홈으로 돌아가는지 확인합니다." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner Snapshot</CardTitle>
            <CardDescription>현재 세션에서 무엇이 가능한지 한눈에 읽히도록 정리했습니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <StatCard label="인증" value={<Shield className="size-5" />} hint="Discord 세션 활성" />
            <StatCard
              label="팀 운영"
              value={<Users className="size-5" />}
              hint={team ? "팀 상세 화면 접근 가능" : "팀 생성 필요"}
            />
            <StatCard
              label="매치 플로우"
              value={<Activity className="size-5" />}
              hint={team ? "매칭 등록 페이지 진입 가능" : "팀 생성 후 사용 가능"}
            />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
