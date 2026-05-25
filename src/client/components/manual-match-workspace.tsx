import {
  CheckCircle2,
  Clock,
  Handshake,
  Inbox,
  Send,
  Undo2,
  XCircle,
} from "lucide-react";
import { EmptyState } from "@/client/components/empty-state";
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
import type { MatchPostView, TeamView } from "@/shared/domain";
import type {
  ManualMatchCandidateView,
  ManualMatchContextView,
  ManualMatchProposalContextView,
  ManualMatchWorkspaceView,
} from "@/shared/contracts/team";

type ManualMatchWorkspaceProps = {
  team: TeamView;
  matchPosts: MatchPostView[];
  manualMatch: ManualMatchWorkspaceView;
  returnTo: string;
};

function formatDateTime(value?: string): string {
  if (!value) return "시간 미정";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatTierRange(post: MatchPostView): string {
  if (!post.minTier && !post.maxTier) return "티어 제한 없음";
  return `${post.minTier ?? "제한 없음"} - ${post.maxTier ?? "제한 없음"}`;
}

function proposalStatusLabel(status: string): string {
  if (status === "PENDING") return "대기 중";
  if (status === "ACCEPTED") return "수락됨";
  if (status === "REJECTED") return "거절됨";
  if (status === "WITHDRAWN") return "철회됨";
  return status;
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "PENDING") return "outline";
  if (status === "ACCEPTED" || status === "OPEN") return "default";
  if (status === "REJECTED" || status === "WITHDRAWN" || status === "CLOSED") {
    return "destructive";
  }
  return "secondary";
}

function HiddenFormFields({
  returnTo,
  teamId,
  postId,
}: {
  returnTo: string;
  teamId?: string;
  postId?: string;
}) {
  return (
    <>
      <input type="hidden" name="returnTo" value={returnTo} />
      {teamId ? <input type="hidden" name="teamId" value={teamId} /> : null}
      {postId ? <input type="hidden" name="postId" value={postId} /> : null}
    </>
  );
}

function CandidateCard({
  candidate,
  canPropose,
  teamId,
  returnTo,
}: {
  candidate: ManualMatchCandidateView;
  canPropose: boolean;
  teamId: string;
  returnTo: string;
}) {
  const disabled = !canPropose || candidate.hasPendingProposal;

  return (
    <div
      className="rounded-[1.5rem] border border-border/80 bg-background/30 p-5 backdrop-blur-sm"
      data-testid={`manual-match-candidate-${candidate.post.id}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{candidate.team.name}</Badge>
            <Badge variant="outline">{formatTierRange(candidate.post)}</Badge>
            {candidate.hasPendingProposal ? (
              <Badge variant="secondary">신청 완료</Badge>
            ) : null}
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold tracking-[-0.02em]">
              {candidate.post.title}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {candidate.post.description || "설명 없음"}
            </p>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {formatDateTime(candidate.post.availableTime)}
          </p>
        </div>
        <form action="/api/match-proposals" method="post">
          <HiddenFormFields
            returnTo={returnTo}
            teamId={teamId}
            postId={candidate.post.id}
          />
          <Button type="submit" disabled={disabled}>
            <Send />
            {candidate.hasPendingProposal ? "신청 대기 중" : "매칭 신청"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function IncomingProposalCard({
  item,
  returnTo,
}: {
  item: ManualMatchProposalContextView;
  returnTo: string;
}) {
  const isPending = item.proposal.status === "PENDING";

  return (
    <div
      className="rounded-[1.5rem] border border-border/80 bg-background/30 p-5 backdrop-blur-sm"
      data-testid={`manual-match-incoming-${item.proposal.id}`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{item.applicantTeam.name}</Badge>
            <Badge variant={statusVariant(item.proposal.status)}>
              {proposalStatusLabel(item.proposal.status)}
            </Badge>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <p>
              내 모집글:{" "}
              <span className="font-medium text-foreground">
                {item.targetPost.title}
              </span>
            </p>
            <p>
              신청 팀 모집글:{" "}
              <span className="font-medium text-foreground">
                {item.applicantPost?.title ?? "확인 가능한 OPEN 모집글 없음"}
              </span>
            </p>
            <p>시간: {formatDateTime(item.applicantPost?.availableTime)}</p>
          </div>
        </div>
        {isPending ? (
          <div className="flex flex-wrap gap-2">
            <form action={`/api/match-proposals/${item.proposal.id}/accept`} method="post">
              <HiddenFormFields returnTo={returnTo} />
              <Button type="submit">
                <CheckCircle2 />
                수락
              </Button>
            </form>
            <form action={`/api/match-proposals/${item.proposal.id}/reject`} method="post">
              <HiddenFormFields returnTo={returnTo} />
              <Button type="submit" variant="outline">
                <XCircle />
                거절
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OutgoingProposalCard({
  item,
  returnTo,
}: {
  item: ManualMatchProposalContextView;
  returnTo: string;
}) {
  const isPending = item.proposal.status === "PENDING";

  return (
    <div
      className="rounded-[1.5rem] border border-border/80 bg-background/30 p-5 backdrop-blur-sm"
      data-testid={`manual-match-outgoing-${item.proposal.id}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{item.targetTeam.name}</Badge>
            <Badge variant={statusVariant(item.proposal.status)}>
              {proposalStatusLabel(item.proposal.status)}
            </Badge>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <p>
              상대 모집글:{" "}
              <span className="font-medium text-foreground">
                {item.targetPost.title}
              </span>
            </p>
            <p>시간: {formatDateTime(item.targetPost.availableTime)}</p>
          </div>
        </div>
        {isPending ? (
          <form action={`/api/match-proposals/${item.proposal.id}/withdraw`} method="post">
            <HiddenFormFields returnTo={returnTo} />
            <Button type="submit" variant="outline">
              <Undo2 />
              철회
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function ConfirmedMatchCard({
  item,
  team,
}: {
  item: ManualMatchContextView;
  team: TeamView;
}) {
  const isLeftTeam = item.leftTeam.id === team.id;
  const opponentTeam = isLeftTeam ? item.rightTeam : item.leftTeam;
  const ownPost = isLeftTeam ? item.leftPost : item.rightPost;
  const opponentPost = isLeftTeam ? item.rightPost : item.leftPost;

  return (
    <div
      className="rounded-[1.5rem] border border-border/80 bg-background/30 p-5 backdrop-blur-sm"
      data-testid={`manual-match-confirmed-${item.match.id}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">확정</Badge>
            <Badge variant="outline">{opponentTeam.name}</Badge>
          </div>
          <p className="text-lg font-semibold tracking-[-0.02em]">
            {ownPost.title} vs {opponentPost.title}
          </p>
          <p className="text-sm text-muted-foreground">
            확정 시각: {formatDateTime(item.match.confirmedAt)}
          </p>
        </div>
        <Handshake className="size-5 text-primary" />
      </div>
    </div>
  );
}

export function ManualMatchWorkspace({
  team,
  matchPosts,
  manualMatch,
  returnTo,
}: ManualMatchWorkspaceProps) {
  const hasOwnOpenPost = matchPosts.some((post) => post.status === "OPEN");
  const pendingIncoming = manualMatch.incomingProposals.filter(
    (item) => item.proposal.status === "PENDING",
  ).length;
  const pendingOutgoing = manualMatch.outgoingProposals.filter(
    (item) => item.proposal.status === "PENDING",
  ).length;

  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader>
          <SectionHeader
            eyebrow="Manual Matching"
            title="수동 매칭"
            description="상대 팀 모집글에 신청하고, 우리 팀으로 들어온 신청을 수락하거나 거절합니다."
          />
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[1.5rem] border border-border/80 bg-background/30 p-5">
            <p className="text-sm text-muted-foreground">신청 가능한 모집글</p>
            <p className="mt-2 text-2xl font-semibold">
              {manualMatch.candidates.length}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border/80 bg-background/30 p-5">
            <p className="text-sm text-muted-foreground">받은 신청 대기</p>
            <p className="mt-2 text-2xl font-semibold">{pendingIncoming}</p>
          </div>
          <div className="rounded-[1.5rem] border border-border/80 bg-background/30 p-5">
            <p className="text-sm text-muted-foreground">보낸 신청 대기</p>
            <p className="mt-2 text-2xl font-semibold">{pendingOutgoing}</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="size-5" />
              받은 신청
            </CardTitle>
            <CardDescription>
              수락하면 양 팀 모집글이 동시에 마감되고 매칭이 확정됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {manualMatch.incomingProposals.length === 0 ? (
              <EmptyState
                title="아직 받은 매칭 신청이 없습니다."
                description="상대 팀이 우리 모집글에 신청하면 여기에서 확인할 수 있습니다."
              />
            ) : (
              manualMatch.incomingProposals.map((item) => (
                <IncomingProposalCard
                  key={item.proposal.id}
                  item={item}
                  returnTo={returnTo}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="size-5" />
              보낸 신청
            </CardTitle>
            <CardDescription>
              상대 팀이 수락하기 전까지 신청을 철회할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {manualMatch.outgoingProposals.length === 0 ? (
              <EmptyState
                title="아직 보낸 매칭 신청이 없습니다."
                description="아래 모집글 목록에서 원하는 상대 팀에 신청하세요."
              />
            ) : (
              manualMatch.outgoingProposals.map((item) => (
                <OutgoingProposalCard
                  key={item.proposal.id}
                  item={item}
                  returnTo={returnTo}
                />
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Handshake className="size-5" />
            상대 모집글
          </CardTitle>
          <CardDescription>
            우리 팀에 OPEN 모집글이 있어야 다른 팀 모집글에 신청할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!hasOwnOpenPost ? (
            <EmptyState
              title="먼저 우리 팀 모집글을 등록하세요."
              description="신청을 보내려면 우리 팀도 현재 OPEN 상태의 모집글이 필요합니다."
            />
          ) : manualMatch.candidates.length === 0 ? (
            <EmptyState
              title="신청 가능한 상대 모집글이 없습니다."
              description="다른 팀이 OPEN 모집글을 등록하면 여기에 표시됩니다."
            />
          ) : (
            manualMatch.candidates.map((candidate) => (
              <CandidateCard
                key={candidate.post.id}
                candidate={candidate}
                canPropose={hasOwnOpenPost}
                teamId={team.id}
                returnTo={returnTo}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5" />
            확정된 매칭
          </CardTitle>
          <CardDescription>
            수락이 완료된 매칭은 이 목록에 남고 관련 모집글은 CLOSED 상태가 됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {manualMatch.confirmedMatches.length === 0 ? (
            <EmptyState
              title="아직 확정된 매칭이 없습니다."
              description="받은 신청을 수락하면 확정된 매칭이 표시됩니다."
            />
          ) : (
            manualMatch.confirmedMatches.map((item) => (
              <ConfirmedMatchCard key={item.match.id} item={item} team={team} />
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
