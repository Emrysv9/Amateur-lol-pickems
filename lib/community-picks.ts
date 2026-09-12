import type { Match, Round, Team } from "@/lib/types";

export type CommunityMatchup = {
  id: string;
  round: Round;
  slot: number;
  title: string;
  subtitle?: string;
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

export type CommunityPickRates = {
  submissionCount: number;
  matchups: CommunityMatchup[];
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

function feedersFor(match: Match, previous: Match[]) {
  const feeders = previous.filter((m) => m.next_match_id === match.id);
  return {
    a: feeders.find((m) => m.next_slot === "a"),
    b: feeders.find((m) => m.next_slot === "b"),
  };
}

function pushSplit(
  out: CommunityMatchup[],
  input: {
    id: string;
    round: Round;
    slot: number;
    title: string;
    subtitle?: string;
    teamAId: string;
    teamBId: string;
    aWins: number;
    bWins: number;
    teams: Team[];
  },
) {
  const [teamAPercent, teamBPercent] = percents(input.aWins, input.bWins);
  out.push({
    id: input.id,
    round: input.round,
    slot: input.slot,
    title: input.title,
    subtitle: input.subtitle,
    teamAName: teamName(input.teams, input.teamAId),
    teamBName: teamName(input.teams, input.teamBId),
    teamALogo: teamLogo(input.teams, input.teamAId),
    teamBLogo: teamLogo(input.teams, input.teamBId),
    teamAPercent,
    teamBPercent,
    teamACount: input.aWins,
    teamBCount: input.bWins,
    sampleSize: input.aWins + input.bWins,
  });
}

function projectedMatchups(
  match: Match,
  feederA: Match | undefined,
  feederB: Match | undefined,
  picks: { selections: Record<string, string> }[],
  teams: Team[],
  title: string,
): CommunityMatchup[] {
  const groups = new Map<
    string,
    { aId: string; bId: string; aWins: number; bWins: number }
  >();

  for (const pick of picks) {
    const aId = feederA ? pick.selections[feederA.id] : undefined;
    const bId = feederB ? pick.selections[feederB.id] : undefined;
    if (!aId || !bId || aId === bId) continue;
    const key = `${aId}|${bId}`;
    const group = groups.get(key) ?? { aId, bId, aWins: 0, bWins: 0 };
    const winner = pick.selections[match.id];
    if (winner === aId) group.aWins += 1;
    else if (winner === bId) group.bWins += 1;
    groups.set(key, group);
  }

  const ranked = [...groups.values()].sort(
    (left, right) => right.aWins + right.bWins - (left.aWins + left.bWins),
  );
  const showSubtitle = ranked.length > 1;

  return ranked.map((group, index) => {
    const [teamAPercent, teamBPercent] = percents(group.aWins, group.bWins);
    return {
      id: `${match.id}-${group.aId}-${group.bId}`,
      round: match.round,
      slot: match.slot,
      title,
      subtitle: showSubtitle
        ? index === 0
          ? "Most common projected matchup"
          : "Alternate projected matchup"
        : undefined,
      teamAName: teamName(teams, group.aId),
      teamBName: teamName(teams, group.bId),
      teamALogo: teamLogo(teams, group.aId),
      teamBLogo: teamLogo(teams, group.bId),
      teamAPercent,
      teamBPercent,
      teamACount: group.aWins,
      teamBCount: group.bWins,
      sampleSize: group.aWins + group.bWins,
    };
  });
}

export function computeCommunityPickRates(
  matches: Match[],
  teams: Team[],
  picks: { selections: Record<string, string> }[],
): CommunityPickRates {
  const { qf, sf, finals } = byRound(matches);
  const matchups: CommunityMatchup[] = [];

  for (const match of qf) {
    if (!match.team_a_id || !match.team_b_id) continue;
    let aWins = 0;
    let bWins = 0;
    for (const pick of picks) {
      const winner = pick.selections[match.id];
      if (winner === match.team_a_id) aWins += 1;
      else if (winner === match.team_b_id) bWins += 1;
    }
    pushSplit(matchups, {
      id: match.id,
      round: "quarterfinal",
      slot: match.slot,
      title: `QF ${match.slot}`,
      teamAId: match.team_a_id,
      teamBId: match.team_b_id,
      aWins,
      bWins,
      teams,
    });
  }

  for (const match of sf) {
    const feed = feedersFor(match, qf);
    matchups.push(
      ...projectedMatchups(
        match,
        feed.a,
        feed.b,
        picks,
        teams,
        `SF ${match.slot}`,
      ),
    );
  }

  for (const match of finals) {
    const feed = feedersFor(match, sf);
    matchups.push(
      ...projectedMatchups(match, feed.a, feed.b, picks, teams, "Grand Final"),
    );
  }

  return { submissionCount: picks.length, matchups };
}
