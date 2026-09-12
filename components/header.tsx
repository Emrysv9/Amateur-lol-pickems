import Link from "next/link";
import type { Profile } from "@/lib/types";
import { LoginButton } from "@/components/login-button";

export function Header({
  profile,
  isAdmin,
  leagueName,
}: {
  profile: Profile | null;
  isAdmin: boolean;
  leagueName?: string | null;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-10 xl:px-12">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
            <span className="font-display text-lg font-semibold tracking-wide uppercase">
              LoL Amateur Pick&apos;Ems
            </span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-muted sm:flex">
            <Link href="/" className="hover:text-primary">
              {leagueName ?? "Bracket"}
            </Link>
            <Link href="/leaderboard" className="hover:text-primary">
              Leaderboard
            </Link>
            {isAdmin ? (
              <Link href="/admin" className="hover:text-primary">
                Admin
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {profile ? (
            <>
              <div className="flex items-center gap-2">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full border border-primary/40 object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs">
                    {profile.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
                  {profile.username}
                </span>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-xs text-muted hover:text-foreground"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <LoginButton />
          )}
        </div>
      </div>
      <nav className="mx-auto flex w-full gap-4 px-4 pb-3 text-sm text-muted sm:hidden">
        <Link href="/" className="hover:text-primary">
          Bracket
        </Link>
        <Link href="/leaderboard" className="hover:text-primary">
          Leaderboard
        </Link>
        {isAdmin ? (
          <Link href="/admin" className="hover:text-primary">
            Admin
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
