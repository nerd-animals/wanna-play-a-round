import { describe, expect, it } from "vitest";
import { getMatchDiscoveryView } from "./match-discovery";
import type { Queries } from "@/server/db/queries";
import type { SessionUser } from "@/server/session";
import type {
  MatchPostRow,
  MatchProposalRow,
  TeamMemberRow,
  TeamRow,
} from "@/server/db/rows";

const actor: SessionUser = {
  id: "owner-1",
  discordUserId: "discord-owner-1",
  username: "owner",
};

function makeTeamRow(over: Partial<TeamRow> = {}): TeamRow {
  return {
    id: "team-1",
    owner_user_id: actor.id,
    name: "Team",
    description: null,
    activity_time: "Weekdays 21:00-24:00",
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
    description: "Looking for practice",
    min_tier: "SILVER",
    max_tier: "PLATINUM",
    available_time: "2099-12-31T22:00:00.000Z",
    status: "OPEN",
    created_by_user_id: actor.id,
    created_at: "2026-05-20T00:00:00.000Z",
    updated_at: "2026-05-20T00:00:00.000Z",
    ...over,
  };
}

function makeMember(over: Partial<TeamMemberRow> = {}): TeamMemberRow {
  return {
    id: "member-1",
    team_id: "team-1",
    user_id: "user-1",
    display_name: "Rift#KR1",
    riot_game_name: "Rift",
    riot_tag_line: "KR1",
    solo_tier: "GOLD",
    role: "MEMBER",
    status: "ACTIVE",
    created_at: "2026-05-20T00:00:00.000Z",
    joined_at: "2026-05-20T00:00:00.000Z",
    ...over,
  };
}

function makeProposalRow(
  over: Partial<MatchProposalRow> = {},
): MatchProposalRow {
  return {
    id: "proposal-1",
    post_id: "post-2",
    applicant_team_id: "team-1",
    applicant_post_id: "post-1",
    status: "PENDING",
    created_by_user_id: actor.id,
    created_at: "2026-05-20T00:00:00.000Z",
    updated_at: "2026-05-20T00:00:00.000Z",
    ...over,
  };
}

describe("getMatchDiscoveryView", () => {
  it("returns searchable opponent posts with applicant readiness context", async () => {
    const myTeam = makeTeamRow({ id: "team-1", name: "Mine" });
    const otherTeam = makeTeamRow({
      id: "team-2",
      owner_user_id: "owner-2",
      name: "Night Scrim",
    });
    const myPost = makeMatchPostRow({ id: "post-1", team_id: myTeam.id });
    const otherPost = makeMatchPostRow({
      id: "post-2",
      team_id: otherTeam.id,
      title: "Late night practice",
      created_by_user_id: "owner-2",
    });
    const teams = new Map([
      [myTeam.id, myTeam],
      [otherTeam.id, otherTeam],
    ]);
    const members = new Map([
      [myTeam.id, Array.from({ length: 5 }, (_, i) => makeMember({ id: `mine-${i}` }))],
      [
        otherTeam.id,
        Array.from({ length: 5 }, (_, i) =>
          makeMember({ id: `other-${i}`, team_id: otherTeam.id }),
        ),
      ],
    ]);
    const db = {
      listTeamsByOwnerId: async () => [myTeam],
      listTeamMembers: async (teamId: string) => members.get(teamId) ?? [],
      findOpenMatchPost: async () => myPost,
      listMatchProposals: async () => [makeProposalRow()],
      listOpenMatchPosts: async () => [myPost, otherPost],
      findTeamById: async (id: string) => teams.get(id) ?? null,
    } as unknown as Queries;

    const view = await getMatchDiscoveryView(
      { q: "night", tier: "GOLD", time: "ALL" },
      { actor },
      db,
    );

    expect(view.myTeam).toMatchObject({ id: myTeam.id });
    expect(view.myOpenPost).toMatchObject({ id: myPost.id });
    expect(view.myActiveMemberCount).toBe(5);
    expect(view.items).toMatchObject([
      {
        post: { id: otherPost.id },
        team: { id: otherTeam.id },
        activeMemberCount: 5,
        averageTierLabel: "GOLD",
        hasPendingProposal: true,
      },
    ]);
  });

  it("filters out posts outside the selected tier range", async () => {
    const otherTeam = makeTeamRow({
      id: "team-2",
      owner_user_id: "owner-2",
      name: "Other",
    });
    const otherPost = makeMatchPostRow({
      id: "post-2",
      team_id: otherTeam.id,
      min_tier: "DIAMOND",
      max_tier: "MASTER",
    });
    const db = {
      listTeamsByOwnerId: async () => [],
      listOpenMatchPosts: async () => [otherPost],
      findTeamById: async () => otherTeam,
      listTeamMembers: async () => [],
    } as unknown as Queries;

    const view = await getMatchDiscoveryView({ tier: "GOLD" }, { actor }, db);

    expect(view.items).toHaveLength(0);
  });
});
