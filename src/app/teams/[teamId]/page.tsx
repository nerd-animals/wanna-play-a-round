import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink, Link2, Swords, Users } from "lucide-react";
import { AppShell } from "@/client/components/app-shell";
import { CheckItem } from "@/client/components/check-item";
import { EmptyState } from "@/client/components/empty-state";
import { ManualMatchWorkspace } from "@/client/components/manual-match-workspace";
import { SectionHeader } from "@/client/components/section-header";
import { StatCard } from "@/client/components/stat-card";
import { StatusAlert } from "@/client/components/status-alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Separator } from "@/client/components/ui/separator";
import { getTeamView } from "@/server/handlers/team";
import { getCurrentUser } from "@/server/session";

type Props = {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{
    error?: string;
    inviteCreated?: string;
    matchCreated?: string;
    proposalSent?: string;
    proposalRejected?: string;
    proposalWithdrawn?: string;
    matchConfirmed?: string;
  }>;
};

function formatMemberName(name?: string): string {
  return name || "이름 미입력";
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACTIVE" || status === "OPEN") {
    return "default";
  }

  if (status === "OWNER") {
    return "secondary";
  }

  if (status === "DISABLED" || status === "EXPIRED" || status === "CANCELLED") {
    return "destructive";
  }

  return "outline";
}

export default async function TeamDetailPage({ params, searchParams }: Props) {
  const user = await getCurrentUser();
  const { teamId } = await params;
  const query = await searchParams;

  if (!user) {
    redirect("/");
  }

  const result = await getTeamView({ teamId });
  if (!result.ok) {
    notFound();
  }
  const { team, members, inviteLinks, matchPosts, manualMatch } = result.data;

  if (team.ownerUserId !== user.id) {
    redirect("/dashboard");
  }

  const activeInvite = inviteLinks.find((link) => link.status === "ACTIVE");
  const hasOpenMatch = matchPosts.some((post) => post.status === "OPEN");
  const activeMembers = members.filter((member) => member.status === "ACTIVE");

  return (
    <AppShell>
      <Card>
        <CardContent className="space-y-8 px-6 py-8 lg:px-10 lg:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <Badge>Team Management</Badge>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{team.name}</h1>
                <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                  {team.description || "팀 소개가 아직 없습니다."}
                </p>
              </div>
            </div>
            <Button asChild size="lg">
              <Link href={`/teams/${team.id}/matches/new`}>매칭 등록</Link>
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <StatCard
              label="활동 시간"
              value={team.activityTime || "미정"}
              hint="운영 기준 시간을 입력하면 상대 팀과의 커뮤니케이션이 쉬워집니다."
            />
            <StatCard
              label="멤버 상태"
              value={`${activeMembers.length}명 활성 / ${members.length}명 전체`}
              hint="ACTIVE 멤버가 있어야 실제 매칭 운영 의미가 생깁니다."
            />
            <StatCard
              label="매칭 상태"
              value={hasOpenMatch ? "OPEN 게시글 있음" : "대기"}
              hint={hasOpenMatch ? "현재 공개된 매칭이 있습니다." : "아직 등록한 OPEN 매칭이 없습니다."}
            />
          </div>

          <div className="grid gap-3">
            {query.error ? (
              <StatusAlert title="작업 오류" tone="destructive" description={query.error} />
            ) : null}
            {query.inviteCreated ? (
              <StatusAlert title="초대 링크 생성 완료" tone="success" description="새 초대 링크를 만들었습니다." />
            ) : null}
            {query.matchCreated ? (
              <StatusAlert title="매칭 등록 완료" tone="success" description="새 매칭 글을 등록했습니다." />
            ) : null}
            {query.proposalSent ? (
              <StatusAlert title="매칭 신청 완료" tone="success" description="상대 팀 owner가 수락하면 매칭이 확정됩니다." />
            ) : null}
            {query.proposalRejected ? (
              <StatusAlert title="신청 거절 완료" tone="success" description="해당 매칭 신청을 거절했습니다." />
            ) : null}
            {query.proposalWithdrawn ? (
              <StatusAlert title="신청 철회 완료" tone="success" description="보낸 매칭 신청을 철회했습니다." />
            ) : null}
            {query.matchConfirmed ? (
              <StatusAlert title="매칭 확정 완료" tone="success" description="양 팀 모집글이 CLOSED 상태로 마감됐습니다." />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 px-6 py-6">
          <SectionHeader
            eyebrow="Status"
            title="현재 목표 기준 진행 상태"
            description="팀 운영 흐름이 어디까지 완료됐는지 빠르게 스캔할 수 있도록 정리했습니다."
          />
          <div className="grid gap-3 lg:grid-cols-3">
            <CheckItem title="초대 링크 생성" description="팀 합류용 링크 발급" done={inviteLinks.length > 0} />
            <CheckItem title="팀 멤버 활성화" description="멤버 ACTIVE 상태 확인" done={activeMembers.length > 0} />
            <CheckItem title="매칭 등록" description="OPEN 상태의 스크림 글 등록" done={hasOpenMatch} />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <SectionHeader
              eyebrow="Invite Links"
              title="공유 가능한 팀 합류 링크"
              description="링크를 발급하고 사용량과 상태를 함께 추적합니다."
              action={
                activeInvite ? (
                  <Button asChild variant="outline">
                    <Link href={`/join/${activeInvite.token}`}>
                      현재 링크 열기
                      <ExternalLink />
                    </Link>
                  </Button>
                ) : null
              }
            />
          </CardHeader>
          <CardContent className="space-y-6">
            <form action={`/api/teams/${team.id}/invite-links`} method="post" className="grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="maxUses">최대 사용 횟수</Label>
                  <Input id="maxUses" name="maxUses" type="number" min="1" placeholder="비워두면 무제한" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expiresAt">만료 시각</Label>
                  <Input id="expiresAt" name="expiresAt" type="datetime-local" />
                </div>
              </div>
              <Button type="submit" className="w-full sm:w-fit">
                <Link2 />
                초대 링크 생성
              </Button>
            </form>

            <Separator />

            <div className="grid gap-3">
              {inviteLinks.length === 0 ? (
                <EmptyState title="아직 생성한 링크가 없습니다." description="첫 링크를 발급하면 이 패널에 상태와 사용량이 누적됩니다." />
              ) : (
                inviteLinks.map((link) => (
                  <div
                    key={link.id}
                    className="rounded-[1.5rem] border border-border/80 bg-background/30 p-5 backdrop-blur-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={statusVariant(link.status)}>{link.status}</Badge>
                          <span className="text-sm text-muted-foreground">
                            사용 {link.usedCount}
                            {link.maxUses ? ` / ${link.maxUses}` : ""}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-foreground">/join/{link.token}</p>
                        <code className="block break-all text-xs text-muted-foreground">{link.token}</code>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/join/${link.token}`}>링크 열기</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              현재 팀 구성
            </CardTitle>
            <CardDescription>팀장과 팀원의 상태를 한 번에 확인할 수 있는 roster 패널입니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-3 rounded-[1.5rem] border border-border/80 bg-background/30 p-5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-semibold tracking-[-0.02em] text-foreground">{formatMemberName(member.displayName)}</p>
                  <p className="text-sm text-muted-foreground">
                    {member.role === "OWNER" ? "팀장" : "팀원"} / {member.status}
                  </p>
                  {member.riotGameName && member.riotTagLine ? (
                    <p className="text-sm text-muted-foreground">
                      Riot {member.riotGameName}#{member.riotTagLine}
                      {member.soloTier ? ` / ${member.soloTier}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariant(member.role)}>{member.role}</Badge>
                  <Badge variant={statusVariant(member.status)}>{member.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <ManualMatchWorkspace
        team={team}
        matchPosts={matchPosts}
        manualMatch={manualMatch}
        returnTo={`/teams/${team.id}`}
      />

      <Card>
        <CardHeader>
          <SectionHeader
            eyebrow="Matches"
            title="등록된 스크림 모집"
            description="현재 팀이 공개 중인 매칭과 과거 기록을 이 패널에서 확인합니다."
            action={
              <Button asChild>
                <Link href={`/teams/${team.id}/matches/new`}>
                  <Swords />
                  매칭 등록
                </Link>
              </Button>
            }
          />
        </CardHeader>
        <CardContent className="grid gap-3">
          {matchPosts.length === 0 ? (
            <EmptyState title="아직 등록한 매칭 글이 없습니다." description="OPEN 상태의 모집 글을 등록하면 이곳에서 바로 확인할 수 있습니다." />
          ) : (
            matchPosts.map((post) => (
              <div
                key={post.id}
                className="rounded-[1.5rem] border border-border/80 bg-background/30 p-5 backdrop-blur-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(post.status)}>{post.status}</Badge>
                      {(post.minTier || post.maxTier) && (
                        <Badge variant="outline">
                          {post.minTier || "?"} - {post.maxTier || "?"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-lg font-semibold tracking-[-0.03em] text-foreground">{post.title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{post.description || "설명 없음"}</p>
                  </div>
                  {post.availableTime ? (
                    <p className="text-sm text-muted-foreground">가능 시간 {post.availableTime}</p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
