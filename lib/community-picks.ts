import type { Match, Round, Team } from "@/lib/types";

export type CommunityMatchup = {
  id: string;
  round: Round;
  slot: number;
  title: string;
  teamAName: string;
  teamBName: string;
  teamALogo: string | null;
  teamBLogo: string | null;
  teamAPercent: number;
  teamBPercent: number;
  teamACount: number;
  teamBCount: number;
  sampleSize: number;
};

export type OwnershipRow = {
  teamId: string;
  name: string;
  logoUrl: string | null;
  count: number;
  percent: number;
};

export type CommunityPickInput = {
  selections: Record<string, string>;
  championTeamId?: string | null;
};

export type CommunityPickRates = {
  submissionCount: number;
  matchups: CommunityMatchup[];
  mostPickedChampion: OwnershipRow | null;
  championOwnership: OwnershipRow[];
  finalistOwnership: OwnershipRow[];
  finalFourOwnership: OwnershipRow[];
};

function teamName(teams: Team[], id: string | null) {
  if (!id) return "TBD";
  return teams.find((t) => t.id === id)?.name ?? "TBD";
}

function teamLogo(teams: Team[], id: string | null) {
  if (!id) return null;
  return teams.find((t) => t.id === id)?.logo_url ?? null;
}

function percents(a: number, b: number): [number, number] {
  const total = a + b;
  if (total === 0) return [0, 0];
  const teamA = Math.round((a / total) * 100);
  return [teamA, 100 - teamA];
}

function byRound(matches: Match[]) {
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
}

function ownershipRows(
  teams: Team[],
  submissionCount: number,
  idsPerPick: (string | null | undefined)[][],
): OwnershipRow[] {
  const counts = new Map<string, number>();
  for (const ids of idsPerPick) {
    const unique = new Set(ids.filter((id): id is string => Boolean(id)));
    for (const id of unique) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([teamId, count]) => ({
      teamId,
      name: teamName(teams, teamId),
      logoUrl: teamLogo(teams, teamId),
      count,
      percent:
        submissionCount === 0 ? 0 : Math.round((count / submissionCount) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function computeCommunityPickRates(
  matches: Match[],
  teams: Team[],
  picks: CommunityPickInput[],
): CommunityPickRates {
  const { qf, sf, finals } = byRound(matches);
  const matchups: CommunityMatchup[] = [];
  const finalMatch = finals[0];

  for (const match of qf) {
    if (!match.team_a_id || !match.team_b_id) continue;
    let aWins = 0;
    let bWins = 0;
    for (const pick of picks) {
      const winner = pick.selections[match.id];
      if (winner === match.team_a_id) aWins += 1;
      else if (winner === match.team_b_id) bWins += 1;
    }
    const [teamAPercent, teamBPercent] = percents(aWins, bWins);
    matchups.push({
      id: match.id,
      round: "quarterfinal",
      slot: match.slot,
      title: `QF ${match.slot}`,
      teamAName: teamName(teams, match.team_a_id),
      teamBName: teamName(teams, match.team_b_id),
      teamALogo: teamLogo(teams, match.team_a_id),
      teamBLogo: teamLogo(teams, match.team_b_id),
      teamAPercent,
      teamBPercent,
      teamACount: aWins,
      teamBCount: bWins,
      sampleSize: aWins + bWins,
    });
  }

  const championOwnership = ownershipRows(
    teams,
    picks.length,
    picks.map((pick) => [
      pick.championTeamId || (finalMatch ? pick.selections[finalMatch.id] : null),
    ]),
  );

  const finalistOwnership = ownershipRows(
    teams,
    picks.length,
    picks.map((pick) => sf.map((match) => pick.selections[match.id])),
  );

  const finalFourOwnership = ownershipRows(
    teams,
    picks.length,
    picks.map((pick) => qf.map((match) => pick.selections[match.id])),
  );

  return {
    submissionCount: picks.length,
    matchups,
    mostPickedChampion: championOwnership[0] ?? null,
    championOwnership,
    finalistOwnership,
    finalFourOwnership,
  };
}
