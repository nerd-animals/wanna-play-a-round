import { describe, it, expect } from "vitest";
import { _createTeam, _getMyTeams, getTeamView } from "./team";
import type { Queries } from "@/server/db/queries";
import type { SessionUser } from "@/server/session";
import type {
  MatchPostRow,
  MatchProposalRow,
  MatchRow,
  TeamRow,
} from "@/server/db/rows";

const actor: SessionUser = {
  id: "user-1",
  discordUserId: "discord-1",
  username: "tester",
};

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

function makeMatchPostRow(over: Partial<MatchPostRow> = {}): MatchPostRow {
  return {
    id: "post-1",
    team_id: "team-1",
    title: "Scrim",
    description: null,
    min_tier: null,
    max_tier: null,
    available_time: "2099-12-31T22:00:00.000Z",
    status: "OPEN",
    created_by_user_id: actor.id,
    created_at: "2026-05-20T00:00:00.000Z",
    updated_at: "2026-05-20T00:00:00.000Z",
    ...over,
  };
}

function makeProposalRow(
  over: Partial<MatchProposalRow> = {},
): MatchProposalRow {
  return {
    id: "proposal-1",
    post_id: "post-1",
    applicant_team_id: "team-2",
    applicant_post_id: "post-2",
    status: "PENDING",
    created_by_user_id: "owner-2",
    created_at: "2026-05-20T00:00:00.000Z",
    updated_at: "2026-05-20T00:00:00.000Z",
    ...over,
  };
}

function makeMatchRow(over: Partial<MatchRow> = {}): MatchRow {
  return {
    id: "match-1",
    left_post_id: "post-1",
    right_post_id: "post-2",
    left_team_id: "team-1",
    right_team_id: "team-2",
    origin: "MANUAL",
    confirmed_at: "2026-05-20T00:00:00.000Z",
    ...over,
  };
}

describe("_createTeam", () => {
  it("returns TEAM_NAME_REQUIRED when name is blank", async () => {
    const db = {} as Queries;
    const res = await _createTeam({ name: "   " }, { actor }, db);
    expect(res).toEqual({ ok: false, code: "TEAM_NAME_REQUIRED" });
  });

  it("allows a second team for the same owner without creating owner members", async () => {
    const teamInserts: TeamRow[] = [];
    const db = {
      insertTeam: async (row: TeamRow) => {
        teamInserts.push(row);
        return row;
      },
    } as unknown as Queries;

    const first = await _createTeam({ name: "Alpha" }, { actor }, db);
    const second = await _createTeam({ name: "Beta" }, { actor }, db);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(teamInserts.map((t) => t.name)).toEqual(["Alpha", "Beta"]);
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

describe("getTeamView", () => {
  it("returns manual match candidates, proposals, and confirmed matches", async () => {
    const team = makeTeamRow({ id: "team-1", name: "Mine" });
    const otherTeam = makeTeamRow({
      id: "team-2",
      owner_user_id: "owner-2",
      name: "Other",
    });
    const ownPost = makeMatchPostRow({ id: "post-1", team_id: team.id });
    const otherPost = makeMatchPostRow({
      id: "post-2",
      team_id: otherTeam.id,
      title: "Other scrim",
      created_by_user_id: "owner-2",
    });
    const incomingProposal = makeProposalRow({
      id: "proposal-in",
      post_id: ownPost.id,
      applicant_team_id: otherTeam.id,
      applicant_post_id: otherPost.id,
    });
    const outgoingProposal = makeProposalRow({
      id: "proposal-out",
      post_id: otherPost.id,
      applicant_team_id: team.id,
      applicant_post_id: ownPost.id,
      created_by_user_id: actor.id,
    });
    const match = makeMatchRow();

    const teams = new Map([
      [team.id, team],
      [otherTeam.id, otherTeam],
    ]);
    const posts = new Map([
      [ownPost.id, ownPost],
      [otherPost.id, otherPost],
    ]);
    const db = {
      findTeamById: async (id: string) => teams.get(id) ?? null,
      listTeamMembers: async () => [],
      listInviteLinks: async () => [],
      listMatchPosts: async () => [ownPost],
      listOpenMatchPosts: async () => [ownPost, otherPost],
      listMatchProposals: async ({ teamId }: { teamId?: string }) =>
        teamId === team.id ? [outgoingProposal] : [],
      listMatchProposalsForPostIds: async () => [incomingProposal],
      listMatchesForTeam: async () => [match],
      findMatchPostById: async (id: string) => posts.get(id) ?? null,
      findOpenMatchPost: async (teamId: string) =>
        [...posts.values()].find(
          (post) => post.team_id === teamId && post.status === "OPEN",
        ) ?? null,
    } as unknown as Queries;

    const res = await getTeamView({ teamId: team.id }, db);

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data.manualMatch.candidates).toMatchObject([
      {
        team: { id: otherTeam.id, name: otherTeam.name },
        post: { id: otherPost.id },
        hasPendingProposal: true,
      },
    ]);
    expect(res.data.manualMatch.incomingProposals).toMatchObject([
      {
        proposal: { id: incomingProposal.id },
        applicantTeam: { id: otherTeam.id },
        applicantPost: { id: otherPost.id },
      },
    ]);
    expect(res.data.manualMatch.outgoingProposals).toMatchObject([
      {
        proposal: { id: outgoingProposal.id },
        targetTeam: { id: otherTeam.id },
        targetPost: { id: otherPost.id },
      },
    ]);
    expect(res.data.manualMatch.confirmedMatches).toMatchObject([
      {
        match: { id: match.id },
        leftTeam: { id: team.id },
        rightTeam: { id: otherTeam.id },
      },
    ]);
  });
});
