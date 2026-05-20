import "server-only";
import { withSession, withTeamOwner } from "@/server/authz";
import { queries, type Queries } from "@/server/db/queries";
import {
  rowToMatchProposalView,
  rowToMatchView,
} from "@/server/db/mappers";
import { createId } from "@/server/lib/id";
import { sendMatchConfirmedNotification } from "@/server/services/discord-bot";
import type { MatchProposalRow } from "@/server/db/rows";
import type { SessionUser } from "@/server/session";
import type {
  AcceptMatchProposalEndpoint,
  ListMatchProposalsEndpoint,
  ProposeMatchEndpoint,
  ProposeMatchRequest,
  RejectMatchProposalEndpoint,
  WithdrawMatchProposalEndpoint,
} from "@/shared/contracts/match-proposals";

type NotificationService = {
  sendMatchConfirmedNotification(matchId: string): Promise<void>;
};

const defaultNotificationService: NotificationService = {
  sendMatchConfirmedNotification,
};

export const _proposeMatch = async (
  req: ProposeMatchRequest,
  ctx: { actor: SessionUser; team: { id: string } },
  db: Queries = queries,
): Promise<ProposeMatchEndpoint["response"]> => {
  const targetPost = await db.findMatchPostById(req.postId);
  if (!targetPost) return { ok: false, code: "MATCH_POST_NOT_FOUND" };
  if (targetPost.status !== "OPEN")
    return { ok: false, code: "MATCH_POST_ALREADY_CLOSED" };
  if (targetPost.team_id === ctx.team.id)
    return { ok: false, code: "CANNOT_PROPOSE_TO_OWN_POST" };

  const applicantOpenPost = await db.findOpenMatchPost(ctx.team.id);
  if (!applicantOpenPost)
    return { ok: false, code: "APPLICANT_OPEN_MATCH_NOT_FOUND" };

  const now = new Date().toISOString();
  const proposal = await db.insertMatchProposal({
    id: createId(),
    post_id: targetPost.id,
    applicant_team_id: ctx.team.id,
    status: "PENDING",
    created_by_user_id: ctx.actor.id,
    created_at: now,
    updated_at: now,
  });

  return { ok: true, data: rowToMatchProposalView(proposal) };
};

export const proposeMatch = withTeamOwner(_proposeMatch);

async function assertPendingProposal(
  proposalId: string,
  db: Queries,
): Promise<MatchProposalRow | { error: "PROPOSAL_NOT_FOUND" | "PROPOSAL_NOT_PENDING" }> {
  const proposal = await db.findMatchProposalById(proposalId);
  if (!proposal) return { error: "PROPOSAL_NOT_FOUND" };
  if (proposal.status !== "PENDING") return { error: "PROPOSAL_NOT_PENDING" };
  return proposal;
}

export const _acceptMatchProposal = async (
  req: { proposalId: string },
  ctx: { actor: SessionUser },
  db: Queries = queries,
  notifications: NotificationService = defaultNotificationService,
): Promise<AcceptMatchProposalEndpoint["response"]> => {
  const proposal = await assertPendingProposal(req.proposalId, db);
  if ("error" in proposal) return { ok: false, code: proposal.error };

  const targetPost = await db.findMatchPostById(proposal.post_id);
  if (!targetPost) return { ok: false, code: "MATCH_POST_NOT_FOUND" };

  const targetTeam = await db.findTeamById(targetPost.team_id);
  if (!targetTeam) return { ok: false, code: "TEAM_NOT_FOUND" };
  if (targetTeam.owner_user_id !== ctx.actor.id)
    return { ok: false, code: "FORBIDDEN" };

  const applicantPost = await db.findOpenMatchPost(proposal.applicant_team_id);
  if (!applicantPost)
    return { ok: false, code: "APPLICANT_OPEN_MATCH_NOT_FOUND" };

  const closedTargetPost = await db.closeMatchPostIfOpen(targetPost.id);
  const closedApplicantPost = await db.closeMatchPostIfOpen(applicantPost.id);
  if (!closedTargetPost || !closedApplicantPost) {
    return { ok: false, code: "MATCH_POST_ALREADY_CLOSED" };
  }

  const confirmedAt = new Date().toISOString();
  const match = await db.insertMatch({
    id: createId(),
    left_post_id: targetPost.id,
    right_post_id: applicantPost.id,
    left_team_id: targetPost.team_id,
    right_team_id: proposal.applicant_team_id,
    origin: "MANUAL",
    confirmed_at: confirmedAt,
  });
  const acceptedProposal = await db.updateMatchProposalStatus(
    proposal.id,
    "ACCEPTED",
  );

  await notifications.sendMatchConfirmedNotification(match.id);

  return {
    ok: true,
    data: {
      proposal: rowToMatchProposalView(acceptedProposal),
      match: rowToMatchView(match),
    },
  };
};

export const acceptMatchProposal = withSession(_acceptMatchProposal);

export const _rejectMatchProposal = async (
  req: { proposalId: string },
  ctx: { actor: SessionUser },
  db: Queries = queries,
): Promise<RejectMatchProposalEndpoint["response"]> => {
  const proposal = await assertPendingProposal(req.proposalId, db);
  if ("error" in proposal) return { ok: false, code: proposal.error };

  const targetPost = await db.findMatchPostById(proposal.post_id);
  if (!targetPost) return { ok: false, code: "MATCH_POST_NOT_FOUND" };

  const targetTeam = await db.findTeamById(targetPost.team_id);
  if (!targetTeam) return { ok: false, code: "TEAM_NOT_FOUND" };
  if (targetTeam.owner_user_id !== ctx.actor.id)
    return { ok: false, code: "FORBIDDEN" };

  const rejected = await db.updateMatchProposalStatus(proposal.id, "REJECTED");
  return { ok: true, data: rowToMatchProposalView(rejected) };
};

export const rejectMatchProposal = withSession(_rejectMatchProposal);

export const _withdrawMatchProposal = async (
  req: { proposalId: string },
  ctx: { actor: SessionUser },
  db: Queries = queries,
): Promise<WithdrawMatchProposalEndpoint["response"]> => {
  const proposal = await assertPendingProposal(req.proposalId, db);
  if ("error" in proposal) return { ok: false, code: proposal.error };

  const applicantTeam = await db.findTeamById(proposal.applicant_team_id);
  if (!applicantTeam) return { ok: false, code: "TEAM_NOT_FOUND" };
  if (applicantTeam.owner_user_id !== ctx.actor.id)
    return { ok: false, code: "FORBIDDEN" };

  const withdrawn = await db.updateMatchProposalStatus(proposal.id, "WITHDRAWN");
  return { ok: true, data: rowToMatchProposalView(withdrawn) };
};

export const withdrawMatchProposal = withSession(_withdrawMatchProposal);

export const _listMatchProposals = async (
  req: ListMatchProposalsEndpoint["request"],
  ctx: { actor: SessionUser },
  db: Queries = queries,
): Promise<ListMatchProposalsEndpoint["response"]> => {
  if (req.postId) {
    const post = await db.findMatchPostById(req.postId);
    if (!post) return { ok: false, code: "MATCH_POST_NOT_FOUND" };
    const team = await db.findTeamById(post.team_id);
    if (!team) return { ok: false, code: "TEAM_NOT_FOUND" };
    if (team.owner_user_id !== ctx.actor.id)
      return { ok: false, code: "FORBIDDEN" };
  } else if (req.teamId) {
    const team = await db.findTeamById(req.teamId);
    if (!team) return { ok: false, code: "TEAM_NOT_FOUND" };
    if (team.owner_user_id !== ctx.actor.id)
      return { ok: false, code: "FORBIDDEN" };
  } else {
    return { ok: false, code: "FORBIDDEN" };
  }

  const proposals = await db.listMatchProposals({
    postId: req.postId,
    teamId: req.teamId,
  });
  return { ok: true, data: proposals.map(rowToMatchProposalView) };
};

export const listMatchProposals = withSession(_listMatchProposals);
