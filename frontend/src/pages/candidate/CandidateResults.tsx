import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  Clock,
  FileText,
  Calendar,
} from 'lucide-react'
import { Button, Card, Skeleton } from '@/components/ui'
import { EmptyState, PageHeader, StatusBadge, AdminStatusBadge, RecommendationBadge } from '@/components/shared'
import { useInterviewResult, useInterviewStatus } from '@/hooks'
import { formatDuration } from '@/lib/utils'
import type { RecommendationVerdict } from '@/types'

export function CandidateResults() {
  const navigate = useNavigate()
  const { data: result, isLoading, isError, refetch, isFetching } = useInterviewResult()
  const { data: status } = useInterviewStatus()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Your Result" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError || !result) {
    return (
      <EmptyState
        icon={FileText}
        title="No result yet"
        description="Your interview result isn't available yet. Check back after your recruiter has evaluated your interview."
        action={
          <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />
    )
  }

  const verdict = result.recommendation as RecommendationVerdict | null
  const isRecommended = verdict === 'Recommended'
  const isNotRecommended = verdict === 'Not Recommended'
  const interviewDate = result.interview_date
    ? new Date(result.interview_date).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  // Real interview duration — derived from the transcript's last segment end
  // timestamp on the backend and returned by the result endpoint.
  const durationSeconds = result.duration_seconds || status?.duration_seconds || 0

  return (
    <div className="space-y-6">
      <PageHeader title="Your Result" description="Your interview outcome." />

      {/* Verdict banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card
          className={`overflow-hidden border-2 ${
            isRecommended
              ? 'border-success/40'
              : isNotRecommended
                ? 'border-destructive/40'
                : 'border-warning/40'
          }`}
        >
          <div className="flex flex-col items-center p-8 text-center sm:p-12">
            <span
              className={`flex h-20 w-20 items-center justify-center rounded-full ${
                isRecommended
                  ? 'bg-success/15 text-success'
                  : isNotRecommended
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-warning/15 text-warning'
              }`}
            >
              {isRecommended ? (
                <CheckCircle2 className="h-10 w-10" />
              ) : isNotRecommended ? (
                <XCircle className="h-10 w-10" />
              ) : (
                <HelpCircle className="h-10 w-10" />
              )}
            </span>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <StatusBadge status={result.status} />
              <AdminStatusBadge status={result.admin_status} />
              {verdict && <RecommendationBadge verdict={verdict} />}
            </div>

            <h2 className="mt-6 font-display text-3xl font-bold text-foreground sm:text-4xl">
              {verdict ?? 'Pending evaluation'}
            </h2>

            {result.message && (
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {result.message}
              </p>
            )}

            {/* Interview metadata */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {interviewDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {interviewDate}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {formatDuration(durationSeconds)}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                <Clock />
                Back to dashboard
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Note */}
      <p className="mx-auto max-w-md text-center text-xs text-muted-foreground">
        Your detailed report — scores, strengths and the full AI evaluation — is shared with your
        recruiter. Contact them if you have questions about your result.
      </p>
    </div>
  )
}
