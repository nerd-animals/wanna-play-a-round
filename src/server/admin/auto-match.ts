import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const DEFAULT_MAX_AVERAGE_TIER_DELTA = 1;
const MAX_ALLOWED_AVERAGE_TIER_DELTA = 10;

function extractAdminSecret(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || request.headers.get("x-admin-secret")?.trim() || null;
}

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAuthorizedAdminRequest(request: NextRequest): boolean {
  const configuredSecret = process.env.ADMIN_JOB_SECRET;
  const providedSecret = extractAdminSecret(request);

  if (!configuredSecret || !providedSecret) return false;
  return secureEquals(providedSecret, configuredSecret);
}

export function readMaxAverageTierDelta(request: NextRequest): number | null {
  const rawValue = request.nextUrl.searchParams.get("maxAverageTierDelta");
  if (!rawValue) return DEFAULT_MAX_AVERAGE_TIER_DELTA;

  const value = Number(rawValue);
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > MAX_ALLOWED_AVERAGE_TIER_DELTA
  ) {
    return null;
  }

  return value;
}
