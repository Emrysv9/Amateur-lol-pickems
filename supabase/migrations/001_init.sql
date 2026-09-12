-- LoL Amateur Pick'Ems
-- Schema is league-scoped so additional leagues can be added later
-- without changing table structure.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text not null unique,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  lock_at timestamptz,
  submissions_locked boolean not null default false,
  points_quarterfinal integer not null default 1,
  points_semifinal integer not null default 2,
  points_final integer not null default 4,
  points_champion integer not null default 8,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null,
  seed integer,
  created_at timestamptz not null default now()
);

create index if not exists teams_league_id_idx on public.teams (league_id);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  round text not null check (round in ('quarterfinal', 'semifinal', 'final')),
  slot integer not null,
  team_a_id uuid references public.teams (id) on delete set null,
  team_b_id uuid references public.teams (id) on delete set null,
  winner_id uuid references public.teams (id) on delete set null,
  next_match_id uuid references public.matches (id) on delete set null,
  next_slot text check (next_slot in ('a', 'b')),
  unique (league_id, round, slot)
);

create index if not exists matches_league_id_idx on public.matches (league_id);

create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  champion_team_id uuid references public.teams (id) on delete set null,
  selections jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  unique (user_id, league_id)
);

create index if not exists picks_league_id_idx on public.picks (league_id);

create table if not exists public.standings (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  score integer not null default 0,
  rank integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

alter table public.users enable row level security;
alter table public.leagues enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.picks enable row level security;
alter table public.standings enable row level security;

create policy "Users are publicly readable"
  on public.users for select
  using (true);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.users for insert
  with check (auth.uid() = id);

create policy "Leagues are publicly readable"
  on public.leagues for select
  using (true);

create policy "Teams are publicly readable"
  on public.teams for select
  using (true);

create policy "Matches are publicly readable"
  on public.matches for select
  using (true);

create policy "Standings are publicly readable"
  on public.standings for select
  using (true);

create policy "Users can read their own picks"
  on public.picks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own picks"
  on public.picks for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.leagues l
      where l.id = league_id
        and l.submissions_locked = false
        and (l.lock_at is null or l.lock_at > now())
    )
  );

create policy "Users can update their own picks while unlocked"
  on public.picks for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.leagues l
      where l.id = league_id
        and l.submissions_locked = false
        and (l.lock_at is null or l.lock_at > now())
    )
  )
  with check (auth.uid() = user_id);

-- Keep public.users in sync when a Discord user signs in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  discord text;
  uname text;
  avatar text;
begin
  discord := coalesce(
    new.raw_user_meta_data->>'provider_id',
    new.raw_user_meta_data->>'sub',
    new.id::text
  );
  uname := coalesce(
    new.raw_user_meta_data->'custom_claims'->>'global_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    'Summoner'
  );
  avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  insert into public.users (id, discord_id, username, avatar_url)
  values (new.id, discord, uname, avatar)
  on conflict (id) do update
    set discord_id = excluded.discord_id,
        username = excluded.username,
        avatar_url = excluded.avatar_url;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

grant usage on schema public to anon, authenticated, service_role;
grant select on table public.users, public.leagues, public.teams, public.matches, public.picks, public.standings to anon, authenticated;
grant insert, update on table public.users to authenticated;
grant insert, update on table public.picks to authenticated;
grant all on table public.users, public.leagues, public.teams, public.matches, public.picks, public.standings to service_role;
grant select on table public.users, public.leagues, public.teams, public.matches, public.picks, public.standings to anon, authenticated;
grant insert, update on table public.users to authenticated;
grant insert, update on table public.picks to authenticated;
grant all on table public.users, public.leagues, public.teams, public.matches, public.picks, public.standings to service_role;
