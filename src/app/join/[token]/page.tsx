import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/client/components/app-shell";
import { CheckItem } from "@/client/components/check-item";
import { SectionHeader } from "@/client/components/section-header";
import { StatCard } from "@/client/components/stat-card";
import { StatusAlert } from "@/client/components/status-alert";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { getCurrentUser, isSupabaseConfiguredAction } from "@/server/actions/auth";
import { getInviteLinkAction } from "@/server/actions/invite-links";
import { getTeamViewAction } from "@/server/actions/teams";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ joined?: string; error?: string; teamId?: string }>;
};

export default async function JoinTeamPage({ params, searchParams }: Props) {
  const { token } = await params;
  const query = await searchParams;
  const inviteLink = await getInviteLinkAction(token);
  const sessionUser = await getCurrentUser();

  if (!inviteLink) {
    notFound();
  }

  const { team } = await getTeamViewAction(inviteLink.teamId);
  if (!team) {
    notFound();
  }

  return (
    <AppShell>
      <Card>
        <CardContent className="space-y-6 px-6 py-8 lg:px-10">
          <SectionHeader
            eyebrow="Join Team"
            title={team.name}
            description="초대 링크를 받은 사용자가 팀에 합류하는 화면입니다. 현재는 기본 정보만 입력해 멤버 등록과 저장 흐름을 검증합니다."
          />
          <div className="grid gap-3">
            {sessionUser?.id === team.ownerUserId ? (
              <StatusAlert
                title="팀장 계정 접속 중"
                description="같은 초대 링크를 통해 본인 계정도 멤버 흐름을 검증할 수 있습니다."
              />
            ) : null}
            {query.joined ? (
              <StatusAlert
                title="팀 합류 완료"
                tone="success"
                description={
                  <>
                    팀 합류가 완료되었습니다.
                    {query.teamId ? (
                      <>
                        {" "}
                        <Link href={`/teams/${query.teamId}`}>팀 페이지로 이동</Link>
                      </>
                    ) : null}
                  </>
                }
              />
            ) : null}
            {query.error ? (
              <StatusAlert title="합류 오류" tone="destructive" description={query.error} />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Invite Snapshot</CardTitle>
            <CardDescription>합류 전에 확인할 핵심 정보를 요약했습니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="토큰" value={<code className="break-all text-sm">{token}</code>} />
              <StatCard label="팀 이름" value={team.name} />
              <StatCard
                label="링크 상태"
                value={`${inviteLink.status} / ${inviteLink.usedCount}${inviteLink.maxUses ? `/${inviteLink.maxUses}` : ""}`}
              />
              <StatCard
                label="저장소"
                value={isSupabaseConfiguredAction() ? "Supabase" : "In-memory fallback"}
              />
            </div>
            <CheckItem title="초대 링크가 ACTIVE 상태인지 확인합니다." done={inviteLink.status === "ACTIVE"} />
            <CheckItem title="팀 이름과 합류 대상 팀이 일치하는지 확인합니다." done />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>멤버 등록 테스트</CardTitle>
            <CardDescription>
              RSO 승인 전까지는 Riot ID를 직접 입력해 임시 검증으로 처리합니다. 승인 후에는 이 입력을 RSO
              세션으로 교체하면 됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={`/api/invite-links/${token}/join`} method="post" className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="riotId">Riot ID</Label>
                <Input
                  id="riotId"
                  name="riotId"
                  placeholder="Hide on bush#KR1"
                  required
                />
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="submit">팀 합류</Button>
                <Button asChild variant="outline">
                  <Link href="/">홈으로 돌아가기</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
