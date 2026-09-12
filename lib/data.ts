import {
  computeCommunityPickRates,
  type CommunityPickRates,
} from "@/lib/community-picks";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
): Promise<{ selections: Record<string, string> }[]> {
  const supabase = await supabaseOrNull();
  if (supabase) {
    const { data, error } = await supabase.rpc("list_pick_selections", {
      p_league_id: leagueId,
    });
    if (!error && data) {
      return (data as { selections: unknown }[]).map((row) => ({
        selections: (row.selections ?? {}) as Record<string, string>,
      }));
    }
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("picks")
      .select("selections")
      .eq("league_id", leagueId);
    return (data ?? []).map((row) => ({
      selections: (row.selections ?? {}) as Record<string, string>,
    }));
  } catch {
    return [];
  }
}

export async function getLeaderboard(leagueId: string): Promise<StandingRow[]> {
  const supabase = await supabaseOrNull();
  if (!supabase) return [];
  const { data } = await supabase
    .from("standings")
    .select("league_id, user_id, score, rank, users (username, avatar_url)")
    .eq("league_id", leagueId)
    .order("rank", { ascending: true });

  type Row = {
    league_id: string;
    user_id: string;
    score: number;
    rank: number;
    users: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
  };

  return ((data ?? []) as Row[]).map((row) => {
    const profile = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      league_id: row.league_id,
      user_id: row.user_id,
      score: row.score,
      rank: row.rank,
      username: profile?.username ?? "Summoner",
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}
