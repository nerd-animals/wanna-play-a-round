import "server-only";

import { NextRequest, NextResponse } from "next/server";

export function isFormSubmission(request: NextRequest): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  return (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  );
}

export function redirectWithQuery(
  request: NextRequest,
  returnTo: string | null | undefined,
  params: Record<string, string>,
): NextResponse {
  const path = returnTo?.startsWith("/") ? returnTo : "/dashboard";
  const url = new URL(path, request.url);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url);
}
