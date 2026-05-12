import type { TeamErrorCode } from "./contracts/team";
import type { InviteErrorCode } from "./contracts/invite";
import type { MatchErrorCode } from "./contracts/match";
import type { AuthErrorCode } from "./contracts/auth";

export type CommonErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "INTERNAL_ERROR";

export type ActionErrorCode =
  | CommonErrorCode
  | TeamErrorCode
  | InviteErrorCode
  | MatchErrorCode
  | AuthErrorCode;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ActionErrorCode };

export interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  request: unknown;
  response: ActionResult<unknown>;
}

export function statusFromError(code: ActionErrorCode): number {
  if (code === "UNAUTHORIZED") return 401;
  if (code === "FORBIDDEN" || code.endsWith("_MEMBER_REQUIRED")) return 403;
  if (code.endsWith("_NOT_FOUND")) return 404;
  if (code.endsWith("_ALREADY_EXISTS")) return 409;
  if (code === "INTERNAL_ERROR") return 500;
  return 422;
}
