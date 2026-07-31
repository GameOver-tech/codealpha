import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import {
  ArrowLeft,
  Download,
  RefreshCw,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Badge,
} from '@/components/ui'
import { CircularProgress, EmptyState, PageHeader, RecommendationBadge, StatusBadge } from '@/components/shared'
import { useAdminAnalysis, useAdminInterviews, useAdminProgress, queryKeys } from '@/hooks'
import { adminApi, getErrorMessage } from '@/services/api'
import { formatDuration } from '@/lib/utils'

const SCORE_LABELS: { key: string; label: string }[] = [
  { key: 'technical_skills', label: 'Technical' },
  { key: 'communication', label: 'Communication' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'problem_solving', label: 'Problem Solving' },
  { key: 'relevant_experience', label: 'Experience' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'teamwork', label: 'Teamwork' },
  { key: 'critical_thinking', label: 'Critical Thinking' },
  { key: 'behavior', label: 'Behavior' },
  { key: 'professionalism', label: 'Professionalism' },
]

const VERDICTS = ['Recommended', 'Not Recommended', 'Need Further Review'] as const

function scoreColor(score: number): string {
  if (score >= 70) return '#22C55E'
  if (score >= 50) return '#F59E0B'
  return '#EF4444'
}

function SectionCard({ title, text }: { title: string; text?: string }) {
  if (!text) return null
  return (
    <Card>
      <CardContent className="p-6">
        <h4 className="font-display text-base font-bold text-foreground">{title}</h4>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  )
}

export function AdminCandidateDetail() {
  const { interviewId } = useParams<{ interviewId: string }>()
  const queryClient = useQueryClient()
  const [overrideVerdict, setOverrideVerdict] = useState<(typeof VERDICTS)[number]>('Recommended')
  const [overrideReason, setOverrideReason] = useState('')

  const { data: interviews } = useAdminInterviews()
  const meta = interviews?.find((i) => i.id === interviewId)
  const { data: progress } = useAdminProgress(interviewId)
  const { data: bundle, isLoading, isError } = useAdminAnalysis(interviewId)

  const reportPdfMutation = useMutation({
    mutationFn: (id: string) => adminApi.reportPdf(id),
    onSuccess: (blob, id) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `HireLens-Report-${meta?.candidate_name ?? id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => adminApi.regenerate(id),
    onSuccess: () => {
      toast.success('Regeneration started — the evaluation will be rebuilt.')
      queryClient.invalidateQueries({ queryKey: queryKeys.adminProgress(interviewId ?? '') })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const overrideMutation = useMutation({
    mutationFn: () => adminApi.overrideRecommendation(interviewId!, overrideVerdict, overrideReason),
    onSuccess: (res) => {
      toast.success(`Recommendation set to "${res.data.verdict}"`)
      setOverrideReason('')
      queryClient.invalidateQueries({ queryKey: queryKeys.adminInterviews })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminAnalysis(interviewId ?? '') })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Candidate Report" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  if (isError || !bundle) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Report not available"
        description="The analysis for this interview isn't ready yet. If it's still processing, check back in a moment."
        action={
          <Button asChild variant="outline">
            <Link to="/admin/candidates">Back to candidates</Link>
          </Button>
        }
      />
    )
  }

  const scores = bundle.scores
  const radarData = SCORE_LABELS.filter((s) => scores && scores[s.key as keyof typeof scores] !== undefined).map((s) => ({
    axis: s.label,
    score: Math.round((scores?.[s.key as keyof typeof scores] as number) ?? 0),
  }))

  const report = bundle.report
  const transcript = bundle.transcript

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta?.candidate_name ?? 'Candidate Report'}
        description={meta?.candidate_email ?? interviewId}
        actions={
          <Button
            variant="outline"
            onClick={() => reportPdfMutation.mutate(interviewId!)}
            loading={reportPdfMutation.isPending}
          >
            <Download />
            Download report
          </Button>
        }
      />

      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/candidates">
            <ArrowLeft />
            Back to candidates
          </Link>
        </Button>
        {meta && <Badge variant="secondary">{meta.job_title}</Badge>}
        {meta && <StatusBadge status={meta.status} />}
        {bundle.recommendation && <RecommendationBadge verdict={bundle.recommendation.verdict} />}
        {meta?.duration_seconds ? (
          <Badge variant="outline">{formatDuration(meta.duration_seconds)}</Badge>
        ) : null}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <Card>
              <CardContent className="flex flex-col items-center p-8">
                <CircularProgress
                  value={scores?.overall_score ?? 0}
                  size={190}
                  strokeWidth={14}
                  color={scoreColor(scores?.overall_score ?? 0)}
                  label="Overall score"
                />
                <div className="mt-6 grid w-full grid-cols-2 gap-3">
                  <div className="rounded-xl bg-muted/60 p-3 text-center">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                    <p className="mt-0.5 font-semibold capitalize text-foreground">{meta?.status.replace(/_/g, ' ') ?? '—'}</p>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3 text-center">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Progress</p>
                    <p className="mt-0.5 font-semibold text-foreground">{Math.round(progress?.progress ?? 0)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Score breakdown</CardTitle>
              </CardHeader>
              <CardContent className="h-[360px]">
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius="80%">
                      <PolarGrid stroke="currentColor" className="text-slate-300 dark:text-slate-600" />
                      <PolarAngleAxis dataKey="axis" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="score" stroke="#2563EB" fill="#2563EB" fillOpacity={0.4} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Scores not available.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-dimension bars */}
          {scores && (
            <Card>
              <CardHeader>
                <CardTitle>Dimension scores</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={radarData} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" className="text-slate-200 dark:text-slate-700" stroke="currentColor" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis type="category" dataKey="axis" width={110} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      cursor={{ fill: 'rgb(37 99 235 / 0.06)' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid rgb(226 232 240)', fontSize: 12, background: 'var(--card)' }}
                      formatter={(value: number | string) => [`${value} / 100`, 'Score']}
                    />
                    <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                      {radarData.map((entry) => (
                        <Cell key={entry.axis} fill={scoreColor(entry.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Strengths & weaknesses */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bundle.strengths.length > 0 ? (
                  <ul className="space-y-3">
                    {bundle.strengths.map((strength, i) => (
                      <li key={i} className="flex items-start gap-3 rounded-xl bg-success/5 p-3 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        {strength}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No strengths identified yet.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  Areas for improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bundle.weaknesses.length > 0 ? (
                  <ul className="space-y-3">
                    {bundle.weaknesses.map((weakness, i) => (
                      <li key={i} className="flex items-start gap-3 rounded-xl bg-destructive/5 p-3 text-sm text-muted-foreground">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        {weakness}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No weaknesses identified yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Executive summary */}
          {report && (
            <Card>
              <CardContent className="space-y-4 p-6">
                <h3 className="font-display text-lg font-bold text-foreground">Executive summary</h3>
                <p className="leading-relaxed text-muted-foreground">{report.executive_summary}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="evaluation" className="mt-0 space-y-6">
          {report ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Interview overview" text={report.interview_overview} />
              <SectionCard title="Candidate overview" text={report.candidate_overview} />
              <SectionCard title="Technical assessment" text={report.technical_assessment} />
              <SectionCard title="Communication assessment" text={report.communication_assessment} />
              <SectionCard title="Confidence assessment" text={report.confidence_assessment} />
              <SectionCard title="Problem solving assessment" text={report.problem_solving_assessment} />
              <SectionCard title="Experience assessment" text={report.experience_assessment} />
              <SectionCard title="Performance analysis" text={report.performance_analysis} />
              <div className="lg:col-span-2">
                <SectionCard title="Improvement suggestions" text={report.improvement_suggestions} />
              </div>
            </div>
          ) : (
            <EmptyState icon={FileText} title="Evaluation not generated yet" description="The report will appear here once the AI evaluation completes." />
          )}
        </TabsContent>

        <TabsContent value="transcript" className="mt-0">
          {transcript ? (
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Badge variant="secondary">Source: {transcript.source}</Badge>
                  <Badge variant="secondary">Language: {transcript.language}</Badge>
                  {transcript.confidence > 0 && (
                    <Badge variant="secondary">Confidence: {Math.round(transcript.confidence * 100)}%</Badge>
                  )}
                </div>
                <div className="max-h-[560px] space-y-3 overflow-y-auto pr-3">
                  {transcript.segments && transcript.segments.length > 0 ? (
                    transcript.segments.map((segment, i) => (
                      <div key={i} className="rounded-xl bg-muted/50 p-3.5">
                        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-primary">
                          {segment.speaker && <span>{segment.speaker}</span>}
                          <span className="text-muted-foreground">
                            {Math.floor(segment.start / 60)}:{String(Math.round(segment.start % 60)).padStart(2, '0')} –{' '}
                            {Math.floor(segment.end / 60)}:{String(Math.round(segment.end % 60)).padStart(2, '0')}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground">{segment.text}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm leading-relaxed text-muted-foreground">{transcript.full_text || 'Transcript is empty.'}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState icon={FileText} title="No transcript yet" description="The transcript will appear once transcription completes." />
          )}
        </TabsContent>

        <TabsContent value="insights" className="mt-0 space-y-6">
          {/* Recommendation override */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Recommendation override
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {VERDICTS.map((verdict) => (
                  <button
                    key={verdict}
                    onClick={() => setOverrideVerdict(verdict)}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                      overrideVerdict === verdict
                        ? verdict === 'Recommended'
                          ? 'border-success bg-success/10 text-success'
                          : verdict === 'Not Recommended'
                            ? 'border-destructive bg-destructive/10 text-destructive'
                            : 'border-warning bg-warning/10 text-warning'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {verdict}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <label htmlFor="override-reason" className="text-xs font-medium text-muted-foreground">
                    Reason (optional)
                  </label>
                  <input
                    id="override-reason"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Why is this verdict changing?"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <Button onClick={() => overrideMutation.mutate()} loading={overrideMutation.isPending}>
                  Apply override
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Speech analysis */}
          {bundle.speech_analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Speech analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {[
                    { label: 'Speaking rate', value: `${Math.round(bundle.speech_analysis.speaking_rate)} WPM` },
                    { label: 'Avg pause', value: `${bundle.speech_analysis.avg_pause_seconds.toFixed(1)}s` },
                    { label: 'Total pauses', value: bundle.speech_analysis.total_pauses },
                    { label: 'Clarity', value: `${Math.round(bundle.speech_analysis.clarity * 100)}%` },
                    { label: 'Fluency', value: `${Math.round(bundle.speech_analysis.fluency * 100)}%` },
                    { label: 'Energy', value: `${Math.round(bundle.speech_analysis.energy * 100)}%` },
                    { label: 'Tone', value: bundle.speech_analysis.tone },
                    { label: 'Emotion', value: bundle.speech_analysis.emotion },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-muted/50 p-4">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                      <p className="mt-1 font-display text-lg font-bold capitalize text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
                {bundle.speech_analysis.notes && (
                  <p className="mt-4 text-sm text-muted-foreground">{bundle.speech_analysis.notes}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sentiment analysis */}
          {bundle.sentiment_analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Sentiment analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-muted/50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sentiment</p>
                    <p className="mt-1 font-display text-lg font-bold capitalize text-foreground">{bundle.sentiment_analysis.sentiment}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Emotion</p>
                    <p className="mt-1 font-display text-lg font-bold capitalize text-foreground">{bundle.sentiment_analysis.emotion}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Professionalism</p>
                    <p className="mt-1 font-display text-lg font-bold text-foreground">
                      {Math.round(bundle.sentiment_analysis.professionalism * 100)}%
                    </p>
                  </div>
                </div>
                {bundle.sentiment_analysis.summary && (
                  <p className="mt-4 text-sm text-muted-foreground">{bundle.sentiment_analysis.summary}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Technical evaluation */}
          {bundle.technical_evaluation && Object.keys(bundle.technical_evaluation).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Technical evaluation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(bundle.technical_evaluation).map(([key, value]) => (
                    <div key={key} className="rounded-xl bg-muted/50 p-4">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="mt-1 text-sm font-medium capitalize text-foreground">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => regenerateMutation.mutate(interviewId!)} loading={regenerateMutation.isPending}>
              <RefreshCw />
              Regenerate evaluation
            </Button>
            {progress?.status === 'failed' && (
              <Button variant="destructive" onClick={() => adminApi.process(interviewId!).then(() => toast.success('Processing restarted'))}>
                <Loader2 />
                Retry processing
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
