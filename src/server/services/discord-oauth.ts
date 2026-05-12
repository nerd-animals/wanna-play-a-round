import "server-only";
import crypto from "crypto";

const DISCORD_API_BASE = "https://discord.com/api";

export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface DiscordUserProfile {
  id: string;
  username: string;
  avatarUrl?: string;
}

export function isDiscordOAuthConfigured(): boolean {
  return Boolean(
    process.env.DISCORD_CLIENT_ID &&
      process.env.DISCORD_CLIENT_SECRET &&
      process.env.DISCORD_REDIRECT_URI,
  );
}

function getDiscordOAuthConfig() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("DISCORD_OAUTH_NOT_CONFIGURED");
  }

  return { clientId, clientSecret, redirectUri };
}

export function createDiscordState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function buildDiscordAuthorizeUrl(state: string): string {
  const config = getDiscordOAuthConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: "identify",
    state,
    prompt: "consent",
  });
  return `${DISCORD_API_BASE}/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDiscordCode(
  code: string,
): Promise<DiscordTokenResponse> {
  const config = getDiscordOAuthConfig();
  const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) throw new Error("DISCORD_TOKEN_EXCHANGE_FAILED");
  return response.json();
}

export async function fetchDiscordUser(
  accessToken: string,
): Promise<DiscordUserProfile> {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("DISCORD_USER_FETCH_FAILED");

  const raw = (await response.json()) as {
    id: string;
    username: string;
    avatar: string | null;
  };
  return {
    id: raw.id,
    username: raw.username,
    avatarUrl: raw.avatar
      ? `https://cdn.discordapp.com/avatars/${raw.id}/${raw.avatar}.png`
      : undefined,
  };
}
