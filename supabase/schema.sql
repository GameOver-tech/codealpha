-- ============================================================
-- HireLens AI — Database Schema + Row Level Security Policies
-- Run this in the Supabase SQL Editor
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
-- When tables are created via the SQL Editor Supabase usually grants these
-- automatically, but this is explicit and idempotent (re-running is safe).
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert on all tables in schema public to anon;
grant usage on all sequences in schema public to anon, authenticated;

-- 1. Profiles (one row per authenticated user)
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

-- 2. Jobs (open positions created by admin)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  created_by uuid references public.profiles(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.jobs enable row level security;

drop policy if exists "Anyone can read active jobs" on public.jobs;
drop policy if exists "Admins can read all jobs" on public.jobs;
drop policy if exists "Admins can insert jobs" on public.jobs;
drop policy if exists "Admins can update jobs" on public.jobs;

create policy "Anyone can read active jobs"
  on public.jobs for select
  using (is_active = true);

create policy "Admins can read all jobs"
  on public.jobs for select
  using (public.is_admin());

create policy "Admins can insert jobs"
  on public.jobs for insert
  with check (public.is_admin());

create policy "Admins can update jobs"
  on public.jobs for update
  using (public.is_admin());

-- 3. Candidates (extends profile with job context)
create table if not exists public.candidates (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  job_id uuid references public.jobs(id),
  created_at timestamptz default now()
);

alter table public.candidates enable row level security;

drop policy if exists "Candidates can read own row" on public.candidates;
drop policy if exists "Candidates can insert own row" on public.candidates;
drop policy if exists "Candidates can update own row" on public.candidates;
drop policy if exists "Admins can read all candidates" on public.candidates;

create policy "Candidates can read own row"
  on public.candidates for select
  using (id = auth.uid());

create policy "Candidates can insert own row"
  on public.candidates for insert
  with check (id = auth.uid());

create policy "Candidates can update own row"
  on public.candidates for update
  using (id = auth.uid());

create policy "Admins can read all candidates"
  on public.candidates for select
  using (public.is_admin());

-- 4. Interviews (one per submitted recording)
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) not null,
  job_id uuid references public.jobs(id) not null,
  recording_url text,
  status text check (status in ('uploaded','transcribing','analyzing','completed','failed')) default 'uploaded',
  error_message text,
  created_at timestamptz default now()
);

alter table public.interviews enable row level security;

drop policy if exists "Candidates can read own interviews" on public.interviews;
drop policy if exists "Candidates can insert own interviews" on public.interviews;
drop policy if exists "Candidates can update own interviews" on public.interviews;
drop policy if exists "Admins can read all interviews" on public.interviews;
drop policy if exists "Admins can update any interview" on public.interviews;

create policy "Candidates can read own interviews"
  on public.interviews for select
  using (candidate_id = auth.uid());

create policy "Candidates can insert own interviews"
  on public.interviews for insert
  with check (candidate_id = auth.uid());

create policy "Candidates can update own interviews"
  on public.interviews for update
  using (candidate_id = auth.uid());

create policy "Admins can read all interviews"
  on public.interviews for select
  using (public.is_admin());

create policy "Admins can update any interview"
  on public.interviews for update
  using (public.is_admin());

-- 5. Transcripts
create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid references public.interviews(id) on delete cascade not null,
  transcript_text text,
  created_at timestamptz default now()
);

alter table public.transcripts enable row level security;

drop policy if exists "Candidates can read own transcripts" on public.transcripts;
drop policy if exists "Admins can read all transcripts" on public.transcripts;
drop policy if exists "Service role can insert transcripts" on public.transcripts;

create policy "Candidates can read own transcripts"
  on public.transcripts for select
  using (
    exists (
      select 1 from public.interviews
      where interviews.id = transcripts.interview_id
        and interviews.candidate_id = auth.uid()
    )
  );

create policy "Admins can read all transcripts"
  on public.transcripts for select
  using (public.is_admin());

create policy "Service role can insert transcripts"
  on public.transcripts for insert
  with check (true);

-- 6. Evaluations
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid references public.interviews(id) on delete cascade not null,
  overall_score int check (overall_score between 0 and 100),
  recommendation text check (recommendation in ('Recommended','Not Recommended','Needs Further Review')),
  technical_score int,
  communication_score int,
  confidence_score int,
  problem_solving_score int,
  experience_score int,
  strengths jsonb,
  weaknesses jsonb,
  summary text,
  created_at timestamptz default now()
);

alter table public.evaluations enable row level security;

drop policy if exists "Candidates can read own evaluations" on public.evaluations;
drop policy if exists "Admins can read all evaluations" on public.evaluations;
drop policy if exists "Service role can insert evaluations" on public.evaluations;

create policy "Candidates can read own evaluations"
  on public.evaluations for select
  using (
    exists (
      select 1 from public.interviews
      where interviews.id = evaluations.interview_id
        and interviews.candidate_id = auth.uid()
    )
  );

create policy "Admins can read all evaluations"
  on public.evaluations for select
  using (public.is_admin());

create policy "Service role can insert evaluations"
  on public.evaluations for insert
  with check (true);
