import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, FileText, Download, RefreshCw, Video } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Input, Skeleton } from '@/components/ui'
import { Avatar, AvatarFallback, EmptyState, PageHeader, RecommendationBadge, StatusBadge } from '@/components/shared'
import { useAdminInterviews } from '@/hooks'
import { adminApi, getErrorMessage } from '@/services/api'
import { useMutation } from '@tanstack/react-query'
import { initials } from '@/lib/utils'

export function AdminReports() {
  const { data: interviews, isLoading, isError } = useAdminInterviews()
  const [search, setSearch] = useState('')

  const completed = useMemo(() => {
    if (!interviews) return []
    const q = search.trim().toLowerCase()
    return interviews
      .filter((i) => i.status === 'completed')
      .filter(
        (i) =>
          !q ||
          `${i.candidate_name} ${i.candidate_email} ${i.job_title}`.toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
  }, [interviews, search])

  const downloadMutation = useMutation({
    mutationFn: (id: string) => adminApi.reportPdf(id),
    onSuccess: (blob, id) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `HireLens-Report-${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" />
        <Skeleton className="h-14 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return <EmptyState icon={Video} title="Could not load reports" description="Check that the backend is running." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Download completed interview reports."
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reports…"
          className="pl-9"
        />
      </div>

      {completed.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description="Completed interviews will appear here with downloadable PDF reports."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {completed.map((interview, i) => (
            <motion.div
              key={interview.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="card-hover">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback>{initials(interview.candidate_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{interview.candidate_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{interview.candidate_email}</p>
                      <p className="mt-1 truncate text-xs font-medium text-primary">{interview.job_title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <RecommendationBadge verdict={interview.recommendation} />
                        <StatusBadge status={interview.status} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {interview.overall_score !== null && (
                        <span className="font-display text-2xl font-bold text-foreground">
                          {Math.round(interview.overall_score)}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadMutation.mutate(interview.id)}
                        loading={downloadMutation.isPending}
                      >
                        <Download />
                        PDF
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="text-xs text-muted-foreground">
                      {interview.created_at
                        ? new Date(interview.created_at).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </span>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/admin/candidates/${interview.id}`}>
                        <RefreshCw />
                        View report
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
