import { NextRequest, NextResponse } from "next/server";
import { finishDiscordLogin } from "@/server/handlers/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
  }

  try {
    const result = await finishDiscordLogin({ code, state });
    if (!result.ok) {
      return NextResponse.redirect(new URL(`/?error=${result.code}`, request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : "DISCORD_LOGIN_FAILED";
    return NextResponse.redirect(new URL(`/?error=${message}`, request.url));
  }
}
