import { beforeEach, describe, expect, it, vi } from "vitest";
import { withSession, withTeamMember, withTeamOwner } from "./authz";
import type { Queries } from "./db/queries";
import type { TeamMemberRow, TeamRow } from "./db/rows";
import { getCurrentUser } from "./session";
import type { SessionUser } from "./session";

vi.mock("./session", () => ({
  getCurrentUser: vi.fn(),
}));

const actor: SessionUser = {
  id: "user-1",
  discordUserId: "discord-1",
  username: "tester",
};

const team: TeamRow = {
  id: "team-1",
  owner_user_id: actor.id,
  name: "Team",
  description: null,
  activity_time: null,
  created_at: "2026-05-20T00:00:00.000Z",
  updated_at: "2026-05-20T00:00:00.000Z",
};

function makeMember(over: Partial<TeamMemberRow> = {}): TeamMemberRow {
  return {
    id: "member-1",
    team_id: team.id,
    user_id: actor.id,
    display_name: "tester",
    riot_game_name: "tester",
    riot_tag_line: "KR1",
    solo_tier: "GOLD",
    role: "MEMBER",
    status: "ACTIVE",
    created_at: "2026-05-20T00:00:00.000Z",
    joined_at: "2026-05-20T00:00:00.000Z",
    ...over,
  };
}

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  mockedGetCurrentUser.mockReset();
});

describe("withSession", () => {
  it("returns UNAUTHORIZED when there is no current user", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    const handler = withSession(async () => ({ ok: true, data: "ok" }));

    await expect(handler({}, {} as Queries)).resolves.toEqual({
      ok: false,
      code: "UNAUTHORIZED",
    });
  });

  it("passes the actor to the wrapped handler", async () => {
    mockedGetCurrentUser.mockResolvedValue(actor);
    const handler = withSession(async (_req: { value: string }, ctx) => ({
      ok: true,
      data: `${ctx.actor.id}:ok`,
    }));

    await expect(handler({ value: "x" }, {} as Queries)).resolves.toEqual({
      ok: true,
      data: "user-1:ok",
    });
  });
});

describe("withTeamOwner", () => {
  it("returns TEAM_NOT_FOUND when the team does not exist", async () => {
    mockedGetCurrentUser.mockResolvedValue(actor);
    const db = {
      findTeamById: async () => null,
    } as unknown as Queries;
    const handler = withTeamOwner(async () => ({ ok: true, data: "ok" }));

    await expect(handler({ teamId: team.id }, db)).resolves.toEqual({
      ok: false,
      code: "TEAM_NOT_FOUND",
    });
  });

  it("returns FORBIDDEN when the actor is not the owner", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: "other",
      discordUserId: "discord-other",
      username: "other",
    });
    const db = {
      findTeamById: async () => team,
    } as unknown as Queries;
    const handler = withTeamOwner(async () => ({ ok: true, data: "ok" }));

    await expect(handler({ teamId: team.id }, db)).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
  });

  it("passes actor and team to the wrapped handler for the owner", async () => {
    mockedGetCurrentUser.mockResolvedValue(actor);
    const db = {
      findTeamById: async () => team,
    } as unknown as Queries;
    const handler = withTeamOwner(async (_req, ctx) => ({
      ok: true,
      data: `${ctx.actor.id}:${ctx.team.id}`,
    }));

    await expect(handler({ teamId: team.id }, db)).resolves.toEqual({
      ok: true,
      data: "user-1:team-1",
    });
  });
});

describe("withTeamMember", () => {
  it("returns TEAM_NOT_FOUND when the team does not exist", async () => {
    mockedGetCurrentUser.mockResolvedValue(actor);
    const db = {
      findTeamById: async () => null,
    } as unknown as Queries;
    const handler = withTeamMember(async () => ({ ok: true, data: "ok" }));

    await expect(handler({ teamId: team.id }, db)).resolves.toEqual({
      ok: false,
      code: "TEAM_NOT_FOUND",
    });
  });

  it("returns FORBIDDEN when the actor is not an ACTIVE member", async () => {
    mockedGetCurrentUser.mockResolvedValue(actor);
    const db = {
      findTeamById: async () => team,
      findTeamMemberByUserId: async () => makeMember({ status: "REMOVED" }),
    } as unknown as Queries;
    const handler = withTeamMember(async () => ({ ok: true, data: "ok" }));

    await expect(handler({ teamId: team.id }, db)).resolves.toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
  });

  it("passes actor and team to the wrapped handler for an ACTIVE member", async () => {
    mockedGetCurrentUser.mockResolvedValue(actor);
    const db = {
      findTeamById: async () => team,
      findTeamMemberByUserId: async () => makeMember(),
    } as unknown as Queries;
    const handler = withTeamMember(async (_req, ctx) => ({
      ok: true,
      data: `${ctx.actor.id}:${ctx.team.id}`,
    }));

    await expect(handler({ teamId: team.id }, db)).resolves.toEqual({
      ok: true,
      data: "user-1:team-1",
    });
  });
});
