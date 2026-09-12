-- =============================================================================
-- LoL Amateur Pick'Ems — paste this entire file into the Supabase SQL Editor
-- Includes: tables, RLS, Discord user sync, community pick-rate RPC, AVL seed
-- Safe to re-run.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

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
  logo_url text,
  created_at timestamptz not null default now()
);

alter table public.teams add column if not exists logo_url text;

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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.leagues enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.picks enable row level security;
alter table public.standings enable row level security;

drop policy if exists "Users are publicly readable" on public.users;
create policy "Users are publicly readable"
  on public.users for select
  using (true);

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.users;
create policy "Users can insert their own profile"
  on public.users for insert
  with check (auth.uid() = id);

drop policy if exists "Leagues are publicly readable" on public.leagues;
create policy "Leagues are publicly readable"
  on public.leagues for select
  using (true);

drop policy if exists "Teams are publicly readable" on public.teams;
create policy "Teams are publicly readable"
  on public.teams for select
  using (true);

drop policy if exists "Matches are publicly readable" on public.matches;
create policy "Matches are publicly readable"
  on public.matches for select
  using (true);

drop policy if exists "Standings are publicly readable" on public.standings;
create policy "Standings are publicly readable"
  on public.standings for select
  using (true);

drop policy if exists "Users can read their own picks" on public.picks;
create policy "Users can read their own picks"
  on public.picks for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own picks" on public.picks;
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

drop policy if exists "Users can update their own picks while unlocked" on public.picks;
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

-- ---------------------------------------------------------------------------
-- Discord profile sync (runs when a user signs in via Supabase Auth)
-- ---------------------------------------------------------------------------

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
    new.raw_user_meta_data->>'preferred_username',
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
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row execute function public.handle_new_user();

-- Community pick rates: selections only, no user ids
create or replace function public.list_pick_selections(p_league_id uuid)
returns table (selections jsonb)
language sql
security definer
set search_path = public
as $$
  select p.selections
  from public.picks p
  where p.league_id = p_league_id;
$$;

revoke all on function public.list_pick_selections(uuid) from public;
grant execute on function public.list_pick_selections(uuid) to anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant select on table public.users, public.leagues, public.teams, public.matches, public.picks, public.standings
  to anon, authenticated;
grant insert, update on table public.users to authenticated;
grant insert, update on table public.picks to authenticated;
grant all on table public.users, public.leagues, public.teams, public.matches, public.picks, public.standings
  to service_role;

insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read team logos" on storage.objects;
create policy "Public read team logos"
  on storage.objects for select
  using (bucket_id = 'team-logos');

-- ---------------------------------------------------------------------------
-- Seed: AVL playoffs, 8 teams, 1v8 / 2v7 / 3v6 / 4v5
-- ---------------------------------------------------------------------------

insert into public.leagues (
  id, slug, name, description, is_active, lock_at, submissions_locked,
  points_quarterfinal, points_semifinal, points_final, points_champion
) values (
  '11111111-1111-4111-8111-111111111111',
  'avl-playoffs',
  'Aegis Vanguard League (AVL)',
  'Amateur League of Legends League. 1100 LP cap.',
  true,
  timestamptz '2026-09-12 19:59:00-04',
  false,
  1, 2, 4, 8
)
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description,
      is_active = excluded.is_active,
      slug = excluded.slug,
      lock_at = excluded.lock_at;

insert into public.teams (id, league_id, name, seed) values
  ('21111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Death Cards', 1),
  ('21111111-1111-4111-8111-111111111112', '11111111-1111-4111-8111-111111111111', 'Conduit The Last Dance', 2),
  ('21111111-1111-4111-8111-111111111113', '11111111-1111-4111-8111-111111111111', 'Roo''s Boos', 3),
  ('21111111-1111-4111-8111-111111111114', '11111111-1111-4111-8111-111111111111', 'Final Boss Lobsta''s Redemption', 4),
  ('21111111-1111-4111-8111-111111111115', '11111111-1111-4111-8111-111111111111', 'Dorado Gaming Alpha', 5),
  ('21111111-1111-4111-8111-111111111116', '11111111-1111-4111-8111-111111111111', 'No Hair No Care', 6),
  ('21111111-1111-4111-8111-111111111117', '11111111-1111-4111-8111-111111111111', 'Akuma TD6', 7),
  ('21111111-1111-4111-8111-111111111118', '11111111-1111-4111-8111-111111111111', 'Gang7 Mirage', 8)
on conflict (id) do update set name = excluded.name, seed = excluded.seed;

insert into public.matches (
  id, league_id, round, slot, team_a_id, team_b_id, winner_id, next_match_id, next_slot
) values
  ('31111111-1111-4111-8111-111111111107', '11111111-1111-4111-8111-111111111111', 'final', 1, null, null, null, null, null),
  ('31111111-1111-4111-8111-111111111105', '11111111-1111-4111-8111-111111111111', 'semifinal', 1, null, null, null, '31111111-1111-4111-8111-111111111107', 'a'),
  ('31111111-1111-4111-8111-111111111106', '11111111-1111-4111-8111-111111111111', 'semifinal', 2, null, null, null, '31111111-1111-4111-8111-111111111107', 'b'),
  -- QF 1: 1v8 -> SF1 A; QF 2: 2v7 -> SF2 A; QF 3: 3v6 -> SF2 B; QF 4: 4v5 -> SF1 B
  ('31111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111111', 'quarterfinal', 1,
    '21111111-1111-4111-8111-111111111111', '21111111-1111-4111-8111-111111111118', null,
    '31111111-1111-4111-8111-111111111105', 'a'),
  ('31111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111111', 'quarterfinal', 2,
    '21111111-1111-4111-8111-111111111112', '21111111-1111-4111-8111-111111111117', null,
    '31111111-1111-4111-8111-111111111106', 'a'),
  ('31111111-1111-4111-8111-111111111103', '11111111-1111-4111-8111-111111111111', 'quarterfinal', 3,
    '21111111-1111-4111-8111-111111111113', '21111111-1111-4111-8111-111111111116', null,
    '31111111-1111-4111-8111-111111111106', 'b'),
  ('31111111-1111-4111-8111-111111111104', '11111111-1111-4111-8111-111111111111', 'quarterfinal', 4,
    '21111111-1111-4111-8111-111111111114', '21111111-1111-4111-8111-111111111115', null,
    '31111111-1111-4111-8111-111111111105', 'b')
on conflict (id) do update
  set team_a_id = excluded.team_a_id,
      team_b_id = excluded.team_b_id,
      next_match_id = excluded.next_match_id,
      next_slot = excluded.next_slot;


