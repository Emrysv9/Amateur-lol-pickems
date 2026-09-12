import type { StandingRow } from "@/lib/types";

export function LeaderboardTable({ rows }: { rows: StandingRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
        No scores yet. Submit a bracket, then scores appear when an admin enters
        results.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-background/30 text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Rank</th>
            <th className="px-4 py-3 font-medium">Player</th>
            <th className="px-4 py-3 font-medium text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user_id} className="border-t border-border">
              <td className="px-4 py-3 font-display text-lg text-primary">
                {row.rank}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {row.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.avatar_url}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs">
                      {row.username.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="font-medium">{row.username}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-semibold">{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
