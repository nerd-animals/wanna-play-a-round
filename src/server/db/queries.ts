import "server-only";
import { getSupabaseAdminClient } from "./client";
import type {
  InviteLinkRow,
  MatchProposalRow,
  MatchPostRow,
  MatchRow,
  TeamMemberRow,
  TeamRow,
  UserRow,
} from "./rows";
import type {
  LolTier,
  MatchOrigin,
  MatchProposalStatus,
  TeamMemberRole,
  TeamMemberStatus,
} from "@/shared/domain";
import type { InviteErrorCode } from "@/shared/contracts/invite";
import type { MatchProposalErrorCode } from "@/shared/contracts/match-proposals";

type JoinTeamByInviteErrorCode =
  | InviteErrorCode
  | "TEAM_NOT_FOUND";

type JoinTeamByInviteRpcRow = {
  result_code: "OK_CREATED" | "OK_REUSED" | JoinTeamByInviteErrorCode;
  member_id: string | null;
  member_team_id: string | null;
  member_user_id: string | null;
  member_display_name: string | null;
  member_riot_game_name: string | null;
  member_riot_tag_line: string | null;
  member_solo_tier: LolTier | null;
  member_role: TeamMemberRole | null;
  member_status: TeamMemberStatus | null;
  member_created_at: string | null;
  member_joined_at: string | null;
};

export type JoinTeamByInviteResult =
  | {
      ok: true;
      member: TeamMemberRow;
      reusedExistingMembership: boolean;
    }
  | { ok: false; code: JoinTeamByInviteErrorCode };

type AcceptMatchProposalErrorCode =
  | MatchProposalErrorCode
  | "FORBIDDEN"
  | "TEAM_NOT_FOUND";

type AcceptMatchProposalRpcRow = {
  result_code: "OK" | AcceptMatchProposalErrorCode;
  proposal_id: string | null;
  proposal_post_id: string | null;
  proposal_applicant_team_id: string | null;
  proposal_applicant_post_id: string | null;
  proposal_status: MatchProposalStatus | null;
  proposal_created_by_user_id: string | null;
  proposal_created_at: string | null;
  proposal_updated_at: string | null;
  match_id: string | null;
  match_left_post_id: string | null;
  match_right_post_id: string | null;
  match_left_team_id: string | null;
  match_right_team_id: string | null;
  match_origin: MatchOrigin | null;
  match_confirmed_at: string | null;
};

export type AcceptMatchProposalResult =
  | {
      ok: true;
      proposal: MatchProposalRow;
      match: MatchRow;
    }
  | { ok: false; code: AcceptMatchProposalErrorCode };

function unwrap<T>(
  data: T | null,
  error: { message: string } | null,
  context: string,
): T {
  if (error) throw new Error(`${context}:${error.message}`);
  if (!data) throw new Error(`${context}:EMPTY`);
  return data;
}

function isPastAvailableTime(value: string | null): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return !Number.isFinite(time) || time < Date.now();
}

async function closeExpiredOpenMatchPosts(
  rows: MatchPostRow[],
): Promise<MatchPostRow[]> {
  const expiredRows = rows.filter(
    (row) => row.status === "OPEN" && isPastAvailableTime(row.available_time),
  );
  if (expiredRows.length === 0) return rows;

  const client = getSupabaseAdminClient();
  const updatedAt = new Date().toISOString();
  await Promise.all(
    expiredRows.map(async (row) => {
      const { error } = await client
        .from("match_posts")
        .update({ status: "CLOSED", updated_at: updatedAt })
        .eq("id", row.id)
        .eq("status", "OPEN");
      if (error)
        throw new Error(`MATCH_POSTS_LAZY_CLOSE_FAILED:${error.message}`);
    }),
  );

  const expiredIds = new Set(expiredRows.map((row) => row.id));
  return rows.map((row) =>
    expiredIds.has(row.id)
      ? { ...row, status: "CLOSED", updated_at: updatedAt }
      : row,
  );
}

function requireTeamMemberFromJoinRpc(row: JoinTeamByInviteRpcRow): TeamMemberRow {
  if (
    !row.member_id ||
    !row.member_team_id ||
    !row.member_role ||
    !row.member_status ||
    !row.member_created_at
  ) {
    throw new Error("JOIN_TEAM_BY_INVITE_MISSING_MEMBER");
  }

  return {
    id: row.member_id,
    team_id: row.member_team_id,
    user_id: row.member_user_id,
    display_name: row.member_display_name,
    riot_game_name: row.member_riot_game_name,
    riot_tag_line: row.member_riot_tag_line,
    solo_tier: row.member_solo_tier,
    role: row.member_role,
    status: row.member_status,
    created_at: row.member_created_at,
    joined_at: row.member_joined_at,
  };
}

function requireAcceptedMatchFromRpc(row: AcceptMatchProposalRpcRow): {
  proposal: MatchProposalRow;
  match: MatchRow;
} {
  if (
    !row.proposal_id ||
    !row.proposal_post_id ||
    !row.proposal_applicant_team_id ||
    !row.proposal_status ||
    !row.proposal_created_by_user_id ||
    !row.proposal_created_at ||
    !row.proposal_updated_at ||
    !row.match_id ||
    !row.match_left_post_id ||
    !row.match_right_post_id ||
    !row.match_left_team_id ||
    !row.match_right_team_id ||
    !row.match_origin ||
    !row.match_confirmed_at
  ) {
    throw new Error("ACCEPT_MATCH_PROPOSAL_MISSING_ROWS");
  }

  return {
    proposal: {
      id: row.proposal_id,
      post_id: row.proposal_post_id,
      applicant_team_id: row.proposal_applicant_team_id,
      applicant_post_id: row.proposal_applicant_post_id,
      status: row.proposal_status,
      created_by_user_id: row.proposal_created_by_user_id,
      created_at: row.proposal_created_at,
      updated_at: row.proposal_updated_at,
    },
    match: {
      id: row.match_id,
      left_post_id: row.match_left_post_id,
      right_post_id: row.match_right_post_id,
      left_team_id: row.match_left_team_id,
      right_team_id: row.match_right_team_id,
      origin: row.match_origin,
      confirmed_at: row.match_confirmed_at,
    },
  };
}

export const queries = {
  // Users
  async upsertUser(row: UserRow): Promise<UserRow> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("users")
      .upsert(row, { onConflict: "id" })
      .select()
      .single<UserRow>();
    return unwrap(data, error, "USERS_UPSERT_FAILED");
  },

  async findUserById(id: string): Promise<UserRow | null> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle<UserRow>();
    if (error) throw new Error(`USERS_FIND_BY_ID_FAILED:${error.message}`);
    return data;
  },

  async findUserByDiscordId(discordUserId: string): Promise<UserRow | null> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("users")
      .select("*")
      .eq("discord_user_id", discordUserId)
      .maybeSingle<UserRow>();
    if (error) throw new Error(`USERS_FIND_BY_DISCORD_ID_FAILED:${error.message}`);
    return data;
  },

  async deleteUser(id: string): Promise<void> {
    const client = getSupabaseAdminClient();
    const { error } = await client.from("users").delete().eq("id", id);
    if (error) throw new Error(`USERS_DELETE_FAILED:${error.message}`);
  },

  // Teams
  async insertTeam(row: TeamRow): Promise<TeamRow> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("teams")
      .insert(row)
      .select()
      .single<TeamRow>();
    return unwrap(data, error, "TEAMS_INSERT_FAILED");
  },

  async deleteTeam(id: string): Promise<void> {
    const client = getSupabaseAdminClient();
    const { error } = await client.from("teams").delete().eq("id", id);
    if (error) throw new Error(`TEAMS_DELETE_FAILED:${error.message}`);
  },

  async findTeamById(id: string): Promise<TeamRow | null> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("teams")
      .select("*")
      .eq("id", id)
      .maybeSingle<TeamRow>();
    if (error) throw new Error(`TEAMS_FIND_BY_ID_FAILED:${error.message}`);
    return data;
  },

  async listTeamsByOwnerId(ownerUserId: string): Promise<TeamRow[]> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("teams")
      .select("*")
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: false })
      .returns<TeamRow[]>();
    if (error) throw new Error(`TEAMS_LIST_BY_OWNER_FAILED:${error.message}`);
    return data ?? [];
  },

  // TeamMembers
  async insertTeamMember(row: TeamMemberRow): Promise<TeamMemberRow> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("team_members")
      .insert(row)
      .select()
      .single<TeamMemberRow>();
    return unwrap(data, error, "TEAM_MEMBERS_INSERT_FAILED");
  },

  async updateTeamMember(row: TeamMemberRow): Promise<TeamMemberRow> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("team_members")
      .update({
        user_id: row.user_id,
        display_name: row.display_name,
        riot_game_name: row.riot_game_name,
        riot_tag_line: row.riot_tag_line,
        solo_tier: row.solo_tier,
        role: row.role,
        status: row.status,
        joined_at: row.joined_at,
      })
      .eq("id", row.id)
      .select()
      .single<TeamMemberRow>();
    return unwrap(data, error, "TEAM_MEMBERS_UPDATE_FAILED");
  },

  async listTeamMembers(teamId: string): Promise<TeamMemberRow[]> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("team_members")
      .select("*")
      .eq("team_id", teamId)
      .returns<TeamMemberRow[]>();
    if (error) throw new Error(`TEAM_MEMBERS_LIST_FAILED:${error.message}`);
    return data ?? [];
  },

  async findTeamMemberByUserId(
    teamId: string,
    userId: string,
  ): Promise<TeamMemberRow | null> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("team_members")
      .select("*")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle<TeamMemberRow>();
    if (error) throw new Error(`TEAM_MEMBERS_FIND_BY_USER_FAILED:${error.message}`);
    return data;
  },

  async findTeamMemberByDisplayName(
    teamId: string,
    displayName: string,
  ): Promise<TeamMemberRow | null> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("team_members")
      .select("*")
      .eq("team_id", teamId)
      .eq("display_name", displayName)
      .maybeSingle<TeamMemberRow>();
    if (error)
      throw new Error(`TEAM_MEMBERS_FIND_BY_DISPLAY_NAME_FAILED:${error.message}`);
    return data;
  },

  async deleteTeamMembersByUserId(userId: string): Promise<void> {
    const client = getSupabaseAdminClient();
    const { error } = await client
      .from("team_members")
      .delete()
      .eq("user_id", userId);
    if (error)
      throw new Error(`TEAM_MEMBERS_DELETE_BY_USER_FAILED:${error.message}`);
  },

  // InviteLinks
  async insertInviteLink(row: InviteLinkRow): Promise<InviteLinkRow> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("team_invite_links")
      .insert(row)
      .select()
      .single<InviteLinkRow>();
    return unwrap(data, error, "INVITE_LINKS_INSERT_FAILED");
  },

  async updateInviteLink(row: InviteLinkRow): Promise<InviteLinkRow> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("team_invite_links")
      .update({
        status: row.status,
        max_uses: row.max_uses,
        used_count: row.used_count,
        expires_at: row.expires_at,
      })
      .eq("id", row.id)
      .select()
      .single<InviteLinkRow>();
    return unwrap(data, error, "INVITE_LINKS_UPDATE_FAILED");
  },

  async incrementInviteLinkUsedCount(id: string): Promise<void> {
    const client = getSupabaseAdminClient();
    const { error } = await client.rpc("increment_invite_link_used_count", {
      link_id: id,
    });
    if (error)
      throw new Error(`INVITE_LINKS_INCREMENT_USED_COUNT_FAILED:${error.message}`);
  },

  async joinTeamByInvite(input: {
    inviteLinkId: string;
    teamId: string;
    memberId: string;
    userId: string;
    displayName: string;
    riotGameName: string;
    riotTagLine: string;
    soloTier: LolTier;
    joinedAt: string;
  }): Promise<JoinTeamByInviteResult> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .rpc("join_team_by_invite", {
        p_link_id: input.inviteLinkId,
        p_team_id: input.teamId,
        p_member_id: input.memberId,
        p_user_id: input.userId,
        p_display_name: input.displayName,
        p_riot_game_name: input.riotGameName,
        p_riot_tag_line: input.riotTagLine,
        p_solo_tier: input.soloTier,
        p_joined_at: input.joinedAt,
      })
      .single<JoinTeamByInviteRpcRow>();

    if (error)
      throw new Error(`JOIN_TEAM_BY_INVITE_FAILED:${error.message}`);
    if (!data) throw new Error("JOIN_TEAM_BY_INVITE_FAILED:EMPTY");

    if (data.result_code !== "OK_CREATED" && data.result_code !== "OK_REUSED") {
      return { ok: false, code: data.result_code };
    }

    return {
      ok: true,
      member: requireTeamMemberFromJoinRpc(data),
      reusedExistingMembership: data.result_code === "OK_REUSED",
    };
  },

  async findInviteLinkByToken(token: string): Promise<InviteLinkRow | null> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("team_invite_links")
      .select("*")
      .eq("token", token)
      .maybeSingle<InviteLinkRow>();
    if (error) throw new Error(`INVITE_LINKS_FIND_BY_TOKEN_FAILED:${error.message}`);
    return data;
  },

  async listInviteLinks(teamId: string): Promise<InviteLinkRow[]> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("team_invite_links")
      .select("*")
      .eq("team_id", teamId)
      .returns<InviteLinkRow[]>();
    if (error) throw new Error(`INVITE_LINKS_LIST_FAILED:${error.message}`);
    return data ?? [];
  },

  // MatchPosts
  async insertMatchPost(row: MatchPostRow): Promise<MatchPostRow> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("match_posts")
      .insert(row)
      .select()
      .single<MatchPostRow>();
    return unwrap(data, error, "MATCH_POSTS_INSERT_FAILED");
  },

  async listMatchPosts(teamId: string): Promise<MatchPostRow[]> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("match_posts")
      .select("*")
      .eq("team_id", teamId)
      .returns<MatchPostRow[]>();
    if (error) throw new Error(`MATCH_POSTS_LIST_FAILED:${error.message}`);
    return closeExpiredOpenMatchPosts(data ?? []);
  },

  async findMatchPostById(id: string): Promise<MatchPostRow | null> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("match_posts")
      .select("*")
      .eq("id", id)
      .maybeSingle<MatchPostRow>();
    if (error) throw new Error(`MATCH_POSTS_FIND_BY_ID_FAILED:${error.message}`);
    const [row] = await closeExpiredOpenMatchPosts(data ? [data] : []);
    return row ?? null;
  },

  async findOpenMatchPost(teamId: string): Promise<MatchPostRow | null> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("match_posts")
      .select("*")
      .eq("team_id", teamId)
      .eq("status", "OPEN")
      .maybeSingle<MatchPostRow>();
    if (error) throw new Error(`MATCH_POSTS_FIND_OPEN_FAILED:${error.message}`);
    const [row] = await closeExpiredOpenMatchPosts(data ? [data] : []);
    return row?.status === "OPEN" ? row : null;
  },

  async listOpenMatchPosts(): Promise<MatchPostRow[]> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("match_posts")
      .select("*")
      .eq("status", "OPEN")
      .returns<MatchPostRow[]>();
    if (error) throw new Error(`MATCH_POSTS_LIST_OPEN_FAILED:${error.message}`);
    const rows = await closeExpiredOpenMatchPosts(data ?? []);
    return rows.filter((row) => row.status === "OPEN");
  },

  async closeMatchPostIfOpen(id: string): Promise<MatchPostRow | null> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("match_posts")
      .update({
        status: "CLOSED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "OPEN")
      .select()
      .maybeSingle<MatchPostRow>();
    if (error)
      throw new Error(`MATCH_POSTS_CLOSE_IF_OPEN_FAILED:${error.message}`);
    return data;
  },

  // MatchProposals
  async insertMatchProposal(row: MatchProposalRow): Promise<MatchProposalRow> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("match_proposals")
      .insert(row)
      .select()
      .single<MatchProposalRow>();
    return unwrap(data, error, "MATCH_PROPOSALS_INSERT_FAILED");
  },

  async findMatchProposalById(id: string): Promise<MatchProposalRow | null> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("match_proposals")
      .select("*")
      .eq("id", id)
      .maybeSingle<MatchProposalRow>();
    if (error)
      throw new Error(`MATCH_PROPOSALS_FIND_BY_ID_FAILED:${error.message}`);
    return data;
  },

  async listMatchProposals(filter: {
    postId?: string;
    teamId?: string;
  }): Promise<MatchProposalRow[]> {
    const client = getSupabaseAdminClient();
    let query = client.from("match_proposals").select("*");
    if (filter.postId) query = query.eq("post_id", filter.postId);
    if (filter.teamId) query = query.eq("applicant_team_id", filter.teamId);
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .returns<MatchProposalRow[]>();
    if (error) throw new Error(`MATCH_PROPOSALS_LIST_FAILED:${error.message}`);
    return data ?? [];
  },

  async listMatchProposalsForPostIds(
    postIds: string[],
  ): Promise<MatchProposalRow[]> {
    if (postIds.length === 0) return [];

    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("match_proposals")
      .select("*")
      .in("post_id", postIds)
      .order("created_at", { ascending: false })
      .returns<MatchProposalRow[]>();
    if (error)
      throw new Error(`MATCH_PROPOSALS_LIST_FOR_POSTS_FAILED:${error.message}`);
    return data ?? [];
  },

  async updateMatchProposalStatus(
    id: string,
    status: MatchProposalRow["status"],
  ): Promise<MatchProposalRow> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("match_proposals")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single<MatchProposalRow>();
    return unwrap(data, error, "MATCH_PROPOSALS_UPDATE_STATUS_FAILED");
  },

  async acceptMatchProposal(input: {
    proposalId: string;
    actorUserId: string;
    matchId: string;
    confirmedAt: string;
  }): Promise<AcceptMatchProposalResult> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .rpc("accept_match_proposal", {
        p_proposal_id: input.proposalId,
        p_actor_user_id: input.actorUserId,
        p_match_id: input.matchId,
        p_confirmed_at: input.confirmedAt,
      })
      .single<AcceptMatchProposalRpcRow>();

    if (error)
      throw new Error(`ACCEPT_MATCH_PROPOSAL_FAILED:${error.message}`);
    if (!data) throw new Error("ACCEPT_MATCH_PROPOSAL_FAILED:EMPTY");

    if (data.result_code !== "OK") {
      return { ok: false, code: data.result_code };
    }

    return {
      ok: true,
      ...requireAcceptedMatchFromRpc(data),
    };
  },

  // Matches
  async insertMatch(row: MatchRow): Promise<MatchRow> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("matches")
      .insert(row)
      .select()
      .single<MatchRow>();
    return unwrap(data, error, "MATCHES_INSERT_FAILED");
  },

  async listMatchesForTeam(teamId: string): Promise<MatchRow[]> {
    const client = getSupabaseAdminClient();
    const { data, error } = await client
      .from("matches")
      .select("*")
      .or(`left_team_id.eq.${teamId},right_team_id.eq.${teamId}`)
      .order("confirmed_at", { ascending: false })
      .returns<MatchRow[]>();
    if (error) throw new Error(`MATCHES_LIST_FOR_TEAM_FAILED:${error.message}`);
    return data ?? [];
  },
};

export type Queries = typeof queries;
