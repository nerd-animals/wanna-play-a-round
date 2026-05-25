import "server-only";
import { withSession } from "@/server/authz";
import { queries, type Queries } from "@/server/db/queries";
import {
  rowToMatchProposalView,
  rowToMatchPostView,
  rowToMatchView,
  rowToTeamInviteLinkView,
  rowToTeamMemberView,
  rowToTeamView,
} from "@/server/db/mappers";
import { createId } from "@/server/lib/id";
import type { SessionUser } from "@/server/session";
import type {
  CreateTeamEndpoint,
  CreateTeamRequest,
  GetMyTeamsEndpoint,
  GetTeamViewData,
  GetTeamViewEndpoint,
  ManualMatchContextView,
  ManualMatchProposalContextView,
} from "@/shared/contracts/team";
import type { MatchProposalRow, MatchRow } from "@/server/db/rows";

export const _createTeam = async (
  req: CreateTeamRequest,
  ctx: { actor: SessionUser },
  db: Queries = queries,
): Promise<CreateTeamEndpoint["response"]> => {
  const name = req.name?.trim();
  if (!name) return { ok: false, code: "TEAM_NAME_REQUIRED" };

  const now = new Date().toISOString();
  const teamRow = await db.insertTeam({
    id: createId(),
    owner_user_id: ctx.actor.id,
    name,
    description: req.description?.trim() || null,
    activity_time: req.activityTime?.trim() || null,
    created_at: now,
    updated_at: now,
  });

  return { ok: true, data: rowToTeamView(teamRow) };
};

export const createTeam = withSession(_createTeam);

export const _getMyTeams = async (
  _req: Record<string, never>,
  ctx: { actor: SessionUser },
  db: Queries = queries,
): Promise<GetMyTeamsEndpoint["response"]> => {
  const rows = await db.listTeamsByOwnerId(ctx.actor.id);
  return { ok: true, data: rows.map(rowToTeamView) };
};

export const getMyTeams = withSession(_getMyTeams);

async function proposalContext(
  proposal: MatchProposalRow,
  db: Queries,
): Promise<ManualMatchProposalContextView | null> {
  const [targetPost, applicantTeam, applicantPost] = await Promise.all([
    db.findMatchPostById(proposal.post_id),
    db.findTeamById(proposal.applicant_team_id),
    proposal.applicant_post_id
      ? db.findMatchPostById(proposal.applicant_post_id)
      : db.findOpenMatchPost(proposal.applicant_team_id),
  ]);
  if (!targetPost || !applicantTeam) return null;

  const targetTeam = await db.findTeamById(targetPost.team_id);
  if (!targetTeam) return null;

  return {
    proposal: rowToMatchProposalView(proposal),
    targetPost: rowToMatchPostView(targetPost),
    targetTeam: rowToTeamView(targetTeam),
    applicantPost: applicantPost ? rowToMatchPostView(applicantPost) : undefined,
    applicantTeam: rowToTeamView(applicantTeam),
  };
}

async function matchContext(
  match: MatchRow,
  db: Queries,
): Promise<ManualMatchContextView | null> {
  const [leftPost, rightPost, leftTeam, rightTeam] = await Promise.all([
    db.findMatchPostById(match.left_post_id),
    db.findMatchPostById(match.right_post_id),
    db.findTeamById(match.left_team_id),
    db.findTeamById(match.right_team_id),
  ]);
  if (!leftPost || !rightPost || !leftTeam || !rightTeam) return null;

  return {
    match: rowToMatchView(match),
    leftPost: rowToMatchPostView(leftPost),
    rightPost: rowToMatchPostView(rightPost),
    leftTeam: rowToTeamView(leftTeam),
    rightTeam: rowToTeamView(rightTeam),
  };
}

function nonNullable<T>(value: T | null): value is T {
  return value !== null;
}

export async function getTeamView(
  req: { teamId: string },
  db: Queries = queries,
): Promise<GetTeamViewEndpoint["response"]> {
  const team = await db.findTeamById(req.teamId);
  if (!team) return { ok: false, code: "TEAM_NOT_FOUND" };

  const [
    members,
    inviteLinks,
    matchPosts,
    openPosts,
    outgoingProposals,
    confirmedMatches,
  ] = await Promise.all([
    db.listTeamMembers(team.id),
    db.listInviteLinks(team.id),
    db.listMatchPosts(team.id),
    db.listOpenMatchPosts(),
    db.listMatchProposals({ teamId: team.id }),
    db.listMatchesForTeam(team.id),
  ]);

  const incomingProposals = await db.listMatchProposalsForPostIds(
    matchPosts.map((post) => post.id),
  );
  const pendingOutgoingPostIds = new Set(
    outgoingProposals
      .filter((proposal) => proposal.status === "PENDING")
      .map((proposal) => proposal.post_id),
  );
  const candidateRows = openPosts
    .filter((post) => post.team_id !== team.id)
    .sort((a, b) => {
      const left = a.available_time ?? a.created_at;
      const right = b.available_time ?? b.created_at;
      return left.localeCompare(right);
    });

  const [
    candidates,
    incomingProposalContexts,
    outgoingProposalContexts,
    confirmedMatchContexts,
  ] = await Promise.all([
    Promise.all(
      candidateRows.map(async (post) => {
        const candidateTeam = await db.findTeamById(post.team_id);
        if (!candidateTeam) return null;

        return {
          post: rowToMatchPostView(post),
          team: rowToTeamView(candidateTeam),
          hasPendingProposal: pendingOutgoingPostIds.has(post.id),
        };
      }),
    ),
    Promise.all(
      incomingProposals.map((proposal) => proposalContext(proposal, db)),
    ),
    Promise.all(
      outgoingProposals.map((proposal) => proposalContext(proposal, db)),
    ),
    Promise.all(confirmedMatches.map((match) => matchContext(match, db))),
  ]);

  const data: GetTeamViewData = {
    team: rowToTeamView(team),
    members: members.map(rowToTeamMemberView),
    inviteLinks: inviteLinks.map(rowToTeamInviteLinkView),
    matchPosts: matchPosts.map(rowToMatchPostView),
    manualMatch: {
      candidates: candidates.filter(nonNullable),
      incomingProposals: incomingProposalContexts.filter(nonNullable),
      outgoingProposals: outgoingProposalContexts.filter(nonNullable),
      confirmedMatches: confirmedMatchContexts.filter(nonNullable),
    },
  };
  return { ok: true, data };
}
