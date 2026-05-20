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
import { isSupabaseConfigured } from "@/server/db/client";
import { getInviteLink } from "@/server/handlers/invite";
import { getTeamView } from "@/server/handlers/team";
import { getCurrentUser } from "@/server/session";
import type { LolTier } from "@/shared/domain";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ joined?: string; error?: string; teamId?: string }>;
};

const soloTiers: LolTier[] = [
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
];

export default async function JoinTeamPage({ params, searchParams }: Props) {
  const { token } = await params;
  const query = await searchParams;
  const sessionUser = await getCurrentUser();

  if (!sessionUser) {
    return (
      <AppShell>
        <Card>
          <CardContent className="space-y-6 px-6 py-8 lg:px-10">
            <SectionHeader
              eyebrow="Join Team"
              title="Discord 로그인이 필요합니다"
              description="초대 링크로 팀에 합류하려면 먼저 Discord 계정으로 로그인해 팀 멤버십을 검증해야 합니다."
            />
            <div className="grid gap-3">
              <StatusAlert
                title="세션 없음"
                description="로그인 후 같은 초대 링크로 돌아와 팀 합류를 계속 진행하세요."
              />
              <StatCard label="초대 토큰" value={<code className="break-all text-sm">{token}</code>} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href="/api/auth/discord/login">디스코드 로그인 시작</a>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">홈으로 돌아가기</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const linkResult = await getInviteLink({ token });
  if (!linkResult.ok || !linkResult.data) {
    notFound();
  }
  const inviteLink = linkResult.data;

  const viewResult = await getTeamView({ teamId: inviteLink.teamId });
  if (!viewResult.ok) {
    notFound();
  }
  const { team } = viewResult.data;

  return (
    <AppShell>
      <Card>
        <CardContent className="space-y-6 px-6 py-8 lg:px-10">
          <SectionHeader
            eyebrow="Join Team"
            title={team.name}
            description="초대 링크를 받은 사용자가 Discord 로그인 후 Riot 자기 신고 정보를 제출해 팀에 합류하는 화면입니다."
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
                value={isSupabaseConfigured() ? "Supabase" : "환경변수 미설정"}
              />
            </div>
            <CheckItem title="초대 링크가 ACTIVE 상태인지 확인합니다." done={inviteLink.status === "ACTIVE"} />
            <CheckItem title="팀 이름과 합류 대상 팀이 일치하는지 확인합니다." done />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riot 프로필 신고</CardTitle>
            <CardDescription>
              게임명, 태그라인, 솔로 랭크 티어를 입력해야 팀 멤버로 등록할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={`/api/invite-links/${token}/join`} method="post" className="grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="riotGameName">Riot 게임명</Label>
                  <Input
                    id="riotGameName"
                    name="riotGameName"
                    placeholder="Hide on bush"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="riotTagLine">태그라인</Label>
                  <Input
                    id="riotTagLine"
                    name="riotTagLine"
                    placeholder="KR1"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="soloTier">솔로 랭크 티어</Label>
                <select
                  id="soloTier"
                  name="soloTier"
                  defaultValue=""
                  required
                  className="h-12 rounded-2xl border border-input/90 bg-background/50 px-4 py-3 text-sm text-foreground outline-none transition-[border-color,box-shadow,background-color] focus-visible:border-primary/70 focus-visible:ring-4 focus-visible:ring-ring/20"
                >
                  <option value="" disabled>
                    티어 선택
                  </option>
                  {soloTiers.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
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
