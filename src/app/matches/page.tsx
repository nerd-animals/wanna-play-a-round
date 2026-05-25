import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  Search,
  Send,
  Swords,
  Users,
} from "lucide-react";
import { AppShell } from "@/client/components/app-shell";
import { EmptyState } from "@/client/components/empty-state";
import { SectionHeader } from "@/client/components/section-header";
import { StatusAlert } from "@/client/components/status-alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { getMatchDiscoveryView } from "@/server/handlers/match-discovery";
import { getCurrentUser } from "@/server/session";
import type {
  MatchDiscoveryItem,
  MatchDiscoveryTimeFilter,
} from "@/shared/contracts/match-discovery";
import type { LolTier, MatchPostView, TeamView } from "@/shared/domain";

type Props = {
  searchParams: Promise<{
    q?: string;
    tier?: string;
    time?: string;
    proposalSent?: string;
    error?: string;
  }>;
};

const tierOptions: Array<{ value: LolTier; label: string }> = [
  { value: "IRON", label: "Iron" },
  { value: "BRONZE", label: "Bronze" },
  { value: "SILVER", label: "Silver" },
  { value: "GOLD", label: "Gold" },
  { value: "PLATINUM", label: "Platinum" },
  { value: "EMERALD", label: "Emerald" },
  { value: "DIAMOND", label: "Diamond" },
  { value: "MASTER", label: "Master" },
  { value: "GRANDMASTER", label: "Grandmaster" },
  { value: "CHALLENGER", label: "Challenger" },
];

const timeOptions: Array<{ value: MatchDiscoveryTimeFilter; label: string }> = [
  { value: "ALL", label: "모든 일정" },
  { value: "TODAY", label: "오늘" },
  { value: "THIS_WEEK", label: "7일 이내" },
];

const selectClassName =
  "h-12 w-full rounded-lg border border-input/90 bg-background/50 px-4 py-3 text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] focus-visible:border-primary/70 focus-visible:ring-4 focus-visible:ring-ring/20";

function asTier(value?: string): LolTier | undefined {
  return tierOptions.some((option) => option.value === value)
    ? (value as LolTier)
    : undefined;
}

function asTime(value?: string): MatchDiscoveryTimeFilter {
  return timeOptions.some((option) => option.value === value)
    ? (value as MatchDiscoveryTimeFilter)
    : "ALL";
}

function formatDateTime(value?: string): string {
  if (!value) return "시간 협의";

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

function currentReturnTo(filters: {
  q?: string;
  tier?: LolTier;
  time?: MatchDiscoveryTimeFilter;
}): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.tier) params.set("tier", filters.tier);
  if (filters.time && filters.time !== "ALL") params.set("time", filters.time);

  const query = params.toString();
  return query ? `/matches?${query}` : "/matches";
}

function MatchAction({
  item,
  myTeam,
  myActiveMemberCount,
  myOpenPost,
  returnTo,
}: {
  item: MatchDiscoveryItem;
  myTeam?: TeamView;
  myActiveMemberCount: number;
  myOpenPost?: MatchPostView;
  returnTo: string;
}) {
  if (!myTeam) {
    return (
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link href="/teams/new">
          팀 만들기
          <ArrowRight />
        </Link>
      </Button>
    );
  }

  if (myActiveMemberCount !== 5) {
    return (
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link href={`/teams/${myTeam.id}`}>
          로스터 확인
          <Users />
        </Link>
      </Button>
    );
  }

  if (!myOpenPost) {
    return (
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link href={`/teams/${myTeam.id}/matches/new`}>
          모집글 등록
          <Swords />
        </Link>
      </Button>
    );
  }

  if (item.hasPendingProposal) {
    return (
      <Button disabled className="w-full sm:w-auto">
        <CheckCircle2 />
        신청 대기 중
      </Button>
    );
  }

  return (
    <form action="/api/match-proposals" method="post" className="w-full sm:w-auto">
      <input type="hidden" name="teamId" value={myTeam.id} />
      <input type="hidden" name="postId" value={item.post.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Button type="submit" className="w-full sm:w-auto" data-testid={`match-discovery-propose-${item.post.id}`}>
        <Send />
        매칭 신청
      </Button>
    </form>
  );
}

export default async function MatchesPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const query = await searchParams;

  if (!user) {
    redirect("/");
  }

  const filters = {
    q: query.q,
    tier: asTier(query.tier),
    time: asTime(query.time),
  };
  const view = await getMatchDiscoveryView(filters, { actor: user });
  const returnTo = currentReturnTo(view.filters);
  const canApply = Boolean(view.myTeam && view.myActiveMemberCount === 5 && view.myOpenPost);

  return (
    <AppShell>
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <Card className="overflow-hidden">
          <CardContent className="space-y-6 px-6 py-8 lg:px-10 lg:py-10">
            <div className="space-y-4">
              <Badge>매칭 탐색</Badge>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-semibold text-balance sm:text-5xl">
                  조건이 맞는 상대 팀을 찾고 바로 신청하세요.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  내 팀의 OPEN 모집글을 기준으로 상대 팀 모집글에 신청합니다. 상대 팀장이 수락하면 양쪽
                  모집글이 닫히고 매칭이 확정됩니다.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {view.myTeam ? (
                <Button asChild size="lg">
                  <Link href={`/teams/${view.myTeam.id}/matches/new`}>
                    모집글 등록
                    <Swords />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link href="/teams/new">
                    팀 만들기
                    <Users />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <Link href="/dashboard">운영 홈</Link>
              </Button>
            </div>

            <div className="grid gap-3">
              {query.proposalSent ? (
                <StatusAlert
                  title="매칭 신청 완료"
                  tone="success"
                  description="상대 팀장이 받은 신청을 수락하면 매칭이 확정됩니다."
                />
              ) : null}
              {query.error ? (
                <StatusAlert
                  title="매칭 신청 실패"
                  tone="destructive"
                  description={query.error}
                />
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>신청 준비 상태</CardTitle>
            <CardDescription>
              수동 매칭 신청 전 필요한 조건을 실제 사용자 행동 기준으로 정리했습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-lg border border-border/80 bg-background/35 p-4">
              <p className="text-sm text-muted-foreground">내 팀</p>
              <p className="mt-2 text-lg font-semibold">
                {view.myTeam ? view.myTeam.name : "팀 없음"}
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/35 p-4">
              <p className="text-sm text-muted-foreground">로스터</p>
              <p className="mt-2 text-lg font-semibold">
                {view.myActiveMemberCount} / 5명
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/35 p-4">
              <p className="text-sm text-muted-foreground">내 모집글</p>
              <p className="mt-2 text-lg font-semibold">
                {view.myOpenPost ? view.myOpenPost.title : "OPEN 모집글 없음"}
              </p>
            </div>
            <Badge variant={canApply ? "default" : "outline"} className="w-fit">
              {canApply ? "신청 가능" : "준비 필요"}
            </Badge>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <SectionHeader
            eyebrow="Filters"
            title="모집글 찾기"
            description="팀명, 제목, 설명, 티어 범위, 일정으로 원하는 상대를 좁힙니다."
          />
        </CardHeader>
        <CardContent>
          <form action="/matches" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-11"
                name="q"
                defaultValue={view.filters.q ?? ""}
                placeholder="팀명, 제목, 설명 검색"
              />
            </div>
            <select className={selectClassName} name="tier" defaultValue={view.filters.tier ?? ""}>
              <option value="">모든 티어</option>
              {tierOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select className={selectClassName} name="time" defaultValue={view.filters.time ?? "ALL"}>
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button type="submit" className="h-12">
              <Filter />
              적용
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">검색 결과</p>
            <h2 className="text-2xl font-semibold">{view.items.length}개 모집글</h2>
          </div>
          <Button asChild variant="outline">
            <Link href="/matches">필터 초기화</Link>
          </Button>
        </div>

        {view.items.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                title="조건에 맞는 모집글이 없습니다."
                description="필터를 줄이거나, 디스코드에서 상대 팀에게 먼저 모집글 등록을 요청해보세요."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {view.items.map((item) => (
              <Card key={item.post.id} data-testid={`match-discovery-card-${item.post.id}`}>
                <CardContent className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{item.team.name}</Badge>
                      <Badge variant="outline">{formatTierRange(item.post)}</Badge>
                      <Badge variant="outline">{item.averageTierLabel}</Badge>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold">{item.post.title}</h3>
                      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                        {item.post.description || "설명 없음"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Clock3 className="size-4" />
                        {formatDateTime(item.post.availableTime)}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Users className="size-4" />
                        {item.activeMemberCount}명 활성
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="size-4" />
                        {item.team.activityTime || "활동 시간 미입력"}
                      </span>
                    </div>
                  </div>
                  <MatchAction
                    item={item}
                    myTeam={view.myTeam}
                    myActiveMemberCount={view.myActiveMemberCount}
                    myOpenPost={view.myOpenPost}
                    returnTo={returnTo}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
