import { LeaderboardTable } from "@/components/leaderboard-table";
import { getActiveLeague, getLeaderboard, getLeagueMatches } from "@/lib/data";
import { decidedPredictionCount } from "@/lib/scoring";
import { isLeagueLocked } from "@/lib/types";

export default async function LeaderboardPage() {
  const league = await getActiveLeague();
  const [rows, matches] = league
    ? await Promise.all([getLeaderboard(league), getLeagueMatches(league.id)])
    : [[], []];

  return (
    <LeaderboardTable
      league={league}
      rows={rows}
      decidedCount={decidedPredictionCount(matches)}
      locked={league ? isLeagueLocked(league) : false}
    />
  );
}
