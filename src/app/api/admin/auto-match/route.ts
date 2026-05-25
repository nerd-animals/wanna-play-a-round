import { NextRequest, NextResponse } from "next/server";
import {
  isAuthorizedAdminRequest,
  readMaxAverageTierDelta,
} from "@/server/admin/auto-match";
import { runAutoMatch } from "@/server/jobs/auto-match";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedAdminRequest(request)) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const maxAverageTierDelta = readMaxAverageTierDelta(request);
  if (maxAverageTierDelta === null) {
    return NextResponse.json(
      { ok: false, code: "INVALID_MAX_AVERAGE_TIER_DELTA" },
      { status: 422 },
    );
  }

  const result = await runAutoMatch({ maxAverageTierDelta });
  return NextResponse.json({ ok: true, data: result });
}
