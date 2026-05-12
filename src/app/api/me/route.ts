import { NextResponse } from "next/server";
import { currentUser } from "@/server/handlers/auth";
import { statusFromError } from "@/shared/api";

export async function GET(): Promise<NextResponse> {
  const result = await currentUser();
  return NextResponse.json(result, {
    status: result.ok ? 200 : statusFromError(result.code),
  });
}
