import type { ActionResult } from "../api";
import type { TeamInviteLinkView, TeamMemberView } from "../domain";

export type InviteErrorCode =
  | "INVITE_NOT_FOUND"
  | "INVITE_INACTIVE"
  | "INVITE_EXHAUSTED"
  | "TEAM_FULL"
  | "DISCORD_GUILD_MEMBERSHIP_REQUIRED"
  | "RIOT_PROFILE_REQUIRED";

// POST /api/teams/:teamId/invite-links
export interface CreateInviteLinkRequest {
  teamId: string;
  maxUses?: number;
  expiresAt?: string;
}
export interface CreateInviteLinkEndpoint {
  method: "POST";
  path: "/api/teams/:teamId/invite-links";
  request: CreateInviteLinkRequest;
  response: ActionResult<TeamInviteLinkView>;
}

// GET /api/invite-links/:token
export interface GetInviteLinkEndpoint {
  method: "GET";
  path: "/api/invite-links/:token";
  request: { token: string };
  response: ActionResult<TeamInviteLinkView | null>;
}

// POST /api/invite-links/:token/join
export interface JoinByInviteRequest {
  token: string;
  riotGameName: string;
  riotTagLine: string;
  soloTier: NonNullable<TeamMemberView["soloTier"]>;
}
export interface JoinByInviteData {
  member: TeamMemberView;
  teamId: string;
  reusedExistingMembership: boolean;
}
export interface JoinByInviteEndpoint {
  method: "POST";
  path: "/api/invite-links/:token/join";
  request: JoinByInviteRequest;
  response: ActionResult<JoinByInviteData>;
}
