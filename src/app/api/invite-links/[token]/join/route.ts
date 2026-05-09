import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/actions/auth";
import { joinTeamByInviteAction } from "@/server/actions/invite-links";
import { createProvisionalRiotSession } from "@/server/services/riot";

type Context = {
  params: Promise<{ token: string }>;
};

export async function POST(
  request: NextRequest,
  context: Context,
): Promise<NextResponse> {
  const { token } = await context.params;
  const user = await getCurrentUser();
  const formData = await request.formData();

  try {
    const riotId = String(formData.get("riotId") ?? "").trim();
    const provisionalSession = riotId ? createProvisionalRiotSession(riotId) : null;
    const displayName = provisionalSession
      ? `${provisionalSession.gameName}#${provisionalSession.tagLine}`
      : String(formData.get("displayName") ?? "").trim() || undefined;

    const result = await joinTeamByInviteAction({
      token,
      sessionUserId: user?.id,
      displayName,
    });

    return NextResponse.redirect(
      new URL(`/join/${token}?joined=1&teamId=${result.teamId}`, request.url),
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown";
    return NextResponse.redirect(new URL(`/join/${token}?error=${code}`, request.url));
  }
}
