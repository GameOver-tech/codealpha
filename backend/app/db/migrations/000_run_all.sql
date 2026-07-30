-- ============================================================
-- HireLens AI — Run All Migrations
-- Execute this entire file in the Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- 001: Schema (tables)
-- 002: RLS policies

-- ============================================================
-- 001_schema.sql — Tables
-- ============================================================

-- Profiles for role-based access
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'candidate')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Candidates (auto-created on first Google sign-in)
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  employment_type TEXT,
  description TEXT,
  requirements TEXT[],
  expectations TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Interviews
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'transcribing', 'analyzing', 'completed')),
  video_url TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Transcripts
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  raw_transcript TEXT,
  refined_transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Evaluations
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  technical_score NUMERIC(5,2),
  communication_score NUMERIC(5,2),
  confidence_score NUMERIC(5,2),
  problem_solving_score NUMERIC(5,2),
  experience_score NUMERIC(5,2),
  overall_score NUMERIC(5,2),
  recommendation TEXT CHECK (recommendation IN ('Recommended', 'Not Recommended', 'Need Further Review')),
  strengths TEXT[],
  weaknesses TEXT[],
  ai_summary TEXT,
  evidence JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed jobs
INSERT INTO jobs (title, company, location, employment_type, description, requirements, expectations) VALUES
('Senior Software Engineer', 'TechCorp Inc.', 'San Francisco, CA', 'Full-time',
 'We are looking for a senior software engineer to join our core platform team. You will design, build, and maintain scalable distributed systems that power our SaaS platform.',
 ARRAY['5+ years of software engineering experience', 'Strong proficiency in Python and TypeScript', 'Experience with cloud platforms (AWS/GCP)', 'Understanding of distributed systems design'],
 ARRAY['Complete a take-home coding project', 'Participate in a 45-minute technical interview', 'System design discussion']),
('Frontend Developer', 'DesignHub', 'Remote', 'Contract',
 'Join our design systems team to build beautiful, accessible, and performant user interfaces for our creative tools platform.',
 ARRAY['3+ years of frontend experience', 'Expert-level React and TypeScript', 'Experience with Tailwind CSS', 'Understanding of web accessibility'],
 ARRAY['Live coding session (React component)', 'Portfolio review', 'Team fit interview']),
('Data Scientist', 'AnalyticsPro', 'New York, NY', 'Full-time',
 'Help us uncover insights from massive datasets. You will work closely with product teams to design experiments, build ML models, and drive data-informed decisions.',
 ARRAY['MS/PhD in a quantitative field', 'Strong Python and SQL skills', 'Experience with ML frameworks (PyTorch/TensorFlow)', 'Experience with data visualization'],
 ARRAY['Technical screening (ML fundamentals)', 'Take-home analysis project', 'Presentation of findings to the team'])
ON CONFLICT DO NOTHING;

-- ============================================================
-- 002_rls.sql — Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "profiles_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin" ON profiles;
CREATE POLICY "profiles_admin" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Candidates
DROP POLICY IF EXISTS "candidates_own" ON candidates;
CREATE POLICY "candidates_own" ON candidates
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "candidates_admin" ON candidates;
CREATE POLICY "candidates_admin" ON candidates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Jobs
DROP POLICY IF EXISTS "jobs_read" ON jobs;
CREATE POLICY "jobs_read" ON jobs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "jobs_admin" ON jobs;
CREATE POLICY "jobs_admin" ON jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Interviews
DROP POLICY IF EXISTS "interviews_own" ON interviews;
CREATE POLICY "interviews_own" ON interviews
  FOR ALL USING (candidate_id = auth.uid());

DROP POLICY IF EXISTS "interviews_admin" ON interviews;
CREATE POLICY "interviews_admin" ON interviews
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Transcripts
DROP POLICY IF EXISTS "transcripts_own" ON transcripts;
CREATE POLICY "transcripts_own" ON transcripts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM interviews WHERE id = interview_id AND candidate_id = auth.uid())
  );

DROP POLICY IF EXISTS "transcripts_admin" ON transcripts;
CREATE POLICY "transcripts_admin" ON transcripts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Evaluations
DROP POLICY IF EXISTS "evaluations_own" ON evaluations;
CREATE POLICY "evaluations_own" ON evaluations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM interviews WHERE id = interview_id AND candidate_id = auth.uid())
  );

DROP POLICY IF EXISTS "evaluations_admin" ON evaluations;
CREATE POLICY "evaluations_admin" ON evaluations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('interview-files', 'interview-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "interview_files_own" ON storage.objects;
CREATE POLICY "interview_files_own" ON storage.objects
  FOR ALL USING (
    bucket_id = 'interview-files' AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "interview_files_admin" ON storage.objects;
CREATE POLICY "interview_files_admin" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'interview-files' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
