import { NextRequest, NextResponse } from "next/server";
import { createTeam } from "@/server/handlers/team";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();

  try {
    const result = await createTeam({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      activityTime: String(formData.get("activityTime") ?? ""),
    });
    if (!result.ok) {
      const target =
        result.code === "UNAUTHORIZED"
          ? "/?error=login"
          : `/teams/new?error=${result.code}`;
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.redirect(
      new URL(`/teams/${result.data.id}`, request.url),
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(new URL(`/teams/new?error=${code}`, request.url));
  }
}
