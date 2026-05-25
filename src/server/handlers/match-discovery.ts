import "server-only";

import { queries, type Queries } from "@/server/db/queries";
import {
  rowToMatchPostView,
  rowToTeamMemberView,
  rowToTeamView,
} from "@/server/db/mappers";
import type { MatchPostRow } from "@/server/db/rows";
import type { SessionUser } from "@/server/session";
import { averageTier, tierOrder } from "@/shared/constants/tierOrder";
import type { LolTier, TeamMemberView } from "@/shared/domain";
import type {
  MatchDiscoveryFilters,
  MatchDiscoveryItem,
  MatchDiscoveryTimeFilter,
  MatchDiscoveryView,
} from "@/shared/contracts/match-discovery";

const tiers = Object.keys(tierOrder) as LolTier[];
const tierValues = new Set<LolTier>(tiers);
const timeFilters = new Set<MatchDiscoveryTimeFilter>([
  "ALL",
  "TODAY",
  "THIS_WEEK",
]);

function normalizeFilters(filters: MatchDiscoveryFilters): MatchDiscoveryFilters {
  const q = filters.q?.trim();
  const tier = filters.tier && tierValues.has(filters.tier)
    ? filters.tier
    : undefined;
  const time = filters.time && timeFilters.has(filters.time)
    ? filters.time
    : "ALL";

  return {
    q: q || undefined,
    tier,
    time,
  };
}

function tierLabelFromAverage(value: number): string {
  if (value <= 0) return "티어 미입력";
  const index = Math.min(tiers.length - 1, Math.max(0, Math.round(value) - 1));
  return tiers[index];
}

function dateValue(value?: string): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function matchesTimeFilter(
  post: MatchPostRow,
  filter: MatchDiscoveryTimeFilter | undefined,
): boolean {
  if (!filter || filter === "ALL") return true;

  const time = dateValue(post.available_time ?? undefined);
  if (!time) return false;

  const now = new Date();
  const postDate = new Date(time);
  if (filter === "TODAY") {
    return postDate.toDateString() === now.toDateString();
  }

  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  return time >= now.getTime() && time <= end.getTime();
}

function matchesTierFilter(post: MatchPostRow, tier?: LolTier): boolean {
  if (!tier) return true;

  const selected = tierOrder[tier];
  const min = post.min_tier ? tierOrder[post.min_tier] : null;
  const max = post.max_tier ? tierOrder[post.max_tier] : null;

  return (!min || selected >= min) && (!max || selected <= max);
}

function matchesTextFilter(item: MatchDiscoveryItem, q?: string): boolean {
  if (!q) return true;

  const target = [
    item.team.name,
    item.team.description,
    item.team.activityTime,
    item.post.title,
    item.post.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return target.includes(q.toLowerCase());
}

function activeMembers(members: TeamMemberView[]): TeamMemberView[] {
  return members.filter((member) => member.status === "ACTIVE");
}

export async function getMatchDiscoveryView(
  filters: MatchDiscoveryFilters,
  ctx: { actor: SessionUser },
  db: Queries = queries,
): Promise<MatchDiscoveryView> {
  const normalized = normalizeFilters(filters);
  const teams = await db.listTeamsByOwnerId(ctx.actor.id);
  const myTeamRow = teams[0] ?? null;

  const [myMembers, myOpenPost, outgoingProposals, openPosts] = myTeamRow
    ? await Promise.all([
        db.listTeamMembers(myTeamRow.id),
        db.findOpenMatchPost(myTeamRow.id),
        db.listMatchProposals({ teamId: myTeamRow.id }),
        db.listOpenMatchPosts(),
      ])
    : await Promise.all([
        Promise.resolve([]),
        Promise.resolve(null),
        Promise.resolve([]),
        db.listOpenMatchPosts(),
      ]);

  const pendingOutgoingPostIds = new Set(
    outgoingProposals
      .filter((proposal) => proposal.status === "PENDING")
      .map((proposal) => proposal.post_id),
  );

  const candidateRows = openPosts
    .filter((post) => post.team_id !== myTeamRow?.id)
    .filter((post) => matchesTierFilter(post, normalized.tier))
    .filter((post) => matchesTimeFilter(post, normalized.time))
    .sort((a, b) => {
      const left = a.available_time ?? a.created_at;
      const right = b.available_time ?? b.created_at;
      return left.localeCompare(right);
    });

  const items = (
    await Promise.all(
      candidateRows.map(async (post) => {
        const [team, members] = await Promise.all([
          db.findTeamById(post.team_id),
          db.listTeamMembers(post.team_id),
        ]);
        if (!team) return null;

        const active = activeMembers(members.map(rowToTeamMemberView));
        const average = averageTier(active);

        return {
          post: rowToMatchPostView(post),
          team: rowToTeamView(team),
          activeMemberCount: active.length,
          averageTier: average,
          averageTierLabel: tierLabelFromAverage(average),
          hasPendingProposal: pendingOutgoingPostIds.has(post.id),
        };
      }),
    )
  )
    .filter((item): item is MatchDiscoveryItem => item !== null)
    .filter((item) => matchesTextFilter(item, normalized.q));

  return {
    myTeam: myTeamRow ? rowToTeamView(myTeamRow) : undefined,
    myOpenPost: myOpenPost ? rowToMatchPostView(myOpenPost) : undefined,
    myActiveMemberCount: activeMembers(myMembers.map(rowToTeamMemberView)).length,
    items,
    filters: normalized,
  };
}
