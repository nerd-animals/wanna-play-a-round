import fs from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import { http, passthrough } from "msw";
import { getSupabaseAdminClient, isSupabaseConfigured } from "./client";
import { queries } from "./queries";
import { server } from "@/tests/mocks/server";
import type {
  InviteLinkRow,
  MatchPostRow,
  MatchProposalRow,
  TeamMemberRow,
  TeamRow,
  UserRow,
} from "./rows";
import type { LolTier } from "@/shared/domain";

const TEST_PREFIX = `query-it-${Date.now()}`;
const FUTURE_TIME = new Date("2099-12-31T22:00:00.000Z").toISOString();
const PAST_TIME = new Date("2020-01-01T00:00:00.000Z").toISOString();

let counter = 0;

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadLocalEnv(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;

    const [, key, value] = match;
    process.env[key] ??= stripQuotes(value);
  }
}

loadLocalEnv();

const describeIfSupabase = isSupabaseConfigured() ? describe : describe.skip;

function nextId(label: string): string {
  counter += 1;
  return `${TEST_PREFIX}-${label}-${counter}`;
}

function now(): string {
  return new Date().toISOString();
}

async function cleanupTestData(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const client = getSupabaseAdminClient();
  const like = `${TEST_PREFIX}%`;
  const tables = [
    "matches",
    "match_proposals",
    "match_posts",
    "team_invite_links",
    "team_members",
    "teams",
    "users",
  ];

  for (const table of tables) {
    const { error } = await client.from(table).delete().like("id", like);
    if (error) throw new Error(`cleanup ${table}: ${error.message}`);
  }
}

async function createUser(label: string): Promise<UserRow> {
  const id = nextId(`user-${label}`);
  return queries.upsertUser({
    id,
    discord_user_id: `${id}-discord`,
    username: `Query IT ${label}`,
    avatar_url: null,
    created_at: now(),
  });
}

async function createTeam(owner: UserRow, label: string): Promise<TeamRow> {
  const createdAt = now();
  return queries.insertTeam({
    id: nextId(`team-${label}`),
    owner_user_id: owner.id,
    name: `Query IT ${label}`,
    description: `${label} description`,
    activity_time: "Weekdays 21:00-24:00",
    created_at: createdAt,
    updated_at: createdAt,
  });
}

async function createActiveMember(
  team: TeamRow,
  user: UserRow,
  label: string,
  tier: LolTier = "GOLD",
): Promise<TeamMemberRow> {
  const createdAt = now();
  return queries.insertTeamMember({
    id: nextId(`member-${label}`),
    team_id: team.id,
    user_id: user.id,
    display_name: `${label}#KR1`,
    riot_game_name: label,
    riot_tag_line: "KR1",
    solo_tier: tier,
    role: "MEMBER",
    status: "ACTIVE",
    created_at: createdAt,
    joined_at: createdAt,
  });
}

async function createFullRoster(team: TeamRow): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    const user = await createUser(`roster-${i}`);
    await createActiveMember(team, user, `Roster${i}`, i % 2 === 0 ? "GOLD" : "SILVER");
  }
}

async function createInvite(
  team: TeamRow,
  createdBy: UserRow,
  label: string,
  maxUses: number | null = null,
): Promise<InviteLinkRow> {
  return queries.insertInviteLink({
    id: nextId(`invite-${label}`),
    team_id: team.id,
    token: nextId(`token-${label}`),
    created_by_user_id: createdBy.id,
    status: "ACTIVE",
    max_uses: maxUses,
    used_count: 0,
    expires_at: null,
    created_at: now(),
  });
}

async function createMatchPost(
  team: TeamRow,
  createdBy: UserRow,
  label: string,
  availableTime = FUTURE_TIME,
): Promise<MatchPostRow> {
  const createdAt = now();
  return queries.insertMatchPost({
    id: nextId(`post-${label}`),
    team_id: team.id,
    title: `Query IT ${label}`,
    description: `${label} match post`,
    min_tier: "SILVER",
    max_tier: "PLATINUM",
    available_time: availableTime,
    status: "OPEN",
    created_by_user_id: createdBy.id,
    created_at: createdAt,
    updated_at: createdAt,
  });
}

async function createProposal(
  post: MatchPostRow,
  applicantTeam: TeamRow,
  createdBy: UserRow,
  status: MatchProposalRow["status"] = "PENDING",
  applicantPostId: string | null = null,
): Promise<MatchProposalRow> {
  const createdAt = now();
  return queries.insertMatchProposal({
    id: nextId(`proposal-${status.toLowerCase()}`),
    post_id: post.id,
    applicant_team_id: applicantTeam.id,
    applicant_post_id: applicantPostId,
    status,
    created_by_user_id: createdBy.id,
    created_at: createdAt,
    updated_at: createdAt,
  });
}

describeIfSupabase("queries Supabase integration", () => {
  beforeEach(() => {
    server.use(http.all(/https:\/\/.*\.supabase\.co\/.*/, () => passthrough()));
  });

  beforeAll(async () => {
    server.use(http.all(/https:\/\/.*\.supabase\.co\/.*/, () => passthrough()));
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it("round-trips .single inserts and .maybeSingle lookups", async () => {
    const user = await createUser("single");

    await expect(queries.findUserById(user.id)).resolves.toMatchObject({
      id: user.id,
      discord_user_id: user.discord_user_id,
    });
    await expect(queries.findUserById(nextId("missing-user"))).resolves.toBeNull();
  });

  it("joins by invite through RPC and enforces max uses", async () => {
    const owner = await createUser("invite-owner");
    const joiner = await createUser("invite-joiner");
    const exhaustedJoiner = await createUser("invite-exhausted-joiner");
    const team = await createTeam(owner, "invite-team");
    const invite = await createInvite(team, owner, "max-once", 1);

    const joinedAt = now();
    const joined = await queries.joinTeamByInvite({
      inviteLinkId: invite.id,
      teamId: team.id,
      memberId: nextId("member-joiner"),
      userId: joiner.id,
      displayName: "InviteJoiner#KR1",
      riotGameName: "InviteJoiner",
      riotTagLine: "KR1",
      soloTier: "GOLD",
      joinedAt,
    });

    expect(joined).toMatchObject({
      ok: true,
      member: {
        team_id: team.id,
        user_id: joiner.id,
        status: "ACTIVE",
        display_name: "InviteJoiner#KR1",
      },
      reusedExistingMembership: false,
    });
    await expect(queries.findInviteLinkByToken(invite.token)).resolves.toMatchObject({
      used_count: 1,
    });

    const exhausted = await queries.joinTeamByInvite({
      inviteLinkId: invite.id,
      teamId: team.id,
      memberId: nextId("member-exhausted"),
      userId: exhaustedJoiner.id,
      displayName: "Exhausted#KR1",
      riotGameName: "Exhausted",
      riotTagLine: "KR1",
      soloTier: "SILVER",
      joinedAt: now(),
    });

    expect(exhausted).toEqual({ ok: false, code: "INVITE_EXHAUSTED" });
    await expect(
      queries.findTeamMemberByUserId(team.id, exhaustedJoiner.id),
    ).resolves.toBeNull();
  });

  it("rejects invite joins when the roster is already full", async () => {
    const owner = await createUser("full-owner");
    const sixth = await createUser("full-sixth");
    const team = await createTeam(owner, "full-team");
    const invite = await createInvite(team, owner, "full-team");
    await createFullRoster(team);

    const joined = await queries.joinTeamByInvite({
      inviteLinkId: invite.id,
      teamId: team.id,
      memberId: nextId("member-sixth"),
      userId: sixth.id,
      displayName: "Sixth#KR1",
      riotGameName: "Sixth",
      riotTagLine: "KR1",
      soloTier: "PLATINUM",
      joinedAt: now(),
    });

    expect(joined).toEqual({ ok: false, code: "TEAM_FULL" });
    await expect(queries.findInviteLinkByToken(invite.token)).resolves.toMatchObject({
      used_count: 0,
    });
  });

  it("accepts a proposal through RPC and closes both match posts", async () => {
    const targetOwner = await createUser("accept-target-owner");
    const applicantOwner = await createUser("accept-applicant-owner");
    const targetTeam = await createTeam(targetOwner, "accept-target-team");
    const applicantTeam = await createTeam(applicantOwner, "accept-applicant-team");
    const targetPost = await createMatchPost(targetTeam, targetOwner, "accept-target");
    const applicantPost = await createMatchPost(
      applicantTeam,
      applicantOwner,
      "accept-applicant",
    );
    const proposal = await createProposal(
      targetPost,
      applicantTeam,
      applicantOwner,
      "PENDING",
      applicantPost.id,
    );

    const accepted = await queries.acceptMatchProposal({
      proposalId: proposal.id,
      actorUserId: targetOwner.id,
      matchId: nextId("match-manual"),
      confirmedAt: now(),
    });

    expect(accepted).toMatchObject({
      ok: true,
      proposal: {
        id: proposal.id,
        applicant_post_id: applicantPost.id,
        status: "ACCEPTED",
      },
      match: {
        left_post_id: targetPost.id,
        right_post_id: applicantPost.id,
        left_team_id: targetTeam.id,
        right_team_id: applicantTeam.id,
        origin: "MANUAL",
      },
    });
    await expect(queries.findMatchPostById(targetPost.id)).resolves.toMatchObject({
      status: "CLOSED",
    });
    await expect(queries.findMatchPostById(applicantPost.id)).resolves.toMatchObject({
      status: "CLOSED",
    });
    await expect(queries.acceptMatchProposal({
      proposalId: proposal.id,
      actorUserId: targetOwner.id,
      matchId: nextId("match-repeat"),
      confirmedAt: now(),
    })).resolves.toEqual({ ok: false, code: "PROPOSAL_NOT_PENDING" });
  });

  it("uses the applicant post captured when the proposal was created", async () => {
    const targetOwner = await createUser("stored-target-owner");
    const applicantOwner = await createUser("stored-applicant-owner");
    const targetTeam = await createTeam(targetOwner, "stored-target-team");
    const applicantTeam = await createTeam(applicantOwner, "stored-applicant-team");
    const targetPost = await createMatchPost(targetTeam, targetOwner, "stored-target");
    const originalApplicantPost = await createMatchPost(
      applicantTeam,
      applicantOwner,
      "stored-original-applicant",
    );
    const proposal = await createProposal(
      targetPost,
      applicantTeam,
      applicantOwner,
      "PENDING",
      originalApplicantPost.id,
    );

    await queries.closeMatchPostIfOpen(originalApplicantPost.id);
    const replacementApplicantPost = await createMatchPost(
      applicantTeam,
      applicantOwner,
      "stored-replacement-applicant",
    );

    await expect(queries.acceptMatchProposal({
      proposalId: proposal.id,
      actorUserId: targetOwner.id,
      matchId: nextId("match-stored-applicant"),
      confirmedAt: now(),
    })).resolves.toEqual({ ok: false, code: "MATCH_POST_ALREADY_CLOSED" });
    await expect(
      queries.findMatchPostById(replacementApplicantPost.id),
    ).resolves.toMatchObject({ status: "OPEN" });
  });

  it("lazy-closes expired match posts when fetched by id", async () => {
    const owner = await createUser("expired-owner");
    const team = await createTeam(owner, "expired-team");
    const post = await createMatchPost(team, owner, "expired-post", PAST_TIME);

    await expect(queries.findMatchPostById(post.id)).resolves.toMatchObject({
      id: post.id,
      status: "CLOSED",
    });
    await expect(queries.findOpenMatchPost(team.id)).resolves.toBeNull();
  });

  it("allows re-proposal after rejected status but blocks duplicate pending proposals", async () => {
    const targetOwner = await createUser("reproposal-target-owner");
    const applicantOwner = await createUser("reproposal-applicant-owner");
    const targetTeam = await createTeam(targetOwner, "reproposal-target-team");
    const applicantTeam = await createTeam(
      applicantOwner,
      "reproposal-applicant-team",
    );
    const targetPost = await createMatchPost(targetTeam, targetOwner, "reproposal");

    await createProposal(targetPost, applicantTeam, applicantOwner, "REJECTED");
    const pending = await createProposal(
      targetPost,
      applicantTeam,
      applicantOwner,
      "PENDING",
    );
    expect(pending.status).toBe("PENDING");

    await expect(
      createProposal(targetPost, applicantTeam, applicantOwner, "PENDING"),
    ).rejects.toThrow("MATCH_PROPOSALS_INSERT_FAILED");
  });
});
