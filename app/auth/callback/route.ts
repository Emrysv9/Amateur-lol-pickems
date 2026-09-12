import { NextResponse } from "next/server";
import { discordIdentityFromUser } from "@/lib/auth";
import { safeInternalPath } from "@/lib/safe-redirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const identity = discordIdentityFromUser(user);
    try {
      const admin = createAdminClient();
      await admin.from("users").upsert({
        id: user.id,
        discord_id: identity.discordId,
        username: identity.username,
        avatar_url: identity.avatarUrl,
      });
    } catch {
      const { error: profileError } = await supabase.from("users").upsert({
        id: user.id,
        discord_id: identity.discordId,
        username: identity.username,
        avatar_url: identity.avatarUrl,
      });
      if (profileError) {
        return NextResponse.redirect(`${origin}/login?error=profile`);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
