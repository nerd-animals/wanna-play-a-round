import type { LolTier, TeamMemberView } from "@/shared/domain";

export const tierOrder: Record<LolTier, number> = {
  IRON: 1,
  BRONZE: 2,
  SILVER: 3,
  GOLD: 4,
  PLATINUM: 5,
  EMERALD: 6,
  DIAMOND: 7,
  MASTER: 8,
  GRANDMASTER: 9,
  CHALLENGER: 10,
};

export function averageTier(members: Pick<TeamMemberView, "soloTier">[]): number {
  const values = members
    .map((member) => (member.soloTier ? tierOrder[member.soloTier] : null))
    .filter((value): value is number => value !== null);

  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
