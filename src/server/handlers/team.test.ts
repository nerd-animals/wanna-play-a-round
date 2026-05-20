import { describe, it, expect } from "vitest";
import { _createTeam, _getMyTeams } from "./team";
import type { Queries } from "@/server/db/queries";
import type { SessionUser } from "@/server/session";
import type { TeamMemberRow, TeamRow } from "@/server/db/rows";

const actor: SessionUser = { id: "user-1", username: "tester" };

function makeTeamRow(over: Partial<TeamRow> = {}): TeamRow {
  return {
    id: "team-1",
    owner_user_id: actor.id,
    name: "Team",
    description: null,
    activity_time: null,
    created_at: "2026-05-20T00:00:00.000Z",
    updated_at: "2026-05-20T00:00:00.000Z",
    ...over,
  };
}

describe("_createTeam", () => {
  it("returns TEAM_NAME_REQUIRED when name is blank", async () => {
    const db = {} as Queries;
    const res = await _createTeam({ name: "   " }, { actor }, db);
    expect(res).toEqual({ ok: false, code: "TEAM_NAME_REQUIRED" });
  });

  it("allows a second team for the same owner (no TEAM_ALREADY_EXISTS guard)", async () => {
    const teamInserts: TeamRow[] = [];
    const memberInserts: TeamMemberRow[] = [];
    const db = {
      insertTeam: async (row: TeamRow) => {
        teamInserts.push(row);
        return row;
      },
      insertTeamMember: async (row: TeamMemberRow) => {
        memberInserts.push(row);
        return row;
      },
    } as unknown as Queries;

    const first = await _createTeam({ name: "Alpha" }, { actor }, db);
    const second = await _createTeam({ name: "Beta" }, { actor }, db);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(teamInserts.map((t) => t.name)).toEqual(["Alpha", "Beta"]);
    expect(memberInserts).toHaveLength(2);
    expect(memberInserts.every((m) => m.role === "OWNER")).toBe(true);
  });

  it("rolls back team insert when owner member insert fails", async () => {
    const teamInserts: TeamRow[] = [];
    const teamDeletes: string[] = [];
    const db = {
      insertTeam: async (row: TeamRow) => {
        teamInserts.push(row);
        return row;
      },
      insertTeamMember: async () => {
        throw new Error("BOOM");
      },
      deleteTeam: async (id: string) => {
        teamDeletes.push(id);
      },
    } as unknown as Queries;

    await expect(
      _createTeam({ name: "Alpha" }, { actor }, db),
    ).rejects.toThrow("BOOM");
    expect(teamDeletes).toEqual([teamInserts[0].id]);
  });
});

describe("_getMyTeams", () => {
  it("returns empty array when owner has no teams", async () => {
    const db = {
      listTeamsByOwnerId: async () => [],
    } as unknown as Queries;
    const res = await _getMyTeams({}, { actor }, db);
    expect(res).toEqual({ ok: true, data: [] });
  });

  it("returns all teams owned by the actor in queries order", async () => {
    const rows = [
      makeTeamRow({ id: "a", name: "Alpha" }),
      makeTeamRow({ id: "b", name: "Beta" }),
    ];
    const db = {
      listTeamsByOwnerId: async () => rows,
    } as unknown as Queries;

    const res = await _getMyTeams({}, { actor }, db);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
