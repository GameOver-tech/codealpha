-- 002_rls.sql — Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- Profiles: users read own, admins read all
CREATE POLICY "profiles_own" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_admin" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Candidates: users read own, admins read all
CREATE POLICY "candidates_own" ON candidates
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "candidates_admin" ON candidates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Jobs: public read, admin write
CREATE POLICY "jobs_read" ON jobs
  FOR SELECT USING (true);
CREATE POLICY "jobs_admin" ON jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Interviews: candidates read own, admins read all
CREATE POLICY "interviews_own" ON interviews
  FOR ALL USING (candidate_id = auth.uid());
CREATE POLICY "interviews_admin" ON interviews
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Transcripts: candidates read own, admins read all
CREATE POLICY "transcripts_own" ON transcripts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM interviews WHERE id = interview_id AND candidate_id = auth.uid())
  );
CREATE POLICY "transcripts_admin" ON transcripts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Evaluations: candidates read own, admins read all
CREATE POLICY "evaluations_own" ON evaluations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM interviews WHERE id = interview_id AND candidate_id = auth.uid())
  );
CREATE POLICY "evaluations_admin" ON evaluations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage bucket for interview files
INSERT INTO storage.buckets (id, name, public) VALUES ('interview-files', 'interview-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "interview_files_own" ON storage.objects
  FOR ALL USING (
    bucket_id = 'interview-files' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "interview_files_admin" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'interview-files' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
