-- Team logos: column + public storage bucket for admin uploads.

alter table public.teams
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read team logos" on storage.objects;
create policy "Public read team logos"
  on storage.objects for select
  using (bucket_id = 'team-logos');
