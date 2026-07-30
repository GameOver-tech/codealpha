-- 001_schema.sql — HireLens AI Database Schema

-- Profiles for role-based access
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'candidate')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Candidates (auto-created on first Google sign-in)
CREATE TABLE candidates (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Jobs
CREATE TABLE jobs (
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
CREATE TABLE interviews (
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
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  raw_transcript TEXT,
  refined_transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Evaluations
CREATE TABLE evaluations (
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

-- Insert sample jobs
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
 ARRAY['Technical screening (ML fundamentals)', 'Take-home analysis project', 'Presentation of findings to the team']);
