import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  ClipboardCheck,
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
import {
  CircularProgress,
  EmptyState,
  PageHeader,
  RecommendationBadge,
  StatusBadge,
  AdminStatusBadge,
  ReadingHighlighter,
  SoundWaveButton,
} from '@/components/shared'
import { useAdminAnalysis, useAdminInterviewMeta, useAdminProgress, queryKeys } from '@/hooks'
import { useAutoScroll } from '@/hooks'
import { useVoice } from '@/hooks/useVoice'
import { buildReadingDocument } from '@/services/readingEngine'
import { adminApi, getErrorMessage, getToken } from '@/services/api'
import { cn, formatDuration } from '@/lib/utils'

const ADMIN_STATUSES = [
  'Pending',
  'Processing',
  'Completed',
  'Recommended',
  'Not Recommended',
  'Need Further Review',
  'Rejected',
  'Selected',
]

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

function SectionCard({
  title,
  text,
  activeWord,
  highlighted,
  onActiveWordRef,
}: {
  title: string
  text?: string
  /** Index of the word currently being spoken within this section. */
  activeWord?: number
  /** Whether this section is the one being read right now. */
  highlighted?: boolean
  /** Ref callback for the active word (auto-scroll target). */
  onActiveWordRef?: (el: HTMLElement | null) => void
}) {
  if (!text) return null
  return (
    <Card
      className={highlighted ? 'border-primary/40 ring-1 ring-primary/15' : undefined}
    >
      <CardContent className="p-6">
        <h4 className="font-display text-base font-bold text-foreground">{title}</h4>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {activeWord !== undefined && activeWord >= 0 ? (
            <ReadingHighlighter text={text} activeWordIndex={activeWord} onActiveWordRef={onActiveWordRef} />
          ) : (
            text
          )}
        </p>
      </CardContent>
    </Card>
  )
}

export function AdminCandidateDetail() {
  const { interviewId } = useParams<{ interviewId: string }>()
  const queryClient = useQueryClient()
  const [overrideVerdict, setOverrideVerdict] = useState<(typeof VERDICTS)[number]>('Recommended')
  const [overrideReason, setOverrideReason] = useState('')

  const { data: meta } = useAdminInterviewMeta(interviewId)
  const { data: progress } = useAdminProgress(interviewId)
  const { data: bundle, isLoading, isError } = useAdminAnalysis(interviewId)

  // ---------------------------------------------------------------------------
  // ALL hooks must run unconditionally — the loading/error returns below are
  // conditional, so no hook may appear after them (React Rules of Hooks).
  // ---------------------------------------------------------------------------
  const report = bundle?.report
  const transcript = bundle?.transcript
  const scores = bundle?.scores

  const radarData = SCORE_LABELS.filter((s) => scores && scores[s.key as keyof typeof scores] !== undefined).map((s) => ({
    axis: s.label,
    score: Math.round((scores?.[s.key as keyof typeof scores] as number) ?? 0),
  }))

  // Structured reading document — sections + words for synchronized reading.
  const readingDoc = useMemo(
    () =>
      buildReadingDocument({
        executiveSummary: report?.executive_summary,
        strengths: bundle?.strengths ?? [],
        weaknesses: bundle?.weaknesses ?? [],
        interviewOverview: report?.interview_overview,
        candidateOverview: report?.candidate_overview,
        technicalAssessment: report?.technical_assessment,
        communicationAssessment: report?.communication_assessment,
        confidenceAssessment: report?.confidence_assessment,
        problemSolvingAssessment: report?.problem_solving_assessment,
        experienceAssessment: report?.experience_assessment,
        performanceAnalysis: report?.performance_analysis,
        improvementSuggestions: report?.improvement_suggestions,
        transcriptText: transcript?.full_text.slice(0, 4000),
        speechNotes: bundle?.speech_analysis?.notes,
        sentimentSummary: bundle?.sentiment_analysis?.summary,
        recommendationReason: bundle?.recommendation?.reason,
        technicalEvaluation: bundle?.technical_evaluation
          ? Object.fromEntries(
              Object.entries(bundle.technical_evaluation).map(([k, v]) => [k, String(v)]),
            )
          : undefined,
      }),
    [report, bundle, transcript],
  )

  // Tab state — reading stays on the current tab, no auto-switching.
  const [activeTab, setActiveTab] = useState('overview')

  // Text to speak — ONLY the sections on the currently active tab, so the
  // reader stays on the page the user is viewing.
  const tabText = useMemo(() => {
    const sections = readingDoc.sections.filter((s) => s.tab === activeTab)
    return sections.map((s) => s.text).join(' ')
  }, [readingDoc, activeTab])
  const reportText = tabText

  const voice = useVoice()
  const listeningToReport =
    voice.text === reportText && (voice.state === 'playing' || voice.state === 'paused')
  const currentSentence = voice.currentSentence || ''

  // Current section (for indicator label + highlight).
  // Match by full-text first; fall back to first-word overlap so chunk
  // boundaries (which may differ from the section's sentence splits) still
  // resolve to the right section.
  const activeSection = useMemo(() => {
    if (!currentSentence) return null
    const direct = readingDoc.sections.find((s) => s.text.includes(currentSentence))
    if (direct) return direct
    const firstWord = currentSentence.match(/\S+/)?.[0]
    if (!firstWord) return null
    return (
      readingDoc.sections.find((s) => s.text.includes(firstWord)) ?? null
    )
  }, [currentSentence, readingDoc])

  // Word index within the current section for highlighting.
  // Uses the ABSOLUTE word index across the spoken text (globalWordIndex)
  // minus the section's starting word offset — deterministic across chunk
  // boundaries, so it works for every tab (Overview/Evaluation/Transcript).
  const activeWordInSection = useMemo(() => {
    if (!activeSection || voice.globalWordIndex < 0) return -1
    // Find section start by scanning: section text appears once in tabText.
    const sectionStart = tabText.indexOf(activeSection.text)
    const prefixWords = tabText.slice(0, sectionStart).match(/\S+/g)?.length ?? 0
    return voice.globalWordIndex - prefixWords
  }, [activeSection, voice.globalWordIndex, tabText])

  // If the user switches tabs mid-reading, restart speech for the new tab.
  useEffect(() => {
    if (!listeningToReport) return
    voice.stop()
    if (tabText.trim()) void voice.speak(tabText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Auto-scroll: keep the ACTIVE WORD centered while reading (word-level
  // tracking so the highlighted word never disappears off-screen).
  const [activeWordEl, setActiveWordEl] = useState<HTMLElement | null>(null)
  useAutoScroll(activeWordEl, Boolean(activeWordEl) && voice.state === 'playing')

  const sectionEls = useRef(new Map<string, HTMLDivElement>())
  const setSectionEl = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) sectionEls.current.set(id, el)
    else sectionEls.current.delete(id)
  }, [])

  // Build reading props for a section card: active word + highlight state.
  const readingProps = useCallback(
    (tab: string, label: string, text: string | undefined) => {
      if (!text) return { activeWord: undefined as number | undefined, highlighted: false }
      const section = readingDoc.sections.find(
        (s) => s.tab === tab && s.label === label && s.text === text,
      )
      const isActive = activeSection?.id === section?.id && listeningToReport
      return {
        activeWord: isActive ? activeWordInSection : -1,
        highlighted: isActive,
        onActiveWordRef: isActive ? setActiveWordEl : undefined,
      }
    },
    [readingDoc, activeSection, listeningToReport, activeWordInSection],
  )

  // Auto-scroll target element for the active section.
  useEffect(() => {
    if (!activeSection) return
    const el = sectionEls.current.get(activeSection.id)
    if (el) {
      setActiveWordEl(el)
    }
  }, [activeSection])

  // Positional mapping for the transcript: each segment's word range inside
  // the full transcript text. Deterministic — matches by word position, not
  // by string comparison, so every segment highlights correctly.
  const transcriptSegments = useMemo(() => {
    if (!transcript?.segments?.length) return []
    const section = readingDoc.sections.find((s) => s.tab === 'transcript')
    if (!section) return []
    let cursor = 0
    return transcript.segments.map((segment) => {
      const segWords = (segment.text || '').match(/\S+/g) ?? []
      const start = cursor
      const end = cursor + segWords.length
      cursor = end
      return { segment, start, end }
    })
  }, [transcript, readingDoc])

  // POST-based download — download managers (IDM) only hijack GET requests,
  // so the PDF always reaches the browser as a normal blob download.
  const downloadPdf = useMutation({
    mutationFn: async ({ id, url }: { id: string; url: string }) => {
      const token = getToken()
      const res = await fetch(url, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok) {
        let detail = `PDF request failed (${res.status})`
        try {
          const data = await res.json()
          detail = data?.detail ?? detail
        } catch {
          /* non-JSON error body */
        }
        throw new Error(detail)
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `HireLens-Report-${meta?.candidate_name ?? id}.pdf`
      a.click()
      URL.revokeObjectURL(objectUrl)
      return id
    },
    onSuccess: (_, vars) => {
      toast.success(vars.url.includes('regenerate') ? 'PDF regenerated from stored results' : 'Report downloaded')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : getErrorMessage(error)),
  })

  const regenerateMutation = useMutation({
    mutationFn: (id: string) => adminApi.regenerate(id),
    onSuccess: () => {
      toast.success('Regeneration started — the evaluation will be rebuilt.')
      queryClient.invalidateQueries({ queryKey: queryKeys.adminProgress(interviewId ?? '') })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => adminApi.updateStatus(interviewId!, status),
    onSuccess: (res) => {
      toast.success(res.data.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.adminInterviews })
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta?.candidate_name ?? 'Candidate Report'}
        description={meta?.candidate_email ?? interviewId}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => downloadPdf.mutate({ id: interviewId!, url: adminApi.regenerateReportPdfUrl(interviewId!) })}
              loading={downloadPdf.isPending}
            >
              <RefreshCw />
              Regenerate PDF
            </Button>
            {/* Sound-wave read button — no floating player, just clean word
                highlighting while the report is spoken. */}
            <SoundWaveButton
              speaking={listeningToReport && voice.state === 'playing'}
              paused={listeningToReport && voice.state === 'paused'}
              ready={voice.state === 'loading' && voice.text === reportText}
              onClick={() => {
                if (listeningToReport) {
                  voice.state === 'playing' ? voice.pause() : voice.resume()
                } else {
                  void voice.speak(reportText)
                }
              }}
            />
            <Button
              onClick={() => downloadPdf.mutate({ id: interviewId!, url: adminApi.reportPdfUrl(interviewId!) })}
              loading={downloadPdf.isPending}
            >
              <Download />
              Download report
            </Button>
          </div>
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
        {meta && <AdminStatusBadge status={meta.admin_status} />}
        {bundle.recommendation && <RecommendationBadge verdict={bundle.recommendation.verdict} />}
        {meta?.duration_seconds ? (
          <Badge variant="outline">{formatDuration(meta.duration_seconds)}</Badge>
        ) : null}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
            <Card
              ref={(el) => setSectionEl('overview-strengths', el)}
              className={readingProps('overview', 'Strengths', bundle.strengths.join('. ')).highlighted ? 'border-primary/40 ring-1 ring-primary/15' : undefined}
            >
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
                      <li
                        key={i}
                        className={cn(
                          'flex items-start gap-3 rounded-xl bg-success/5 p-3 text-sm text-muted-foreground transition-colors',
                          currentSentence && strength.includes(currentSentence) && 'bg-success/15 ring-1 ring-success/40',
                        )}
                      >
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
            <Card
              ref={(el) => setSectionEl('overview-areas-for-improvement', el)}
              className={readingProps('overview', 'Areas for Improvement', bundle.weaknesses.join('. ')).highlighted ? 'border-primary/40 ring-1 ring-primary/15' : undefined}
            >
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
                      <li
                        key={i}
                        className={cn(
                          'flex items-start gap-3 rounded-xl bg-destructive/5 p-3 text-sm text-muted-foreground transition-colors',
                          currentSentence && weakness.includes(currentSentence) && 'bg-destructive/15 ring-1 ring-destructive/40',
                        )}
                      >
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
          {report && (() => {
            const props = readingProps('overview', 'Executive Summary', report.executive_summary)
            return (
              <Card
                ref={(el) => setSectionEl('overview-executive-summary', el)}
                className={props.highlighted ? 'border-primary/50 ring-1 ring-primary/20' : undefined}
              >
                <CardContent className="space-y-4 p-6">
                  <h3 className="font-display text-lg font-bold text-foreground">Executive summary</h3>
                  <p className="leading-relaxed text-muted-foreground">
                    {props.activeWord !== undefined && props.activeWord >= 0 ? (
                      <ReadingHighlighter text={report.executive_summary} activeWordIndex={props.activeWord} onActiveWordRef={props.onActiveWordRef} />
                    ) : (
                      report.executive_summary
                    )}
                  </p>
                </CardContent>
              </Card>
            )
          })()}
        </TabsContent>

        <TabsContent value="evaluation" className="mt-0 space-y-6">
          {report ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Interview overview" text={report.interview_overview} {...readingProps('evaluation', 'Interview Overview', report.interview_overview)} />
              <SectionCard title="Candidate overview" text={report.candidate_overview} {...readingProps('evaluation', 'Candidate Overview', report.candidate_overview)} />
              <SectionCard title="Technical assessment" text={report.technical_assessment} {...readingProps('evaluation', 'Technical Assessment', report.technical_assessment)} />
              <SectionCard title="Communication assessment" text={report.communication_assessment} {...readingProps('evaluation', 'Communication Assessment', report.communication_assessment)} />
              <SectionCard title="Confidence assessment" text={report.confidence_assessment} {...readingProps('evaluation', 'Confidence Assessment', report.confidence_assessment)} />
              <SectionCard title="Problem solving assessment" text={report.problem_solving_assessment} {...readingProps('evaluation', 'Problem Solving Assessment', report.problem_solving_assessment)} />
              <SectionCard title="Experience assessment" text={report.experience_assessment} {...readingProps('evaluation', 'Experience Assessment', report.experience_assessment)} />
              <SectionCard title="Performance analysis" text={report.performance_analysis} {...readingProps('evaluation', 'Performance Analysis', report.performance_analysis)} />
              <div className="lg:col-span-2">
                <SectionCard title="Improvement suggestions" text={report.improvement_suggestions} {...readingProps('evaluation', 'Improvement Suggestions', report.improvement_suggestions)} />
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
                  {transcriptSegments.length > 0 ? (
                    transcriptSegments.map(({ segment, start, end }, i) => {
                      // Positional matching: this segment is active when the
                      // current word index falls inside its word range.
                      const segActive = Boolean(
                        activeSection &&
                          activeSection.tab === 'transcript' &&
                          listeningToReport &&
                          activeWordInSection >= start &&
                          activeWordInSection < end,
                      )
                      const segActiveWord = segActive ? activeWordInSection - start : -1

                      return (
                        <div
                          key={i}
                          className={cn(
                            'rounded-xl bg-muted/50 p-3.5 transition-colors',
                            segActive && 'bg-primary/10 ring-1 ring-primary/40',
                          )}
                        >
                          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-primary">
                            {segment.speaker && <span>{segment.speaker}</span>}
                            <span className="text-muted-foreground">
                              {Math.floor(segment.start / 60)}:{String(Math.round(segment.start % 60)).padStart(2, '0')} –{' '}
                              {Math.floor(segment.end / 60)}:{String(Math.round(segment.end % 60)).padStart(2, '0')}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed text-foreground">
                            {segActive && segActiveWord >= 0 ? (
                              <ReadingHighlighter
                                text={segment.text}
                                activeWordIndex={segActiveWord}
                                onActiveWordRef={setActiveWordEl}
                              />
                            ) : (
                              segment.text
                            )}
                          </p>
                        </div>
                      )
                    })
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
          {/* Admin status management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Interview status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Current status:{' '}
                <AdminStatusBadge status={meta?.admin_status ?? 'Pending'} className="ml-1" />
              </p>
              <div className="flex flex-wrap gap-2">
                {ADMIN_STATUSES.map((status) => {
                  const active = (meta?.admin_status ?? 'Pending') === status
                  return (
                    <button
                      key={status}
                      onClick={() => statusMutation.mutate(status)}
                      disabled={statusMutation.isPending}
                      className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      }`}
                    >
                      {status}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

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
                {bundle.speech_analysis.notes && (() => {
                  const props = readingProps('insights', 'Speech Analysis', bundle.speech_analysis.notes)
                  return (
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                      {props.activeWord !== undefined && props.activeWord >= 0 ? (
                        <ReadingHighlighter
                          text={bundle.speech_analysis.notes}
                          activeWordIndex={props.activeWord}
                          onActiveWordRef={props.onActiveWordRef}
                        />
                      ) : (
                        bundle.speech_analysis.notes
                      )}
                    </p>
                  )
                })()}
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
                {bundle.sentiment_analysis.summary && (() => {
                  const props = readingProps('insights', 'Sentiment Analysis', bundle.sentiment_analysis.summary)
                  return (
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                      {props.activeWord !== undefined && props.activeWord >= 0 ? (
                        <ReadingHighlighter
                          text={bundle.sentiment_analysis.summary}
                          activeWordIndex={props.activeWord}
                          onActiveWordRef={props.onActiveWordRef}
                        />
                      ) : (
                        bundle.sentiment_analysis.summary
                      )}
                    </p>
                  )
                })()}
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
                  {Object.entries(bundle.technical_evaluation).map(([key, value]) => {
                    const label = key.replace(/_/g, ' ')
                    const text = String(value)
                    const props = readingProps('insights', `Technical: ${label}`, text)
                    return (
                      <div
                        key={key}
                        className={cn(
                          'rounded-xl bg-muted/50 p-4 transition-colors',
                          props.highlighted && 'bg-primary/10 ring-1 ring-primary/40',
                        )}
                      >
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-medium capitalize text-foreground">
                          {props.activeWord !== undefined && props.activeWord >= 0 ? (
                            <ReadingHighlighter
                              text={text}
                              activeWordIndex={props.activeWord}
                              onActiveWordRef={props.onActiveWordRef}
                            />
                          ) : (
                            text
                          )}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendation reason — read aloud with word highlight */}
          {bundle.recommendation?.reason && (() => {
            const props = readingProps('insights', 'Recommendation', bundle.recommendation.reason)
            return (
              <Card className={props.highlighted ? 'border-primary/40 ring-1 ring-primary/15' : undefined}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Recommendation
                    {bundle.recommendation && (
                      <RecommendationBadge verdict={bundle.recommendation.verdict} />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {props.activeWord !== undefined && props.activeWord >= 0 ? (
                      <ReadingHighlighter
                        text={bundle.recommendation.reason}
                        activeWordIndex={props.activeWord}
                        onActiveWordRef={props.onActiveWordRef}
                      />
                    ) : (
                      bundle.recommendation.reason
                    )}
                  </p>
                </CardContent>
              </Card>
            )
          })()}

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
