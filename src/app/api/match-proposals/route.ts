import { NextRequest, NextResponse } from "next/server";
import {
  listMatchProposals,
  proposeMatch,
} from "@/server/handlers/match-proposals";
import { isFormSubmission, redirectWithQuery } from "@/server/lib/form-redirect";
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
  if (isFormSubmission(request)) {
    const formData = await request.formData();
    const result = await proposeMatch({
      postId: String(formData.get("postId") ?? ""),
      teamId: String(formData.get("teamId") ?? ""),
    });
    const returnTo = String(formData.get("returnTo") ?? "");

    if (!result.ok && result.code === "UNAUTHORIZED") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return redirectWithQuery(
      request,
      returnTo,
      result.ok ? { proposalSent: "1" } : { error: result.code },
    );
  }

  const body = (await request.json()) as { postId?: string; teamId?: string };
  const result = await proposeMatch({
    postId: body.postId ?? "",
    teamId: body.teamId ?? "",
  });

  return NextResponse.json(result, {
    status: result.ok ? 201 : statusFromError(result.code),
  });
}
