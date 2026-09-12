# LoL Amateur Pick'Ems

Single-league MVP for **Aegis Vanguard League (AVL)** playoffs. Discord login, one 8-team bracket per account, leaderboard, and an admin page to edit the league, teams, pairings, and results.

The data model is already league-scoped (`league_id` on teams, matches, picks, and standings) so more leagues can be added later without a rewrite.

## Stack

- Next.js 15 App Router + TypeScript
- Tailwind CSS
- Supabase (Postgres, Auth, RLS)
- Discord OAuth via Supabase Auth
- Vercel-ready

## Folder structure

```
app/
  page.tsx                 Active league Pick'Em
  leaderboard/page.tsx
  admin/page.tsx
  login/page.tsx
  auth/callback/route.ts
  auth/signout/route.ts
components/
lib/
  actions/                 save picks, admin results
  supabase/                browser, server, admin, middleware clients
  types.ts
  data.ts
  auth.ts
  scoring.ts
supabase/
  complete.sql            PASTE THIS into Supabase SQL Editor
  migrations/             split versions of the same schema
  seed.sql
middleware.ts
```

## 1. Install

```bash
npm install
cp .env.example .env.local
```

## 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and paste the entire contents of `supabase/complete.sql`. Run it once.
   If the project already has tables, run `supabase/migrations/003_team_logos.sql` so team logos work.
3. Copy **Project URL**, **anon key**, and **service role key** from **Project Settings → API** into `.env.local`.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_DISCORD_IDS=
```

`ADMIN_DISCORD_IDS` is a comma-separated list of Discord snowflake IDs (Discord User Settings → Advanced → Developer Mode → right-click your avatar → Copy User ID).

## 3. Discord OAuth (Supabase Auth)

### Discord Developer Portal

1. Open [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**.
2. **OAuth2 → General**
   - Copy **Client ID** and **Client Secret**.
   - **Redirects** — add exactly:

     `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`

     Example: `https://abcdefghijk.supabase.co/auth/v1/callback`

   Discord talks to **Supabase**, not to localhost. Do not put `localhost:3000/auth/callback` in the Discord portal.

3. Scopes used by the app: `identify` (username + avatar). No email or guilds.

### Supabase Auth

1. **Authentication → Providers → Discord** → Enable.
2. Paste Discord **Client ID** and **Client Secret**. Save.
3. **Authentication → URL Configuration**
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs** (one per line):

     ```
     http://localhost:3000/auth/callback
     https://<your-app>.vercel.app/auth/callback
     ```

These app URLs are where Supabase sends the user **after** Discord. Add every origin you actually use.

### Local env

```
NEXT_PUBLIC_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_DISCORD_IDS=123456789012345678
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code. Vercel: set the same keys and set `NEXT_PUBLIC_SITE_URL` to the production URL.

### Login flow in this repo

1. `LoginButton` calls `supabase.auth.signInWithOAuth({ provider: "discord" })`.
2. Discord → `https://<ref>.supabase.co/auth/v1/callback`.
3. Supabase → `http://localhost:3000/auth/callback?code=...`.
4. `app/auth/callback/route.ts` exchanges the code for a session and upserts `public.users`.

## 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 5. Deploy on Vercel

1. Import the Git repo into Vercel.
2. Set the same env vars (use the production site URL for `NEXT_PUBLIC_SITE_URL`).
3. Add the production callback URLs in Discord and Supabase.

## Scoring (defaults)

| Pick | Points |
| --- | --- |
| Quarterfinal | 1 |
| Semifinal | 2 |
| Final | 4 |
| Champion | 8 |

Admins can change these on `/admin`. One submission per Discord user per league (unique on `picks(user_id, league_id)`).

## Out of scope (this MVP)

- Multiple leagues in the UI
- Riot API
- Fantasy, stats, and team pages
