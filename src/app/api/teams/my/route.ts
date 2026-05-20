import { NextResponse } from "next/server";
import { getMyTeams } from "@/server/handlers/team";
import { statusFromError } from "@/shared/api";

export async function GET(): Promise<NextResponse> {
  const result = await getMyTeams({});
  return NextResponse.json(result, {
    status: result.ok ? 200 : statusFromError(result.code),
  });
}
