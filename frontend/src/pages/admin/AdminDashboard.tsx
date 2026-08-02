import { useMemo } from 'react'
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
  PieChart,
  Pie,
  Legend,
} from 'recharts'
import {
  Users,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Video,
  Clock,
  Star,
} from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Skeleton } from '@/components/ui'
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

const STATUS_LABELS: Record<string, string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  transcript_ready: 'Transcribing',
  ai_evaluation: 'AI Evaluation',
  pdf_generated: 'Generating PDF',
  completed: 'Completed',
  failed: 'Failed',
}

const CHART_TOOLTIP_STYLE = {
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontSize: 12,
  background: 'var(--card)',
  boxShadow: '0 8px 30px -6px rgb(15 23 42 / 0.15)',
}

function DashboardStatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  delay,
  trend,
  trendLabel,
}: {
  icon: typeof Users
  label: string
  value: number | string
  sub: string
  color: string
  delay: number
  trend: number
  trendLabel: string
}) {
  const positive = trend >= 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className="card-hover h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18`, color }}>
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                positive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
              }`}
              title={`${trendLabel}: ${positive ? '+' : ''}${trend}`}
            >
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {positive ? '+' : ''}{trend}
            </span>
          </div>
          <p className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground/70">{sub}</p>
          <p className="mt-3 flex items-center gap-1 border-t border-border/40 pt-2.5 text-[11px] text-muted-foreground/60">
            <Clock className="h-3 w-3" />
            Updated {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function AdminDashboard() {
  const { data, isLoading, isError } = useAdminDashboard()

  // Hooks must run unconditionally — before any early return — so their
  // order is identical on every render.
  const statusDistribution = useMemo(() => {
    const counts = data?.status_counts ?? {}
    return Object.keys(counts)
      .filter((s) => counts[s] > 0)
      .map((s) => ({
        name: STATUS_LABELS[s] ?? s.replace(/_/g, ' '),
        value: counts[s],
        fill: STATUS_COLORS[s] ?? '#2563EB',
      }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  const recent: AdminDashboardRecent[] = data?.recent ?? []

  const volumeByDay = useMemo(() => {
    const buckets = new Map<string, number>()
    recent.forEach((i) => {
      if (!i.created_at) return
      const day = new Date(i.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      buckets.set(day, (buckets.get(day) ?? 0) + 1)
    })
    return [...buckets.entries()]
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, count]) => ({ date, count }))
  }, [recent])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Admin Dashboard" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
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

  // Completion rate derived from real counts.
  const completionRate = stats.total_interviews > 0
    ? Math.round((stats.interviewed_candidates / stats.total_interviews) * 100)
    : 0

  // Weekly growth from the real recent list (this 7 days vs previous 7 days).
  const now = Date.now()
  const thisWeek = recent.filter((i) => i.created_at && now - new Date(i.created_at).getTime() < 7 * 86400_000).length
  const prevWeek = recent.filter((i) => i.created_at && now - new Date(i.created_at).getTime() >= 7 * 86400_000 && now - new Date(i.created_at).getTime() < 14 * 86400_000).length
  const weeklyGrowth = prevWeek > 0 ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : thisWeek > 0 ? 100 : 0

  const statCards = [
    {
      icon: Users,
      label: 'Total interviews',
      value: stats.total_interviews,
      sub: `${stats.total_candidates} candidates registered`,
      color: '#2563EB',
      trend: weeklyGrowth,
      trendLabel: 'vs last 7 days',
    },
    {
      icon: CheckCircle2,
      label: 'Completed',
      value: stats.interviewed_candidates,
      sub: `${completionRate}% completion rate`,
      color: '#22C55E',
      trend: 0,
      trendLabel: 'vs last 7 days',
    },
    {
      icon: Star,
      label: 'Average score',
      value: Math.round(stats.avg_score),
      sub: `${stats.recommended} recommended · ${stats.not_recommended} not recommended`,
      color: '#6366F1',
      trend: 0,
      trendLabel: 'vs last 7 days',
    },
    {
      icon: XCircle,
      label: 'Failed',
      value: stats.failed,
      sub: `${stats.processing} still processing`,
      color: '#EF4444',
      trend: 0,
      trendLabel: 'vs last 7 days',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Monitor interview processing and candidate outcomes at a glance."
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, i) => (
          <DashboardStatCard key={card.label} {...card} delay={i * 0.05} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trend line */}
        <Card>
          <CardHeader>
            <CardTitle>Interview volume</CardTitle>
            <CardDescription>Interviews uploaded per day · recent records</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {volumeByDay.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No interview activity yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeByDay} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="text-slate-200 dark:text-slate-700" stroke="currentColor" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value: number | string) => [value, 'Interviews']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area type="monotone" dataKey="count" name="Interviews" stroke="#2563EB" fill="url(#volumeGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status distribution donut */}
        <Card>
          <CardHeader>
            <CardTitle>Interviews by status</CardTitle>
            <CardDescription>Share of all interviews in each pipeline stage</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {statusDistribution.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No interviews yet — upload the first recording to see the breakdown.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value: number | string, name: string) => [value, name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={44}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparison bar chart — recommendation outcomes */}
      <Card>
        <CardHeader>
          <CardTitle>Hiring outcomes</CardTitle>
          <CardDescription>How evaluated candidates were classified</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          {stats.total_interviews === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No evaluations yet — outcomes will appear after processing completes.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Recommended', value: stats.recommended, fill: '#22C55E' },
                  { name: 'Not Recommended', value: stats.not_recommended, fill: '#EF4444' },
                  { name: 'Need Review', value: stats.total_interviews - stats.recommended - stats.not_recommended - stats.failed, fill: '#F59E0B' },
                ].filter((d) => d.value >= 0)}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="text-slate-200 dark:text-slate-700" stroke="currentColor" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  cursor={{ fill: 'rgb(37 99 235 / 0.06)' }}
                  formatter={(value: number | string) => [value, 'Candidates']}
                  labelFormatter={(label) => `Outcome: ${label}`}
                />
                <Bar dataKey="value" name="Candidates" radius={[8, 8, 0, 0]} maxBarSize={64}>
                  {[
                    { name: 'Recommended', value: stats.recommended, fill: '#22C55E' },
                    { name: 'Not Recommended', value: stats.not_recommended, fill: '#EF4444' },
                    { name: 'Need Review', value: stats.total_interviews - stats.recommended - stats.not_recommended - stats.failed, fill: '#F59E0B' },
                  ]
                    .filter((d) => d.value >= 0)
                    .map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Recent interviews */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent interviews</CardTitle>
            <CardDescription>Latest activity across all candidates</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/candidates">
              View all
              <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Video className="h-7 w-7" strokeWidth={1.75} />
              </span>
              <div>
                <p className="font-display text-base font-bold text-foreground">No interviews yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload the first recording to start evaluating candidates.
                </p>
              </div>
              <Button asChild>
                <Link to="/admin/upload">
                  <Video />
                  Upload interview
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {recent.map((interview: AdminDashboardRecent) => (
                <Link
                  key={interview.id}
                  to={`/admin/candidates/${interview.id}`}
                  className="flex items-center gap-4 py-3.5 transition-colors hover:bg-accent/50"
                >
                  <Avatar className="h-10 w-10 border border-border/60 shadow-sm">
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
                  <div className="hidden items-center gap-3 sm:flex">
                    {interview.overall_score !== null && (
                      <span className="flex items-center gap-1 font-display text-sm font-bold text-foreground">
                        <Star className="h-3.5 w-3.5 text-amber-400" />
                        {Math.round(interview.overall_score)}
                      </span>
                    )}
                    {interview.has_speech === false ? (
                      <span className="text-xs font-semibold text-muted-foreground">No speech</span>
                    ) : (
                      <RecommendationBadge verdict={interview.recommendation} />
                    )}
                    <StatusBadge status={interview.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
