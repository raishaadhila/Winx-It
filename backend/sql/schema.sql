-- ============================================================================
-- Winx It! — Schema for Supabase Postgres
-- Run this in Supabase Dashboard → SQL Editor → New query
-- ============================================================================

-- 1) Enable pgcrypto for gen_random_uuid() (usually already on, but safe to call)
create extension if not exists pgcrypto;

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    name text not null default 'Fairy',
    fairy text not null default 'tecna'
        check (fairy in ('bloom', 'stella', 'flora', 'musa', 'tecna', 'layla')),
    pillar text not null default 'tecna'
        check (pillar in ('tecna', 'flora', 'musa', 'bloom', 'stella')),
    accent text not null default 'blue'
        check (accent in ('pink', 'blue', 'lime', 'purple', 'yellow')),
    avatar_seed text,
    level integer not null default 1,
    total_xp integer not null default 0,
    current_streak integer not null default 0,
    longest_streak integer not null default 0,
    last_completed_date date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.pillar_xp (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    tecna integer not null default 0,
    flora integer not null default 0,
    musa integer not null default 0,
    bloom integer not null default 0,
    stella integer not null default 0
);

create table if not exists public.plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    title text not null,
    goal_text text not null,
    timeframe text not null,
    start_date date not null,
    end_date date not null,
    status text not null default 'active'
        check (status in ('active', 'paused', 'completed', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists plans_user_id_idx on public.plans(user_id);
create index if not exists plans_status_idx on public.plans(user_id, status);

create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    plan_id uuid not null references public.plans(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    day integer not null,
    week integer not null,
    month integer not null,
    date date not null,
    description text not null,
    pillar text not null
        check (pillar in ('tecna', 'flora', 'musa', 'bloom', 'stella')),
    hours numeric(4,2) not null default 1.0,
    energy text not null default 'medium'
        check (energy in ('low', 'medium', 'high')),
    done boolean not null default false,
    completed_at timestamptz,
    position integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists tasks_plan_id_idx on public.tasks(plan_id);
create index if not exists tasks_user_id_date_idx on public.tasks(user_id, date);
create index if not exists tasks_user_id_done_idx on public.tasks(user_id, done);

create table if not exists public.xp_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    source text not null,
    amount integer not null,
    pillar text
        check (pillar is null or pillar in ('tecna', 'flora', 'musa', 'bloom', 'stella')),
    ref_id uuid,
    created_at timestamptz not null default now()
);

create index if not exists xp_events_user_id_idx on public.xp_events(user_id, created_at desc);

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.pillar_xp enable row level security;
alter table public.plans enable row level security;
alter table public.tasks enable row level security;
alter table public.xp_events enable row level security;

drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles
    for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "pillar_xp self" on public.pillar_xp;
create policy "pillar_xp self" on public.pillar_xp
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "plans self" on public.plans;
create policy "plans self" on public.plans
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasks self" on public.tasks;
create policy "tasks self" on public.tasks
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "xp_events self" on public.xp_events;
create policy "xp_events self" on public.xp_events
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS (updated_at maintenance)
-- ============================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
    for each row execute function public.touch_updated_at();

drop trigger if exists plans_touch on public.plans;
create trigger plans_touch before update on public.plans
    for each row execute function public.touch_updated_at();

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
    for each row execute function public.touch_updated_at();

-- ============================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
--
-- This block may fail on Supabase if you don't own the `auth.users` table
-- (which is the default). If the CREATE TRIGGER at the bottom errors with
-- "permission denied for table users", use the FALLBACK below instead.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, name)
    values (new.id, new.email, split_part(new.email, '@', 1))
    on conflict (id) do nothing;

    insert into public.pillar_xp (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    return new;
end;
$$;

-- Grant the auth admin role permission to call the function and write to the tables
grant usage on schema public to supabase_auth_admin;
grant all on table public.profiles to supabase_auth_admin;
grant all on table public.pillar_xp to supabase_auth_admin;

grant execute on function public.handle_new_user() to supabase_auth_admin;

-- Trigger on auth.users (drop first in case of re-runs)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ============================================================================
-- FALLBACK (only run this section if the CREATE TRIGGER above failed):
--
-- If you got: "ERROR: permission denied for table users" or
-- "ERROR: must be owner of table users", Supabase won't let you attach a
-- trigger to auth.users directly. Use one of these alternatives:
--
-- OPTION A — Create profile manually in your FastAPI signup handler:
--   Replace Supabase Auth's signUp flow with a custom flow that:
--     1. Calls supabase.auth.signUp() to create the auth user
--     2. Then calls a POST /api/me/bootstrap endpoint that inserts the
--        profile + pillar_xp rows using the service_role key.
--   Remove the trigger above (or just leave it — it will silently no-op).
--
-- OPTION B — Use a Supabase Database Webhook (Dashboard → Database → Webhooks):
--   Create a webhook on the auth.users table that calls an edge function,
--   which inserts the profile + pillar_xp rows. No DB permissions needed.
--
-- Either way, the rest of the schema is fine. Profiles just won't be created
-- automatically — the FastAPI layer can backfill them.
-- ============================================================================
