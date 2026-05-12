import { NextResponse } from "next/server";
import { getMyTeam } from "@/server/handlers/team";
import { statusFromError } from "@/shared/api";

export async function GET(): Promise<NextResponse> {
  const result = await getMyTeam({});
  return NextResponse.json(result, {
    status: result.ok ? 200 : statusFromError(result.code),
  });
}
