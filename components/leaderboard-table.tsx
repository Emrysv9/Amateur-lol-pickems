import type { League, StandingRow } from "@/lib/types";

export function LeaderboardTable({
  league,
  rows,
  decidedCount,
}: {
  league: League | null;
  rows: StandingRow[];
  decidedCount: number;
}) {
  const leader = rows[0] ?? null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border/80 pb-3">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            {league?.name ?? "Pick'Ems"} · Standings
          </p>
          <h1 className="font-display text-4xl font-semibold uppercase leading-none tracking-wide">
            Leaderboard
          </h1>
        </div>
        <p className="text-xs uppercase tracking-wider text-muted">
          {rows.length} {rows.length === 1 ? "player" : "players"}
          <span className="mx-2 text-border">·</span>
          {decidedCount} scored {decidedCount === 1 ? "pick" : "picks"}
        </p>
      </header>

      <FeaturedLeader
        leader={leader}
        decidedCount={decidedCount}
        empty={rows.length === 0}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <PodiumCard
          place={2}
          row={rows[1] ?? null}
          decidedCount={decidedCount}
        />
        <PodiumCard
          place={3}
          row={rows[2] ?? null}
          decidedCount={decidedCount}
        />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          Rankings appear after an admin enters match winners.
        </p>
      ) : (
        <section className="overflow-x-auto rounded-xl border border-border bg-surface">
          <div className="grid grid-cols-[3.5rem_minmax(0,1.6fr)_5.5rem_5.5rem_4.5rem] gap-2 border-b border-border bg-background/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted sm:grid-cols-[4rem_minmax(0,1.8fr)_7rem_7rem_6rem] sm:px-4">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">Correct</span>
            <span className="text-right">Score</span>
            <span className="text-right">Trend</span>
          </div>
          <ol>
            {rows.map((row) => (
              <LeaderboardRow
                key={row.user_id}
                row={row}
                decidedCount={decidedCount}
                highlight={row.rank <= 3}
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function PodiumCard({
  place,
  row,
  decidedCount,
}: {
  place: 2 | 3;
  row: StandingRow | null;
  decidedCount: number;
}) {
  const medal = medalForRank(place)!;
  return (
    <article
      className={`flex items-center gap-3 rounded-xl border bg-surface px-4 py-3 ${
        place === 2 ? "border-medal-silver/40" : "border-medal-bronze/40"
      }`}
    >
      <PlayerAvatar
        name={row?.username ?? "TBD"}
        src={row?.avatar_url ?? null}
        size={56}
        ring={medal.ring}
      />
      <div className="min-w-0 flex-1">
        <p className={`font-display text-xs font-semibold uppercase tracking-[0.2em] ${medal.text}`}>
          {place === 2 ? "2nd · Silver" : "3rd · Bronze"}
        </p>
        <p className="truncate font-display text-xl font-semibold uppercase leading-tight">
          {row?.username ?? "Open slot"}
        </p>
      </div>
      <div className="text-right">
        <p className="font-display text-2xl font-semibold tabular-nums">
          {row ? row.score : "—"}
        </p>
        <p className="text-[10px] uppercase tracking-wider text-muted">
          {row
            ? `${row.correctPicks}${decidedCount ? `/${decidedCount}` : ""} correct`
            : "Awaiting"}
        </p>
      </div>
    </article>
  );
}

function FeaturedLeader({
  leader,
  decidedCount,
  empty,
}: {
  leader: StandingRow | null;
  decidedCount: number;
  empty: boolean;
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-medal-gold/35 bg-surface">
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-medal-gold shadow-[0_0_18px_var(--medal-gold)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-52 w-80 bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--medal-gold)_22%,transparent),transparent)]"
      />
      <div className="relative flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-6 sm:py-5">
        <PlayerAvatar
          name={leader?.username ?? "TBD"}
          src={leader?.avatar_url ?? null}
          size={96}
          ring="gold"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-medal-gold">
            Current leader
          </p>
          <h2 className="font-display truncate text-3xl font-semibold uppercase leading-none sm:text-4xl">
            {empty ? "Awaiting results" : leader?.username}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {empty
              ? "The first scored bracket takes this throne."
              : "Rank 1 · gold position"}
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[22rem]">
          <StatTile
            label="Score"
            value={empty ? "—" : String(leader?.score ?? 0)}
            tone="gold"
          />
          <StatTile
            label="Correct"
            value={
              empty
                ? "—"
                : `${leader?.correctPicks ?? 0}${decidedCount ? `/${decidedCount}` : ""}`
            }
          />
          <StatTile label="Trend" value="—" hint="Coming soon" />
        </div>
      </div>
    </section>
  );
}

function LeaderboardRow({
  row,
  decidedCount,
  highlight,
}: {
  row: StandingRow;
  decidedCount: number;
  highlight: boolean;
}) {
  const medal = medalForRank(row.rank);
  return (
    <li
      className={`grid grid-cols-[3.5rem_minmax(0,1.6fr)_5.5rem_5.5rem_4.5rem] items-center gap-2 border-t border-border/80 px-3 py-2.5 sm:grid-cols-[4rem_minmax(0,1.8fr)_7rem_7rem_6rem] sm:px-4 ${
        highlight ? "bg-surface-raised/60" : "hover:bg-background/50"
      }`}
    >
      <span className={`font-display text-xl font-semibold ${medal?.text ?? "text-primary"}`}>
        {row.rank === 1 ? "1st" : row.rank === 2 ? "2nd" : row.rank === 3 ? "3rd" : row.rank}
      </span>
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar
          name={row.username}
          src={row.avatar_url}
          size={44}
          ring={medal?.ring}
        />
        <div className="min-w-0">
          <p className="truncate font-medium leading-tight">{row.username}</p>
          {medal ? (
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${medal.text}`}>
              {medal.label}
            </p>
          ) : (
            <p className="text-[10px] uppercase tracking-wider text-muted">Challenger</p>
          )}
        </div>
      </div>
      <span className="text-right tabular-nums text-sm">
        {row.correctPicks}
        {decidedCount ? (
          <span className="text-muted">/{decidedCount}</span>
        ) : null}
      </span>
      <span className="text-right font-display text-xl font-semibold tabular-nums">
        {row.score}
      </span>
      <span
        className="inline-flex items-center justify-end gap-1 text-xs text-muted"
        title="Ranking trend coming soon"
      >
        <TrendPlaceholder />
        —
      </span>
    </li>
  );
}

function StatTile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "gold";
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className={`font-display text-2xl font-semibold leading-none ${
          tone === "gold" ? "text-medal-gold" : ""
        }`}
        title={hint}
      >
        {value}
      </p>
    </div>
  );
}

function PlayerAvatar({
  name,
  src,
  size,
  ring,
}: {
  name: string;
  src: string | null;
  size: number;
  ring?: "gold" | "silver" | "bronze";
}) {
  const ringClass =
    ring === "gold"
      ? "ring-2 ring-medal-gold shadow-[0_0_16px_color-mix(in_srgb,var(--medal-gold)_45%,transparent)]"
      : ring === "silver"
        ? "ring-2 ring-medal-silver"
        : ring === "bronze"
          ? "ring-2 ring-medal-bronze"
          : "ring-1 ring-border";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover ${ringClass}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary/20 font-display font-semibold ${ringClass}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function medalForRank(rank: number) {
  if (rank === 1) return { label: "Gold", text: "text-medal-gold", ring: "gold" as const };
  if (rank === 2) return { label: "Silver", text: "text-medal-silver", ring: "silver" as const };
  if (rank === 3) return { label: "Bronze", text: "text-medal-bronze", ring: "bronze" as const };
  return null;
}

function TrendPlaceholder() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path d="M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
