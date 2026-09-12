import { BracketPicker } from "@/components/bracket-picker";
import { CommunityPickRatesSection } from "@/components/community-pick-rates";
import { LoginButton } from "@/components/login-button";
import { getCurrentProfile } from "@/lib/auth";
import {
  getActiveLeague,
  getCommunityPickRates,
  getLeagueMatches,
  getLeagueTeams,
  getUserPick,
} from "@/lib/data";
import { isLeagueLocked } from "@/lib/types";

export default async function HomePage() {
  const [league, profile] = await Promise.all([getActiveLeague(), getCurrentProfile()]);

  if (!league) {
    return (
      <SetupNeeded />
    );
  }

  const [teams, matches] = await Promise.all([
    getLeagueTeams(league.id),
    getLeagueMatches(league.id),
  ]);
  const [pick, communityRates] = await Promise.all([
    profile ? getUserPick(league.id, profile.id) : Promise.resolve(null),
    getCommunityPickRates(league.id, matches, teams),
  ]);
  const locked = isLeagueLocked(league);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-primary/20 bg-surface p-6 sm:p-8 xl:max-w-5xl">
        <p className="text-xs uppercase tracking-[0.25em] text-primary">
          Active league
        </p>
        <h1 className="font-display mt-2 text-4xl font-semibold uppercase tracking-wide sm:text-5xl">
          {league.name}
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          {league.description}
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs uppercase tracking-wider text-muted">
          <span className="rounded-full border border-border px-3 py-1">
            QF {league.points_quarterfinal} · SF {league.points_semifinal} · F{" "}
            {league.points_final} · Champ {league.points_champion}
          </span>
          <span className="rounded-full border border-border px-3 py-1">
            {locked
              ? "Predictions are locked"
              : league.lock_at
                ? `Editable until ${new Date(league.lock_at).toLocaleString()}`
                : "Editable until locked"}
          </span>
          {pick && !locked ? (
            <span className="rounded-full border border-primary/40 px-3 py-1 text-primary">
              Saved · you can still edit
            </span>
          ) : null}
        </div>
        {!profile ? (
          <div className="mt-6">
            <LoginButton label="Sign in with Discord to pick" />
          </div>
        ) : null}
      </section>

      <BracketPicker
        league={league}
        matches={matches}
        teams={teams}
        existing={pick}
        locked={locked}
        signedIn={Boolean(profile)}
      />

      <div className="xl:max-w-6xl">
        <CommunityPickRatesSection rates={communityRates} />
      </div>
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8">
      <h1 className="font-display text-3xl font-semibold uppercase">
        No league is seeded yet
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        Create a Supabase project, run <code className="text-primary">supabase/complete.sql</code>{" "}
        (or the AVL patch if tables already exist), and add your env vars.
      </p>
    </div>
  );
}
