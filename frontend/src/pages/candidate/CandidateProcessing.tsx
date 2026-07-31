import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Upload,
  FileText,
  Brain,
  LineChart,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Clock,
  Inbox,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Progress } from '@/components/ui'
import { PageHeader, StatusBadge } from '@/components/shared'
import { useInterviewStatus } from '@/hooks'
import type { InterviewStatusValue } from '@/types'

/**
 * The three candidate-visible interview states.
 *
 * Determined ONLY from backend data:
 *  - PENDING    -> no interview record exists for the candidate
 *  - IN_REVIEW  -> interview exists but processing has not finished
 *  - COMPLETED  -> backend status is "completed" (result is ready)
 */
type CandidateState = 'pending' | 'in_review' | 'completed'

const STAGE_STEPS: { stage: string; label: string; icon: typeof Upload; progress: number }[] = [
  { stage: 'uploaded', label: 'Uploaded', icon: Upload, progress: 10 },
  { stage: 'transcribing', label: 'Transcribing', icon: FileText, progress: 30 },
  { stage: 'speech_analysis', label: 'Speech Analysis', icon: Brain, progress: 50 },
  { stage: 'ai_evaluation', label: 'AI Evaluation', icon: LineChart, progress: 70 },
  { stage: 'pdf_generated', label: 'PDF Generation', icon: FileText, progress: 90 },
  { stage: 'completed', label: 'Completed', icon: Trophy, progress: 100 },
]

/** Fully completed pipeline steps (labels per the candidate-facing spec). */
const COMPLETED_STEPS = [
  'Uploaded',
  'Transcript Generated',
  'Speech Analysis',
  'AI Evaluation',
  'PDF Generated',
  'Completed',
]

/** Map a backend status to the furthest completed pipeline step. */
function stageIndex(status: InterviewStatusValue | undefined): number {
  if (status === 'completed') return STAGE_STEPS.length - 1
  if (!status) return 0
  const idx = STAGE_STEPS.findIndex((s) => status.toLowerCase().includes(s.stage))
  return idx >= 0 ? idx : 1
}

export function CandidateProcessing() {
  const navigate = useNavigate()
  const { data: status, isLoading, isError, refetch, isFetching } = useInterviewStatus()

  // Derive the candidate-visible state strictly from backend data.
  let state: CandidateState = 'pending'
  if (status) {
    state = status.status === 'completed' ? 'completed' : 'in_review'
  }

  // Real-time sync: poll while the interview is processing. When it flips to
  // completed the page updates automatically (the hook re-fetches every 5s).
  useEffect(() => {
    if (state === 'completed') {
      toast.success('Your interview report is ready!')
    }
  }, [state])

  const current = stageIndex(status?.status)
  const activeStep = STAGE_STEPS[current]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Interview Status" />
        <Card>
          <CardContent className="flex flex-col items-center gap-6 p-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // PENDING — no interview record exists yet.
  if (isError || !status || state === 'pending') {
    return (
      <div className="space-y-6">
        <PageHeader title="Interview Status" description="Track your interview evaluation." />
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
              <div className="mt-5 flex items-center gap-2">
                <StatusBadge status="pending" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-foreground">Interview Pending</h2>
              <p className="mt-1 text-sm text-muted-foreground">Waiting for interview upload.</p>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                No interview has been uploaded yet. Please wait until the recruiter uploads your
                interview.
              </p>
              {isError && (
                <Button variant="outline" className="mt-6" onClick={() => refetch()} loading={isFetching}>
                  Retry
                </Button>
              )}
            </motion.div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status.status === 'failed') {
    return (
      <div className="space-y-6">
        <PageHeader title="Interview Status" />
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </span>
            <h2 className="font-display text-xl font-bold text-foreground">Processing Failed</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {status.failure_reason || status.error_message || 'The interview could not be processed.'}
            </p>
            <p className="text-xs text-muted-foreground">
              Contact your recruiter to re-upload the recording.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // COMPLETED — backend status is "completed".
  if (state === 'completed') {
    return (
      <div className="space-y-6">
        <PageHeader title="Interview Status" description="Your evaluation is complete." />
        <Card>
          <CardContent className="flex flex-col items-center p-8 text-center sm:p-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex w-full max-w-xl flex-col items-center"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <div className="mt-5 flex items-center gap-2">
                <StatusBadge status="completed" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-foreground">Completed</h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                Your interview evaluation has been completed successfully. Click “View Results” to
                see your complete AI evaluation.
              </p>

              {/* Completed pipeline timeline */}
              <div className="mt-8 w-full space-y-3 rounded-2xl border border-border/60 bg-muted/40 p-5 text-left">
                {COMPLETED_STEPS.map((label, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-white">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                  </motion.div>
                ))}
                <div className="pt-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-success to-emerald-400" />
                  </div>
                  <p className="mt-1.5 text-right text-xs font-medium text-success">100% complete</p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button onClick={() => navigate('/dashboard/results')}>
                  <Trophy />
                  View Results
                </Button>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // IN REVIEW — interview exists, processing in progress.
  return (
    <div className="space-y-6">
      <PageHeader
        title="Interview Status"
        description="Our AI is evaluating your interview."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Progress checklist */}
        <Card>
          <CardContent className="p-8">
            <div className="space-y-5">
              {STAGE_STEPS.map((step, i) => {
                const done = i < current
                const active = i === current
                return (
                  <motion.div
                    key={step.stage}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-4"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                        done
                          ? 'bg-success text-white'
                          : active
                            ? 'bg-primary text-white shadow-glow'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : active ? (
                        <step.icon className="h-5 w-5 animate-pulse" />
                      ) : (
                        <step.icon className="h-5 w-5" />
                      )}
                    </span>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-semibold ${
                          done ? 'text-foreground' : active ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {step.label}
                      </p>
                      {active && <Progress value={step.progress} className="mt-2 h-1.5" />}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Status card */}
        <Card className="h-fit">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="relative">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/30" />
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </span>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <StatusBadge status="processing" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-foreground">In Review</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Our AI is currently evaluating your interview. Results will appear automatically once
              processing has completed.
            </p>
            <Progress
              value={activeStep.progress}
              className="mt-6 h-2"
              indicatorClassName="bg-gradient-to-r from-primary to-blue-400"
            />
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              {activeStep.progress}% complete
            </p>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              You can close this page and check back later.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
