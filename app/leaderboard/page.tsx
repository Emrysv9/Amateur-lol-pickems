import { LeaderboardTable } from "@/components/leaderboard-table";
import { getActiveLeague, getLeaderboard } from "@/lib/data";

export default async function LeaderboardPage() {
  const league = await getActiveLeague();
  const rows = league ? await getLeaderboard(league.id) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-primary">
          {league?.name ?? "Pick'Ems"}
        </p>
        <h1 className="font-display mt-2 text-4xl font-semibold uppercase">
          Leaderboard
        </h1>
        <p className="mt-2 text-sm text-muted">
          Rankings update when an admin enters match winners.
        </p>
      </div>
      <LeaderboardTable rows={rows} />
    </div>
  );
}
