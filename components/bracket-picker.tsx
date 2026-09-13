"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { saveBracketPick } from "@/lib/actions/picks";
import { TeamLogo } from "@/components/team-logo";
import type { League, Match, PickRow, Team } from "@/lib/types";

type Props = {
  league: League;
  matches: Match[];
  teams: Team[];
  existing: PickRow | null;
  locked: boolean;
  signedIn: boolean;
};

function teamName(teams: Team[], id: string | null) {
  if (!id) return "TBD";
  return teams.find((t) => t.id === id)?.name ?? "TBD";
}

export function BracketPicker({
  league,
  matches,
  teams,
  existing,
  locked,
  signedIn,
}: Props) {
  const [selections, setSelections] = useState<Record<string, string>>(
    existing?.selections ?? {},
  );
  const [savedOnce, setSavedOnce] = useState(Boolean(existing));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (existing?.selections) {
      setSelections(existing.selections);
      setSavedOnce(true);
    }
  }, [existing]);

  const byRound = useMemo(() => {
    const qf = matches
      .filter((m) => m.round === "quarterfinal")
      .sort((a, b) => a.slot - b.slot);
    const sf = matches
      .filter((m) => m.round === "semifinal")
      .sort((a, b) => a.slot - b.slot);
    const finals = matches
      .filter((m) => m.round === "final")
      .sort((a, b) => a.slot - b.slot);
    return { qf, sf, finals };
  }, [matches]);

  const qfVisual = useMemo(() => {
    return byRound.sf.flatMap((sfMatch) => {
      const feeders = byRound.qf.filter((q) => q.next_match_id === sfMatch.id);
      const a = feeders.find((q) => q.next_slot === "a");
      const b = feeders.find((q) => q.next_slot === "b");
      return [a, b].filter((m): m is Match => Boolean(m));
    });
  }, [byRound]);

  const sfTeams = useMemo(() => {
    return byRound.sf.map((sfMatch) => {
      const feeders = byRound.qf.filter((q) => q.next_match_id === sfMatch.id);
      const a = feeders.find((q) => q.next_slot === "a");
      const b = feeders.find((q) => q.next_slot === "b");
      return {
        match: sfMatch,
        teamA: a ? selections[a.id] ?? null : null,
        teamB: b ? selections[b.id] ?? null : null,
        feederPicked: Boolean(a && b && selections[a.id] && selections[b.id]),
      };
    });
  }, [byRound, selections]);

  const finalTeams = useMemo(() => {
    return byRound.finals.map((finalMatch) => {
      const feeders = byRound.sf.filter((s) => s.next_match_id === finalMatch.id);
      const a = feeders.find((s) => s.next_slot === "a");
      const b = feeders.find((s) => s.next_slot === "b");
      return {
        match: finalMatch,
        teamA: a ? selections[a.id] ?? null : null,
        teamB: b ? selections[b.id] ?? null : null,
        feederPicked: Boolean(a && b && selections[a.id] && selections[b.id]),
      };
    });
  }, [byRound, selections]);

  const championId =
    byRound.finals[0] ? selections[byRound.finals[0].id] ?? null : null;

  function pickWinner(match: Match, teamId: string, dependentIds: string[]) {
    if (locked) return;
    setSelections((prev) => {
      const next = { ...prev, [match.id]: teamId };
      for (const id of dependentIds) delete next[id];
      return next;
    });
  }

  function downstreamFrom(matchId: string): string[] {
    const ids: string[] = [];
    const start = matches.find((m) => m.id === matchId);
    let cursor = start;
    while (cursor?.next_match_id) {
      ids.push(cursor.next_match_id);
      cursor = matches.find((m) => m.id === cursor?.next_match_id);
    }
    return ids;
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveBracketPick({
        selections,
        championTeamId: championId,
      });
      if (!result.ok) setMessage(result.error);
      else {
        setSavedOnce(true);
        setMessage("Changes saved.");
      }
    });
  }

  const champTeam = teams.find((t) => t.id === championId);

  return (
    <div className="space-y-6">
      {locked ? (
        <div
          role="status"
          className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-medium text-primary"
        >
          Predictions are locked.
        </div>
      ) : signedIn ? (
        <p className="text-sm text-muted">
          {savedOnce
            ? "Your bracket is saved. Change any pick and save again until the tournament is locked."
            : "Submit one bracket. You can return and edit it until the tournament is locked."}
        </p>
      ) : null}

      <p className="text-xs uppercase tracking-[0.2em] text-muted">
        Click a team to advance them — winners fill the next round
      </p>

      <div className="bracket-scroll">
        <div className="bracket-board">
          <div className="bracket-head bracket-head-qf">
            Quarters · {league.points_quarterfinal} pts
          </div>
          <div className="bracket-head bracket-head-sf">
            Semis · {league.points_semifinal} pts
          </div>
          <div className="bracket-head bracket-head-final">
            Final · {league.points_final} pts
          </div>
          <div className="bracket-head bracket-head-champ">
            Champion · {league.points_champion} pts
          </div>

          {qfVisual.map((match, index) => (
            <div key={match.id} className={`bracket-cell bracket-qf-${index + 1}`}>
              <MatchCard
                label={`QF ${match.slot}`}
                teamAId={match.team_a_id}
                teamBId={match.team_b_id}
                selectedId={selections[match.id] ?? null}
                teams={teams}
                disabled={locked}
                onPick={(teamId) =>
                  pickWinner(match, teamId, downstreamFrom(match.id))
                }
              />
            </div>
          ))}

          <div
            className={`bracket-join bracket-join-pair bracket-join-sf1 ${
              sfTeams[0]?.feederPicked ? "is-live" : ""
            }`}
            aria-hidden
          />
          <div
            className={`bracket-join bracket-join-pair bracket-join-sf2 ${
              sfTeams[1]?.feederPicked ? "is-live" : ""
            }`}
            aria-hidden
          />

          {sfTeams.map((entry, index) => (
            <div
              key={entry.match.id}
              className={`bracket-cell bracket-sf-${index + 1}`}
            >
              <MatchCard
                label={`SF ${entry.match.slot}`}
                teamAId={entry.teamA}
                teamBId={entry.teamB}
                selectedId={selections[entry.match.id] ?? null}
                teams={teams}
                disabled={locked || !entry.teamA || !entry.teamB}
                onPick={(teamId) =>
                  pickWinner(entry.match, teamId, downstreamFrom(entry.match.id))
                }
              />
            </div>
          ))}

          <div
            className={`bracket-join bracket-join-pair bracket-join-final ${
              finalTeams[0]?.feederPicked ? "is-live" : ""
            }`}
            aria-hidden
          />

          {finalTeams.map((entry) => (
            <div key={entry.match.id} className="bracket-cell bracket-final">
              <MatchCard
                label="Grand Final"
                teamAId={entry.teamA}
                teamBId={entry.teamB}
                selectedId={selections[entry.match.id] ?? null}
                teams={teams}
                disabled={locked || !entry.teamA || !entry.teamB}
                onPick={(teamId) =>
                  pickWinner(entry.match, teamId, downstreamFrom(entry.match.id))
                }
              />
            </div>
          ))}

          <div
            className={`bracket-join bracket-join-champ ${championId ? "is-live" : ""}`}
            aria-hidden
          />

          <div className="bracket-cell bracket-champ">
            <div
              className={`w-full overflow-hidden rounded-xl border px-4 py-5 transition ${
                championId
                  ? "champion-card"
                  : "border-border bg-surface"
              }`}
            >
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-highlight">
                {championId ? "Champion" : "Tournament winner"}
              </p>
              <div className="flex items-center gap-3">
                <TeamLogo team={champTeam} size="lg" />
                <p className="font-display text-2xl font-semibold leading-tight text-foreground">
                  {teamName(teams, championId)}
                </p>
              </div>
              <p className="mt-3 text-xs text-muted">
                {championId
                  ? "Your predicted tournament champion."
                  : "The team you pick in the final is your champion."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!signedIn ? (
          <p className="text-sm text-muted">
            Sign in with Discord to save one bracket.
          </p>
        ) : locked ? (
          <p className="text-sm font-medium text-primary">
            Predictions are locked.
          </p>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-highlight hover:shadow-[0_0_16px_color-mix(in_srgb,var(--highlight)_22%,transparent)] disabled:opacity-60"
          >
            {pending
              ? "Saving…"
              : savedOnce
                ? "Save changes"
                : "Save bracket"}
          </button>
        )}
        {message && !locked ? (
          <p className="text-sm text-primary">{message}</p>
        ) : null}
      </div>
    </div>
  );
}

function MatchCard({
  label,
  teamAId,
  teamBId,
  selectedId,
  teams,
  disabled,
  onPick,
}: {
  label: string;
  teamAId: string | null;
  teamBId: string | null;
  selectedId: string | null;
  teams: Team[];
  disabled: boolean;
  onPick: (teamId: string) => void;
}) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-background shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          {label}
        </span>
        {selectedId ? (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Advanced
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-muted/60">
            Pick winner
          </span>
        )}
      </div>
      <TeamRow
        teamId={teamAId}
        selected={selectedId === teamAId}
        eliminated={Boolean(selectedId && selectedId !== teamAId)}
        teams={teams}
        disabled={disabled || !teamAId}
        onPick={onPick}
      />
      <div className="h-px bg-border" />
      <TeamRow
        teamId={teamBId}
        selected={selectedId === teamBId}
        eliminated={Boolean(selectedId && selectedId !== teamBId)}
        teams={teams}
        disabled={disabled || !teamBId}
        onPick={onPick}
      />
    </div>
  );
}

function TeamRow({
  teamId,
  selected,
  eliminated,
  teams,
  disabled,
  onPick,
}: {
  teamId: string | null;
  selected: boolean;
  eliminated: boolean;
  teams: Team[];
  disabled: boolean;
  onPick: (teamId: string) => void;
}) {
  const team = teams.find((t) => t.id === teamId);
  return (
    <button
      type="button"
      disabled={disabled || !teamId}
      onClick={() => teamId && onPick(teamId)}
      className={`group flex w-full items-center gap-2.5 px-2.5 py-2.5 text-left text-sm transition duration-150 ${
        selected
          ? "bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_50%,transparent),0_0_18px_color-mix(in_srgb,var(--highlight)_16%,transparent)]"
          : eliminated
            ? "bg-transparent text-muted/70 hover:bg-foreground/5"
            : "hover:-translate-y-px hover:bg-primary/10 hover:text-foreground"
      } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-transparent`}
    >
      <span
        className={`h-8 w-0.5 shrink-0 rounded-full transition ${
          selected ? "bg-highlight shadow-[0_0_10px_color-mix(in_srgb,var(--highlight)_35%,transparent)]" : "bg-transparent group-hover:bg-primary/50"
        }`}
      />
      <TeamLogo team={team} size="md" />
      <span className="min-w-0 flex-1">
        {team?.seed ? (
          <span className="mr-1.5 font-mono text-[11px] text-muted">
            {team.seed}
          </span>
        ) : null}
        <span className={`truncate ${selected ? "font-semibold" : ""}`}>
          {team?.name ?? "TBD"}
        </span>
      </span>
      {selected ? (
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary">
          Adv
        </span>
      ) : null}
    </button>
  );
}
