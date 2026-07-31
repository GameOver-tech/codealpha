import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Upload,
  FileText,
  Clock,
  Trophy,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Video,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui'
import { EmptyState, PageHeader, StatusBadge, CircularProgress, RecommendationBadge } from '@/components/shared'
import type { RecommendationVerdict } from '@/types'
import { useAuth } from '@/context'
import { useInterviewStatus, useInterviewResult, useJobs, queryKeys } from '@/hooks'
import { getErrorMessage } from '@/services/api'
import { formatDuration } from '@/lib/utils'

export function DashboardOverview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const statusQuery = useInterviewStatus()
  const resultQuery = useInterviewResult()
  const jobsQuery = useJobs()

  const status = statusQuery.data
  const result = resultQuery.data
  const isLoading = statusQuery.isLoading || statusQuery.isFetching

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.interviewStatus }),
        queryClient.invalidateQueries({ queryKey: queryKeys.interviewResult }),
      ])
      toast.success('Interview status refreshed')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setRefreshing(false)
    }
  }

  const activeJobs = jobsQuery.data?.filter((job) => job.is_active) ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.first_name ?? 'there'} 👋`}
        description="Track your interviews and evaluation progress."
        actions={
          <Button onClick={handleRefresh} variant="outline" loading={refreshing}>
            <Clock />
            Refresh status
          </Button>
        }
      />

      {/* Interview status card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {isLoading && !status ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="mt-4 h-4 w-72" />
              <Skeleton className="mt-3 h-4 w-56" />
            </CardContent>
          </Card>
        ) : status ? (
          <Card className="overflow-hidden">
            <div className="grid gap-0 md:grid-cols-[1fr_auto]">
              <CardContent className="flex flex-col justify-center p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={status.status} />
                  {status.recommendation && (
                    <RecommendationBadge verdict={status.recommendation as RecommendationVerdict} />
                  )}
                </div>
                <h2 className="mt-4 font-display text-xl font-bold text-foreground sm:text-2xl">{status.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{status.job_title}</p>

                {status.status === 'failed' ? (
                  <div className="mt-5 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <div>
                      <p className="text-sm font-semibold text-destructive">Processing failed</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {status.failure_reason || status.error_message || 'An unexpected error occurred.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {status.duration_seconds > 0
                      ? `Duration: ${formatDuration(status.duration_seconds)}`
                      : 'Processing your interview — results are on the way.'}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  {status.status === 'completed' ? (
                    <Button onClick={() => navigate('/dashboard/results')}>
                      <FileText />
                      View results
                      <ArrowRight />
                    </Button>
                  ) : status.status === 'failed' ? (
                    <Button onClick={() => navigate('/upload')}>
                      <Upload />
                      Upload again
                    </Button>
                  ) : (
                    <Button onClick={() => navigate('/dashboard/processing')} loading={!status}>
                      <Loader2 className={status ? 'animate-spin' : ''} />
                      Track processing
                    </Button>
                  )}
                </div>
              </CardContent>

              {status.status === 'completed' && result?.scores && (
                <div className="flex items-center justify-center border-t border-border/60 bg-gradient-to-br from-primary/5 to-transparent p-6 md:border-l md:border-t-0 md:p-10">
                  <CircularProgress
                    value={result.scores.overall_score}
                    size={150}
                    label="Overall score"
                    color={result.scores.overall_score >= 70 ? '#22C55E' : result.scores.overall_score >= 50 ? '#F59E0B' : '#EF4444'}
                  />
                </div>
              )}
            </div>
          </Card>
        ) : (
          <EmptyState
            icon={Video}
            title="No interview yet"
            description="Upload your first interview recording to get an AI-powered evaluation."
            action={
              <Button size="lg" onClick={() => navigate('/upload')}>
                <Upload />
                Upload your first interview
              </Button>
            }
          />
        )}
      </motion.div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            icon: FileText,
            label: 'Latest status',
            value: status ? status.status.replace(/_/g, ' ') : '—',
            sub: status?.job_title ?? 'No interview yet',
          },
          {
            icon: Trophy,
            label: 'Overall score',
            value: result?.scores ? `${Math.round(result.scores.overall_score)}/100` : '—',
            sub: result?.recommendation?.verdict ?? 'Pending evaluation',
          },
          {
            icon: Clock,
            label: 'Interview duration',
            value: status ? formatDuration(status.duration_seconds) : '—',
            sub: status?.created_at ? `Uploaded ${new Date(status.created_at).toLocaleDateString()}` : '—',
          },
        ].map((stat) => (
          <Card key={stat.label} className="card-hover">
            <CardContent className="flex items-start gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <stat.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                <p className="mt-0.5 truncate font-display text-lg font-bold capitalize text-foreground">{stat.value}</p>
                <p className="truncate text-xs text-muted-foreground">{stat.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Open positions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Open positions</CardTitle>
          <Link to="/jobs" className="text-xs font-semibold text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {jobsQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : activeJobs.length > 0 ? (
            <ul className="divide-y divide-border/60">
              {activeJobs.slice(0, 5).map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{job.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{job.description}</p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/jobs/${job.id}`}>
                      Apply
                      <ArrowRight />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No open positions right now. Check back soon.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
