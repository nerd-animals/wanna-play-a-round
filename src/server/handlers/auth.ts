import "server-only";
import { withSession } from "@/server/authz";
import { queries, type Queries } from "@/server/db/queries";
import { rowToUserView } from "@/server/db/mappers";
import { createId } from "@/server/lib/id";
import {
  clearSession,
  getCurrentUser,
  popDiscordOAuthState,
  setDiscordOAuthState,
  setSessionUser,
} from "@/server/session";
import {
  buildDiscordAuthorizeUrl,
  createDiscordState,
  exchangeDiscordCode,
  fetchDiscordUser,
  isDiscordOAuthConfigured,
} from "@/server/services/discord-oauth";
import type { ActionResult } from "@/shared/api";
import type { UserView } from "@/shared/domain";
import type {
  CurrentUserEndpoint,
  DeleteAccountEndpoint,
} from "@/shared/contracts/auth";

export async function currentUser(): Promise<CurrentUserEndpoint["response"]> {
  const user = await getCurrentUser();
  return { ok: true, data: user };
}

export async function startDiscordLogin(): Promise<
  ActionResult<{ authorizeUrl: string }>
> {
  if (!isDiscordOAuthConfigured()) {
    return { ok: false, code: "DISCORD_OAUTH_NOT_CONFIGURED" };
  }
  const state = createDiscordState();
  await setDiscordOAuthState(state);
  return { ok: true, data: { authorizeUrl: buildDiscordAuthorizeUrl(state) } };
}

export async function finishDiscordLogin(
  input: { code?: string | null; state?: string | null },
  db: Queries = queries,
): Promise<ActionResult<UserView>> {
  const storedState = await popDiscordOAuthState();
  if (
    !input.code ||
    !input.state ||
    !storedState ||
    input.state !== storedState
  ) {
    return { ok: false, code: "DISCORD_STATE_MISMATCH" };
  }

  const tokens = await exchangeDiscordCode(input.code);
  const profile = await fetchDiscordUser(tokens.access_token);

  const existing = await db.findUserByDiscordId(profile.id);
  const now = new Date().toISOString();

  const row = await db.upsertUser({
    id: existing?.id ?? createId(),
    discord_user_id: profile.id,
    username: profile.username,
    avatar_url: profile.avatarUrl ?? null,
    created_at: existing?.created_at ?? now,
  });

  await setSessionUser(row.id);
  return { ok: true, data: rowToUserView(row) };
}

export async function logout(): Promise<ActionResult<null>> {
  await clearSession();
  return { ok: true, data: null };
}

export const _deleteAccount = async (
  _req: Record<string, never>,
  ctx: { actor: UserView },
  db: Queries = queries,
): Promise<DeleteAccountEndpoint["response"]> => {
  await db.deleteTeamMembersByUserId(ctx.actor.id);
  await db.deleteUser(ctx.actor.id);
  await clearSession();
  return { ok: true, data: null };
};

export const deleteAccount = withSession(_deleteAccount);
