import { NextRequest, NextResponse } from "next/server";
import { joinByInvite } from "@/server/handlers/invite";
import type { LolTier } from "@/shared/domain";

type Context = {
  params: Promise<{ token: string }>;
};

export async function POST(
  request: NextRequest,
  context: Context,
): Promise<NextResponse> {
  const { token } = await context.params;
  const formData = await request.formData();
  const riotGameName = String(formData.get("riotGameName") ?? "").trim();
  const riotTagLine = String(formData.get("riotTagLine") ?? "").trim();
  const soloTier = String(formData.get("soloTier") ?? "").trim();

  try {
    const result = await joinByInvite({
      token,
      riotGameName,
      riotTagLine,
      soloTier: soloTier as LolTier,
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
    const code = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(
      new URL(`/join/${token}?error=${code}`, request.url),
    );
  }
}
