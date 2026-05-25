import type { LolTier, MatchPostView, TeamView } from "@/shared/domain";

export type MatchDiscoveryTimeFilter = "ALL" | "TODAY" | "THIS_WEEK";

export type MatchDiscoveryFilters = {
  q?: string;
  tier?: LolTier;
  time?: MatchDiscoveryTimeFilter;
};

export type MatchDiscoveryItem = {
  post: MatchPostView;
  team: TeamView;
  activeMemberCount: number;
  averageTier: number;
  averageTierLabel: string;
  hasPendingProposal: boolean;
};

export type MatchDiscoveryView = {
  myTeam?: TeamView;
  myOpenPost?: MatchPostView;
  myActiveMemberCount: number;
  items: MatchDiscoveryItem[];
  filters: MatchDiscoveryFilters;
};
