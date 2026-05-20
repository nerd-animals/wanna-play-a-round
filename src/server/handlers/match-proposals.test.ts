import { describe, expect, it } from "vitest";
import {
  _acceptMatchProposal,
  _proposeMatch,
  _rejectMatchProposal,
  _withdrawMatchProposal,
} from "./match-proposals";
import type { Queries } from "@/server/db/queries";
import type {
  MatchPostRow,
  MatchProposalRow,
  MatchRow,
  TeamRow,
} from "@/server/db/rows";
import type { SessionUser } from "@/server/session";

const owner: SessionUser = {
  id: "owner-1",
  discordUserId: "discord-owner-1",
  username: "owner",
};

const applicantOwner: SessionUser = {
  id: "owner-2",
  discordUserId: "discord-owner-2",
  username: "applicant",
};

const targetTeam: TeamRow = {
  id: "team-target",
  owner_user_id: owner.id,
  name: "Target",
  description: null,
  activity_time: null,
  created_at: "2026-05-20T00:00:00.000Z",
  updated_at: "2026-05-20T00:00:00.000Z",
};

const applicantTeam: TeamRow = {
  id: "team-applicant",
  owner_user_id: applicantOwner.id,
  name: "Applicant",
  description: null,
  activity_time: null,
  created_at: "2026-05-20T00:00:00.000Z",
  updated_at: "2026-05-20T00:00:00.000Z",
};

function makePost(over: Partial<MatchPostRow> = {}): MatchPostRow {
  return {
    id: "post-target",
    team_id: targetTeam.id,
    title: "Target scrim",
    description: null,
    min_tier: null,
    max_tier: null,
    available_time: null,
    status: "OPEN",
    created_by_user_id: owner.id,
    created_at: "2026-05-20T00:00:00.000Z",
    updated_at: "2026-05-20T00:00:00.000Z",
    ...over,
  };
}

function makeProposal(
  over: Partial<MatchProposalRow> = {},
): MatchProposalRow {
  return {
    id: "proposal-1",
    post_id: "post-target",
    applicant_team_id: applicantTeam.id,
    status: "PENDING",
    created_by_user_id: applicantOwner.id,
    created_at: "2026-05-20T00:00:00.000Z",
    updated_at: "2026-05-20T00:00:00.000Z",
    ...over,
  };
}

describe("_proposeMatch", () => {
  it("rejects proposals to the applicant team's own post", async () => {
    const db = {
      findMatchPostById: async () => makePost({ team_id: applicantTeam.id }),
    } as unknown as Queries;

    await expect(
      _proposeMatch(
        { postId: "post-target", teamId: applicantTeam.id },
        { actor: applicantOwner, team: applicantTeam },
        db,
      ),
    ).resolves.toEqual({ ok: false, code: "CANNOT_PROPOSE_TO_OWN_POST" });
  });

  it("creates a pending proposal when the applicant team has an OPEN post", async () => {
    const inserted: MatchProposalRow[] = [];
    const db = {
      findMatchPostById: async () => makePost(),
      findOpenMatchPost: async () =>
        makePost({ id: "post-applicant", team_id: applicantTeam.id }),
      insertMatchProposal: async (row: MatchProposalRow) => {
        inserted.push(row);
        return row;
      },
    } as unknown as Queries;

    const res = await _proposeMatch(
      { postId: "post-target", teamId: applicantTeam.id },
      { actor: applicantOwner, team: applicantTeam },
      db,
    );

    expect(res.ok).toBe(true);
    expect(inserted[0]).toMatchObject({
      post_id: "post-target",
      applicant_team_id: applicantTeam.id,
      status: "PENDING",
      created_by_user_id: applicantOwner.id,
    });
  });
});

describe("_acceptMatchProposal", () => {
  it("creates a manual match, closes both OPEN posts, accepts proposal, and notifies Discord", async () => {
    const closedPostIds: string[] = [];
    const insertedMatches: MatchRow[] = [];
    const updatedProposalStatuses: string[] = [];
    const notifiedMatchIds: string[] = [];
    const db = {
      findMatchProposalById: async () => makeProposal(),
      findMatchPostById: async () => makePost(),
      findTeamById: async () => targetTeam,
      findOpenMatchPost: async () =>
        makePost({ id: "post-applicant", team_id: applicantTeam.id }),
      closeMatchPostIfOpen: async (id: string) => {
        closedPostIds.push(id);
        return makePost({ id, status: "CLOSED" });
      },
      insertMatch: async (row: MatchRow) => {
        insertedMatches.push(row);
        return row;
      },
      updateMatchProposalStatus: async (
        id: string,
        status: MatchProposalRow["status"],
      ) => {
        updatedProposalStatuses.push(`${id}:${status}`);
        return makeProposal({ id, status });
      },
    } as unknown as Queries;

    const res = await _acceptMatchProposal(
      { proposalId: "proposal-1" },
      { actor: owner },
      db,
      {
        sendMatchConfirmedNotification: async (matchId: string) => {
          notifiedMatchIds.push(matchId);
        },
      },
    );

    expect(res.ok).toBe(true);
    expect(closedPostIds).toEqual(["post-target", "post-applicant"]);
    expect(insertedMatches[0]).toMatchObject({
      left_post_id: "post-target",
      right_post_id: "post-applicant",
      left_team_id: targetTeam.id,
      right_team_id: applicantTeam.id,
      origin: "MANUAL",
    });
    expect(updatedProposalStatuses).toEqual(["proposal-1:ACCEPTED"]);
    expect(notifiedMatchIds).toEqual([insertedMatches[0].id]);
  });

  it("returns MATCH_POST_ALREADY_CLOSED when a conditional close loses the race", async () => {
    const db = {
      findMatchProposalById: async () => makeProposal(),
      findMatchPostById: async () => makePost(),
      findTeamById: async () => targetTeam,
      findOpenMatchPost: async () =>
        makePost({ id: "post-applicant", team_id: applicantTeam.id }),
      closeMatchPostIfOpen: async () => null,
    } as unknown as Queries;

    await expect(
      _acceptMatchProposal({ proposalId: "proposal-1" }, { actor: owner }, db, {
        sendMatchConfirmedNotification: async () => undefined,
      }),
    ).resolves.toEqual({ ok: false, code: "MATCH_POST_ALREADY_CLOSED" });
  });
});

describe("_rejectMatchProposal and _withdrawMatchProposal", () => {
  it("lets the target team owner reject a pending proposal", async () => {
    const db = {
      findMatchProposalById: async () => makeProposal(),
      findMatchPostById: async () => makePost(),
      findTeamById: async () => targetTeam,
      updateMatchProposalStatus: async (
        id: string,
        status: MatchProposalRow["status"],
      ) => makeProposal({ id, status }),
    } as unknown as Queries;

    const res = await _rejectMatchProposal(
      { proposalId: "proposal-1" },
      { actor: owner },
      db,
    );

    expect(res).toMatchObject({
      ok: true,
      data: { id: "proposal-1", status: "REJECTED" },
    });
  });

  it("lets the applicant team owner withdraw a pending proposal", async () => {
    const db = {
      findMatchProposalById: async () => makeProposal(),
      findTeamById: async () => applicantTeam,
      updateMatchProposalStatus: async (
        id: string,
        status: MatchProposalRow["status"],
      ) => makeProposal({ id, status }),
    } as unknown as Queries;

    const res = await _withdrawMatchProposal(
      { proposalId: "proposal-1" },
      { actor: applicantOwner },
      db,
    );

    expect(res).toMatchObject({
      ok: true,
      data: { id: "proposal-1", status: "WITHDRAWN" },
    });
  });
});
