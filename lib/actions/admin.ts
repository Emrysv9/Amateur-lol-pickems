"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import {
  getActiveLeague,
  getLeagueById,
  getLeagueMatches,
  getLeagueTeams,
} from "@/lib/data";
import { easternLocalToIso, slugify } from "@/lib/eastern-time";
import { scorePick } from "@/lib/scoring";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Match, PickRow, Team } from "@/lib/types";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!isAdmin(profile)) {
    return { ok: false as const, error: "Admin access required." };
  }
  return { ok: true as const, profile };
}

function revalidateLeague() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/leaderboard");
}

function applyWinnerPropagation(
  matches: Match[],
  matchId: string,
  winnerId: string | null,
): Match[] {
  const byId = new Map(matches.map((m) => [m.id, { ...m }]));
  const current = byId.get(matchId);
  if (!current) return matches;

  const previousWinner = current.winner_id;
  current.winner_id = winnerId;

  const walk = (from: Match, oldTeam: string | null, newTeam: string | null) => {
    if (!from.next_match_id || !from.next_slot) return;
    const next = byId.get(from.next_match_id);
    if (!next) return;
    const slotKey = from.next_slot === "a" ? "team_a_id" : "team_b_id";
    const previous = next[slotKey];
    next[slotKey] = newTeam;
    if (next.winner_id && next.winner_id === oldTeam && oldTeam !== newTeam) {
      const cleared = next.winner_id;
      next.winner_id = null;
      walk(next, cleared, null);
    } else if (previous && previous !== newTeam && next.winner_id === previous) {
      const cleared = next.winner_id;
      next.winner_id = null;
      walk(next, cleared, null);
    }
  };

  walk(current, previousWinner, winnerId);
  return Array.from(byId.values());
}

async function clearLaterRounds(admin: ReturnType<typeof createAdminClient>, leagueId: string) {
  const matches = await getLeagueMatches(leagueId);
  for (const match of matches.filter((m) => m.round !== "quarterfinal")) {
    await admin
      .from("matches")
      .update({ team_a_id: null, team_b_id: null, winner_id: null })
      .eq("id", match.id);
  }
  for (const match of matches.filter((m) => m.round === "quarterfinal")) {
    await admin.from("matches").update({ winner_id: null }).eq("id", match.id);
  }
}

export async function setMatchWinner(matchId: string, winnerId: string | null) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const league = await getActiveLeague();
  if (!league) return { ok: false as const, error: "League not found." };

  const matches = await getLeagueMatches(league.id);
  const match = matches.find((m) => m.id === matchId);
  if (!match) return { ok: false as const, error: "Match not found." };
  if (
    winnerId &&
    winnerId !== match.team_a_id &&
    winnerId !== match.team_b_id
  ) {
    return { ok: false as const, error: "Winner must be one of the two teams." };
  }

  const updated = applyWinnerPropagation(matches, matchId, winnerId);
  const admin = createAdminClient();

  for (const row of updated) {
    const { error } = await admin
      .from("matches")
      .update({
        team_a_id: row.team_a_id,
        team_b_id: row.team_b_id,
        winner_id: row.winner_id,
      })
      .eq("id", row.id);
    if (error) return { ok: false as const, error: error.message };
  }

  await recalculateStandings(league.id);
  revalidateLeague();
  return { ok: true as const };
}

export async function setSubmissionsLocked(locked: boolean) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const league = await getActiveLeague();
  if (!league) return { ok: false as const, error: "League not found." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("leagues")
    .update({ submissions_locked: locked })
    .eq("id", league.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function updateScoring(values: {
  points_quarterfinal: number;
  points_semifinal: number;
  points_final: number;
  points_champion: number;
}) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const league = await getActiveLeague();
  if (!league) return { ok: false as const, error: "League not found." };

  const admin = createAdminClient();
  const { error } = await admin.from("leagues").update(values).eq("id", league.id);
  if (error) return { ok: false as const, error: error.message };

  await recalculateStandings(league.id);
  revalidateLeague();
  return { ok: true as const };
}

export async function updateLeagueDetails(input: {
  name: string;
  description: string;
  lockAtLocal: string;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const league = await getActiveLeague();
  if (!league) return { ok: false, error: "League not found." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "League name is required." };
  const lock_at = input.lockAtLocal ? easternLocalToIso(input.lockAtLocal) : null;
  if (input.lockAtLocal && !lock_at) {
    return { ok: false, error: "Lock time must be YYYY-MM-DDTHH:MM Eastern." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("leagues")
    .update({
      name,
      description: input.description.trim() || null,
      lock_at,
    })
    .eq("id", league.id);
  if (error) return { ok: false, error: error.message };

  revalidateLeague();
  return { ok: true };
}

export async function updateTeams(
  rows: Array<{ id: string; name: string; seed: number }>,
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const league = await getActiveLeague();
  if (!league) return { ok: false, error: "League not found." };

  if (rows.length !== 8) return { ok: false, error: "An 8-team bracket needs 8 teams." };
  const seeds = new Set(rows.map((row) => row.seed));
  if (seeds.size !== 8 || [...seeds].some((seed) => seed < 1 || seed > 8)) {
    return { ok: false, error: "Seeds must be unique numbers 1 through 8." };
  }
  if (rows.some((row) => !row.name.trim())) {
    return { ok: false, error: "Every team needs a name." };
  }

  const admin = createAdminClient();
  for (const row of rows) {
    const { error } = await admin
      .from("teams")
      .update({ name: row.name.trim(), seed: row.seed })
      .eq("id", row.id)
      .eq("league_id", league.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidateLeague();
  return { ok: true };
}

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

async function removeStoredLogos(
  admin: ReturnType<typeof createAdminClient>,
  leagueId: string,
  teamId: string,
) {
  const { data: files } = await admin.storage.from("team-logos").list(leagueId);
  const stale = (files ?? [])
    .filter((file) => file.name.startsWith(teamId))
    .map((file) => `${leagueId}/${file.name}`);
  if (stale.length > 0) {
    await admin.storage.from("team-logos").remove(stale);
  }
}

export async function uploadTeamLogo(formData: FormData): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const league = await getActiveLeague();
  if (!league) return { ok: false, error: "League not found." };

  const teamId = String(formData.get("teamId") ?? "");
  const file = formData.get("file");
  if (!teamId || !(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a logo file." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "Logo must be 2MB or smaller." };
  }
  const ext = LOGO_TYPES[file.type];
  if (!ext) {
    return { ok: false, error: "Use PNG, JPG, SVG, or WebP." };
  }

  const belongs = (await getLeagueTeams(league.id)).some((team) => team.id === teamId);
  if (!belongs) return { ok: false, error: "Team not found in this league." };

  const admin = createAdminClient();
  await removeStoredLogos(admin, league.id, teamId);
  const path = `${league.id}/${teamId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from("team-logos").upload(path, buffer, {
    contentType: file.type,
    upsert: true,
    cacheControl: "3600",
  });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { data } = admin.storage.from("team-logos").getPublicUrl(path);
  const { error } = await admin
    .from("teams")
    .update({ logo_url: `${data.publicUrl}?v=${Date.now()}` })
    .eq("id", teamId)
    .eq("league_id", league.id);
  if (error) return { ok: false, error: error.message };

  revalidateLeague();
  return { ok: true };
}

export async function removeTeamLogo(teamId: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const league = await getActiveLeague();
  if (!league) return { ok: false, error: "League not found." };

  const admin = createAdminClient();
  await removeStoredLogos(admin, league.id, teamId);
  const { error } = await admin
    .from("teams")
    .update({ logo_url: null })
    .eq("id", teamId)
    .eq("league_id", league.id);
  if (error) return { ok: false, error: error.message };

  revalidateLeague();
  return { ok: true };
}

export async function applySeededQuarterfinals(): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const league = await getActiveLeague();
  if (!league) return { ok: false, error: "League not found." };

  const [teams, matches] = await Promise.all([
    getLeagueTeams(league.id),
    getLeagueMatches(league.id),
  ]);
  const bySeed = new Map(teams.map((team) => [team.seed, team]));
  const need = [1, 2, 3, 4, 5, 6, 7, 8];
  if (need.some((seed) => !bySeed.get(seed))) {
    return { ok: false, error: "Set seeds 1–8 on all teams first." };
  }

  const qf = matches
    .filter((m) => m.round === "quarterfinal")
    .sort((a, b) => a.slot - b.slot);
  const sf = matches.filter((m) => m.round === "semifinal");
  const sf1 = sf.find((m) => m.slot === 1);
  const sf2 = sf.find((m) => m.slot === 2);
  if (qf.length !== 4 || !sf1 || !sf2) {
    return { ok: false, error: "Bracket tree is incomplete." };
  }

  const pairings: Array<{
    match: Match;
    a: Team;
    b: Team;
    next: Match;
    slot: "a" | "b";
  }> = [
    { match: qf[0], a: bySeed.get(1)!, b: bySeed.get(8)!, next: sf1, slot: "a" },
    { match: qf[1], a: bySeed.get(2)!, b: bySeed.get(7)!, next: sf2, slot: "a" },
    { match: qf[2], a: bySeed.get(3)!, b: bySeed.get(6)!, next: sf2, slot: "b" },
    { match: qf[3], a: bySeed.get(4)!, b: bySeed.get(5)!, next: sf1, slot: "b" },
  ];

  const admin = createAdminClient();
  for (const pairing of pairings) {
    const { error } = await admin
      .from("matches")
      .update({
        team_a_id: pairing.a.id,
        team_b_id: pairing.b.id,
        winner_id: null,
        next_match_id: pairing.next.id,
        next_slot: pairing.slot,
      })
      .eq("id", pairing.match.id);
    if (error) return { ok: false, error: error.message };
  }
  await clearLaterRounds(admin, league.id);

  revalidateLeague();
  return { ok: true };
}

export async function updateQuarterfinals(
  pairings: Array<{ matchId: string; teamAId: string; teamBId: string }>,
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const league = await getActiveLeague();
  if (!league) return { ok: false, error: "League not found." };

  const used = new Set<string>();
  for (const pairing of pairings) {
    if (!pairing.teamAId || !pairing.teamBId) {
      return { ok: false, error: "Each quarterfinal needs two teams." };
    }
    if (pairing.teamAId === pairing.teamBId) {
      return { ok: false, error: "A team cannot play itself." };
    }
    if (used.has(pairing.teamAId) || used.has(pairing.teamBId)) {
      return { ok: false, error: "Each team can only appear in one quarterfinal." };
    }
    used.add(pairing.teamAId);
    used.add(pairing.teamBId);
  }

  const admin = createAdminClient();
  for (const pairing of pairings) {
    const { error } = await admin
      .from("matches")
      .update({
        team_a_id: pairing.teamAId,
        team_b_id: pairing.teamBId,
        winner_id: null,
      })
      .eq("id", pairing.matchId)
      .eq("league_id", league.id);
    if (error) return { ok: false, error: error.message };
  }
  await clearLaterRounds(admin, league.id);

  revalidateLeague();
  return { ok: true };
}

export async function setActiveLeague(leagueId: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const { error: offError } = await admin.from("leagues").update({ is_active: false }).neq("id", leagueId);
  if (offError) return { ok: false, error: offError.message };
  const { error } = await admin.from("leagues").update({ is_active: true }).eq("id", leagueId);
  if (error) return { ok: false, error: error.message };
  revalidateLeague();
  return { ok: true };
}

export async function createEightTeamLeague(input: {
  name: string;
  description: string;
  lockAtLocal: string;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const name = input.name.trim();
  if (!name) return { ok: false, error: "League name is required." };
  const lock_at = input.lockAtLocal ? easternLocalToIso(input.lockAtLocal) : null;

  const admin = createAdminClient();
  await admin.from("leagues").update({ is_active: false }).eq("is_active", true);

  const { data: league, error: leagueError } = await admin
    .from("leagues")
    .insert({
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      name,
      description: input.description.trim() || null,
      is_active: true,
      lock_at,
      submissions_locked: false,
    })
    .select("id")
    .single();
  if (leagueError || !league) {
    return { ok: false, error: leagueError?.message ?? "Could not create league." };
  }

  const teamRows = Array.from({ length: 8 }, (_, index) => ({
    league_id: league.id,
    name: `Team ${index + 1}`,
    seed: index + 1,
  }));
  const { data: teams, error: teamError } = await admin
    .from("teams")
    .insert(teamRows)
    .select("id, seed");
  if (teamError || !teams) return { ok: false, error: teamError?.message ?? "Could not create teams." };

  const { data: final, error: finalError } = await admin
    .from("matches")
    .insert({ league_id: league.id, round: "final", slot: 1 })
    .select("id")
    .single();
  if (finalError || !final) return { ok: false, error: finalError?.message ?? "Could not create final." };

  const { data: semis, error: sfError } = await admin
    .from("matches")
    .insert([
      {
        league_id: league.id,
        round: "semifinal",
        slot: 1,
        next_match_id: final.id,
        next_slot: "a",
      },
      {
        league_id: league.id,
        round: "semifinal",
        slot: 2,
        next_match_id: final.id,
        next_slot: "b",
      },
    ])
    .select("id, slot");
  if (sfError || !semis) return { ok: false, error: sfError?.message ?? "Could not create semifinals." };

  const sf1 = semis.find((row) => row.slot === 1)!;
  const sf2 = semis.find((row) => row.slot === 2)!;
  const bySeed = new Map(teams.map((team) => [team.seed, team.id]));

  const { error: qfError } = await admin.from("matches").insert([
    {
      league_id: league.id,
      round: "quarterfinal",
      slot: 1,
      team_a_id: bySeed.get(1),
      team_b_id: bySeed.get(8),
      next_match_id: sf1.id,
      next_slot: "a",
    },
    {
      league_id: league.id,
      round: "quarterfinal",
      slot: 2,
      team_a_id: bySeed.get(2),
      team_b_id: bySeed.get(7),
      next_match_id: sf2.id,
      next_slot: "a",
    },
    {
      league_id: league.id,
      round: "quarterfinal",
      slot: 3,
      team_a_id: bySeed.get(3),
      team_b_id: bySeed.get(6),
      next_match_id: sf2.id,
      next_slot: "b",
    },
    {
      league_id: league.id,
      round: "quarterfinal",
      slot: 4,
      team_a_id: bySeed.get(4),
      team_b_id: bySeed.get(5),
      next_match_id: sf1.id,
      next_slot: "b",
    },
  ]);
  if (qfError) return { ok: false, error: qfError.message };

  revalidateLeague();
  return { ok: true };
}

export async function resetLeague(input: {
  confirm: string;
  resetTeamNames: boolean;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  if (input.confirm.trim().toUpperCase() !== "RESET") {
    return { ok: false, error: "Type RESET to confirm." };
  }

  const league = await getActiveLeague();
  if (!league) return { ok: false, error: "League not found." };

  const admin = createAdminClient();

  const { error: picksError } = await admin.from("picks").delete().eq("league_id", league.id);
  if (picksError) return { ok: false, error: picksError.message };

  const { error: standingsError } = await admin
    .from("standings")
    .delete()
    .eq("league_id", league.id);
  if (standingsError) return { ok: false, error: standingsError.message };

  const { error: lockError } = await admin
    .from("leagues")
    .update({ submissions_locked: false })
    .eq("id", league.id);
  if (lockError) return { ok: false, error: lockError.message };

  if (input.resetTeamNames) {
    const teams = await getLeagueTeams(league.id);
    const ordered = teams
      .slice()
      .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
    for (let i = 0; i < ordered.length; i += 1) {
      const { error } = await admin
        .from("teams")
        .update({ name: `Team ${i + 1}`, seed: i + 1 })
        .eq("id", ordered[i].id);
      if (error) return { ok: false, error: error.message };
    }

    const refreshed = await getLeagueTeams(league.id);
    const matches = await getLeagueMatches(league.id);
    const bySeed = new Map(refreshed.map((team) => [team.seed, team]));
    const qf = matches
      .filter((m) => m.round === "quarterfinal")
      .sort((a, b) => a.slot - b.slot);
    const sf = matches.filter((m) => m.round === "semifinal");
    const sf1 = sf.find((m) => m.slot === 1);
    const sf2 = sf.find((m) => m.slot === 2);

    if (qf.length === 4 && sf1 && sf2 && [1, 2, 3, 4, 5, 6, 7, 8].every((s) => bySeed.get(s))) {
      const pairings = [
        { match: qf[0], a: bySeed.get(1)!, b: bySeed.get(8)!, next: sf1, slot: "a" as const },
        { match: qf[1], a: bySeed.get(2)!, b: bySeed.get(7)!, next: sf2, slot: "a" as const },
        { match: qf[2], a: bySeed.get(3)!, b: bySeed.get(6)!, next: sf2, slot: "b" as const },
        { match: qf[3], a: bySeed.get(4)!, b: bySeed.get(5)!, next: sf1, slot: "b" as const },
      ];
      for (const pairing of pairings) {
        const { error } = await admin
          .from("matches")
          .update({
            team_a_id: pairing.a.id,
            team_b_id: pairing.b.id,
            winner_id: null,
            next_match_id: pairing.next.id,
            next_slot: pairing.slot,
          })
          .eq("id", pairing.match.id);
        if (error) return { ok: false, error: error.message };
      }
    }
  }

  await clearLaterRounds(admin, league.id);

  revalidateLeague();
  return { ok: true };
}

export async function recalculateStandings(leagueId?: string) {
  const league = leagueId
    ? await getLeagueById(leagueId)
    : await getActiveLeague();
  if (!league) return { ok: false as const, error: "League not found." };

  const matches = await getLeagueMatches(league.id);
  const admin = createAdminClient();
  const { data: picks, error } = await admin
    .from("picks")
    .select("id, league_id, user_id, champion_team_id, selections, submitted_at")
    .eq("league_id", league.id);
  if (error) return { ok: false as const, error: error.message };

  const scored = ((picks ?? []) as Array<Omit<PickRow, "selections"> & { selections: Record<string, string> }>).map(
    (pick) => ({
      user_id: pick.user_id,
      score: scorePick(
        {
          ...pick,
          selections: pick.selections ?? {},
        },
        matches,
        league,
      ),
    }),
  );

  scored.sort((a, b) => b.score - a.score);
  const rows = scored.map((row, index) => ({
    league_id: league.id,
    user_id: row.user_id,
    score: row.score,
    rank: index + 1,
    updated_at: new Date().toISOString(),
  }));

  await admin.from("standings").delete().eq("league_id", league.id);
  if (rows.length > 0) {
    const { error: insertError } = await admin.from("standings").insert(rows);
    if (insertError) return { ok: false as const, error: insertError.message };
  }

  return { ok: true as const };
}
