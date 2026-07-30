export interface User {
  id: string;
  email: string;
  role: 'admin' | 'candidate';
  full_name?: string;
  photo_url?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location?: string;
  employment_type?: string;
  description?: string;
  requirements?: string[];
  expectations?: string[];
  is_active: boolean;
}

export interface InterviewStatus {
  id: string;
  status: 'uploaded' | 'transcribing' | 'analyzing' | 'completed';
  progress_pct: number;
}

export interface Evaluation {
  technical_score: number | null;
  communication_score: number | null;
  confidence_score: number | null;
  problem_solving_score: number | null;
  experience_score: number | null;
  overall_score: number | null;
  recommendation: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  ai_summary: string | null;
  evidence: Record<string, { quote: string; timestamp: string }[]> | null;
}

export interface CandidateListItem {
  id: string;
  full_name: string;
  email: string;
  photo_url?: string;
  job_title?: string;
  overall_score?: number;
  recommendation?: string;
  status?: string;
  interview_date?: string;
}

export interface CandidateDetail {
  candidate: CandidateListItem;
  job: Job | null;
  interview_status: string | null;
  interview_date: string | null;
  audio_url: string | null;
  transcript: { raw_transcript?: string; refined_transcript?: string } | null;
  evaluation: Evaluation | null;
}
