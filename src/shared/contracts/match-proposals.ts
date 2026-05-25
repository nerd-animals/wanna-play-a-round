import type { ActionResult } from "../api";
import type { MatchProposalView, MatchView } from "../domain";

export type MatchProposalErrorCode =
  | "PROPOSAL_NOT_FOUND"
  | "PROPOSAL_NOT_PENDING"
  | "MATCH_PROPOSAL_ALREADY_EXISTS"
  | "MATCH_POST_NOT_FOUND"
  | "CANNOT_PROPOSE_TO_OWN_POST"
  | "APPLICANT_OPEN_MATCH_NOT_FOUND"
  | "MATCH_POST_ALREADY_CLOSED";

export interface ProposeMatchRequest {
  postId: string;
  teamId: string;
}

export interface ProposeMatchEndpoint {
  method: "POST";
  path: "/api/match-proposals";
  request: ProposeMatchRequest;
  response: ActionResult<MatchProposalView>;
}

export interface ListMatchProposalsRequest {
  postId?: string;
  teamId?: string;
}

export interface ListMatchProposalsEndpoint {
  method: "GET";
  path: "/api/match-proposals";
  request: ListMatchProposalsRequest;
  response: ActionResult<MatchProposalView[]>;
}

export interface AcceptMatchProposalEndpoint {
  method: "POST";
  path: "/api/match-proposals/:proposalId/accept";
  request: { proposalId: string };
  response: ActionResult<{ proposal: MatchProposalView; match: MatchView }>;
}

export interface RejectMatchProposalEndpoint {
  method: "POST";
  path: "/api/match-proposals/:proposalId/reject";
  request: { proposalId: string };
  response: ActionResult<MatchProposalView>;
}

export interface WithdrawMatchProposalEndpoint {
  method: "POST";
  path: "/api/match-proposals/:proposalId/withdraw";
  request: { proposalId: string };
  response: ActionResult<MatchProposalView>;
}
