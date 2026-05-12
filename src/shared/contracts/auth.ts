import type { ActionResult } from "../api";
import type { UserView } from "../domain";

export type AuthErrorCode =
  | "DISCORD_OAUTH_NOT_CONFIGURED"
  | "DISCORD_STATE_MISMATCH";

// GET /api/me
export interface CurrentUserEndpoint {
  method: "GET";
  path: "/api/me";
  request: Record<string, never>;
  response: ActionResult<UserView | null>;
}
