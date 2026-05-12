import { NextRequest, NextResponse } from "next/server";
import { joinByInvite } from "@/server/handlers/invite";

type Context = {
  params: Promise<{ token: string }>;
};

export async function POST(
  request: NextRequest,
  context: Context,
): Promise<NextResponse> {
  const { token } = await context.params;
  const formData = await request.formData();
  const displayName =
    String(formData.get("displayName") ?? "").trim() || undefined;

  try {
    const result = await joinByInvite({ token, displayName });
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
