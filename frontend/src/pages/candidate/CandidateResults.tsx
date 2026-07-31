import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts'
import {
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Sparkles,
  RefreshCw,
  Video,
  Trophy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { CircularProgress, EmptyState, PageHeader, RecommendationBadge } from '@/components/shared'
import { useInterviewResult } from '@/hooks'
import { candidateApi, getErrorMessage } from '@/services/api'
import { formatDuration } from '@/lib/utils'

const SCORE_LABELS: { key: string; label: string }[] = [
  { key: 'technical_skills', label: 'Technical' },
  { key: 'communication', label: 'Communication' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'problem_solving', label: 'Problem Solving' },
  { key: 'relevant_experience', label: 'Experience' },
  { key: 'professionalism', label: 'Professionalism' },
]

function scoreColor(score: number): string {
  if (score >= 70) return '#22C55E'
  if (score >= 50) return '#F59E0B'
  return '#EF4444'
}

export function CandidateResults() {
  const navigate = useNavigate()
  const [downloading, setDownloading] = useState(false)

  const { data: result, isLoading, isError, refetch, isFetching } = useInterviewResult()

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
        <PageHeader title="Interview Results" />
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  if (isError || !result) {
    return (
      <EmptyState
        icon={FileText}
        title="No results yet"
        description="Your interview results aren't ready yet, or you haven't completed an interview. Processing usually takes a few minutes."
        action={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
              <RefreshCw />
              Retry
            </Button>
            <Button onClick={() => navigate('/dashboard')}>
              <Video />
              View interview status
            </Button>
          </div>
        }
      />
    )
  }

  const scores = result.scores
  const radarData = SCORE_LABELS.filter((s) => scores && scores[s.key as keyof typeof scores] !== undefined).map((s) => ({
    axis: s.label,
    score: Math.round((scores?.[s.key as keyof typeof scores] as number) ?? 0),
  }))

  const transcriptSegments = result.transcript ? result.transcript.split(/\n+/).filter(Boolean) : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interview Results"
        description="Your AI-generated evaluation report."
        actions={
          <Button onClick={handleDownloadPdf} loading={downloading} disabled={!result.pdf}>
            <Download />
            Download PDF
          </Button>
        }
      />

      {/* Verdict banner */}
      {result.recommendation && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-4 rounded-2xl border p-5 ${
            result.recommendation.verdict === 'Recommended'
              ? 'border-success/30 bg-success/5'
              : result.recommendation.verdict === 'Not Recommended'
                ? 'border-destructive/30 bg-destructive/5'
                : 'border-warning/30 bg-warning/5'
          }`}
        >
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              result.recommendation.verdict === 'Recommended'
                ? 'bg-success/15 text-success'
                : result.recommendation.verdict === 'Not Recommended'
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-warning/15 text-warning'
            }`}
          >
            {result.recommendation.verdict === 'Recommended' ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : result.recommendation.verdict === 'Not Recommended' ? (
              <XCircle className="h-6 w-6" />
            ) : (
              <Trophy className="h-6 w-6" />
            )}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold text-foreground">Recommendation</h2>
              <RecommendationBadge verdict={result.recommendation.verdict} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{result.recommendation.message}</p>
          </div>
        </motion.div>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="report">Detailed Report</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            {/* Score card */}
            <Card>
              <CardContent className="flex flex-col items-center p-8">
                <CircularProgress
                  value={scores?.overall_score ?? 0}
                  size={200}
                  strokeWidth={14}
                  color={scoreColor(scores?.overall_score ?? 0)}
                  label="Overall score"
                />
                <div className="mt-6 grid w-full grid-cols-2 gap-3">
                  <div className="rounded-xl bg-muted/60 p-3 text-center">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Candidate</p>
                    <p className="mt-0.5 truncate font-semibold text-foreground">{result.candidate_name}</p>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3 text-center">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Duration</p>
                    <p className="mt-0.5 font-semibold text-foreground">{formatDuration(result.duration_seconds)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Radar chart */}
            <Card>
              <CardHeader>
                <CardTitle>Score breakdown</CardTitle>
              </CardHeader>
              <CardContent className="h-[340px]">
                {scores ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius="78%">
                      <PolarGrid stroke="currentColor" className="text-slate-300 dark:text-slate-600" />
                      <PolarAngleAxis dataKey="axis" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="score" stroke="#2563EB" fill="#2563EB" fillOpacity={0.4} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Scores not available yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-dimension scores */}
          {scores && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SCORE_LABELS.map((s) => {
                const value = scores[s.key as keyof typeof scores] as number | undefined
                if (value === undefined) return null
                return (
                  <Card key={s.key} className="card-hover">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                        <span className="font-display text-lg font-bold" style={{ color: scoreColor(value) }}>
                          {Math.round(value)}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${value}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: scoreColor(value) }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="report" className="mt-0">
          {result.report ? (
            <div className="space-y-6">
              <Card>
                <CardContent className="space-y-4 p-6">
                  <h3 className="font-display text-lg font-bold text-foreground">Executive summary</h3>
                  <p className="leading-relaxed text-muted-foreground">{result.report.executive_summary}</p>
                  <h3 className="pt-2 font-display text-lg font-bold text-foreground">Interview overview</h3>
                  <p className="leading-relaxed text-muted-foreground">{result.report.interview_overview}</p>
                  <h3 className="pt-2 font-display text-lg font-bold text-foreground">Candidate overview</h3>
                  <p className="leading-relaxed text-muted-foreground">{result.report.candidate_overview}</p>
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                {[
                  { title: 'Technical assessment', text: result.report.technical_assessment },
                  { title: 'Communication assessment', text: result.report.communication_assessment },
                  { title: 'Confidence assessment', text: result.report.confidence_assessment },
                  { title: 'Problem solving assessment', text: result.report.problem_solving_assessment },
                  { title: 'Experience assessment', text: result.report.experience_assessment },
                  { title: 'Performance analysis', text: result.report.performance_analysis },
                ].map((section) => (
                  <Card key={section.title}>
                    <CardContent className="p-6">
                      <h4 className="font-display text-base font-bold text-foreground">{section.title}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.text}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon={FileText} title="Report not generated yet" description="Check back soon." />
          )}
        </TabsContent>

        <TabsContent value="transcript" className="mt-0">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Strengths / weaknesses */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.strengths.length > 0 ? (
                    <ul className="space-y-3">
                      {result.strengths.map((strength, i) => (
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
                  {result.weaknesses.length > 0 ? (
                    <ul className="space-y-3">
                      {result.weaknesses.map((weakness, i) => (
                        <li key={i} className="flex items-start gap-3 rounded-xl bg-destructive/5 p-3 text-sm text-muted-foreground">
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No improvement areas identified yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-warning" />
                    Improvement suggestions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {result.report?.improvement_suggestions ?? 'Not available yet.'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Transcript */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Interview transcript
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[520px] space-y-3 overflow-y-auto pr-3">
                {transcriptSegments.length > 0 ? (
                  transcriptSegments.map((segment, i) => (
                    <div key={i} className="rounded-xl bg-muted/50 p-3.5">
                      <p className="text-sm leading-relaxed text-foreground">{segment}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Transcript is empty.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
