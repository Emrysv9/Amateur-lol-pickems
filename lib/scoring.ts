import type { League, Match, PickRow } from "@/lib/types";
import { pointsForRound } from "@/lib/types";

export function scorePick(
  pick: PickRow,
  matches: Match[],
  league: League,
): number {
  let score = 0;
  for (const match of matches) {
    if (!match.winner_id) continue;
    if (pick.selections[match.id] === match.winner_id) {
      score += pointsForRound(league, match.round);
    }
  }
  const final = matches.find((m) => m.round === "final");
  if (final?.winner_id && pick.champion_team_id === final.winner_id) {
    score += league.points_champion;
  }
  return score;
}
