import { describe, expect, it, vi } from "vitest";
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
    applicant_post_id: "post-applicant",
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
      listMatchProposals: async () => [],
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
      applicant_post_id: "post-applicant",
      status: "PENDING",
      created_by_user_id: applicantOwner.id,
    });
  });

  it("rejects duplicate pending proposals for the same post and applicant team", async () => {
    const db = {
      findMatchPostById: async () => makePost(),
      findOpenMatchPost: async () =>
        makePost({ id: "post-applicant", team_id: applicantTeam.id }),
      listMatchProposals: async () => [makeProposal()],
    } as unknown as Queries;

    await expect(
      _proposeMatch(
        { postId: "post-target", teamId: applicantTeam.id },
        { actor: applicantOwner, team: applicantTeam },
        db,
      ),
    ).resolves.toEqual({ ok: false, code: "MATCH_PROPOSAL_ALREADY_EXISTS" });
  });

  it("allows a new proposal after a previous proposal was rejected", async () => {
    const inserted: MatchProposalRow[] = [];
    const db = {
      findMatchPostById: async () => makePost(),
      findOpenMatchPost: async () =>
        makePost({ id: "post-applicant", team_id: applicantTeam.id }),
      listMatchProposals: async () => [makeProposal({ status: "REJECTED" })],
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
    expect(inserted).toHaveLength(1);
  });
});

describe("_acceptMatchProposal", () => {
  it("accepts a proposal atomically and notifies Discord", async () => {
    const notifiedMatchIds: string[] = [];
    const match = {
      id: "match-1",
      left_post_id: "post-target",
      right_post_id: "post-applicant",
      left_team_id: targetTeam.id,
      right_team_id: applicantTeam.id,
      origin: "MANUAL",
      confirmed_at: "2026-05-20T00:00:00.000Z",
    } satisfies MatchRow;
    const db = {
      acceptMatchProposal: async () => ({
        ok: true,
        proposal: makeProposal({ status: "ACCEPTED" }),
        match,
      }),
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
    expect(res).toMatchObject({
      ok: true,
      data: {
        proposal: { status: "ACCEPTED" },
        match: { id: "match-1" },
      },
    });
    expect(notifiedMatchIds).toEqual(["match-1"]);
  });

  it("returns MATCH_POST_ALREADY_CLOSED when the atomic accept loses the race", async () => {
    const db = {
      acceptMatchProposal: async () => ({
        ok: false,
        code: "MATCH_POST_ALREADY_CLOSED",
      }),
    } as unknown as Queries;

    await expect(
      _acceptMatchProposal({ proposalId: "proposal-1" }, { actor: owner }, db, {
        sendMatchConfirmedNotification: async () => undefined,
      }),
    ).resolves.toEqual({ ok: false, code: "MATCH_POST_ALREADY_CLOSED" });
  });

  it("still succeeds when Discord notification fails after acceptance", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const db = {
      acceptMatchProposal: async () => ({
        ok: true,
        proposal: makeProposal({ status: "ACCEPTED" }),
        match: {
          id: "match-1",
          left_post_id: "post-target",
          right_post_id: "post-applicant",
          left_team_id: targetTeam.id,
          right_team_id: applicantTeam.id,
          origin: "MANUAL",
          confirmed_at: "2026-05-20T00:00:00.000Z",
        } satisfies MatchRow,
      }),
    } as unknown as Queries;

    try {
      const res = await _acceptMatchProposal(
        { proposalId: "proposal-1" },
        { actor: owner },
        db,
        {
          sendMatchConfirmedNotification: async () => {
            throw new Error("discord down");
          },
        },
      );

      expect(res).toMatchObject({
        ok: true,
        data: {
          proposal: { status: "ACCEPTED" },
          match: { id: "match-1" },
        },
      });
      expect(errorSpy).toHaveBeenCalledWith(
        "MATCH_CONFIRMED_NOTIFICATION_FAILED",
        expect.any(Error),
      );
    } finally {
      errorSpy.mockRestore();
    }
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
