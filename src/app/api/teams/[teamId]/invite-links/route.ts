import { NextRequest, NextResponse } from "next/server";
import { createInviteLink } from "@/server/handlers/invite";

type Context = {
  params: Promise<{ teamId: string }>;
};

export async function POST(
  request: NextRequest,
  context: Context,
): Promise<NextResponse> {
  const { teamId } = await context.params;
  const formData = await request.formData();
  const maxUsesValue = String(formData.get("maxUses") ?? "").trim();
  const expiresAt = String(formData.get("expiresAt") ?? "").trim();

  try {
    const result = await createInviteLink({
      teamId,
      maxUses: maxUsesValue ? Number(maxUsesValue) : undefined,
      expiresAt: expiresAt || undefined,
    });
    if (!result.ok) {
      const target =
        result.code === "UNAUTHORIZED"
          ? "/"
          : `/teams/${teamId}?error=${result.code}`;
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.redirect(
      new URL(`/teams/${teamId}?inviteCreated=1`, request.url),
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(
      new URL(`/teams/${teamId}?error=${code}`, request.url),
    );
  }
}
