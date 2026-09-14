import { notFound } from "next/navigation";
import Link from "next/link";
import { BracketPicker } from "@/components/bracket-picker";
import {
  getActiveLeague,
  getLeagueMatches,
  getLeagueTeams,
  getLockedUserPick,
} from "@/lib/data";
import { isLeagueLocked } from "@/lib/types";

export default async function PlayerBracketPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const league = await getActiveLeague();
  if (!league || !isLeagueLocked(league)) notFound();

  const pick = await getLockedUserPick(league.id, userId);
  if (!pick) notFound();

  const [teams, matches] = await Promise.all([
    getLeagueTeams(league.id),
    getLeagueMatches(league.id),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            Locked bracket
          </p>
          <h1 className="font-display text-4xl font-semibold uppercase leading-none tracking-wide">
            {pick.username}
          </h1>
        </div>
        <Link
          href="/leaderboard"
          className="text-sm text-muted hover:text-primary"
        >
          ← Back to leaderboard
        </Link>
      </div>
      <BracketPicker
        league={league}
        matches={matches}
        teams={teams}
        existing={pick}
        locked
        signedIn={false}
        viewingName={pick.username}
      />
    </div>
  );
}
