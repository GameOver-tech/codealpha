export type Role = 'candidate' | 'admin'

export interface User {
  id: string
  email: string
  role: Role
  first_name: string
  last_name: string
  full_name: string
  phone: string
  gender: string
}

export interface TokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
}

export interface MessageResponse {
  message: string
}

export interface RegisterRequest {
  first_name: string
  last_name: string
  email: string
  password: string
  phone?: string
  gender?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export interface UserUpdate {
  first_name?: string
  last_name?: string
  phone?: string
  gender?: string
}

export interface Job {
  id: string
  title: string
  description: string
  is_active: boolean
  created_at: string | null
}

export type InterviewStatusValue =
  | 'uploaded'
  | 'processing'
  | 'transcript_ready'
  | 'ai_evaluation'
  | 'pdf_generated'
  | 'completed'
  | 'failed'

export interface InterviewStatus {
  id: string
  title: string
  status: InterviewStatusValue
  admin_status: string
  job_title: string
  created_at: string | null
  updated_at: string | null
  duration_seconds: number
  error_message: string
  failure_reason: string
  failure_stage: string
  processing_finished_at: string | null
  recommendation: string | null
  has_speech: boolean
}

export type RecommendationVerdict = 'Recommended' | 'Not Recommended' | 'Need Further Review'

export interface Recommendation {
  id: string
  interview_id: string
  verdict: RecommendationVerdict
  reason: string
  message: string
}

export interface Scores {
  id: string
  interview_id: string
  technical_skills: number
  communication: number
  confidence: number
  problem_solving: number
  relevant_experience: number
  leadership: number
  teamwork: number
  critical_thinking: number
  behavior: number
  professionalism: number
  overall_score: number
}

export interface SpeechAnalysis {
  id: string
  interview_id: string
  speech_speed_wpm: number
  avg_pause_seconds: number
  total_pauses: number
  speaking_rate: number
  confidence: number
  tone: string
  emotion: string
  clarity: number
  fluency: number
  energy: number
  notes: string
}

export interface SentimentAnalysis {
  id: string
  interview_id: string
  sentiment: string
  emotion: string
  confidence: number
  professionalism: number
  summary: string
}

export interface Report {
  id: string
  interview_id: string
  executive_summary: string
  interview_overview: string
  candidate_overview: string
  performance_analysis: string
  technical_assessment: string
  communication_assessment: string
  confidence_assessment: string
  problem_solving_assessment: string
  experience_assessment: string
  improvement_suggestions: string
}

export interface PdfMeta {
  id: string
  filename: string
  url: string
}

export interface InterviewResult {
  interview_id: string
  status: InterviewStatusValue
  candidate_name: string
  candidate_email: string
  interview_date: string | null
  duration_seconds: number
  transcript: string
  speech_analysis: SpeechAnalysis | null
  sentiment_analysis: SentimentAnalysis | null
  scores: Scores | null
  strengths: string[]
  weaknesses: string[]
  recommendation: Recommendation | null
  report: Report | null
  pdf: PdfMeta | null
}

/** Candidate-facing result — only the hiring decision, never the report. */
export interface CandidateSummary {
  interview_id: string
  status: InterviewStatusValue
  admin_status: string
  candidate_name: string
  candidate_email: string
  interview_date: string | null
  duration_seconds: number
  recommendation: string | null
  message: string
  has_speech: boolean
}

export interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker: string | null
  confidence: number
}

export interface Transcript {
  id: string
  interview_id: string
  full_text: string
  segments: TranscriptSegment[]
  speakers: string[]
  language: string
  confidence: number
  source: string
}

export interface TechnicalEvaluation {
  [key: string]: unknown
}

export interface AnalysisBundle {
  transcript: Transcript | null
  speech_analysis: SpeechAnalysis | null
  sentiment_analysis: SentimentAnalysis | null
  technical_evaluation: TechnicalEvaluation | null
  scores: Scores | null
  strengths: string[]
  weaknesses: string[]
  recommendation: Recommendation | null
  report: Report | null
  has_speech: boolean
  evaluation_criteria: string[]
}

export interface Profile {
  id: string
  user_id: string
  experience: string
  skills: string
  education: string
  current_company: string
  expected_salary: string
  profile_picture_url: string
  resume_url: string
}

export interface ProfileUpdate {
  experience?: string
  skills?: string
  education?: string
  current_company?: string
  expected_salary?: string
}

export interface AdminUploadResponse {
  interview_id: string
  file_id: string
  candidate_id: string
  candidate_email: string
  status: string
  message: string
}

export interface ProcessResponse {
  interview_id: string
  status: string
  message: string
}

export interface InterviewProgress {
  interview_id: string
  status: InterviewStatusValue
  progress: number
  stage: string
  failure_stage: string
  failure_reason: string
  started_at: string | null
  processing_finished_at: string | null
}

export interface CandidateProfileSummary {
  skills: string
  education: string
  experience: string
  current_company: string
  profile_picture_url: string
}

export interface AdminInterview {
  id: string
  candidate_id: string
  candidate_name: string
  candidate_email: string
  candidate_profile: CandidateProfileSummary | null
  admin_status: string
  job_title: string
  status: InterviewStatusValue
  progress: number
  stage: string
  duration_seconds: number
  overall_score: number | null
  recommendation: RecommendationVerdict | null
  failure_reason: string
  failure_stage: string
  processing_finished_at: string | null
  created_at: string | null
  has_speech: boolean
}

export interface RecommendationMessage {
  verdict: RecommendationVerdict
  message: string
}

/** Aggregated dashboard payload — server-side counts + recent interviews. */
export interface AdminDashboardStats {
  total_candidates: number
  total_interviews: number
  interviewed_candidates: number
  processing: number
  failed: number
  recommended: number
  not_recommended: number
  avg_score: number
}

export interface AdminDashboardRecent {
  id: string
  candidate_id: string
  candidate_name: string
  candidate_email: string
  job_title: string
  status: InterviewStatusValue
  admin_status: string
  overall_score: number | null
  recommendation: RecommendationVerdict | null
  profile_picture_url: string | null
  created_at: string | null
  has_speech: boolean
}

export interface AdminDashboard {
  stats: AdminDashboardStats
  status_counts: Record<string, number>
  recent: AdminDashboardRecent[]
}

export interface RegisteredCandidate {
  id: string
  full_name: string
  email: string
}

export interface AdminCandidateLatestInterview {
  id: string
  job_title: string
  status: InterviewStatusValue
  admin_status: string
  overall_score: number | null
  recommendation: RecommendationVerdict | null
  created_at: string | null
}

/** One row per registered candidate (with or without interviews). */
export interface AdminCandidate {
  id: string
  full_name: string
  email: string
  phone: string | null
  gender: string | null
  is_active: boolean
  created_at: string | null
  profile_picture_url: string | null
  interview_count: number
  has_interview: boolean
  latest_interview: AdminCandidateLatestInterview | null
}

export interface CandidateUpdatePayload {
  first_name?: string
  last_name?: string
  phone?: string
  gender?: string
  is_active?: boolean
}

export type ScoreMap = Partial<Record<keyof Scores, number>>

export interface ApiError {
  detail?: string | { loc: (string | number)[]; msg: string; type: string }[]
  message?: string
  reason?: string
}

// --- Chat assistant (stateless widget) ---

export interface ChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  message: string
  history: ChatHistoryItem[]
}

/** Tool activity shown alongside an assistant message while streaming. */
export interface StreamToolEvent {
  name: string
  status: 'started' | 'done' | 'error'
  error?: string
}
