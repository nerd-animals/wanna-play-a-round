import "server-only";
import { queries, type Queries } from "@/server/db/queries";
import { rowToTeamMemberView } from "@/server/db/mappers";
import type { MatchPostRow } from "@/server/db/rows";
import { averageTier } from "@/shared/constants/tierOrder";

export interface AutoMatchCandidate {
  leftPostId: string;
  rightPostId: string;
  leftTeamId: string;
  rightTeamId: string;
  availableTime: string;
  averageTierDelta: number;
}

export interface AutoMatchRunResult {
  dryRun: true;
  maxAverageTierDelta: number;
  candidates: AutoMatchCandidate[];
}

async function getTeamAverageTier(
  teamId: string,
  db: Queries,
): Promise<number> {
  const members = await db.listTeamMembers(teamId);
  return averageTier(
    members
      .filter((member) => member.status === "ACTIVE")
      .map(rowToTeamMemberView),
  );
}

function hasCompatibleTime(left: MatchPostRow, right: MatchPostRow): boolean {
  return Boolean(
    left.available_time &&
      right.available_time &&
      left.available_time === right.available_time,
  );
}

export async function findAutoMatchCandidates(
  db: Queries = queries,
  maxAverageTierDelta = 1,
): Promise<AutoMatchCandidate[]> {
  const openPosts = await db.listOpenMatchPosts();
  const candidates: AutoMatchCandidate[] = [];

  for (let i = 0; i < openPosts.length; i += 1) {
    for (let j = i + 1; j < openPosts.length; j += 1) {
      const left = openPosts[i];
      const right = openPosts[j];
      if (left.team_id === right.team_id || !hasCompatibleTime(left, right)) {
        continue;
      }

      const [leftAverageTier, rightAverageTier] = await Promise.all([
        getTeamAverageTier(left.team_id, db),
        getTeamAverageTier(right.team_id, db),
      ]);
      const averageTierDelta = Math.abs(leftAverageTier - rightAverageTier);
      if (averageTierDelta > maxAverageTierDelta) continue;

      candidates.push({
        leftPostId: left.id,
        rightPostId: right.id,
        leftTeamId: left.team_id,
        rightTeamId: right.team_id,
        availableTime: left.available_time ?? "",
        averageTierDelta,
      });
    }
  }

  return candidates;
}

export async function runAutoMatch(options: {
  db?: Queries;
  maxAverageTierDelta?: number;
} = {}): Promise<AutoMatchRunResult> {
  const { db = queries, maxAverageTierDelta = 1 } = options;
  const candidates = await findAutoMatchCandidates(db, maxAverageTierDelta);

  return {
    dryRun: true,
    maxAverageTierDelta,
    candidates,
  };
}
