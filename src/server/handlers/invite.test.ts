import { describe, expect, it } from "vitest";
import { _createInviteLink, _joinByInvite, getInviteLink } from "./invite";
import type { Queries } from "@/server/db/queries";
import type { InviteLinkRow, TeamMemberRow, TeamRow } from "@/server/db/rows";
import type { SessionUser } from "@/server/session";

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

const riotReq = {
  token: "token-1",
  riotGameName: "Hide on bush",
  riotTagLine: "KR1",
  soloTier: "GOLD" as const,
};

const guildMemberService = {
  isDiscordGuildMember: async () => true,
};

function makeInviteLink(over: Partial<InviteLinkRow> = {}): InviteLinkRow {
  return {
    id: "link-1",
    team_id: team.id,
    token: "token-1",
    created_by_user_id: actor.id,
    status: "ACTIVE",
    max_uses: null,
    used_count: 0,
    expires_at: null,
    created_at: "2026-05-20T00:00:00.000Z",
    ...over,
  };
}

function makeMember(over: Partial<TeamMemberRow> = {}): TeamMemberRow {
  return {
    id: "member-1",
    team_id: team.id,
    user_id: actor.id,
    display_name: "Hide on bush#KR1",
    riot_game_name: "Hide on bush",
    riot_tag_line: "KR1",
    solo_tier: "GOLD",
    role: "MEMBER",
    status: "ACTIVE",
    created_at: "2026-05-20T00:00:00.000Z",
    joined_at: "2026-05-20T00:00:00.000Z",
    ...over,
  };
}

function activeMembers(count: number): TeamMemberRow[] {
  return Array.from({ length: count }, (_, i) =>
    makeMember({ id: `member-${i}`, user_id: `user-${i}` }),
  );
}

describe("_createInviteLink", () => {
  it("inserts an ACTIVE invite link for the owner team", async () => {
    const inserts: InviteLinkRow[] = [];
    const db = {
      insertInviteLink: async (row: InviteLinkRow) => {
        inserts.push(row);
        return row;
      },
    } as unknown as Queries;

    const res = await _createInviteLink(
      { teamId: team.id, maxUses: 5, expiresAt: "2026-06-01T00:00:00.000Z" },
      { actor, team },
      db,
    );

    expect(res.ok).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      team_id: team.id,
      created_by_user_id: actor.id,
      status: "ACTIVE",
      max_uses: 5,
      used_count: 0,
      expires_at: "2026-06-01T00:00:00.000Z",
    });
    expect(inserts[0].token).toBeTruthy();
  });
});

describe("getInviteLink", () => {
  it("returns null data when token does not exist", async () => {
    const db = {
      findInviteLinkByToken: async () => null,
    } as unknown as Queries;

    await expect(getInviteLink({ token: "missing" }, db)).resolves.toEqual({
      ok: true,
      data: null,
    });
  });
});

describe("_joinByInvite", () => {
  it("returns INVITE_NOT_FOUND for an unknown token", async () => {
    const db = {
      findInviteLinkByToken: async () => null,
    } as unknown as Queries;

    await expect(
      _joinByInvite(riotReq, { actor }, db, guildMemberService),
    ).resolves.toEqual({ ok: false, code: "INVITE_NOT_FOUND" });
  });

  it("returns INVITE_INACTIVE when the link is disabled", async () => {
    const db = {
      findInviteLinkByToken: async () =>
        makeInviteLink({ status: "DISABLED" }),
    } as unknown as Queries;

    await expect(
      _joinByInvite(riotReq, { actor }, db, guildMemberService),
    ).resolves.toEqual({ ok: false, code: "INVITE_INACTIVE" });
  });

  it("returns INVITE_EXHAUSTED when max uses is reached", async () => {
    const db = {
      findInviteLinkByToken: async () =>
        makeInviteLink({ max_uses: 1, used_count: 1 }),
    } as unknown as Queries;

    await expect(
      _joinByInvite(riotReq, { actor }, db, guildMemberService),
    ).resolves.toEqual({ ok: false, code: "INVITE_EXHAUSTED" });
  });

  it("requires Discord guild membership before joining", async () => {
    const db = {
      findInviteLinkByToken: async () => makeInviteLink(),
      findTeamById: async () => team,
    } as unknown as Queries;

    await expect(
      _joinByInvite(riotReq, { actor }, db, {
        isDiscordGuildMember: async () => false,
      }),
    ).resolves.toEqual({
      ok: false,
      code: "DISCORD_GUILD_MEMBERSHIP_REQUIRED",
    });
  });

  it("requires Riot profile fields", async () => {
    const db = {
      findInviteLinkByToken: async () => makeInviteLink(),
      findTeamById: async () => team,
    } as unknown as Queries;

    await expect(
      _joinByInvite(
        { ...riotReq, riotGameName: " ", riotTagLine: "" },
        { actor },
        db,
        guildMemberService,
      ),
    ).resolves.toEqual({ ok: false, code: "RIOT_PROFILE_REQUIRED" });
  });

  it("returns TEAM_FULL when adding a new active member would exceed five", async () => {
    const db = {
      findInviteLinkByToken: async () => makeInviteLink(),
      findTeamById: async () => team,
      findTeamMemberByUserId: async () => null,
      listTeamMembers: async () => activeMembers(5),
    } as unknown as Queries;

    await expect(
      _joinByInvite(riotReq, { actor }, db, guildMemberService),
    ).resolves.toEqual({ ok: false, code: "TEAM_FULL" });
  });

  it("creates an ACTIVE member with Riot profile and increments used count", async () => {
    const insertedMembers: TeamMemberRow[] = [];
    const incrementedLinkIds: string[] = [];
    const db = {
      findInviteLinkByToken: async () => makeInviteLink(),
      findTeamById: async () => team,
      findTeamMemberByUserId: async () => null,
      listTeamMembers: async () => activeMembers(4),
      insertTeamMember: async (row: TeamMemberRow) => {
        insertedMembers.push(row);
        return row;
      },
      incrementInviteLinkUsedCount: async (id: string) => {
        incrementedLinkIds.push(id);
      },
    } as unknown as Queries;

    const res = await _joinByInvite(riotReq, { actor }, db, guildMemberService);

    expect(res.ok).toBe(true);
    expect(insertedMembers[0]).toMatchObject({
      team_id: team.id,
      user_id: actor.id,
      display_name: "Hide on bush#KR1",
      riot_game_name: "Hide on bush",
      riot_tag_line: "KR1",
      solo_tier: "GOLD",
      role: "MEMBER",
      status: "ACTIVE",
    });
    expect(incrementedLinkIds).toEqual(["link-1"]);
  });

  it("reuses an ACTIVE session membership without consuming the invite again", async () => {
    const updatedMembers: TeamMemberRow[] = [];
    const incrementedLinkIds: string[] = [];
    const db = {
      findInviteLinkByToken: async () => makeInviteLink(),
      findTeamById: async () => team,
      findTeamMemberByUserId: async () =>
        makeMember({
          display_name: "Old#KR1",
          riot_game_name: "Old",
          solo_tier: "SILVER",
        }),
      updateTeamMember: async (row: TeamMemberRow) => {
        updatedMembers.push(row);
        return row;
      },
      incrementInviteLinkUsedCount: async (id: string) => {
        incrementedLinkIds.push(id);
      },
    } as unknown as Queries;

    const res = await _joinByInvite(riotReq, { actor }, db, guildMemberService);

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.reusedExistingMembership).toBe(true);
    expect(updatedMembers[0]).toMatchObject({
      display_name: "Hide on bush#KR1",
      riot_game_name: "Hide on bush",
      riot_tag_line: "KR1",
      solo_tier: "GOLD",
    });
    expect(incrementedLinkIds).toHaveLength(0);
  });
});
