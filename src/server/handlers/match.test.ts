import { describe, it, expect } from "vitest";
import { _registerMatchPost } from "./match";
import type { Queries } from "@/server/db/queries";
import type { SessionUser } from "@/server/session";
import type {
  MatchPostRow,
  TeamMemberRow,
  TeamRow,
} from "@/server/db/rows";

const actor: SessionUser = { id: "owner-1", username: "owner" };

const team: TeamRow = {
  id: "team-1",
  owner_user_id: actor.id,
  name: "Team",
  description: null,
  activity_time: null,
  created_at: "2026-05-20T00:00:00.000Z",
  updated_at: "2026-05-20T00:00:00.000Z",
};

const baseReq = { teamId: team.id, title: "Scrim @ 8pm" };

function makeMember(over: Partial<TeamMemberRow> = {}): TeamMemberRow {
  return {
    id: "member-1",
    team_id: team.id,
    user_id: "user-x",
    display_name: "name",
    role: "MEMBER",
    status: "ACTIVE",
    created_at: "2026-05-20T00:00:00.000Z",
    joined_at: "2026-05-20T00:00:00.000Z",
    ...over,
  };
}

function activeMembers(count: number): TeamMemberRow[] {
  return Array.from({ length: count }, (_, i) =>
    makeMember({ id: `m-${i}`, user_id: `u-${i}` }),
  );
}

describe("_registerMatchPost", () => {
  it("returns TITLE_REQUIRED when title is blank", async () => {
    const db = {} as Queries;
    const res = await _registerMatchPost(
      { teamId: team.id, title: "   " },
      { actor, team },
      db,
    );
    expect(res).toEqual({ ok: false, code: "TITLE_REQUIRED" });
  });

  it("returns OPEN_MATCH_ALREADY_EXISTS when an OPEN post exists", async () => {
    const db = {
      findOpenMatchPost: async () =>
        ({ id: "existing-open" }) as MatchPostRow,
    } as unknown as Queries;

    const res = await _registerMatchPost(baseReq, { actor, team }, db);
    expect(res).toEqual({ ok: false, code: "OPEN_MATCH_ALREADY_EXISTS" });
  });

  it("returns TEAM_NOT_COMPLETE when fewer than 5 ACTIVE members", async () => {
    const db = {
      findOpenMatchPost: async () => null,
      listTeamMembers: async () => activeMembers(4),
    } as unknown as Queries;

    const res = await _registerMatchPost(baseReq, { actor, team }, db);
    expect(res).toEqual({ ok: false, code: "TEAM_NOT_COMPLETE" });
  });

  it("returns TEAM_NOT_COMPLETE when more than 5 ACTIVE members (defensive)", async () => {
    const db = {
      findOpenMatchPost: async () => null,
      listTeamMembers: async () => activeMembers(6),
    } as unknown as Queries;

    const res = await _registerMatchPost(baseReq, { actor, team }, db);
    expect(res).toEqual({ ok: false, code: "TEAM_NOT_COMPLETE" });
  });

  it("ignores PENDING/REMOVED members when counting (only ACTIVE counts toward 5)", async () => {
    const db = {
      findOpenMatchPost: async () => null,
      listTeamMembers: async () => [
        ...activeMembers(4),
        makeMember({ id: "p-1", user_id: "u-p", status: "PENDING" }),
        makeMember({ id: "r-1", user_id: "u-r", status: "REMOVED" }),
      ],
    } as unknown as Queries;

    const res = await _registerMatchPost(baseReq, { actor, team }, db);
    expect(res).toEqual({ ok: false, code: "TEAM_NOT_COMPLETE" });
  });

  it("inserts an OPEN post when exactly 5 ACTIVE members", async () => {
    const inserts: MatchPostRow[] = [];
    const db = {
      findOpenMatchPost: async () => null,
      listTeamMembers: async () => activeMembers(5),
      insertMatchPost: async (row: MatchPostRow) => {
        inserts.push(row);
        return row;
      },
    } as unknown as Queries;

    const res = await _registerMatchPost(baseReq, { actor, team }, db);
    expect(res.ok).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].status).toBe("OPEN");
    expect(inserts[0].team_id).toBe(team.id);
    expect(inserts[0].created_by_user_id).toBe(actor.id);
  });
});
