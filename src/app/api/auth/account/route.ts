import { NextRequest, NextResponse } from "next/server";
import { deleteAccount } from "@/server/handlers/auth";
import { statusFromError } from "@/shared/api";

export async function DELETE(): Promise<NextResponse> {
  const result = await deleteAccount({});
  return NextResponse.json(result, {
    status: result.ok ? 200 : statusFromError(result.code),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const result = await deleteAccount({});
  if (!result.ok) {
    const target = result.code === "UNAUTHORIZED" ? "/" : `/dashboard?error=${result.code}`;
    return NextResponse.redirect(new URL(target, request.url), 303);
  }
  return NextResponse.redirect(new URL("/", request.url), 303);
}
