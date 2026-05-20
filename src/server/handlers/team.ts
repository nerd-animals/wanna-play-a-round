import "server-only";
import { withSession } from "@/server/authz";
import { queries, type Queries } from "@/server/db/queries";
import {
  rowToMatchPostView,
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
} from "@/shared/contracts/team";

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

export async function getTeamView(
  req: { teamId: string },
  db: Queries = queries,
): Promise<GetTeamViewEndpoint["response"]> {
  const team = await db.findTeamById(req.teamId);
  if (!team) return { ok: false, code: "TEAM_NOT_FOUND" };

  const [members, inviteLinks, matchPosts] = await Promise.all([
    db.listTeamMembers(team.id),
    db.listInviteLinks(team.id),
    db.listMatchPosts(team.id),
  ]);

  const data: GetTeamViewData = {
    team: rowToTeamView(team),
    members: members.map(rowToTeamMemberView),
    inviteLinks: inviteLinks.map(rowToTeamInviteLinkView),
    matchPosts: matchPosts.map(rowToMatchPostView),
  };
  return { ok: true, data };
}
