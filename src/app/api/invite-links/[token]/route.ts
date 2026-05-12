import { NextResponse } from "next/server";
import { getInviteLink } from "@/server/handlers/invite";
import { getTeamView } from "@/server/handlers/team";

type Context = {
  params: Promise<{ token: string }>;
};

export async function GET(
  _request: Request,
  context: Context,
): Promise<NextResponse> {
  const { token } = await context.params;
  const linkResult = await getInviteLink({ token });
  if (!linkResult.ok || !linkResult.data) {
    return NextResponse.json({ inviteLink: null }, { status: 404 });
  }

  const viewResult = await getTeamView({ teamId: linkResult.data.teamId });
  const team = viewResult.ok ? viewResult.data.team : null;
  return NextResponse.json({ inviteLink: linkResult.data, team });
}
