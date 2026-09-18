-- Soberish · Supabase schema
--
-- Run once in the Supabase SQL editor. Everything is protected by row level
-- security: a drinker can only touch their own rows, and the leaderboard is
-- readable by anyone signed in.
--
-- Two layers have to line up, and they are easy to confuse. Table GRANTs are
-- the coarse gate: without them Postgres refuses the query outright with
-- "permission denied for table …", before any policy is consulted. RLS
-- policies are the fine gate, deciding which rows that role may then see or
-- write. Both are spelled out below rather than left to Supabase's default
-- privileges, which do not always reach objects created from the SQL editor.

-- ---------------------------------------------------------------------------
-- drinks — the synced copy of each user's log
-- ---------------------------------------------------------------------------
create table if not exists public.drinks (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  consumed_at timestamptz not null,
  volume_ml   numeric(8, 2) not null check (volume_ml > 0),
  abv         numeric(5, 2) not null check (abv >= 0 and abv <= 96),
  -- Minutes spent drinking it; 0 is one swallow.
  duration_minutes numeric(6, 2) not null default 0 check (duration_minutes >= 0),
  label       text not null default 'Drink',
  icon        text not null default '🍺',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Soft delete, so a deletion made offline still replicates.
  deleted     boolean not null default false
);

-- `create table if not exists` above is a no-op on a project that already has
-- the table, so a column added later needs saying twice.
alter table public.drinks
  add column if not exists duration_minutes numeric(6, 2) not null default 0
  check (duration_minutes >= 0);

create index if not exists drinks_user_updated_idx on public.drinks (user_id, updated_at);

alter table public.drinks enable row level security;

drop policy if exists "drinks are private" on public.drinks;
create policy "drinks are private" on public.drinks
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.drinks to authenticated;

-- ---------------------------------------------------------------------------
-- bac_status — one row per drinker who is currently above 0.00%
-- ---------------------------------------------------------------------------
create table if not exists public.bac_status (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Anonymous',
  bac          numeric(5, 3) not null default 0 check (bac >= 0),
  peak_bac     numeric(5, 3) not null default 0 check (peak_bac >= 0),
  -- Standard drinks on the Finnish scale — 12 g of ethanol each (THL).
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

grant select, insert, update, delete on table public.bac_status to authenticated;

-- Live leaderboard updates (the app also polls, so this is an optimisation).
--
-- This is the one statement here with no `if not exists` spelling: run a second
-- time it fails with "relation is already member of publication", and because
-- the SQL editor submits the whole file as a single transaction, that failure
-- rolls back everything above it too. So the guard is not tidiness — without it
-- the file is a one-shot, and re-running it to pick up a new column silently
-- leaves the database exactly as it was.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'bac_status'
    )
  then
    alter publication supabase_realtime add table public.bac_status;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

-- Upgrading from a version without drink durations? The alter above adds the
-- column and backfills every existing row with 0 — "drunk in one go", which is
-- how the app read them anyway. Running this whole file again is safe, or apply
-- just that one statement.

-- Hit "relation bac_status is already member of publication supabase_realtime"
-- on an older copy of this file? That was the publication line below, which had
-- no guard; the error aborted the transaction, so nothing that run was meant to
-- add actually landed. This version is safe to re-run — do that, then check the
-- column arrived:
--   select column_name from information_schema.columns
--   where table_name = 'drinks' and column_name = 'duration_minutes';

-- Already ran an earlier version of this file and hit "permission denied for
-- table bac_status"? The tables and policies are fine — only the grants above
-- were missing. Running this whole file again is safe and fixes it, or apply
-- just these two lines:
--   grant select, insert, update, delete on table public.drinks to authenticated;
--   grant select, insert, update, delete on table public.bac_status to authenticated;

-- Optional: schedule with pg_cron to drop replicated tombstones and stale rows.
--   select cron.schedule('soberish-cleanup', '0 5 * * *', $$
--     delete from public.drinks where deleted and updated_at < now() - interval '30 days';
--     delete from public.bac_status where sober_at < now() - interval '2 days';
--   $$);
