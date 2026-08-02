import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { FileText, Clock, Video, Inbox } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Skeleton } from '@/components/ui'
import { PageHeader, StatusBadge } from '@/components/shared'
import { useInterviewStatus, queryKeys } from '@/hooks'
import { getErrorMessage } from '@/services/api'
import { formatDuration } from '@/lib/utils'

/**
 * Candidate dashboard — a clean overview of where the interview stands.
 * Detailed evaluation data lives exclusively on the Results page.
 */
export function DashboardOverview() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const statusQuery = useInterviewStatus()
  const status = statusQuery.data
  const isLoading = statusQuery.isLoading || statusQuery.isFetching

  // Derive the candidate-visible state strictly from backend data.
  //  - no interview record -> No interview yet
  //  - interview exists, not completed -> In Review
  //  - backend status completed -> Completed
  const hasNoInterview = !status && !statusQuery.isLoading
  const isCompleted = status?.status === 'completed'

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.interviewStatus })
      toast.success('Interview status refreshed')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Dashboard"
        description="Track your interview evaluation at a glance."
        actions={
          <Button onClick={handleRefresh} variant="outline" loading={refreshing}>
            <Clock />
            Refresh status
          </Button>
        }
      />

      {/* Status card — reflects the real interview lifecycle only. */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {isLoading && !status ? (
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-4 w-56" />
              <div className="flex gap-3 pt-2">
                <Skeleton className="h-10 w-32 rounded-xl" />
                <Skeleton className="h-10 w-32 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        ) : hasNoInterview ? (
          /* NO INTERVIEW — no interview record exists yet. */
          <Card>
            <CardContent className="flex flex-col items-center p-10 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Inbox className="h-8 w-8" />
                </span>
                <div className="mt-5">
                  <StatusBadge status="uploaded" />
                </div>
                <h2 className="mt-4 font-display text-xl font-bold text-foreground">No interview yet</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  No interview has been uploaded yet. You can start a live AI interview right now,
                  or wait until the recruiter uploads your interview.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button onClick={() => navigate('/dashboard/live-interview')}>
                    <Video />
                    Start Live Interview
                  </Button>
                  <Button variant="outline" disabled>
                    <FileText />
                    No Results Yet
                  </Button>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        ) : isCompleted ? (
          /* COMPLETED — evaluation done, results available. */
          <Card className="overflow-hidden">
            <div className="grid gap-0 md:grid-cols-[1fr_auto]">
              <CardContent className="flex flex-col justify-center p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status="completed" />
                </div>
                <h2 className="mt-4 font-display text-xl font-bold text-foreground sm:text-2xl">
                  {status.title || 'Interview completed'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{status.job_title}</p>
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Duration: {formatDuration(status.duration_seconds)}
                </p>

                {status.has_speech === false ? (
                  <div className="mt-6">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      No speech was detected in your recording, so no evaluation could be
                      generated. Please contact your recruiter to re-upload.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button onClick={() => navigate('/dashboard/results')}>
                      <FileText />
                      View Results
                    </Button>
                  </div>
                )}
              </CardContent>

              <div className="flex flex-col items-center justify-center gap-3 border-t border-border/60 bg-gradient-to-br from-success/10 to-transparent p-6 md:border-l md:border-t-0 md:p-10">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
                  <FileText className="h-8 w-8" />
                </span>
                <p className="text-center text-sm font-semibold text-foreground">Evaluation complete</p>
                <p className="max-w-[220px] text-center text-xs text-muted-foreground">
                  {status.has_speech === false
                    ? 'The recording contained no audible speech.'
                    : 'Your full AI evaluation is ready on the Results page.'}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          /* IN REVIEW — interview exists, processing in progress. Failed
             interviews are shown as "Under Review" too — the candidate never
             sees a failure state; the recruiter handles it on the admin side
             and the outcome appears here when ready. */
          <Card className="overflow-hidden">
            <div className="grid gap-0 md:grid-cols-[1fr_auto]">
              <CardContent className="flex flex-col justify-center p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    Under Review
                  </span>
                </div>
                <h2 className="mt-4 font-display text-xl font-bold text-foreground sm:text-2xl">
                  {status?.title || 'Interview in review'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{status?.job_title}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Our AI is currently evaluating your interview. Results will appear automatically.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button disabled>Processing...</Button>
                </div>
              </CardContent>

              <div className="flex flex-col items-center justify-center gap-3 border-t border-border/60 bg-gradient-to-br from-primary/5 to-transparent p-6 md:border-l md:border-t-0 md:p-10">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileText className="h-8 w-8" />
                </span>
                <p className="max-w-[220px] text-center text-xs text-muted-foreground">
                  This usually takes a few minutes. You can close this page and check back later.
                </p>
              </div>
            </div>
          </Card>
        )}
      </motion.div>

      {/* Quick status widget — one summary card, no evaluation details. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Card className="card-hover group h-full transition-all duration-300 hover:-translate-y-0.5">
          <CardContent className="flex h-full items-start gap-4 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-white">
              <Video className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Interview status</p>
              <p className="mt-0.5 truncate font-display text-lg font-bold capitalize text-foreground">
                {hasNoInterview ? 'No Interview' : isCompleted ? 'Completed' : 'Under Review'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {status?.job_title || 'No interview yet'}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
