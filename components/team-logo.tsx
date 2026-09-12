import type { Team } from "@/lib/types";

const SIZES = {
  sm: 24,
  md: 32,
  lg: 40,
} as const;

export function TeamLogo({
  team,
  size = "md",
}: {
  team?: Pick<Team, "name" | "logo_url"> | null;
  size?: keyof typeof SIZES;
}) {
  const px = SIZES[size];
  const src = team?.logo_url || "/team-placeholder.svg";
  const label = team?.name ? `${team.name} logo` : "Team logo placeholder";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      width={px}
      height={px}
      className="shrink-0 object-contain bg-transparent"
      style={{ width: px, height: px }}
    />
  );
}
