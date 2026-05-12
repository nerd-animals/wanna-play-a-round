import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/client/components/app-shell";
import { CheckItem } from "@/client/components/check-item";
import { StatusAlert } from "@/client/components/status-alert";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { getCurrentUser } from "@/server/session";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewTeamPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const query = await searchParams;

  if (!user) {
    redirect("/");
  }

  return (
    <AppShell>
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl sm:text-4xl">팀을 먼저 만들고 운영 흐름을 시작합니다.</CardTitle>
            <CardDescription>
              RSO를 붙이기 전 단계라 지금은 팀 생성, 멤버 저장, 매칭 등록까지의 기본 흐름에 집중합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {query.error ? (
              <StatusAlert title="팀 생성 오류" tone="destructive" description={query.error} />
            ) : null}
            <form action="/api/teams" method="post" className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="name">팀명</Label>
                <Input id="name" name="name" placeholder="Midnight Scrim" required />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">팀 소개</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="주 3회 스크림, 저녁 시간대 중심으로 운영"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="activityTime">주 활동 시간</Label>
                <Input id="activityTime" name="activityTime" placeholder="평일 21:00-24:00" />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="submit">팀 생성</Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard">취소</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>생성 직후 확인 포인트</CardTitle>
            <CardDescription>폼 제출 후 아래 조건이 맞으면 기본 팀 운영 플로우가 정상입니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <CheckItem title="생성 성공 후 자동으로 팀 상세 페이지로 이동해야 합니다." />
            <CheckItem title="생성 직후 팀장 멤버가 ACTIVE 상태로 저장되어야 합니다." />
            <CheckItem title={`${user.username} 계정이 팀 소유자로 연결되어야 합니다.`} done />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
