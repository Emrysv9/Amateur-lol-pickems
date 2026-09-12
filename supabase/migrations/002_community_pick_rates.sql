-- Aggregated pick data for community percentages.
-- Returns selections only (no user ids) so the homepage can show pick rates
-- without opening individual brackets.

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
