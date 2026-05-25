import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Inbox,
  LogOut,
  Plus,
  Send,
  Swords,
  UserPlus,
  Users,
} from "lucide-react";
import { AppShell } from "@/client/components/app-shell";
import { CheckItem } from "@/client/components/check-item";
import { SectionHeader } from "@/client/components/section-header";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { _getMyTeams, getTeamView } from "@/server/handlers/team";
import { getCurrentUser } from "@/server/session";

type NextAction = {
  title: string;
  description: string;
  href: string;
  label: string;
  kind: "team" | "roster" | "post" | "incoming" | "discover";
};

function ActionIcon({ kind }: { kind: NextAction["kind"] }) {
  if (kind === "team") return <Plus />;
  if (kind === "roster") return <UserPlus />;
  if (kind === "post") return <Swords />;
  if (kind === "incoming") return <Inbox />;
  return <Send />;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const teamsResult = await _getMyTeams({}, { actor: user });
  const team = teamsResult.ok ? (teamsResult.data[0] ?? null) : null;
  const teamViewResult = team ? await getTeamView({ teamId: team.id }) : null;
  const teamView = teamViewResult?.ok ? teamViewResult.data : null;
  const activeMembers = teamView?.members.filter((member) => member.status === "ACTIVE") ?? [];
  const openPost = teamView?.matchPosts.find((post) => post.status === "OPEN") ?? null;
  const pendingIncoming =
    teamView?.manualMatch.incomingProposals.filter((item) => item.proposal.status === "PENDING").length ?? 0;
  const pendingOutgoing =
    teamView?.manualMatch.outgoingProposals.filter((item) => item.proposal.status === "PENDING").length ?? 0;
  const confirmedMatches = teamView?.manualMatch.confirmedMatches.length ?? 0;

  const nextAction: NextAction = !team
    ? {
        title: "팀을 먼저 만드세요",
        description: "팀이 있어야 초대 링크, 로스터, 모집글, 매칭 신청을 이어갈 수 있습니다.",
        href: "/teams/new",
        label: "팀 만들기",
        kind: "team",
      }
    : activeMembers.length !== 5
      ? {
          title: "로스터를 5명으로 맞추세요",
          description: "수동 매칭 신청과 모집글 등록은 ACTIVE 멤버가 정확히 5명일 때 진행됩니다.",
          href: `/teams/${team.id}`,
          label: "팀원 초대하기",
          kind: "roster",
        }
      : !openPost
        ? {
            title: "내 팀 모집글을 등록하세요",
            description: "상대 팀에 신청하려면 먼저 내 팀의 OPEN 모집글이 필요합니다.",
            href: `/teams/${team.id}/matches/new`,
            label: "모집글 등록",
            kind: "post",
          }
        : pendingIncoming > 0
          ? {
              title: "받은 신청을 확인하세요",
              description: "상대 팀 신청을 수락하면 양쪽 모집글이 닫히고 매칭이 확정됩니다.",
              href: `/teams/${team.id}`,
              label: "받은 신청 보기",
              kind: "incoming",
            }
          : {
              title: "상대 팀을 찾아 신청하세요",
              description: "조건이 맞는 모집글을 필터로 찾고 수동 매칭 신청을 보낼 수 있습니다.",
              href: "/matches",
              label: "매칭 찾기",
              kind: "discover",
            };

  return (
    <AppShell>
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <Card className="overflow-hidden">
          <CardContent className="space-y-7 px-6 py-8 lg:px-10 lg:py-10">
            <div className="space-y-4">
              <Badge>운영 홈</Badge>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">로그인: {user.username}</p>
                <h1 className="max-w-3xl text-4xl font-semibold text-balance sm:text-5xl">
                  다음 행동: {nextAction.title}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  {nextAction.description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={nextAction.href}>
                  <ActionIcon kind={nextAction.kind} />
                  {nextAction.label}
                </Link>
              </Button>
              {team ? (
                <Button asChild variant="outline" size="lg">
                  <Link href="/matches">
                    매칭 탐색
                    <ArrowRight />
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>현재 상태</CardTitle>
            <CardDescription>오늘 바로 움직일 수 있는 운영 신호만 모았습니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-lg border border-border/80 bg-background/35 p-4">
              <p className="text-sm text-muted-foreground">팀</p>
              <p className="mt-2 text-lg font-semibold">{team?.name ?? "아직 없음"}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/35 p-4">
              <p className="text-sm text-muted-foreground">ACTIVE 로스터</p>
              <p className="mt-2 text-lg font-semibold">{activeMembers.length} / 5명</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/35 p-4">
              <p className="text-sm text-muted-foreground">OPEN 모집글</p>
              <p className="mt-2 text-lg font-semibold">{openPost ? openPost.title : "없음"}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              팀 준비
            </CardTitle>
            <CardDescription>신청 가능한 상태까지 필요한 준비 단계입니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <CheckItem
              title="팀 생성"
              description={team ? team.name : "팀장이 먼저 팀을 생성해야 합니다."}
              done={Boolean(team)}
            />
            <CheckItem
              title="로스터 5명"
              description={`현재 ACTIVE ${activeMembers.length}명`}
              done={activeMembers.length === 5}
            />
            <CheckItem
              title="OPEN 모집글"
              description={openPost ? openPost.title : "내 팀 모집글이 있어야 신청을 보낼 수 있습니다."}
              done={Boolean(openPost)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionHeader
              eyebrow="Manual Matching"
              title="수동 매칭 진행"
              description="받은 신청, 보낸 신청, 확정 결과를 팀 상세에서 처리합니다."
            />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border/80 bg-background/35 p-4">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Inbox className="size-4" />
                받은 신청
              </p>
              <p className="mt-3 text-2xl font-semibold">{pendingIncoming}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/35 p-4">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Send className="size-4" />
                보낸 신청
              </p>
              <p className="mt-3 text-2xl font-semibold">{pendingOutgoing}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/35 p-4">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4" />
                확정 매칭
              </p>
              <p className="mt-3 text-2xl font-semibold">{confirmedMatches}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-semibold">계정 관리</p>
            <p className="text-sm text-muted-foreground">
              로그아웃하거나 테스트 계정 데이터를 삭제할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <form action="/api/auth/logout" method="post">
              <Button variant="outline" type="submit">
                <LogOut />
                로그아웃
              </Button>
            </form>
            <form action="/api/auth/account" method="post">
              <Button
                className="border-red-500/50 text-red-200 hover:bg-red-500/10"
                variant="outline"
                type="submit"
              >
                계정 삭제
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
