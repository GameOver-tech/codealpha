-- ============================================================
-- HireLens AI — Database Schema Migration
-- Fixes infinite-recursion RLS policies (42P17)
-- by replacing inline profile-role checks with a
-- SECURITY DEFINER is_admin() helper function.
-- Safe to run repeatedly (idempotent).
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

-- 1. Profiles
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

-- 2. Jobs
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

-- 3. Candidates
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

-- 4. Interviews
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
drop policy if exists "Candidates can read own evaluations" on public.evaluations;
drop policy if exists "Admins can read all evaluations" on public.evaluations;
drop policy if exists "Service role can insert evaluations" on public.evaluations;

create policy "Candidates can read own evaluations"
  on public.evaluations for select
  using (
    exists (
      select 1 from public.interviews
      where interviews.id = evaluations.interview_id
        and evaluations.interview_id = interviews.id
        and interviews.candidate_id = auth.uid()
    )
  );

create policy "Admins can read all evaluations"
  on public.evaluations for select
  using (public.is_admin());

create policy "Service role can insert evaluations"
  on public.evaluations for insert
  with check (true);
