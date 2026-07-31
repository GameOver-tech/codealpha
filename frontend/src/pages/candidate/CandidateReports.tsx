import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, FileText, RefreshCw, Video, CalendarDays, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, Skeleton } from '@/components/ui'
import { EmptyState, PageHeader, RecommendationBadge, StatusBadge } from '@/components/shared'
import { useInterviewResult, useInterviewStatus } from '@/hooks'
import { candidateApi, getErrorMessage } from '@/services/api'
import { formatDuration } from '@/lib/utils'

export function CandidateReports() {
  const navigate = useNavigate()
  const [downloading, setDownloading] = useState(false)
  const { data: result, isLoading, isError, refetch, isFetching } = useInterviewResult()
  const { data: status } = useInterviewStatus()

  const handleDownloadPdf = async () => {
    setDownloading(true)
    try {
      const blob = await candidateApi.resultPdf()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `HireLens-Report-${result?.candidate_name ?? 'Candidate'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (isError || !result) {
    return (
      <EmptyState
        icon={FileText}
        title="No reports yet"
        description="Your interview reports will appear here once your interview has been evaluated."
        action={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
              <RefreshCw />
              Refresh
            </Button>
            {status?.status === 'completed' && (
              <Button onClick={() => navigate('/dashboard/results')}>
                <Video />
                View results
              </Button>
            )}
          </div>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Download your evaluation report as a professional PDF."
      />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="card-hover overflow-hidden">
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
            <div className="flex items-start gap-5">
              <span className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-blue-400/15 text-primary sm:flex">
                <FileText className="h-8 w-8" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-bold text-foreground">
                    {result.candidate_name}
                  </h2>
                  <StatusBadge status={result.status} />
                  {result.recommendation && (
                    <RecommendationBadge verdict={result.recommendation.verdict} />
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{result.candidate_email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {result.interview_date
                      ? new Date(result.interview_date).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5" />
                    {result.scores ? `Overall: ${Math.round(result.scores.overall_score)}/100` : 'Not scored yet'}
                  </span>
                  {result.duration_seconds > 0 && (
                    <span>Duration: {formatDuration(result.duration_seconds)}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-3">
              <Button variant="outline" onClick={() => navigate('/dashboard/results')}>
                <Video />
                View report
              </Button>
              <Button onClick={handleDownloadPdf} loading={downloading} disabled={!result.pdf}>
                <Download />
                Download PDF
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {!result.pdf && (
        <p className="text-center text-sm text-muted-foreground">
          The PDF report is generated when your interview completes. Check back shortly.
        </p>
      )}
    </div>
  )
}
