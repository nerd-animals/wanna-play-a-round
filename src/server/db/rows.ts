import "server-only";
import type {
  InviteLinkStatus,
  LolTier,
  MatchOrigin,
  MatchPostStatus,
  MatchProposalStatus,
  TeamMemberRole,
  TeamMemberStatus,
} from "@/shared/domain";

export interface UserRow {
  id: string;
  discord_user_id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

export interface TeamRow {
  id: string;
  owner_user_id: string;
  name: string;
  description: string | null;
  activity_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberRow {
  id: string;
  team_id: string;
  user_id: string | null;
  display_name: string | null;
  riot_game_name: string | null;
  riot_tag_line: string | null;
  solo_tier: LolTier | null;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  created_at: string;
  joined_at: string | null;
}

export interface InviteLinkRow {
  id: string;
  team_id: string;
  token: string;
  created_by_user_id: string;
  status: InviteLinkStatus;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  created_at: string;
}

export interface MatchPostRow {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  min_tier: LolTier | null;
  max_tier: LolTier | null;
  available_time: string | null;
  status: MatchPostStatus;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface MatchRow {
  id: string;
  left_post_id: string;
  right_post_id: string;
  left_team_id: string;
  right_team_id: string;
  origin: MatchOrigin;
  confirmed_at: string;
}

export interface MatchProposalRow {
  id: string;
  post_id: string;
  applicant_team_id: string;
  status: MatchProposalStatus;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}
