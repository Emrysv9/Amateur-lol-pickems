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

export function decidedPredictionCount(matches: Match[]): number {
  let count = matches.filter((match) => match.winner_id).length;
  if (matches.some((match) => match.round === "final" && match.winner_id)) {
    count += 1;
  }
  return count;
}

export function countCorrectPicks(pick: PickRow, matches: Match[]): number {
  let correct = 0;
  for (const match of matches) {
    if (!match.winner_id) continue;
    if (pick.selections[match.id] === match.winner_id) correct += 1;
  }
  const final = matches.find((match) => match.round === "final");
  if (final?.winner_id && pick.champion_team_id === final.winner_id) {
    correct += 1;
  }
  return correct;
}
