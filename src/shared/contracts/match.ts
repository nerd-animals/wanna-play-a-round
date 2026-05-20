import type { ActionResult } from "../api";
import type { LolTier, MatchPostView } from "../domain";

export type MatchErrorCode =
  | "TITLE_REQUIRED"
  | "OPEN_MATCH_ALREADY_EXISTS"
  | "TEAM_NOT_COMPLETE";

// POST /api/teams/:teamId/matches
export interface RegisterMatchPostRequest {
  teamId: string;
  title: string;
  description?: string;
  minTier?: LolTier;
  maxTier?: LolTier;
  availableTime?: string;
}
export interface RegisterMatchPostEndpoint {
  method: "POST";
  path: "/api/teams/:teamId/matches";
  request: RegisterMatchPostRequest;
  response: ActionResult<MatchPostView>;
}
