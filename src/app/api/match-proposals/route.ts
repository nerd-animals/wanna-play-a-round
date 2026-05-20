import { NextRequest, NextResponse } from "next/server";
import {
  listMatchProposals,
  proposeMatch,
} from "@/server/handlers/match-proposals";
import { statusFromError } from "@/shared/api";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const result = await listMatchProposals({
    postId: request.nextUrl.searchParams.get("postId") ?? undefined,
    teamId: request.nextUrl.searchParams.get("teamId") ?? undefined,
  });

  return NextResponse.json(result, {
    status: result.ok ? 200 : statusFromError(result.code),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as { postId?: string; teamId?: string };
  const result = await proposeMatch({
    postId: body.postId ?? "",
    teamId: body.teamId ?? "",
  });

  return NextResponse.json(result, {
    status: result.ok ? 201 : statusFromError(result.code),
  });
}
