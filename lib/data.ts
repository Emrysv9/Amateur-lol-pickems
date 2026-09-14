import {
  computeCommunityPickRates,
  type CommunityPickInput,
  type CommunityPickRates,
} from "@/lib/community-picks";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { countCorrectPicks, scorePick } from "@/lib/scoring";
import type { League, Match, PickRow, StandingRow, Team } from "@/lib/types";
import { ACTIVE_LEAGUE_SELECT } from "@/lib/types";

async function supabaseOrNull() {
  try {
    return await createClient();
  } catch {
    return null;
  }
}

export async function getActiveLeague(): Promise<League | null> {
  const supabase = await supabaseOrNull();
  if (!supabase) return null;
  const { data: active } = await supabase
    .from("leagues")
    .select(ACTIVE_LEAGUE_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (active) return active;
  const { data: anyLeague } = await supabase
    .from("leagues")
    .select(ACTIVE_LEAGUE_SELECT)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return anyLeague;
}

export async function getLeagueById(id: string): Promise<League | null> {
  const supabase = await supabaseOrNull();
  if (!supabase) return null;
  const { data } = await supabase
    .from("leagues")
    .select(ACTIVE_LEAGUE_SELECT)
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function getLeagues(): Promise<League[]> {
  const supabase = await supabaseOrNull();
  if (!supabase) return [];
  const { data } = await supabase
    .from("leagues")
    .select(ACTIVE_LEAGUE_SELECT)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getLeagueTeams(leagueId: string): Promise<Team[]> {
  const supabase = await supabaseOrNull();
  if (!supabase) return [];
  const { data } = await supabase
    .from("teams")
    .select("id, league_id, name, seed, logo_url")
    .eq("league_id", leagueId)
    .order("seed", { ascending: true });
  return data ?? [];
}

export async function getLeagueMatches(leagueId: string): Promise<Match[]> {
  const supabase = await supabaseOrNull();
  if (!supabase) return [];
  const { data } = await supabase
    .from("matches")
    .select(
      "id, league_id, round, slot, team_a_id, team_b_id, winner_id, next_match_id, next_slot",
    )
    .eq("league_id", leagueId)
    .order("slot", { ascending: true });
  return (data ?? []) as Match[];
}

export async function getUserPick(
  leagueId: string,
  userId: string,
): Promise<PickRow | null> {
  const supabase = await supabaseOrNull();
  if (!supabase) return null;
  const { data } = await supabase
    .from("picks")
    .select("id, league_id, user_id, champion_team_id, selections, submitted_at")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;
  return {
    ...data,
    selections: (data.selections ?? {}) as Record<string, string>,
  };
}

export async function getCommunityPickRates(
  leagueId: string,
  matches: Match[],
  teams: Team[],
): Promise<CommunityPickRates> {
  const picks = await getLeaguePickSelections(leagueId);
  return computeCommunityPickRates(matches, teams, picks);
}

async function getLeaguePickSelections(
  leagueId: string,
): Promise<CommunityPickInput[]> {
  const supabase = await supabaseOrNull();
  if (supabase) {
    const { data, error } = await supabase.rpc("list_pick_selections", {
      p_league_id: leagueId,
    });
    if (!error && data) {
      return (data as { selections: unknown; champion_team_id?: string | null }[]).map(
        (row) => ({
          selections: (row.selections ?? {}) as Record<string, string>,
          championTeamId: row.champion_team_id ?? null,
        }),
      );
    }
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("picks")
      .select("selections, champion_team_id")
      .eq("league_id", leagueId);
    return (data ?? []).map((row) => ({
      selections: (row.selections ?? {}) as Record<string, string>,
      championTeamId: row.champion_team_id ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getLeaderboard(league: League): Promise<StandingRow[]> {
  const matches = await getLeagueMatches(league.id);
  const picks = await getLeaguePicksWithProfiles(league.id);

  const scored = picks.map((pick) => ({
    league_id: league.id,
    user_id: pick.user_id,
    score: scorePick(pick, matches, league),
    username: pick.username,
    avatar_url: pick.avatar_url,
    correctPicks: countCorrectPicks(pick, matches),
    submittedAt: pick.submitted_at,
  }));

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.correctPicks - a.correctPicks ||
      a.submittedAt.localeCompare(b.submittedAt) ||
      a.username.localeCompare(b.username),
  );

  return scored.map((row, index) => ({
    league_id: row.league_id,
    user_id: row.user_id,
    score: row.score,
    rank: index + 1,
    username: row.username,
    avatar_url: row.avatar_url,
    correctPicks: row.correctPicks,
  }));
}

export async function getLockedUserPick(
  leagueId: string,
  userId: string,
): Promise<(PickRow & { username: string; avatar_url: string | null }) | null> {
  const picks = await getLeaguePicksWithProfiles(leagueId);
  return picks.find((pick) => pick.user_id === userId) ?? null;
}

type PickWithProfile = PickRow & {
  username: string;
  avatar_url: string | null;
};

async function getLeaguePicksWithProfiles(leagueId: string): Promise<PickWithProfile[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("picks")
      .select(
        "id, league_id, user_id, champion_team_id, selections, submitted_at, users (username, avatar_url)",
      )
      .eq("league_id", leagueId);

    type Row = Omit<PickRow, "selections"> & {
      selections: unknown;
      users:
        | { username: string; avatar_url: string | null }
        | { username: string; avatar_url: string | null }[]
        | null;
    };

    return ((data ?? []) as Row[]).map((row) => {
      const profile = Array.isArray(row.users) ? row.users[0] : row.users;
      return {
        id: row.id,
        league_id: row.league_id,
        user_id: row.user_id,
        champion_team_id: row.champion_team_id,
        selections: (row.selections ?? {}) as Record<string, string>,
        submitted_at: row.submitted_at,
        username: profile?.username ?? "Summoner",
        avatar_url: profile?.avatar_url ?? null,
      };
    });
  } catch {
    return [];
  }
}
