export const ACTIVE_LEAGUE_SELECT =
  "id, slug, name, description, is_active, lock_at, submissions_locked, points_quarterfinal, points_semifinal, points_final, points_champion";

export type Round = "quarterfinal" | "semifinal" | "final";

export type League = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  lock_at: string | null;
  submissions_locked: boolean;
  points_quarterfinal: number;
  points_semifinal: number;
  points_final: number;
  points_champion: number;
};

export type Team = {
  id: string;
  league_id: string;
  name: string;
  seed: number | null;
  logo_url: string | null;
};

export type Match = {
  id: string;
  league_id: string;
  round: Round;
  slot: number;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_id: string | null;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
};

export type Profile = {
  id: string;
  discord_id: string;
  username: string;
  avatar_url: string | null;
};

export type PickRow = {
  id: string;
  league_id: string;
  user_id: string;
  champion_team_id: string | null;
  selections: Record<string, string>;
  submitted_at: string;
};

export type StandingRow = {
  league_id: string;
  user_id: string;
  score: number;
  rank: number;
  username: string;
  avatar_url: string | null;
  correctPicks: number;
};

export function isLeagueLocked(league: League, now = new Date()): boolean {
  if (league.submissions_locked) return true;
  if (league.lock_at && new Date(league.lock_at) <= now) return true;
  return false;
}

export function pointsForRound(league: League, round: Round): number {
  if (round === "quarterfinal") return league.points_quarterfinal;
  if (round === "semifinal") return league.points_semifinal;
  return league.points_final;
}
