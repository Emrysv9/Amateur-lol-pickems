import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/admin-panel";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import {
  getActiveLeague,
  getLeagueMatches,
  getLeagues,
  getLeagueTeams,
} from "@/lib/data";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/admin");
  if (!isAdmin(profile)) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8">
        <h1 className="font-display text-3xl font-semibold uppercase">
          Restricted
        </h1>
        <p className="mt-3 text-sm text-muted">
          This Discord account is not in <code>ADMIN_DISCORD_IDS</code>.
        </p>
      </div>
    );
  }

  const league = await getActiveLeague();
  if (!league) {
    return (
      <p className="text-sm text-muted">
        No league is seeded yet. Run <code>supabase/complete.sql</code> or create
        one below after the tables exist.
      </p>
    );
  }

  const [teams, matches, leagues] = await Promise.all([
    getLeagueTeams(league.id),
    getLeagueMatches(league.id),
    getLeagues(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-primary">
          Operations
        </p>
        <h1 className="font-display mt-2 text-4xl font-semibold uppercase">
          Admin
        </h1>
        <p className="mt-2 text-sm text-muted">
          Edit the active league, teams, and pairings here. Enter series winners
          when games finish.
        </p>
      </div>
      <AdminPanel
        league={league}
        leagues={leagues}
        matches={matches}
        teams={teams}
      />
    </div>
  );
}
