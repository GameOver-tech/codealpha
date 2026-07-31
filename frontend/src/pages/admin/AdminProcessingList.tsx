import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, AlertTriangle, ArrowRight, Video } from 'lucide-react'
import { Button, Card, CardContent, Progress, Skeleton } from '@/components/ui'
import { Avatar, AvatarFallback, AvatarImage, EmptyState, PageHeader, StatusBadge } from '@/components/shared'
import { useAdminInterviews } from '@/hooks'
import { mediaUrl } from '@/services/api'
import { initials } from '@/lib/utils'

export function AdminProcessingList() {
  const { data: interviews, isLoading, isError } = useAdminInterviews()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Processing" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (isError || !interviews) {
    return (
      <EmptyState
        icon={Video}
        title="Could not load processing queue"
        description="The backend may be unavailable."
      />
    )
  }

  const active = interviews.filter((i) => !['completed', 'failed'].includes(i.status))
  const failed = interviews.filter((i) => i.status === 'failed')

  const rows = [...active, ...failed]

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Loader2}
        title="Nothing processing right now"
        description="Interviews that are being processed or have failed will show up here."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Processing"
        description="Live status of interviews currently being evaluated."
      />

      <div className="space-y-4">
        {rows.map((interview, i) => {
          const failedStatus = interview.status === 'failed'
          return (
            <motion.div
              key={interview.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={failedStatus ? 'border-destructive/30' : undefined}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={mediaUrl(interview.candidate_profile?.profile_picture_url)}
                        alt={interview.candidate_name}
                      />
                      <AvatarFallback>{initials(interview.candidate_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-foreground">{interview.candidate_name}</p>
                        <StatusBadge status={interview.status} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {interview.candidate_email} · {interview.job_title}
                      </p>
                    </div>
                    <div className="w-40 shrink-0">
                      {failedStatus ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          {interview.failure_stage || 'Failed'}
                        </span>
                      ) : (
                        <>
                          <Progress value={interview.progress} className="h-2" />
                          <p className="mt-1 text-right text-xs text-muted-foreground">
                            {Math.round(interview.progress)}%
                          </p>
                        </>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/admin/candidates/${interview.id}`}>
                        View
                        <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
