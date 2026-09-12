import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getCurrentProfile(): Promise<Profile | null> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return null;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("id, discord_id, username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

export function isAdmin(profile: Profile | null): boolean {
  if (!profile) return false;
  const raw = process.env.ADMIN_DISCORD_IDS ?? "";
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.includes(profile.discord_id);
}

export function discordIdentityFromUser(user: {
  id: string;
  user_metadata?: Record<string, unknown>;
  identities?: Array<{ provider: string; id: string; identity_data?: Record<string, unknown> }>;
}): { discordId: string; username: string; avatarUrl: string | null } {
  const meta = user.user_metadata ?? {};
  const discord = user.identities?.find((i) => i.provider === "discord");
  const claims = (meta.custom_claims as Record<string, string> | undefined) ?? {};
  const discordId =
    discord?.id ||
    (meta.provider_id as string | undefined) ||
    (meta.sub as string | undefined) ||
    user.id;
  const username =
    claims.global_name ||
    (meta.full_name as string | undefined) ||
    (meta.name as string | undefined) ||
    (meta.preferred_username as string | undefined) ||
    "Summoner";
  const avatarUrl =
    (meta.avatar_url as string | undefined) ||
    (meta.picture as string | undefined) ||
    (discord?.identity_data?.avatar_url as string | undefined) ||
    null;
  return { discordId, username, avatarUrl };
}
