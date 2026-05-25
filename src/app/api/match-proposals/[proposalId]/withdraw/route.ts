import { NextRequest, NextResponse } from "next/server";
import { withdrawMatchProposal } from "@/server/handlers/match-proposals";
import { isFormSubmission, redirectWithQuery } from "@/server/lib/form-redirect";
import { statusFromError } from "@/shared/api";

type Context = {
  params: Promise<{ proposalId: string }>;
};

export async function POST(
  request: NextRequest,
  context: Context,
): Promise<NextResponse> {
  const { proposalId } = await context.params;
  const formData = isFormSubmission(request) ? await request.formData() : null;
  const result = await withdrawMatchProposal({ proposalId });

  if (formData) {
    const returnTo = String(formData.get("returnTo") ?? "");
    if (!result.ok && result.code === "UNAUTHORIZED") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return redirectWithQuery(
      request,
      returnTo,
      result.ok ? { proposalWithdrawn: "1" } : { error: result.code },
    );
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : statusFromError(result.code),
  });
}
