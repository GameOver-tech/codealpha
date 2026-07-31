import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import {
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ArrowRight,
  Video,
} from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui'
import { Avatar, AvatarFallback, AvatarImage, EmptyState, PageHeader, RecommendationBadge, StatusBadge } from '@/components/shared'
import { useAdminDashboard } from '@/hooks'
import { mediaUrl } from '@/services/api'
import { initials } from '@/lib/utils'
import type { AdminDashboardRecent } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  uploaded: '#2563EB',
  processing: '#3B82F6',
  transcript_ready: '#0EA5E9',
  ai_evaluation: '#6366F1',
  pdf_generated: '#8B5CF6',
  completed: '#22C55E',
  failed: '#EF4444',
}

function DashboardStatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  delay,
}: {
  icon: typeof Users
  label: string
  value: number | string
  sub: string
  color: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className="card-hover">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18`, color }}>
              <Icon className="h-5 w-5" />
            </span>
            <TrendingUp className="h-4 w-4 text-muted-foreground/40" />
          </div>
          <p className="mt-4 font-display text-2xl font-bold text-foreground">{value}</p>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground/70">{sub}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function AdminDashboard() {
  const { data, isLoading, isError } = useAdminDashboard()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Admin Dashboard" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={Video}
        title="Could not load dashboard"
        description="The backend may be unavailable. Check that the API server is running."
      />
    )
  }

  const stats = data.stats
  const statusCounts = Object.keys(STATUS_COLORS).map((status) => ({
    status,
    count: data.status_counts[status] ?? 0,
  }))
  const recent: AdminDashboardRecent[] = data.recent ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Monitor interview processing and candidate outcomes."
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard icon={Users} label="Total interviews" value={stats.total_interviews} sub={`${stats.total_candidates} candidates`} color="#2563EB" delay={0} />
        <DashboardStatCard icon={CheckCircle2} label="Completed" value={stats.interviewed_candidates} sub="Reports generated" color="#22C55E" delay={0.05} />
        <DashboardStatCard icon={Loader2} label="Processing" value={stats.processing} sub="In the pipeline" color="#F59E0B" delay={0.1} />
        <DashboardStatCard icon={XCircle} label="Failed" value={stats.failed} sub="Need attention" color="#EF4444" delay={0.15} />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Interviews by status</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusCounts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="text-slate-200 dark:text-slate-700" stroke="currentColor" />
                <XAxis dataKey="status" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v: string) => v.replace(/_/g, ' ')} />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: 'rgb(37 99 235 / 0.06)' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgb(226 232 240)',
                    fontSize: 12,
                    background: 'var(--card)',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {statusCounts.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#2563EB'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interview volume</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={[...recent]
                  .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
                  .map((i) => ({
                    date: new Date(i.created_at ?? 0).toLocaleDateString(),
                    count: 1,
                  }))}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="text-slate-200 dark:text-slate-700" stroke="currentColor" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgb(226 232 240)',
                    fontSize: 12,
                    background: 'var(--card)',
                  }}
                />
                <Area type="monotone" dataKey="count" stroke="#2563EB" fill="url(#volumeGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent interviews */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent interviews</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/candidates">
              View all
              <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No interviews yet. Upload the first recording to get started.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {recent.map((interview: AdminDashboardRecent) => (
                <Link
                  key={interview.id}
                  to={`/admin/candidates/${interview.id}`}
                  className="flex items-center gap-4 py-3.5 transition-colors hover:bg-accent/50"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={mediaUrl(interview.profile_picture_url)}
                      alt={interview.candidate_name}
                    />
                    <AvatarFallback>{initials(interview.candidate_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{interview.candidate_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{interview.job_title}</p>
                  </div>
                  {interview.overall_score !== null && (
                    <span className="hidden font-display text-sm font-bold text-foreground sm:block">
                      {Math.round(interview.overall_score)}
                    </span>
                  )}
                  <RecommendationBadge verdict={interview.recommendation} />
                  <StatusBadge status={interview.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
