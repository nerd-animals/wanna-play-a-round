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
  return Number.isFinite(time) && time < Date.now();
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
    return data;
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
};

export type Queries = typeof queries;
