import "server-only";
import { cookies } from "next/headers";
import type { UserView } from "@/shared/domain";
import { queries } from "./db/queries";
import { rowToUserView } from "./db/mappers";

const SESSION_COOKIE = "sf_owner_session";
const STATE_COOKIE = "sf_discord_oauth_state";

export type SessionUser = UserView;

export async function setSessionUser(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(STATE_COOKIE);
}

export async function setDiscordOAuthState(state: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
  });
}

export async function popDiscordOAuthState(): Promise<string | null> {
  const cookieStore = await cookies();
  const state = cookieStore.get(STATE_COOKIE)?.value ?? null;
  cookieStore.delete(STATE_COOKIE);
  return state;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!userId) return null;

  const row = await queries.findUserById(userId);
  return row ? rowToUserView(row) : null;
}
