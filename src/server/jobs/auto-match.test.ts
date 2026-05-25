import { describe, expect, it } from "vitest";
import { findAutoMatchCandidates, runAutoMatch } from "./auto-match";
import type { Queries } from "@/server/db/queries";
import type { MatchPostRow, TeamMemberRow } from "@/server/db/rows";

function post(overrides: Partial<MatchPostRow>): MatchPostRow {
  return {
    id: "post",
    team_id: "team",
    title: "Post",
    description: null,
    min_tier: null,
    max_tier: null,
    available_time: "2099-12-31T22:00:00.000Z",
    status: "OPEN",
    created_by_user_id: "owner",
    created_at: "2026-05-25T00:00:00.000Z",
    updated_at: "2026-05-25T00:00:00.000Z",
    ...overrides,
  };
}

function member(teamId: string, tier: TeamMemberRow["solo_tier"]): TeamMemberRow {
  return {
    id: `${teamId}-${tier}`,
    team_id: teamId,
    user_id: `${teamId}-user`,
    display_name: `${teamId}#KR1`,
    riot_game_name: teamId,
    riot_tag_line: "KR1",
    solo_tier: tier,
    role: "MEMBER",
    status: "ACTIVE",
    created_at: "2026-05-25T00:00:00.000Z",
    joined_at: "2026-05-25T00:00:00.000Z",
  };
}

describe("auto-match job", () => {
  it("finds compatible open posts with matching time and tier delta", async () => {
    const db = {
      listOpenMatchPosts: async () => [
        post({ id: "left-post", team_id: "left-team" }),
        post({ id: "right-post", team_id: "right-team" }),
        post({
          id: "different-time-post",
          team_id: "different-time-team",
          available_time: "2099-12-31T23:00:00.000Z",
        }),
      ],
      listTeamMembers: async (teamId: string) => {
        if (teamId === "left-team") return [member(teamId, "GOLD")];
        if (teamId === "right-team") return [member(teamId, "PLATINUM")];
        return [member(teamId, "CHALLENGER")];
      },
    } as unknown as Queries;

    await expect(findAutoMatchCandidates(db, 1)).resolves.toEqual([
      {
        leftPostId: "left-post",
        rightPostId: "right-post",
        leftTeamId: "left-team",
        rightTeamId: "right-team",
        availableTime: "2099-12-31T22:00:00.000Z",
        averageTierDelta: 1,
      },
    ]);
  });

  it("returns a dry-run result without mutating match state", async () => {
    const db = {
      listOpenMatchPosts: async () => [
        post({ id: "left-post", team_id: "left-team" }),
        post({ id: "right-post", team_id: "right-team" }),
      ],
      listTeamMembers: async (teamId: string) => [member(teamId, "GOLD")],
    } as unknown as Queries;

    await expect(runAutoMatch({ db, maxAverageTierDelta: 0 })).resolves.toEqual({
      dryRun: true,
      maxAverageTierDelta: 0,
      candidates: [
        {
          leftPostId: "left-post",
          rightPostId: "right-post",
          leftTeamId: "left-team",
          rightTeamId: "right-team",
          availableTime: "2099-12-31T22:00:00.000Z",
          averageTierDelta: 0,
        },
      ],
    });
  });
});
