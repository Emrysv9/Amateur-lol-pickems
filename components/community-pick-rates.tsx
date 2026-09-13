import type { CommunityPickRates, OwnershipRow } from "@/lib/community-picks";
import { TeamLogo } from "@/components/team-logo";

export function CommunityPickRatesSection({
  rates,
}: {
  rates: CommunityPickRates;
}) {
  return (
    <section className="space-y-6 rounded-2xl border border-primary/20 bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary">
            Community
          </p>
          <h2 className="font-display mt-2 text-3xl font-semibold uppercase">
            Community Trends
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Who the field has advancing, plus first-round splits. Later rounds
            are ownership, not projected pairings.
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-wider text-muted">
          {rates.submissionCount === 0
            ? "No brackets yet"
            : `${rates.submissionCount} bracket${rates.submissionCount === 1 ? "" : "s"}`}
        </span>
      </div>

      {rates.submissionCount === 0 ? (
        <p className="text-sm text-muted">
          Trends fill in after the first Discord user submits a bracket.
        </p>
      ) : (
        <>
          <MostPickedChampion row={rates.mostPickedChampion} />
          <div className="grid gap-3 lg:grid-cols-3">
            <OwnershipList
              title="Champion"
              caption="% of brackets picking this team to win it all"
              rows={rates.championOwnership}
            />
            <OwnershipList
              title="Finalists"
              caption="% of brackets with this team in the final"
              rows={rates.finalistOwnership}
            />
            <OwnershipList
              title="Final Four"
              caption="% of brackets with this team in the semis"
              rows={rates.finalFourOwnership}
            />
          </div>
        </>
      )}

      {rates.matchups.length === 0 ? null : (
        <div className="space-y-3">
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            First-round matchups
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {rates.matchups.map((matchup) => (
              <article
                key={matchup.id}
                className="overflow-hidden rounded-xl border border-border bg-surface-raised"
              >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    {matchup.title}
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    {matchup.sampleSize === 1 ? "1 pick" : `${matchup.sampleSize} picks`}
                  </p>
                </div>
                <div className="space-y-3 p-4">
                  <PickRow
                    name={matchup.teamAName}
                    logoUrl={matchup.teamALogo}
                    percent={matchup.teamAPercent}
                    empty={matchup.sampleSize === 0}
                  />
                  <PickRow
                    name={matchup.teamBName}
                    logoUrl={matchup.teamBLogo}
                    percent={matchup.teamBPercent}
                    empty={matchup.sampleSize === 0}
                    muted
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MostPickedChampion({ row }: { row: OwnershipRow | null }) {
  if (!row) return null;
  return (
    <article className="flex flex-wrap items-center gap-4 rounded-xl border border-highlight/35 bg-surface-raised px-4 py-4 sm:px-5">
      <TeamLogo team={{ name: row.name, logo_url: row.logoUrl }} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-highlight">
          Most picked champion
        </p>
        <h3 className="font-display truncate text-2xl font-semibold uppercase leading-tight">
          {row.name}
        </h3>
        <p className="text-sm text-muted">
          Picked to win the tournament in {row.count}{" "}
          {row.count === 1 ? "bracket" : "brackets"}
        </p>
      </div>
      <p className="font-display text-4xl font-semibold tabular-nums text-highlight">
        {row.percent}%
      </p>
    </article>
  );
}

function OwnershipList({
  title,
  caption,
  rows,
}: {
  title: string;
  caption: string;
  rows: OwnershipRow[];
}) {
  return (
    <article className="rounded-xl border border-border bg-surface-raised p-4">
      <h3 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-primary">
        {title}
      </h3>
      <p className="mt-1 text-[11px] leading-snug text-muted">{caption}</p>
      <div className="mt-3 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No data yet.</p>
        ) : (
          rows.map((row, index) => (
            <PickRow
              key={row.teamId}
              name={row.name}
              logoUrl={row.logoUrl}
              percent={row.percent}
              empty={false}
              muted={index > 0}
            />
          ))
        )}
      </div>
    </article>
  );
}

function PickRow({
  name,
  logoUrl,
  percent,
  empty,
  muted,
}: {
  name: string;
  logoUrl: string | null;
  percent: number;
  empty: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <TeamLogo team={{ name, logo_url: logoUrl }} size="sm" />
          <span className="truncate">{name}</span>
        </span>
        <span
          className={`font-display text-lg font-semibold tabular-nums ${
            muted ? "text-muted" : "text-primary"
          }`}
        >
          {empty ? "—" : `${percent}%`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full ${muted ? "bg-muted" : "bg-primary"}`}
          style={{ width: empty ? "0%" : `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}
