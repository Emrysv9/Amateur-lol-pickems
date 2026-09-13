import type { ReactNode } from "react";
import { LoginButton } from "@/components/login-button";
import type { League, PickRow, Profile } from "@/lib/types";

export function TournamentHero({
  league,
  locked,
  submissionCount,
  profile,
  pick,
}: {
  league: League;
  locked: boolean;
  submissionCount: number;
  profile: Profile | null;
  pick: PickRow | null;
}) {
  const status = userStatus({ profile, pick, locked });

  return (
    <section className="relative overflow-hidden rounded-xl border border-primary/25 bg-surface">
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-primary shadow-[0_0_18px_var(--primary)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-72 bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--primary)_22%,transparent),transparent)]"
      />

      <div className="relative px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                Playoffs
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  locked
                    ? "bg-error/15 text-error"
                    : "bg-success/15 text-success"
                }`}
              >
                {locked ? <LockIcon /> : <LiveIcon />}
                {locked ? "Locked" : "Open"}
              </span>
            </div>
            <h1 className="font-display mt-1 text-3xl font-semibold uppercase leading-none tracking-wide sm:text-4xl">
              {league.name}
            </h1>
            {league.description ? (
              <p className="mt-2 max-w-2xl text-sm leading-snug text-muted">
                {league.description}
              </p>
            ) : null}
          </div>
          <p className="hidden shrink-0 text-right text-[10px] uppercase tracking-wider text-muted/70 sm:block">
            Scoring
            <span className="mt-0.5 block font-mono normal-case tracking-normal text-muted">
              {league.points_quarterfinal}/{league.points_semifinal}/
              {league.points_final}/{league.points_champion}
            </span>
          </p>
        </div>

        <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/70 pt-3 text-sm">
          <MetaItem
            icon={<UsersIcon />}
            label={`${submissionCount} ${submissionCount === 1 ? "bracket" : "brackets"}`}
          />
          <MetaItem icon={<ClockIcon />} label={deadlineLabel(league, locked)} />
          <li className="inline-flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${status.className}`}
            >
              {status.icon}
              {status.label}
            </span>
          </li>
        </ul>

        <p className="mt-2 font-mono text-[10px] text-muted/70 sm:hidden">
          Scoring {league.points_quarterfinal}/{league.points_semifinal}/
          {league.points_final}/{league.points_champion}
        </p>

        {!profile ? (
          <div className="mt-3 w-fit">
            <LoginButton label="Sign in with Discord to pick" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function userStatus({
  profile,
  pick,
  locked,
}: {
  profile: Profile | null;
  pick: PickRow | null;
  locked: boolean;
}) {
  if (!profile) {
    return {
      label: "Sign in to submit",
      icon: <UserIcon />,
      className: "bg-surface-raised text-muted",
    };
  }
  if (pick) {
    return {
      label: locked ? "Your bracket is in" : "Submitted · can edit",
      icon: <CheckIcon />,
      className: "bg-success/15 text-success",
    };
  }
  if (locked) {
    return {
      label: "No bracket submitted",
      icon: <LockIcon />,
      className: "bg-error/15 text-error",
    };
  }
  return {
    label: "Not submitted",
    icon: <AlertIcon />,
    className: "bg-primary/15 text-primary",
  };
}

function deadlineLabel(league: League, locked: boolean) {
  if (locked) return "Submissions closed";
  if (!league.lock_at) return "Open until locked";
  return `Locks ${formatEastern(league.lock_at)}`;
}

function formatEastern(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function MetaItem({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <li className="inline-flex items-center gap-1.5 text-muted">
      <span className="text-primary">{icon}</span>
      <span className="text-foreground">{label}</span>
    </li>
  );
}

function iconClass() {
  return "h-3.5 w-3.5 shrink-0";
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass()} fill="none" aria-hidden>
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass()} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass()} fill="none" aria-hidden>
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass()} fill="none" aria-hidden>
      <rect
        x="4"
        y="11"
        width="16"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LiveIcon() {
  return (
    <span className="relative flex h-1.5 w-1.5" aria-hidden>
      <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
    </span>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass()} fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 20a7 7 0 0 1 14 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass()} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 8v5M12 16h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
