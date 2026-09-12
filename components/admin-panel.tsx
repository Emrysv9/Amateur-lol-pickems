"use client";

import { useState, useTransition } from "react";
import {
  applySeededQuarterfinals,
  createEightTeamLeague,
  removeTeamLogo,
  resetLeague,
  setActiveLeague,
  setMatchWinner,
  setSubmissionsLocked,
  updateLeagueDetails,
  updateQuarterfinals,
  updateScoring,
  updateTeams,
  uploadTeamLogo,
} from "@/lib/actions/admin";
import { TeamLogo } from "@/components/team-logo";
import { isoToEasternLocal } from "@/lib/eastern-time";
import type { League, Match, Team } from "@/lib/types";

const fieldClass =
  "mt-1 w-full rounded-md border border-border bg-background/40 px-2 py-1.5 text-sm text-foreground";

export function AdminPanel({
  league,
  leagues,
  matches,
  teams,
}: {
  league: League;
  leagues: League[];
  matches: Match[];
  teams: Team[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rounds: Array<{ key: Match["round"]; label: string }> = [
    { key: "quarterfinal", label: "Enter winners" },
    { key: "semifinal", label: "Semifinals" },
    { key: "final", label: "Final" },
  ];

  const qf = matches
    .filter((m) => m.round === "quarterfinal")
    .sort((a, b) => a.slot - b.slot);

  function name(id: string | null) {
    if (!id) return "TBD";
    return teams.find((t) => t.id === id)?.name ?? "TBD";
  }

  return (
    <div className="space-y-10">
      {message ? <p className="text-sm text-primary">{message}</p> : null}

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-display text-xl font-semibold uppercase">
          Active tournament
        </h2>
        <p className="mt-1 text-sm text-muted">
          The public site shows the active league. Create another 8-team
          playoff when you need a new event — no code change required.
        </p>
        {leagues.length > 1 ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              className={fieldClass + " max-w-md"}
              defaultValue={league.id}
              disabled={pending}
              onChange={(e) => {
                const id = e.target.value;
                startTransition(async () => {
                  const result = await setActiveLeague(id);
                  setMessage(result.ok ? "Active league updated." : result.error);
                });
              }}
            >
              {leagues.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.is_active ? " (active)" : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            startTransition(async () => {
              const result = await updateLeagueDetails({
                name: String(form.get("name") ?? ""),
                description: String(form.get("description") ?? ""),
                lockAtLocal: String(form.get("lockAt") ?? ""),
              });
              setMessage(result.ok ? "League details saved." : result.error);
            });
          }}
        >
          <label className="text-xs uppercase text-muted">
            Name
            <input name="name" required defaultValue={league.name} className={fieldClass} />
          </label>
          <label className="text-xs uppercase text-muted">
            Description
            <textarea
              name="description"
              rows={3}
              defaultValue={league.description ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="text-xs uppercase text-muted">
            Predictions lock (Eastern Time)
            <input
              name="lockAt"
              type="datetime-local"
              defaultValue={isoToEasternLocal(league.lock_at)}
              className={fieldClass + " max-w-xs"}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
          >
            Save league details
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-display text-xl font-semibold uppercase">
          Teams and seeds
        </h2>
        <p className="mt-1 text-sm text-muted">
          Seed 1 plays seed 8, 2 vs 7, 3 vs 6, 4 vs 5 after you apply pairings.
        </p>
        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const rows = teams.map((team) => ({
              id: team.id,
              name: String(form.get(`name-${team.id}`) ?? ""),
              seed: Number(form.get(`seed-${team.id}`)),
            }));
            startTransition(async () => {
              const result = await updateTeams(rows);
              setMessage(result.ok ? "Teams saved." : result.error);
            });
          }}
        >
          {teams
            .slice()
            .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))
            .map((team) => (
              <div
                key={team.id}
                className="grid grid-cols-[2rem_4rem_1fr] items-center gap-2 sm:grid-cols-[2rem_4rem_1fr_auto]"
              >
                <TeamLogo team={team} size="md" />
                <input
                  name={`seed-${team.id}`}
                  type="number"
                  min={1}
                  max={8}
                  defaultValue={team.seed ?? undefined}
                  className={fieldClass}
                  aria-label="Seed"
                />
                <input
                  name={`name-${team.id}`}
                  defaultValue={team.name}
                  className={fieldClass}
                  aria-label="Team name"
                />
                <div className="col-span-3 flex flex-wrap items-center gap-2 sm:col-span-1">
                  <label className="cursor-pointer rounded-md border border-border px-2 py-1.5 text-xs text-muted hover:border-primary/50 hover:text-primary">
                    Upload logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        const body = new FormData();
                        body.set("teamId", team.id);
                        body.set("file", file);
                        startTransition(async () => {
                          const result = await uploadTeamLogo(body);
                          setMessage(result.ok ? `Logo saved for ${team.name}.` : result.error);
                        });
                      }}
                    />
                  </label>
                  {team.logo_url ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await removeTeamLogo(team.id);
                          setMessage(result.ok ? "Logo removed." : result.error);
                        })
                      }
                      className="text-xs text-muted hover:text-error"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          <button
            type="submit"
            disabled={pending}
            className="mt-3 w-fit rounded-md border border-primary/50 px-4 py-2 text-sm text-primary"
          >
            Save teams
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-display text-xl font-semibold uppercase">
          Quarterfinal pairings
        </h2>
        <p className="mt-1 text-sm text-muted">
          Changing pairings clears later-round results. Use seeds for the
          standard 1v8 / 2v7 / 3v6 / 4v5 bracket.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await applySeededQuarterfinals();
              setMessage(
                result.ok ? "Applied 1v8, 2v7, 3v6, 4v5 from seeds." : result.error,
              );
            })
          }
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
        >
          Apply 1v8 / 2v7 / 3v6 / 4v5 from seeds
        </button>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const pairings = qf.map((match) => ({
              matchId: match.id,
              teamAId: String(form.get(`a-${match.id}`) ?? ""),
              teamBId: String(form.get(`b-${match.id}`) ?? ""),
            }));
            startTransition(async () => {
              const result = await updateQuarterfinals(pairings);
              setMessage(result.ok ? "Pairings saved." : result.error);
            });
          }}
        >
          {qf.map((match) => (
              <div
                key={match.id}
                className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[auto_1fr_auto_1fr] sm:items-center"
              >
                <p className="self-center text-xs uppercase tracking-wider text-muted">
                  QF {match.slot}
                </p>
                <label className="flex items-center gap-2">
                  <TeamLogo
                    team={teams.find((t) => t.id === match.team_a_id) ?? null}
                    size="sm"
                  />
                  <select
                    name={`a-${match.id}`}
                    defaultValue={match.team_a_id ?? ""}
                    className={fieldClass}
                  >
                    <option value="">Team A</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        #{team.seed} {team.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="self-center text-center text-xs text-muted">vs</p>
                <label className="flex items-center gap-2">
                  <TeamLogo
                    team={teams.find((t) => t.id === match.team_b_id) ?? null}
                    size="sm"
                  />
                  <select
                    name={`b-${match.id}`}
                    defaultValue={match.team_b_id ?? ""}
                    className={fieldClass}
                  >
                    <option value="">Team B</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        #{team.seed} {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
          ))}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary"
          >
            Save pairings
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-error/50 bg-error/10 p-6">
        <h2 className="font-display text-xl font-semibold uppercase text-error">
          Reset league
        </h2>
        <p className="mt-1 text-sm text-muted">
          Clears every submitted bracket and the leaderboard for{" "}
          <span className="text-primary">{league.name}</span>, unlocks
          predictions, and wipes match results. Then enter new teams below — or
          create a new tournament in the next section. This cannot be undone.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            startTransition(async () => {
              const result = await resetLeague({
                confirm: String(form.get("confirm") ?? ""),
                resetTeamNames: form.get("resetTeams") === "on",
              });
              setMessage(
                result.ok
                  ? "League reset. Enter new team names, save teams, then apply pairings."
                  : result.error,
              );
              if (result.ok) e.currentTarget.reset();
            });
          }}
        >
          <label className="flex items-start gap-2 text-sm text-muted">
            <input
              type="checkbox"
              name="resetTeams"
              defaultChecked
              className="mt-1"
            />
            Replace team names with Team 1–8 so you can type the next roster
          </label>
          <label className="block text-xs uppercase text-muted">
            Type RESET to confirm
            <input
              name="confirm"
              autoComplete="off"
              className={fieldClass + " max-w-xs"}
              placeholder="RESET"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-error px-4 py-2 text-sm font-semibold text-foreground hover:bg-error/90 disabled:opacity-60"
          >
            Reset League
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-display text-xl font-semibold uppercase">
          New 8-team league
        </h2>
        <p className="mt-1 text-sm text-muted">
          Creates a fresh bracket, marks it active, and leaves this one in the
          database for history.
        </p>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            startTransition(async () => {
              const result = await createEightTeamLeague({
                name: String(form.get("newName") ?? ""),
                description: String(form.get("newDescription") ?? ""),
                lockAtLocal: String(form.get("newLock") ?? ""),
              });
              setMessage(result.ok ? "New league created and set active." : result.error);
            });
          }}
        >
          <label className="text-xs uppercase text-muted">
            Name
            <input name="newName" required className={fieldClass} />
          </label>
          <label className="text-xs uppercase text-muted">
            Description
            <input name="newDescription" className={fieldClass} />
          </label>
          <label className="text-xs uppercase text-muted">
            Lock (Eastern)
            <input name="newLock" type="datetime-local" className={fieldClass + " max-w-xs"} />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="w-fit rounded-md border border-primary/50 px-4 py-2 text-sm text-primary"
          >
            Create league
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-display text-xl font-semibold uppercase">
          Tournament lock
        </h2>
        <p className="mt-1 text-sm text-muted">
          Locking makes every bracket read-only. Players see “Predictions are
          locked.”
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await setSubmissionsLocked(!league.submissions_locked);
              setMessage(
                result.ok
                  ? league.submissions_locked
                    ? "Predictions unlocked."
                    : "Predictions are locked."
                  : result.error,
              );
            })
          }
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
        >
          {league.submissions_locked ? "Unlock predictions" : "Lock tournament"}
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-display text-xl font-semibold uppercase">Scoring</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            startTransition(async () => {
              const result = await updateScoring({
                points_quarterfinal: Number(form.get("qf")),
                points_semifinal: Number(form.get("sf")),
                points_final: Number(form.get("final")),
                points_champion: Number(form.get("champ")),
              });
              setMessage(result.ok ? "Scoring saved." : result.error);
            });
          }}
        >
          <label className="text-xs uppercase text-muted">
            Quarterfinal
            <input name="qf" type="number" defaultValue={league.points_quarterfinal} className={fieldClass} />
          </label>
          <label className="text-xs uppercase text-muted">
            Semifinal
            <input name="sf" type="number" defaultValue={league.points_semifinal} className={fieldClass} />
          </label>
          <label className="text-xs uppercase text-muted">
            Final
            <input name="final" type="number" defaultValue={league.points_final} className={fieldClass} />
          </label>
          <label className="text-xs uppercase text-muted">
            Champion
            <input name="champ" type="number" defaultValue={league.points_champion} className={fieldClass} />
          </label>
          <button
            type="submit"
            className="sm:col-span-4 mt-2 w-fit rounded-md border border-primary/50 px-4 py-2 text-sm text-primary"
          >
            Save scoring
          </button>
        </form>
      </section>

      {rounds.map((round) => (
        <section key={round.key} className="space-y-3">
          <h2 className="font-display text-xl font-semibold uppercase">
            {round.label}
          </h2>
          {matches
            .filter((m) => m.round === round.key)
            .sort((a, b) => a.slot - b.slot)
            .map((match) => (
              <div
                key={match.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <TeamLogo
                      team={teams.find((t) => t.id === match.team_a_id) ?? null}
                      size="sm"
                    />
                    {name(match.team_a_id)}
                  </span>
                  <span className="text-muted">vs</span>
                  <span className="inline-flex items-center gap-2">
                    <TeamLogo
                      team={teams.find((t) => t.id === match.team_b_id) ?? null}
                      size="sm"
                    />
                    {name(match.team_b_id)}
                  </span>
                </p>
                <select
                  className="rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
                  defaultValue={match.winner_id ?? ""}
                  disabled={!match.team_a_id || !match.team_b_id || pending}
                  onChange={(e) => {
                    const value = e.target.value || null;
                    startTransition(async () => {
                      const result = await setMatchWinner(match.id, value);
                      setMessage(result.ok ? "Result saved." : result.error);
                    });
                  }}
                >
                  <option value="">No winner yet</option>
                  {match.team_a_id ? (
                    <option value={match.team_a_id}>{name(match.team_a_id)}</option>
                  ) : null}
                  {match.team_b_id ? (
                    <option value={match.team_b_id}>{name(match.team_b_id)}</option>
                  ) : null}
                </select>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
