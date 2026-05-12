import "server-only";
import { withTeamOwner } from "@/server/authz";
import { queries, type Queries } from "@/server/db/queries";
import { rowToTeamInviteLinkView, rowToTeamMemberView } from "@/server/db/mappers";
import { createId, createToken } from "@/server/lib/id";
import { getCurrentUser, type SessionUser } from "@/server/session";
import type { TeamRow } from "@/server/db/rows";
import type {
  CreateInviteLinkEndpoint,
  CreateInviteLinkRequest,
  GetInviteLinkEndpoint,
  JoinByInviteEndpoint,
  JoinByInviteRequest,
} from "@/shared/contracts/invite";

function isInviteExpired(expiresAt: string | null): boolean {
  return Boolean(expiresAt && new Date(expiresAt).getTime() < Date.now());
}

export const _createInviteLink = async (
  req: CreateInviteLinkRequest,
  ctx: { actor: SessionUser; team: TeamRow },
  db: Queries = queries,
): Promise<CreateInviteLinkEndpoint["response"]> => {
  const link = await db.insertInviteLink({
    id: createId(),
    team_id: ctx.team.id,
    token: createToken(),
    created_by_user_id: ctx.actor.id,
    status: "ACTIVE",
    max_uses: req.maxUses ?? null,
    used_count: 0,
    expires_at: req.expiresAt ?? null,
    created_at: new Date().toISOString(),
  });
  return { ok: true, data: rowToTeamInviteLinkView(link) };
};

export const createInviteLink = withTeamOwner(_createInviteLink);

export async function getInviteLink(
  req: { token: string },
  db: Queries = queries,
): Promise<GetInviteLinkEndpoint["response"]> {
  const link = await db.findInviteLinkByToken(req.token);
  return { ok: true, data: link ? rowToTeamInviteLinkView(link) : null };
}

export async function joinByInvite(
  req: JoinByInviteRequest,
  db: Queries = queries,
): Promise<JoinByInviteEndpoint["response"]> {
  const link = await db.findInviteLinkByToken(req.token);
  if (!link) return { ok: false, code: "INVITE_NOT_FOUND" };
  if (link.status !== "ACTIVE" || isInviteExpired(link.expires_at))
    return { ok: false, code: "INVITE_INACTIVE" };
  if (link.max_uses !== null && link.used_count >= link.max_uses)
    return { ok: false, code: "INVITE_EXHAUSTED" };

  const team = await db.findTeamById(link.team_id);
  if (!team) return { ok: false, code: "TEAM_NOT_FOUND" };

  const trimmedDisplayName = req.displayName?.trim();
  const actor = await getCurrentUser();
  if (!actor && !trimmedDisplayName)
    return { ok: false, code: "DISPLAY_NAME_REQUIRED" };

  let member = actor
    ? await db.findTeamMemberByUserId(team.id, actor.id)
    : null;

  if (!member && trimmedDisplayName) {
    member = await db.findTeamMemberByDisplayName(team.id, trimmedDisplayName);
  }

  const joinedAt = new Date().toISOString();

  if (member?.status === "ACTIVE") {
    if (trimmedDisplayName && member.display_name !== trimmedDisplayName) {
      member = await db.updateTeamMember({
        ...member,
        display_name: trimmedDisplayName,
      });
    }
    return {
      ok: true,
      data: {
        member: rowToTeamMemberView(member),
        teamId: team.id,
        reusedExistingMembership: true,
      },
    };
  }

  if (member) {
    member = await db.updateTeamMember({
      ...member,
      status: "ACTIVE",
      display_name: trimmedDisplayName ?? member.display_name,
      joined_at: joinedAt,
    });
  } else {
    member = await db.insertTeamMember({
      id: createId(),
      team_id: team.id,
      user_id: actor?.id ?? null,
      display_name: trimmedDisplayName ?? null,
      role: "MEMBER",
      status: "ACTIVE",
      created_at: joinedAt,
      joined_at: joinedAt,
    });
  }

  await db.updateInviteLink({ ...link, used_count: link.used_count + 1 });

  return {
    ok: true,
    data: {
      member: rowToTeamMemberView(member),
      teamId: team.id,
      reusedExistingMembership: false,
    },
  };
}
