import "server-only";
import { withTeamOwner } from "@/server/authz";
import { queries, type Queries } from "@/server/db/queries";
import { rowToMatchPostView } from "@/server/db/mappers";
import { createId } from "@/server/lib/id";
import type { TeamRow } from "@/server/db/rows";
import type { SessionUser } from "@/server/session";
import type {
  RegisterMatchPostEndpoint,
  RegisterMatchPostRequest,
} from "@/shared/contracts/match";

export const _registerMatchPost = async (
  req: RegisterMatchPostRequest,
  ctx: { actor: SessionUser; team: TeamRow },
  db: Queries = queries,
): Promise<RegisterMatchPostEndpoint["response"]> => {
  const title = req.title?.trim();
  if (!title) return { ok: false, code: "TITLE_REQUIRED" };

  const ownerMember = await db.findTeamMemberByUserId(ctx.team.id, ctx.actor.id);
  if (!ownerMember || ownerMember.status !== "ACTIVE")
    return { ok: false, code: "OWNER_MEMBER_REQUIRED" };

  const openPost = await db.findOpenMatchPost(ctx.team.id);
  if (openPost) return { ok: false, code: "OPEN_MATCH_ALREADY_EXISTS" };

  const members = await db.listTeamMembers(ctx.team.id);
  if (!members.some((m) => m.status === "ACTIVE"))
    return { ok: false, code: "ACTIVE_MEMBER_REQUIRED" };

  const now = new Date().toISOString();
  const post = await db.insertMatchPost({
    id: createId(),
    team_id: ctx.team.id,
    title,
    description: req.description?.trim() || null,
    min_tier: req.minTier ?? null,
    max_tier: req.maxTier ?? null,
    available_time: req.availableTime?.trim() || null,
    status: "OPEN",
    created_by_user_id: ctx.actor.id,
    created_at: now,
    updated_at: now,
  });
  return { ok: true, data: rowToMatchPostView(post) };
};

export const registerMatchPost = withTeamOwner(_registerMatchPost);
