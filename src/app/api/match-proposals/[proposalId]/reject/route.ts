import { NextRequest, NextResponse } from "next/server";
import { rejectMatchProposal } from "@/server/handlers/match-proposals";
import { statusFromError } from "@/shared/api";

type Context = {
  params: Promise<{ proposalId: string }>;
};

export async function POST(
  _request: NextRequest,
  context: Context,
): Promise<NextResponse> {
  const { proposalId } = await context.params;
  const result = await rejectMatchProposal({ proposalId });

  return NextResponse.json(result, {
    status: result.ok ? 200 : statusFromError(result.code),
  });
}
