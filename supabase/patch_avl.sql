-- If you already ran complete.sql with ACL placeholders, run this in the SQL Editor
-- to switch that league to AVL without recreating tables.

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
