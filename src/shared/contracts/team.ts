import type { ActionResult } from "../api";
import type {
  MatchProposalView,
  MatchPostView,
  MatchView,
  TeamInviteLinkView,
  TeamMemberView,
  TeamView,
} from "../domain";

export type TeamErrorCode = "TEAM_NAME_REQUIRED" | "TEAM_NOT_FOUND";

// POST /api/teams
export interface CreateTeamRequest {
  name: string;
  description?: string;
  activityTime?: string;
}
export interface CreateTeamEndpoint {
  method: "POST";
  path: "/api/teams";
  request: CreateTeamRequest;
  response: ActionResult<TeamView>;
}

// GET /api/teams/:teamId
export interface GetTeamViewData {
  team: TeamView;
  members: TeamMemberView[];
  inviteLinks: TeamInviteLinkView[];
  matchPosts: MatchPostView[];
  manualMatch: ManualMatchWorkspaceView;
}

export interface ManualMatchCandidateView {
  post: MatchPostView;
  team: TeamView;
  hasPendingProposal: boolean;
}

export interface ManualMatchProposalContextView {
  proposal: MatchProposalView;
  targetPost: MatchPostView;
  targetTeam: TeamView;
  applicantPost?: MatchPostView;
  applicantTeam: TeamView;
}

export interface ManualMatchContextView {
  match: MatchView;
  leftPost: MatchPostView;
  rightPost: MatchPostView;
  leftTeam: TeamView;
  rightTeam: TeamView;
}

export interface ManualMatchWorkspaceView {
  candidates: ManualMatchCandidateView[];
  incomingProposals: ManualMatchProposalContextView[];
  outgoingProposals: ManualMatchProposalContextView[];
  confirmedMatches: ManualMatchContextView[];
}
export interface GetTeamViewEndpoint {
  method: "GET";
  path: "/api/teams/:teamId";
  request: { teamId: string };
  response: ActionResult<GetTeamViewData>;
}

// GET /api/teams/my
export interface GetMyTeamsEndpoint {
  method: "GET";
  path: "/api/teams/my";
  request: Record<string, never>;
  response: ActionResult<TeamView[]>;
}
