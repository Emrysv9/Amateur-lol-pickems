"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { getActiveLeague, getLeagueMatches, getUserPick } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { isLeagueLocked } from "@/lib/types";

export async function saveBracketPick(input: {
  selections: Record<string, string>;
  championTeamId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sign in with Discord to submit a bracket." };

  const league = await getActiveLeague();
  if (!league) return { ok: false, error: "No active league is configured yet." };
  if (isLeagueLocked(league)) {
    return { ok: false, error: "Predictions are locked." };
  }

  const matches = await getLeagueMatches(league.id);
  const qf = matches.filter((m) => m.round === "quarterfinal");
  for (const match of qf) {
    if (!input.selections[match.id]) {
      return { ok: false, error: "Pick a winner for every quarterfinal." };
    }
  }
  const sf = matches.filter((m) => m.round === "semifinal");
  for (const match of sf) {
    if (!input.selections[match.id]) {
      return { ok: false, error: "Pick a winner for every semifinal." };
    }
  }
  const final = matches.find((m) => m.round === "final");
  if (!final || !input.selections[final.id] || !input.championTeamId) {
    return { ok: false, error: "Pick a finals winner and champion." };
  }

  const supabase = await createClient();
  const existing = await getUserPick(league.id, profile.id);
  const payload = {
    league_id: league.id,
    user_id: profile.id,
    champion_team_id: input.championTeamId,
    selections: input.selections,
    submitted_at: existing?.submitted_at ?? new Date().toISOString(),
  };

  const { error } = await supabase.from("picks").upsert(payload, {
    onConflict: "user_id,league_id",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/leaderboard");
  return { ok: true };
}
