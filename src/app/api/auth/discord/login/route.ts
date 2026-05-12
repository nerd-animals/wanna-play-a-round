import { NextResponse } from "next/server";
import { startDiscordLogin } from "@/server/handlers/auth";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const result = await startDiscordLogin();
    if (!result.ok) {
      return NextResponse.redirect(new URL(`/?error=${result.code}`, request.url));
    }
    return NextResponse.redirect(result.data.authorizeUrl);
  } catch (e) {
    const message = e instanceof Error ? e.message : "DISCORD_OAUTH_NOT_CONFIGURED";
    return NextResponse.redirect(new URL(`/?error=${message}`, request.url));
  }
}
