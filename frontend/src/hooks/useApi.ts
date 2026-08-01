import { useQuery } from '@tanstack/react-query'
import { candidateApi, adminApi, jobsApi, profileApi } from '@/services/api'
import type { CandidateSummary, InterviewStatusValue } from '@/types'

export const queryKeys = {
  me: ['auth', 'me'] as const,
  jobs: ['jobs'] as const,
  profile: ['profile'] as const,
  interviewStatus: ['interview', 'status'] as const,
  interviewResult: ['interview', 'result'] as const,
  adminInterviews: ['admin', 'interviews'] as const,
  adminInterviewMeta: (id: string) => ['admin', 'interview', 'meta', id] as const,
  adminDashboard: ['admin', 'dashboard'] as const,
  adminProgress: (id: string) => ['admin', 'progress', id] as const,
  adminAnalysis: (id: string) => ['admin', 'analysis', id] as const,
  adminTranscript: (id: string) => ['admin', 'transcript', id] as const,
  adminScores: (id: string) => ['admin', 'scores', id] as const,
  adminRecommendation: (id: string) => ['admin', 'recommendation', id] as const,
  adminReport: (id: string) => ['admin', 'report', id] as const,
}

export function useJobs() {
  return useQuery({
    queryKey: queryKeys.jobs,
    queryFn: async () => (await jobsApi.list()).data,
    staleTime: 5 * 60 * 1000,
  })
}

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => (await profileApi.get()).data,
  })
}

export function useInterviewStatus() {
  return useQuery({
    queryKey: queryKeys.interviewStatus,
    queryFn: async () => (await candidateApi.interviewStatus()).data,
    retry: 1,
    // Real-time sync: poll while the interview is still processing so the
    // candidate dashboard / status / results pages flip to Completed
    // automatically. Stops polling once processing has finished.
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      const active: InterviewStatusValue[] = [
        'uploaded',
        'processing',
        'transcript_ready',
        'ai_evaluation',
        'pdf_generated',
      ]
      return active.includes(data.status) ? 5000 : false
    },
  })
}

export function useInterviewResult() {
  return useQuery({
    queryKey: queryKeys.interviewResult,
    queryFn: async () => (await candidateApi.interviewResult()).data as CandidateSummary,
    retry: 1,
  })
}

export function useAdminInterviews(enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminInterviews,
    queryFn: async () => (await adminApi.interviews()).data,
    enabled,
    staleTime: 30 * 1000,
    // Poll in the background so status changes surface without manual
    // refresh, but not faster than the data actually changes. Polling is
    // paused while the query is disabled (e.g. notification bell closed).
    refetchInterval: (query) =>
      query.state.data && query.state.data.some((i) => ['uploaded', 'processing', 'transcript_ready', 'ai_evaluation', 'pdf_generated'].includes(i.status))
        ? 15 * 1000
        : 60 * 1000,
  })
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.adminDashboard,
    queryFn: async () => (await adminApi.dashboard()).data,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  })
}

export function useAdminInterviewMeta(interviewId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminInterviewMeta(interviewId ?? ''),
    queryFn: async () => (await adminApi.interviewMeta(interviewId!)).data,
    enabled: Boolean(interviewId),
    staleTime: 30 * 1000,
  })
}

export function useAdminProgress(interviewId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminProgress(interviewId ?? ''),
    queryFn: async () => (await adminApi.progress(interviewId!)).data,
    enabled: Boolean(interviewId),
    refetchInterval: (query) =>
      query.state.data && ['processing', 'uploaded', 'transcript_ready', 'ai_evaluation', 'pdf_generated'].includes(query.state.data.status)
        ? 5000
        : false,
  })
}

export function useAdminAnalysis(interviewId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminAnalysis(interviewId ?? ''),
    queryFn: async () => (await adminApi.analysis(interviewId!)).data,
    enabled: Boolean(interviewId),
    // The analysis bundle is heavy (fetches all artifacts). Cache it for
    // several minutes — navigating back to a candidate is then instant.
    // Regenerate/override mutations invalidate this key explicitly.
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminTranscript(interviewId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminTranscript(interviewId ?? ''),
    queryFn: async () => (await adminApi.transcript(interviewId!)).data,
    enabled: Boolean(interviewId),
  })
}

export function useAdminRecommendation(interviewId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminRecommendation(interviewId ?? ''),
    queryFn: async () => (await adminApi.recommendation(interviewId!)).data,
    enabled: Boolean(interviewId),
  })
}

export function useAdminReport(interviewId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminReport(interviewId ?? ''),
    queryFn: async () => (await adminApi.report(interviewId!)).data,
    enabled: Boolean(interviewId),
  })
}
