import { api, API_BASE_URL } from './client'
import type {
  AdminInterview,
  AdminUploadResponse,
  AnalysisBundle,
  ChangePasswordRequest,
  InterviewProgress,
  InterviewResult,
  InterviewStatus,
  Job,
  LoginRequest,
  MessageResponse,
  ProcessResponse,
  Profile,
  ProfileUpdate,
  RecommendationMessage,
  RegisterRequest,
  ScoreMap,
  TokenResponse,
  Transcript,
  User,
} from '@/types'

export const authApi = {
  register: (payload: RegisterRequest) => api.post<TokenResponse>('/api/auth/register', payload),
  login: (payload: LoginRequest) => api.post<TokenResponse>('/api/auth/login', payload),
  logout: () => api.post<MessageResponse>('/api/auth/logout'),
  me: () => api.get<User>('/api/auth/me'),
  changePassword: (payload: ChangePasswordRequest) =>
    api.put<MessageResponse>('/api/auth/me/password', payload),
}

export const jobsApi = {
  list: () => api.get<Job[]>('/api/jobs'),
  create: (payload: { title: string; description?: string }) =>
    api.post<Job>('/api/jobs', payload),
}

export const profileApi = {
  get: () => api.get<Profile>('/api/profile'),
  update: (payload: ProfileUpdate) => api.put<Profile>('/api/profile', payload),
  uploadPicture: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<Profile>('/api/profile/picture', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const candidateApi = {
  interviewStatus: () => api.get<InterviewStatus>('/api/interview/status'),
  interviewResult: () => api.get<InterviewResult>('/api/interview/result'),
  /** Download the PDF blob for the candidate's latest interview. */
  resultPdf: async () => {
    const res = await api.get<Blob>('/api/interview/result/pdf', { responseType: 'blob' })
    return res.data
  },
}

export const adminApi = {
  upload: async (file: File, jobTitle: string, jobDescription: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('job_title', jobTitle)
    if (jobDescription) form.append('job_description', jobDescription)
    const res = await api.post<AdminUploadResponse>('/api/admin/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
    })
    return res.data
  },

  process: (interviewId: string) =>
    api.post<ProcessResponse>('/api/admin/process', { interview_id: interviewId }),

  progress: (interviewId: string) =>
    api.get<InterviewProgress>(`/api/admin/interview/${interviewId}/progress`),

  transcript: (interviewId: string) =>
    api.get<Transcript>('/api/admin/transcript', { params: { interview_id: interviewId } }),

  analysis: (interviewId: string) =>
    api.get<AnalysisBundle>('/api/admin/analysis', { params: { interview_id: interviewId } }),

  scores: (interviewId: string) =>
    api.get<ScoreMap>('/api/admin/scores', { params: { interview_id: interviewId } }),

  recommendation: (interviewId: string) =>
    api.get<RecommendationMessage>('/api/admin/recommendation', {
      params: { interview_id: interviewId },
    }),

  report: (interviewId: string) =>
    api.get<Record<string, string>>('/api/admin/report', { params: { interview_id: interviewId } }),

  reportPdf: async (interviewId: string) => {
    const res = await api.get<Blob>('/api/admin/report/pdf', {
      params: { interview_id: interviewId },
      responseType: 'blob',
    })
    return res.data
  },

  interviews: () => api.get<AdminInterview[]>('/api/admin/interviews'),

  regenerate: (interviewId: string) =>
    api.post<ProcessResponse>('/api/admin/regenerate', { interview_id: interviewId }),

  overrideRecommendation: (interviewId: string, verdict: string, reason: string) =>
    api.post<RecommendationMessage>('/api/admin/status/recommendation/not-recommendation', null, {
      params: { interview_id: interviewId, verdict, reason },
    }),

  deleteInterview: (interviewId: string) =>
    api.delete<MessageResponse>(`/api/admin/interview/${interviewId}`),
}

export { API_BASE_URL }
