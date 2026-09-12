import type { CommunityPickRates } from "@/lib/community-picks";
import { TeamLogo } from "@/components/team-logo";
import type { Round } from "@/lib/types";

const ROUND_ORDER: Round[] = ["quarterfinal", "semifinal", "final"];

const ROUND_LABEL: Record<Round, string> = {
  quarterfinal: "Quarterfinals",
  semifinal: "Semifinals",
  final: "Final",
};

export function CommunityPickRatesSection({
  rates,
}: {
  rates: CommunityPickRates;
}) {
  const grouped = ROUND_ORDER.map((round) => ({
    round,
    items: rates.matchups.filter((m) => m.round === round),
  })).filter((group) => group.items.length > 0);

  return (
    <section className="space-y-5 rounded-2xl border border-primary/20 bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary">
            Community
          </p>
          <h2 className="font-display mt-2 text-3xl font-semibold uppercase">
            Community Pick Rate
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            How submitted brackets split every matchup. Later rounds use each
            player&apos;s projected pairing.
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
          Percentages fill in after the first Discord user submits a bracket.
        </p>
      ) : null}

      {grouped.length === 0 ? null : (
        <div className="space-y-8">
          {grouped.map(({ round, items }) => (
            <div key={round} className="space-y-3">
              <h3 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                {ROUND_LABEL[round]}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((matchup) => (
                  <article
                    key={matchup.id}
                    className="overflow-hidden rounded-xl border border-border bg-surface-raised"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted">
                          {matchup.title}
                        </p>
                        {matchup.subtitle ? (
                          <p className="text-[11px] text-primary/80">
                            {matchup.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-[11px] uppercase tracking-wider text-muted">
                        {matchup.sampleSize} pick
                        {matchup.sampleSize === 1 ? "" : "s"}
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
          ))}
        </div>
      )}
    </section>
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
          style={{ width: empty ? "0%" : `${percent}%` }}
        />
      </div>
    </div>
  );
}
