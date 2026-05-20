import "server-only";
import { getSupabaseAdminClient } from "./client";
import type {
  InviteLinkRow,
  MatchPostRow,
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
    return data ?? [];
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
    return data;
  },
};

export type Queries = typeof queries;
