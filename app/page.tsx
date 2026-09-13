import { BracketPicker } from "@/components/bracket-picker";
import { CommunityPickRatesSection } from "@/components/community-pick-rates";
import { TournamentHero } from "@/components/tournament-hero";
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
      <TournamentHero
        league={league}
        locked={locked}
        submissionCount={communityRates.submissionCount}
        profile={profile}
        pick={pick}
      />

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
