import "server-only";
import { withSession, withTeamOwner } from "@/server/authz";
import { queries, type Queries } from "@/server/db/queries";
import { rowToTeamInviteLinkView, rowToTeamMemberView } from "@/server/db/mappers";
import { createId, createToken } from "@/server/lib/id";
import { isDiscordGuildMember } from "@/server/services/discord-bot";
import type { SessionUser } from "@/server/session";
import type { TeamRow } from "@/server/db/rows";
import type {
  CreateInviteLinkEndpoint,
  CreateInviteLinkRequest,
  GetInviteLinkEndpoint,
  JoinByInviteEndpoint,
  JoinByInviteRequest,
} from "@/shared/contracts/invite";
import type { LolTier } from "@/shared/domain";

function isInviteExpired(expiresAt: string | null): boolean {
  return Boolean(expiresAt && new Date(expiresAt).getTime() < Date.now());
}

const TEAM_ROSTER_SIZE = 5;
const LOL_TIERS: LolTier[] = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
];

type DiscordMembershipService = {
  isDiscordGuildMember(userId: string): Promise<boolean>;
};

const defaultDiscordMembershipService: DiscordMembershipService = {
  isDiscordGuildMember,
};

function normalizeRiotProfile(req: JoinByInviteRequest): {
  riotGameName: string;
  riotTagLine: string;
  soloTier: LolTier;
} | null {
  const riotGameName = req.riotGameName?.trim();
  const riotTagLine = req.riotTagLine?.trim();
  if (!riotGameName || !riotTagLine || !LOL_TIERS.includes(req.soloTier)) {
    return null;
  }
  return {
    riotGameName,
    riotTagLine,
    soloTier: req.soloTier,
  };
}

export const _createInviteLink = async (
  req: CreateInviteLinkRequest,
  ctx: { actor: SessionUser; team: TeamRow },
  db: Queries = queries,
): Promise<CreateInviteLinkEndpoint["response"]> => {
  const link = await db.insertInviteLink({
    id: createId(),
    team_id: ctx.team.id,
    token: createToken(),
    created_by_user_id: ctx.actor.id,
    status: "ACTIVE",
    max_uses: req.maxUses ?? null,
    used_count: 0,
    expires_at: req.expiresAt ?? null,
    created_at: new Date().toISOString(),
  });
  return { ok: true, data: rowToTeamInviteLinkView(link) };
};

export const createInviteLink = withTeamOwner(_createInviteLink);

export async function getInviteLink(
  req: { token: string },
  db: Queries = queries,
): Promise<GetInviteLinkEndpoint["response"]> {
  const link = await db.findInviteLinkByToken(req.token);
  return { ok: true, data: link ? rowToTeamInviteLinkView(link) : null };
}

export async function _joinByInvite(
  req: JoinByInviteRequest,
  ctx: { actor: SessionUser },
  db: Queries = queries,
  discord: DiscordMembershipService = defaultDiscordMembershipService,
): Promise<JoinByInviteEndpoint["response"]> {
  const link = await db.findInviteLinkByToken(req.token);
  if (!link) return { ok: false, code: "INVITE_NOT_FOUND" };
  if (link.status !== "ACTIVE" || isInviteExpired(link.expires_at))
    return { ok: false, code: "INVITE_INACTIVE" };
  if (link.max_uses !== null && link.used_count >= link.max_uses)
    return { ok: false, code: "INVITE_EXHAUSTED" };

  const team = await db.findTeamById(link.team_id);
  if (!team) return { ok: false, code: "TEAM_NOT_FOUND" };

  const isGuildMember = await discord.isDiscordGuildMember(ctx.actor.discordUserId);
  if (!isGuildMember)
    return { ok: false, code: "DISCORD_GUILD_MEMBERSHIP_REQUIRED" };

  const riotProfile = normalizeRiotProfile(req);
  if (!riotProfile) return { ok: false, code: "RIOT_PROFILE_REQUIRED" };

  let member = await db.findTeamMemberByUserId(team.id, ctx.actor.id);

  const joinedAt = new Date().toISOString();
  const displayName = `${riotProfile.riotGameName}#${riotProfile.riotTagLine}`;

  if (member?.status === "ACTIVE") {
    member = await db.updateTeamMember({
      ...member,
      display_name: displayName,
      riot_game_name: riotProfile.riotGameName,
      riot_tag_line: riotProfile.riotTagLine,
      solo_tier: riotProfile.soloTier,
    });
    return {
      ok: true,
      data: {
        member: rowToTeamMemberView(member),
        teamId: team.id,
        reusedExistingMembership: true,
      },
    };
  }

  const members = await db.listTeamMembers(team.id);
  const activeCount = members.filter((m) => m.status === "ACTIVE").length;
  if (activeCount >= TEAM_ROSTER_SIZE) return { ok: false, code: "TEAM_FULL" };

  if (member) {
    member = await db.updateTeamMember({
      ...member,
      status: "ACTIVE",
      display_name: displayName,
      riot_game_name: riotProfile.riotGameName,
      riot_tag_line: riotProfile.riotTagLine,
      solo_tier: riotProfile.soloTier,
      joined_at: joinedAt,
    });
  } else {
    member = await db.insertTeamMember({
      id: createId(),
      team_id: team.id,
      user_id: ctx.actor.id,
      display_name: displayName,
      riot_game_name: riotProfile.riotGameName,
      riot_tag_line: riotProfile.riotTagLine,
      solo_tier: riotProfile.soloTier,
      role: "MEMBER",
      status: "ACTIVE",
      created_at: joinedAt,
      joined_at: joinedAt,
    });
  }

  await db.incrementInviteLinkUsedCount(link.id);

  return {
    ok: true,
    data: {
      member: rowToTeamMemberView(member),
      teamId: team.id,
      reusedExistingMembership: false,
    },
  };
}

export const joinByInvite = withSession(_joinByInvite);
