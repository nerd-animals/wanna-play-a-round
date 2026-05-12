import { NextResponse } from "next/server";
import { logout } from "@/server/handlers/auth";

export async function POST(request: Request): Promise<NextResponse> {
  await logout();
  return NextResponse.redirect(new URL("/", request.url));
}
