import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/client/components/app-shell";
import { CheckItem } from "@/client/components/check-item";
import { MatchPostForm } from "@/client/components/match-post-form";
import { StatusAlert } from "@/client/components/status-alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { getTeamView } from "@/server/handlers/team";
import { getCurrentUser } from "@/server/session";

type Props = {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ error?: string }>;
};

const TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;

export default async function NewMatchPage({ params, searchParams }: Props) {
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
  const { team } = result.data;

  if (team.ownerUserId !== user.id) {
    redirect("/dashboard");
  }

  return (
    <AppShell>
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl sm:text-4xl">{team.name} 스크림 모집 글 등록</CardTitle>
            <CardDescription>
              현재 단계에서는 팀장 권한과 기본 팀 구성이 있으면 매칭 글을 등록할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {query.error ? (
              <StatusAlert title="매칭 등록 오류" tone="destructive" description={query.error} />
            ) : null}
            <MatchPostForm
              action={`/api/teams/${team.id}/matches`}
              cancelHref={`/teams/${team.id}`}
              tiers={TIERS}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>등록 후 확인할 것</CardTitle>
            <CardDescription>매칭 등록이 성공하면 아래 상태가 팀 상세 화면에 반영되어야 합니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <CheckItem title="등록 성공 후 팀 상세 페이지에 OPEN 상태 글이 보여야 합니다." />
            <CheckItem title="같은 팀에서는 동시에 하나의 OPEN 글만 유지되어야 합니다." />
            <CheckItem title="팀장 권한이 없는 계정은 접근할 수 없어야 합니다." done />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
