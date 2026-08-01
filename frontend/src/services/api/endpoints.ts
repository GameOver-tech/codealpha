import { api, API_BASE_URL, getToken } from './client'
import type {
  AdminDashboard,
  AdminInterview,
  AdminUploadResponse,
  AnalysisBundle,
  CandidateSummary,
  ChangePasswordRequest,
  ChatRequest,
  InterviewProgress,
  InterviewStatus,
  Job,
  LoginRequest,
  MessageResponse,
  ProcessResponse,
  Profile,
  ProfileUpdate,
  RecommendationMessage,
  RegisteredCandidate,
  RegisterRequest,
  ScoreMap,
  TokenResponse,
  Transcript,
  User,
  UserUpdate,
} from '@/types'

export const authApi = {
  register: (payload: RegisterRequest) => api.post<TokenResponse>('/api/auth/register', payload),
  login: (payload: LoginRequest) => api.post<TokenResponse>('/api/auth/login', payload),
  logout: () => api.post<MessageResponse>('/api/auth/logout'),
  me: () => api.get<User>('/api/auth/me'),
  updateMe: (payload: UserUpdate) => api.put<User>('/api/auth/me', payload),
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
  interviewResult: () => api.get<CandidateSummary>('/api/interview/result'),
}

/** Build a public URL for a locally-stored upload (avatars, etc.). */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (/^https?:\/\//.test(path)) return path
  return `${API_BASE_URL}/media/${path}`
}

export const adminApi = {
  upload: async (file: File, candidateEmail: string, jobTitle: string, jobDescription: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('candidate_email', candidateEmail)
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

  // POST-based download — download managers (IDM etc.) only hijack GET
  // requests, so POST is never intercepted.
  reportPdfUrl: (interviewId: string) =>
    `/api/admin/report/pdf/download?interview_id=${encodeURIComponent(interviewId)}`,
  regenerateReportPdfUrl: (interviewId: string) =>
    `/api/admin/report/pdf/regenerate?interview_id=${encodeURIComponent(interviewId)}`,

  regenerateReportPdf: async (interviewId: string) => {
    const res = await api.get<Blob>('/api/admin/report/pdf/regenerate', {
      params: { interview_id: interviewId },
      responseType: 'blob',
    })
    return res.data
  },

  updateStatus: (interviewId: string, status: string) =>
    api.put<{ interview_id: string; admin_status: string; message: string }>(
      `/api/admin/interview/${interviewId}/status`,
      null,
      { params: { status } },
    ),

  interviews: () => api.get<AdminInterview[]>('/api/admin/interviews'),

  interviewMeta: (interviewId: string) =>
    api.get<AdminInterview>(`/api/admin/interview/${interviewId}/meta`),

  dashboard: () => api.get<AdminDashboard>('/api/admin/dashboard'),

  registeredCandidates: () => api.get<RegisteredCandidate[]>('/api/admin/candidates/registered'),

  regenerate: (interviewId: string) =>
    api.post<ProcessResponse>('/api/admin/regenerate', { interview_id: interviewId }),

  overrideRecommendation: (interviewId: string, verdict: string, reason: string) =>
    api.post<RecommendationMessage>('/api/admin/status/recommendation/not-recommendation', null, {
      params: { interview_id: interviewId, verdict, reason },
    }),

  deleteInterview: (interviewId: string) =>
    api.delete<MessageResponse>(`/api/admin/interview/${interviewId}`),
}

// --- Chat assistant (stateless widget) ---
// Streaming uses raw fetch — axios cannot consume a Server-Sent Events body.
// History is sent with every request; nothing is stored server-side.

export interface StreamChatEvents {
  onMessage?: (delta: string) => void
  onTool?: (tool: { name: string; status: string; error?: string }) => void
  onDone?: (content: string) => void
  onError?: (message: string) => void
}

export function streamChat(
  payload: ChatRequest,
  events: StreamChatEvents,
  signal?: AbortSignal,
): Promise<void> {
  return fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() ?? ''}`,
    },
    body: JSON.stringify(payload),
    signal,
  }).then(async (resp) => {
    if (!resp.ok) {
      let message = `Chat request failed (${resp.status})`
      try {
        const data = await resp.json()
        message = data?.detail ?? data?.message ?? message
      } catch {
        /* non-JSON error body */
      }
      events.onError?.(message)
      return
    }

    const reader = resp.body?.getReader()
    if (!reader) {
      events.onError?.('No response body')
      return
    }
    const decoder = new TextDecoder()
    let buffer = ''

    const dispatch = (raw: string) => {
      const lines = raw.split('\n')
      let event = 'message'
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          if (!data) continue
          try {
            const parsed = JSON.parse(data)
            if (event === 'message') events.onMessage?.(parsed.delta ?? '')
            else if (event === 'tool') {
              events.onTool?.({
                name: parsed.name ?? '',
                status: parsed.status ?? 'done',
                error: parsed.error,
              })
            } else if (event === 'done') events.onDone?.(parsed.content ?? '')
            else if (event === 'error') events.onError?.(parsed.message ?? 'Something went wrong')
          } catch {
            /* skip malformed SSE payload */
          }
        }
      }
    }

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events_ = buffer.split('\n\n')
      buffer = events_.pop() ?? ''
      for (const chunk of events_) dispatch(chunk)
    }
    if (buffer.trim()) dispatch(buffer)
  })
}

export const chatApi = {
  stream: streamChat,
  uploadInterview: async (file: File, candidateEmail: string, jobTitle?: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('candidate_email', candidateEmail)
    if (jobTitle) form.append('job_title', jobTitle)
    const res = await api.post<{
      interview_id: string
      candidate_email: string
      status: string
      message: string
    }>('/api/chat/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
    })
    return res.data
  },
}

export { API_BASE_URL }
