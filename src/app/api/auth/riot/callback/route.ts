import { NextRequest, NextResponse } from "next/server";
import { joinByInvite } from "@/server/handlers/invite";
import { getCurrentUser } from "@/server/session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Temporary route until Riot RSO is available for v1. The callback reuses
  // the invite join flow with the current Discord session username.
  const sessionUser = await getCurrentUser();
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/?error=RIOT_CALLBACK_INVALID", request.url),
    );
  }

  try {
    const result = await joinByInvite({
      token,
      riotGameName: sessionUser?.username ?? "",
      riotTagLine: "RSO",
      soloTier: "GOLD",
    });
    if (!result.ok) {
      return NextResponse.redirect(
        new URL(`/join/${token}?error=${result.code}`, request.url),
      );
    }
    return NextResponse.redirect(
      new URL(`/join/${token}?joined=1&teamId=${result.data.teamId}`, request.url),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(
      new URL(`/join/${token}?error=${message}`, request.url),
    );
  }
}
