import { NextRequest, NextResponse } from "next/server";
import { registerMatchPost } from "@/server/handlers/match";
import type { LolTier } from "@/shared/domain";

type Context = {
  params: Promise<{ teamId: string }>;
};

function readTier(value: FormDataEntryValue | null): LolTier | undefined {
  if (!value) return undefined;
  return String(value) as LolTier;
}

export async function POST(
  request: NextRequest,
  context: Context,
): Promise<NextResponse> {
  const { teamId } = await context.params;
  const formData = await request.formData();

  try {
    const result = await registerMatchPost({
      teamId,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      minTier: readTier(formData.get("minTier")),
      maxTier: readTier(formData.get("maxTier")),
      availableTime: String(formData.get("availableTime") ?? ""),
    });
    if (!result.ok) {
      const target =
        result.code === "UNAUTHORIZED"
          ? "/"
          : `/teams/${teamId}/matches/new?error=${result.code}`;
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.redirect(
      new URL(`/teams/${teamId}?matchCreated=1`, request.url),
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(
      new URL(`/teams/${teamId}/matches/new?error=${code}`, request.url),
    );
  }
}
