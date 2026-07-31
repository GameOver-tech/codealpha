-- ============================================================
-- HireLens AI — Supabase Compatibility Layer
-- Run this in the Supabase SQL Editor ONCE.
-- ============================================================
--
-- The application schema (users, interviews, transcripts, scores, etc.)
-- is managed by Alembic migrations against the DATABASE_URL. This script
-- only provisions the pieces Supabase Auth integration needs:
--
--   1. pgcrypto extension (gen_random_uuid)
--   2. the legacy `profiles` table used by seed_admin.py to flag admins
--   3. the is_admin() helper the backend consults on first login
--   4. role grants so the service_role key can manage the app tables
--
-- Idempotent: safe to run repeatedly.
-- ============================================================

-- 0. Extensions
create extension if not exists "pgcrypto";

-- 0.5 Security definer helper: check if the current user is an admin.
-- SECURITY DEFINER + STABLE lets RLS policies call this without
-- infinite recursion (the function runs as the table owner).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 0.6 Privileges for the standard Supabase roles.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert on all tables in schema public to anon;
grant usage on all sequences in schema public to anon, authenticated;

-- 1. Profiles (one row per authenticated user; role marks admins)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'candidate')),
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Service role can insert profiles" on public.profiles;

create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "Service role can insert profiles"
  on public.profiles for insert
  with check (true);
