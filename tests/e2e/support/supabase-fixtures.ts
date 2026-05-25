import fs from "node:fs";
import path from "node:path";
import type { APIRequestContext, BrowserContext, TestInfo } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const SESSION_COOKIE = "sf_owner_session";
const FUTURE_AVAILABLE_TIME = new Date("2099-12-31T22:00").toISOString();

type SupabaseResult<T> = PromiseLike<{
  data: T | null;
  error: { message: string } | null;
}>;

export type TestUser = {
  id: string;
  discordUserId: string;
  username: string;
};

export type TestTeam = {
  id: string;
  ownerUserId: string;
  name: string;
};

export type TestInvite = {
  id: string;
  teamId: string;
  token: string;
  usedCount: number;
};

let envLoaded = false;
let client: SupabaseClient | null = null;

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
  if (envLoaded) return;
  envLoaded = true;

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

export function hasSupabaseConfig(): boolean {
  loadLocalEnv();
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseClient(): SupabaseClient {
  loadLocalEnv();
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_TEST_ENV_NOT_CONFIGURED");
  }

  client ??= createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return client;
}

async function must<T>(label: string, result: SupabaseResult<T>): Promise<T> {
  const { data, error } = await result;
  if (error) throw new Error(`${label}: ${error.message}`);
  if (data === null) throw new Error(`${label}: no data returned`);
  return data;
}

async function mustOk(
  label: string,
  result: PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  const { error } = await result;
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function safeDelete(
  table: string,
  column: string,
  operatorValue: string,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from(table)
    .delete()
    .like(column, operatorValue);
  if (error) throw new Error(`cleanup ${table}: ${error.message}`);
}

export async function cleanupStaleE2eData(): Promise<void> {
  if (!hasSupabaseConfig()) return;

  await safeDelete("matches", "id", "e2e-%");
  await safeDelete("match_proposals", "id", "e2e-%");
  await safeDelete("match_posts", "id", "e2e-%");
  await safeDelete("team_invite_links", "id", "e2e-%");
  await safeDelete("team_members", "id", "e2e-%");
  await safeDelete("teams", "id", "e2e-%");
  await safeDelete("users", "id", "e2e-%");
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

export async function loginAs(
  context: BrowserContext,
  userId: string,
): Promise<void> {
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: userId,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export function sessionCookieHeader(userId: string): string {
  return `${SESSION_COOKIE}=${userId}`;
}

export async function deleteRequestSession(
  request: APIRequestContext,
  userId: string,
): Promise<void> {
  await request.delete("/api/auth/account", {
    headers: { cookie: sessionCookieHeader(userId) },
  });
}

export class E2EWorld {
  readonly prefix: string;
  private readonly client = getSupabaseClient();
  private counter = 0;
  private userIds = new Set<string>();

  constructor(testInfo: TestInfo) {
    this.prefix = `e2e-${Date.now()}-${testInfo.workerIndex}-${slug(testInfo.title)}`;
  }

  private next(label: string): string {
    this.counter += 1;
    return `${this.prefix}-${label}-${this.counter}`;
  }

  async cleanup(): Promise<void> {
    const ids = [...this.userIds];
    if (ids.length > 0) {
      const { error } = await this.client.from("users").delete().in("id", ids);
      if (error) throw new Error(`cleanup users: ${error.message}`);
    }

    await safeDelete("matches", "id", `${this.prefix}%`);
    await safeDelete("match_proposals", "id", `${this.prefix}%`);
    await safeDelete("match_posts", "id", `${this.prefix}%`);
    await safeDelete("team_invite_links", "id", `${this.prefix}%`);
    await safeDelete("team_members", "id", `${this.prefix}%`);
    await safeDelete("teams", "id", `${this.prefix}%`);
  }

  async createUser(
    label: string,
    options: { guildMember?: boolean } = {},
  ): Promise<TestUser> {
    const id = this.next(`user-${label}`);
    const guildPrefix = options.guildMember === false
      ? "e2e-discord-nonmember"
      : "e2e-discord-member";
    const user: TestUser = {
      id,
      discordUserId: `${guildPrefix}-${id}`,
      username: `E2E ${label} ${this.counter}`,
    };

    await mustOk(
      "insert user",
      this.client.from("users").insert({
        id: user.id,
        discord_user_id: user.discordUserId,
        username: user.username,
        avatar_url: null,
      }),
    );
    this.userIds.add(user.id);
    return user;
  }

  async createTeam(owner: TestUser, label = "team"): Promise<TestTeam> {
    const team: TestTeam = {
      id: this.next(`team-${label}`),
      ownerUserId: owner.id,
      name: `E2E ${label} ${this.counter}`,
    };

    await mustOk(
      "insert team",
      this.client.from("teams").insert({
        id: team.id,
        owner_user_id: owner.id,
        name: team.name,
        description: `${team.name} description`,
        activity_time: "Weekdays 21:00-24:00",
      }),
    );
    return team;
  }

  async createInvite(
    team: TestTeam,
    createdBy: TestUser,
    options: { maxUses?: number | null } = {},
  ): Promise<TestInvite> {
    const id = this.next("invite");
    const token = this.next("token");

    await mustOk(
      "insert invite",
      this.client.from("team_invite_links").insert({
        id,
        team_id: team.id,
        token,
        created_by_user_id: createdBy.id,
        status: "ACTIVE",
        max_uses: options.maxUses ?? null,
        used_count: 0,
        expires_at: null,
      }),
    );

    return {
      id,
      teamId: team.id,
      token,
      usedCount: 0,
    };
  }

  async createActiveMember(
    team: TestTeam,
    label: string,
    options: { user?: TestUser; tier?: string; role?: "OWNER" | "MEMBER" } = {},
  ): Promise<TestUser> {
    const user = options.user ?? (await this.createUser(label));
    const riotName = `Rift${this.counter}`;
    const riotTag = "KR1";
    const createdAt = new Date().toISOString();

    await mustOk(
      "insert member",
      this.client.from("team_members").insert({
        id: this.next(`member-${label}`),
        team_id: team.id,
        user_id: user.id,
        display_name: `${riotName}#${riotTag}`,
        riot_game_name: riotName,
        riot_tag_line: riotTag,
        solo_tier: options.tier ?? "GOLD",
        role: options.role ?? "MEMBER",
        status: "ACTIVE",
        created_at: createdAt,
        joined_at: createdAt,
      }),
    );

    return user;
  }

  async createFullRoster(team: TestTeam): Promise<void> {
    for (let i = 0; i < 5; i += 1) {
      await this.createActiveMember(team, `roster-${i}`, {
        tier: i % 2 === 0 ? "GOLD" : "SILVER",
      });
    }
  }

  async createMatchPost(
    team: TestTeam,
    owner: TestUser,
    label: string,
  ): Promise<{ id: string; teamId: string; title: string }> {
    const post = {
      id: this.next(`post-${label}`),
      teamId: team.id,
      title: `E2E Match ${label} ${this.counter}`,
    };
    const now = new Date().toISOString();

    await mustOk(
      "insert match post",
      this.client.from("match_posts").insert({
        id: post.id,
        team_id: team.id,
        title: post.title,
        description: `${post.title} description`,
        min_tier: "SILVER",
        max_tier: "PLATINUM",
        available_time: FUTURE_AVAILABLE_TIME,
        status: "OPEN",
        created_by_user_id: owner.id,
        created_at: now,
        updated_at: now,
      }),
    );

    return post;
  }

  async findTeamByOwnerAndName(
    owner: TestUser,
    name: string,
  ): Promise<TestTeam> {
    const row = await must<{ id: string; owner_user_id: string; name: string }>(
      "find team",
      this.client
        .from("teams")
        .select("id, owner_user_id, name")
        .eq("owner_user_id", owner.id)
        .eq("name", name)
        .single(),
    );
    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      name: row.name,
    };
  }

  async findLatestInvite(team: TestTeam): Promise<TestInvite> {
    const row = await must<{
      id: string;
      team_id: string;
      token: string;
      used_count: number;
    }>(
      "find invite",
      this.client
        .from("team_invite_links")
        .select("id, team_id, token, used_count")
        .eq("team_id", team.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    );
    return {
      id: row.id,
      teamId: row.team_id,
      token: row.token,
      usedCount: row.used_count,
    };
  }

  async countRows(
    table: string,
    column: string,
    value: string,
  ): Promise<number> {
    const { count, error } = await this.client
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq(column, value);
    if (error) throw new Error(`count ${table}: ${error.message}`);
    return count ?? 0;
  }

  async getInviteUsedCount(invite: TestInvite): Promise<number> {
    const row = await must<{ used_count: number }>(
      "get invite used count",
      this.client
        .from("team_invite_links")
        .select("used_count")
        .eq("id", invite.id)
        .single(),
    );
    return row.used_count;
  }

  async getTeamMember(
    team: TestTeam,
    user: TestUser,
  ): Promise<{
    display_name: string | null;
    riot_game_name: string | null;
    riot_tag_line: string | null;
    solo_tier: string | null;
    status: string;
  } | null> {
    const { data, error } = await this.client
      .from("team_members")
      .select("display_name, riot_game_name, riot_tag_line, solo_tier, status")
      .eq("team_id", team.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(`get member: ${error.message}`);
    return data;
  }

  async getMatchPostByTitle(
    team: TestTeam,
    title: string,
  ): Promise<{ id: string; status: string } | null> {
    const { data, error } = await this.client
      .from("match_posts")
      .select("id, status")
      .eq("team_id", team.id)
      .eq("title", title)
      .maybeSingle();
    if (error) throw new Error(`get match post: ${error.message}`);
    return data;
  }

  async getProposalStatus(proposalId: string): Promise<string> {
    const row = await must<{ status: string }>(
      "get proposal",
      this.client
        .from("match_proposals")
        .select("status")
        .eq("id", proposalId)
        .single(),
    );
    return row.status;
  }

  async findLatestProposal(
    targetPost: { id: string },
    applicantTeam: TestTeam,
  ): Promise<{ id: string; status: string; applicantPostId: string | null }> {
    const row = await must<{
      id: string;
      status: string;
      applicant_post_id: string | null;
    }>(
      "find latest proposal",
      this.client
        .from("match_proposals")
        .select("id, status, applicant_post_id")
        .eq("post_id", targetPost.id)
        .eq("applicant_team_id", applicantTeam.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    );

    return {
      id: row.id,
      status: row.status,
      applicantPostId: row.applicant_post_id,
    };
  }
}
