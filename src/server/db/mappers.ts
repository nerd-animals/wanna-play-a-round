import "server-only";
import type {
  MatchPostView,
  TeamInviteLinkView,
  TeamMemberView,
  TeamView,
  UserView,
} from "@/shared/domain";
import type {
  InviteLinkRow,
  MatchPostRow,
  TeamMemberRow,
  TeamRow,
  UserRow,
} from "./rows";

export function rowToUserView(row: UserRow): UserView {
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url ?? undefined,
  };
}

export function rowToTeamView(row: TeamRow): TeamView {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    description: row.description ?? undefined,
    activityTime: row.activity_time ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToTeamMemberView(row: TeamMemberRow): TeamMemberView {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id ?? undefined,
    displayName: row.display_name ?? undefined,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    joinedAt: row.joined_at ?? undefined,
  };
}

export function rowToTeamInviteLinkView(row: InviteLinkRow): TeamInviteLinkView {
  return {
    id: row.id,
    teamId: row.team_id,
    token: row.token,
    createdByUserId: row.created_by_user_id,
    status: row.status,
    maxUses: row.max_uses ?? undefined,
    usedCount: row.used_count,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
  };
}

export function rowToMatchPostView(row: MatchPostRow): MatchPostView {
  return {
    id: row.id,
    teamId: row.team_id,
    title: row.title,
    description: row.description ?? undefined,
    minTier: row.min_tier ?? undefined,
    maxTier: row.max_tier ?? undefined,
    availableTime: row.available_time ?? undefined,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
