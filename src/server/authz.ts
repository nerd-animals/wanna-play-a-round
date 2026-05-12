import "server-only";
import type { ActionResult } from "@/shared/api";
import { queries, type Queries } from "./db/queries";
import type { TeamRow } from "./db/rows";
import { getCurrentUser, type SessionUser } from "./session";

export type Handler<Req, Ctx, Data> = (
  req: Req,
  ctx: Ctx,
  db?: Queries,
) => Promise<ActionResult<Data>>;

export function withSession<Req, Data>(
  handler: Handler<Req, { actor: SessionUser }, Data>,
) {
  return async (req: Req, db: Queries = queries): Promise<ActionResult<Data>> => {
    const actor = await getCurrentUser();
    if (!actor) return { ok: false, code: "UNAUTHORIZED" };
    return handler(req, { actor }, db);
  };
}

export function withTeamOwner<Req extends { teamId: string }, Data>(
  handler: Handler<Req, { actor: SessionUser; team: TeamRow }, Data>,
) {
  return withSession<Req, Data>(async (req, { actor }, db = queries) => {
    const team = await db.findTeamById(req.teamId);
    if (!team) return { ok: false, code: "TEAM_NOT_FOUND" };
    if (team.owner_user_id !== actor.id) return { ok: false, code: "FORBIDDEN" };
    return handler(req, { actor, team }, db);
  });
}

export function withTeamMember<Req extends { teamId: string }, Data>(
  handler: Handler<Req, { actor: SessionUser; team: TeamRow }, Data>,
) {
  return withSession<Req, Data>(async (req, { actor }, db = queries) => {
    const team = await db.findTeamById(req.teamId);
    if (!team) return { ok: false, code: "TEAM_NOT_FOUND" };
    const member = await db.findTeamMemberByUserId(req.teamId, actor.id);
    if (!member || member.status !== "ACTIVE")
      return { ok: false, code: "FORBIDDEN" };
    return handler(req, { actor, team }, db);
  });
}
