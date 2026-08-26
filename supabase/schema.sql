-- Soberish · Supabase schema
--
-- Run once in the Supabase SQL editor. Everything is protected by row level
-- security: a drinker can only touch their own rows, and the leaderboard is
-- readable by anyone signed in.

-- ---------------------------------------------------------------------------
-- drinks — the synced copy of each user's log
-- ---------------------------------------------------------------------------
create table if not exists public.drinks (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  consumed_at timestamptz not null,
  volume_ml   numeric(8, 2) not null check (volume_ml > 0),
  abv         numeric(5, 2) not null check (abv >= 0 and abv <= 96),
  label       text not null default 'Drink',
  icon        text not null default '🍺',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Soft delete, so a deletion made offline still replicates.
  deleted     boolean not null default false
);

create index if not exists drinks_user_updated_idx on public.drinks (user_id, updated_at);

alter table public.drinks enable row level security;

drop policy if exists "drinks are private" on public.drinks;
create policy "drinks are private" on public.drinks
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- bac_status — one row per drinker who is currently above 0.00%
-- ---------------------------------------------------------------------------
create table if not exists public.bac_status (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Anonymous',
  bac          numeric(5, 3) not null default 0 check (bac >= 0),
  peak_bac     numeric(5, 3) not null default 0 check (peak_bac >= 0),
  drinks       numeric(6, 1) not null default 0 check (drinks >= 0),
  -- The moment `bac` was true; clients extrapolate forward from here.
  measured_at  timestamptz not null default now(),
  -- When the publisher projects hitting 0.00%. Rows past this are ignored.
  sober_at     timestamptz
);

create index if not exists bac_status_sober_at_idx on public.bac_status (sober_at desc);

alter table public.bac_status enable row level security;

drop policy if exists "leaderboard is readable by signed-in users" on public.bac_status;
create policy "leaderboard is readable by signed-in users" on public.bac_status
  for select
  to authenticated
  using (true);

drop policy if exists "publish only your own status" on public.bac_status;
create policy "publish only your own status" on public.bac_status
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Live leaderboard updates (the app also polls, so this is an optimisation).
alter publication supabase_realtime add table public.bac_status;

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

-- Optional: schedule with pg_cron to drop replicated tombstones and stale rows.
--   select cron.schedule('soberish-cleanup', '0 5 * * *', $$
--     delete from public.drinks where deleted and updated_at < now() - interval '30 days';
--     delete from public.bac_status where sober_at < now() - interval '2 days';
--   $$);
