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

const TEAM_ROSTER_SIZE = 5;

function normalizeAvailableTime(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const time = new Date(trimmed).getTime();
  if (!Number.isFinite(time) || time <= Date.now()) return "INVALID";

  return new Date(time).toISOString();
}

export const _registerMatchPost = async (
  req: RegisterMatchPostRequest,
  ctx: { actor: SessionUser; team: TeamRow },
  db: Queries = queries,
): Promise<RegisterMatchPostEndpoint["response"]> => {
  const title = req.title?.trim();
  if (!title) return { ok: false, code: "TITLE_REQUIRED" };

  const openPost = await db.findOpenMatchPost(ctx.team.id);
  if (openPost) return { ok: false, code: "OPEN_MATCH_ALREADY_EXISTS" };

  const members = await db.listTeamMembers(ctx.team.id);
  const activeCount = members.filter((m) => m.status === "ACTIVE").length;
  if (activeCount !== TEAM_ROSTER_SIZE)
    return { ok: false, code: "TEAM_NOT_COMPLETE" };

  const availableTime = normalizeAvailableTime(req.availableTime);
  if (availableTime === "INVALID")
    return { ok: false, code: "AVAILABLE_TIME_INVALID" };

  const now = new Date().toISOString();
  const post = await db.insertMatchPost({
    id: createId(),
    team_id: ctx.team.id,
    title,
    description: req.description?.trim() || null,
    min_tier: req.minTier ?? null,
    max_tier: req.maxTier ?? null,
    available_time: availableTime,
    status: "OPEN",
    created_by_user_id: ctx.actor.id,
    created_at: now,
    updated_at: now,
  });
  return { ok: true, data: rowToMatchPostView(post) };
};

export const registerMatchPost = withTeamOwner(_registerMatchPost);
