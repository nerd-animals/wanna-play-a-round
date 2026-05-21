import "server-only";

const DISCORD_API_BASE = "https://discord.com/api";

export interface DiscordGuildMember {
  userId: string;
  nickname?: string;
  roleIds: string[];
  joinedAt?: string;
  isPending: boolean;
}

type DiscordGuildMemberResponse = {
  user?: {
    id?: string;
  };
  nick?: string | null;
  roles?: string[];
  joined_at?: string;
  pending?: boolean;
};

export function getDiscordBotConfig() {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  const inviteUrl = process.env.DISCORD_INVITE_URL;

  if (!botToken || !guildId) {
    throw new Error("DISCORD_BOT_NOT_CONFIGURED");
  }

  return {
    botToken,
    guildId,
    inviteUrl,
  };
}

function getE2eGuildMemberOverride(
  userId: string,
): DiscordGuildMember | null | undefined {
  if (process.env.NODE_ENV === "production") return undefined;

  const denyPrefixes =
    process.env.E2E_DISCORD_GUILD_NON_MEMBER_ID_PREFIXES?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  if (denyPrefixes.some((prefix) => userId.startsWith(prefix))) {
    return null;
  }

  const allowPrefixes =
    process.env.E2E_DISCORD_GUILD_MEMBER_ID_PREFIXES?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  if (allowPrefixes.some((prefix) => userId.startsWith(prefix))) {
    return {
      userId,
      roleIds: [],
      isPending: false,
    };
  }

  return undefined;
}

function mapDiscordGuildMember(
  userId: string,
  payload: DiscordGuildMemberResponse,
): DiscordGuildMember {
  return {
    userId: payload.user?.id ?? userId,
    nickname: payload.nick ?? undefined,
    roleIds: payload.roles ?? [],
    joinedAt: payload.joined_at,
    isPending: payload.pending ?? false,
  };
}

export async function fetchDiscordGuildMember(
  userId: string,
): Promise<DiscordGuildMember | null> {
  const e2eOverride = getE2eGuildMemberOverride(userId);
  if (e2eOverride !== undefined) return e2eOverride;

  const { botToken, guildId } = getDiscordBotConfig();
  const response = await fetch(
    `${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`,
    {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("DISCORD_GUILD_MEMBER_LOOKUP_FAILED");
  }

  const payload = (await response.json()) as DiscordGuildMemberResponse;
  return mapDiscordGuildMember(userId, payload);
}

export async function isDiscordGuildMember(userId: string): Promise<boolean> {
  const member = await fetchDiscordGuildMember(userId);
  return member !== null;
}

export async function sendMatchConfirmedNotification(
  matchId: string,
): Promise<void> {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_DISABLE_DISCORD_NOTIFICATIONS === "1"
  ) {
    return;
  }

  const channelId = process.env.DISCORD_MATCH_CHANNEL_ID;
  if (!channelId) return;

  const { botToken } = getDiscordBotConfig();
  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: `Match confirmed: ${matchId}`,
    }),
  });

  if (!response.ok) {
    throw new Error("DISCORD_MATCH_NOTIFICATION_FAILED");
  }
}
