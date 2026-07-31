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
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Progress } from '@/components/ui'
import { EmptyState, PageHeader } from '@/components/shared'
import { useInterviewStatus } from '@/hooks'
import { getErrorMessage } from '@/services/api'

const STAGE_STEPS: { stage: string; label: string; icon: typeof Upload; progress: number }[] = [
  { stage: 'uploaded', label: 'Uploaded', icon: Upload, progress: 10 },
  { stage: 'transcribing', label: 'Transcribing audio', icon: FileText, progress: 30 },
  { stage: 'speech_analysis', label: 'Speech analysis', icon: Brain, progress: 50 },
  { stage: 'ai_evaluation', label: 'AI evaluation', icon: LineChart, progress: 70 },
  { stage: 'pdf_generated', label: 'Generating PDF', icon: FileText, progress: 90 },
  { stage: 'completed', label: 'Completed', icon: Trophy, progress: 100 },
]

function stageIndex(stage: string): number {
  const idx = STAGE_STEPS.findIndex((s) => stage.toLowerCase().includes(s.stage))
  return idx >= 0 ? idx : 1
}

export function CandidateProcessing() {
  const navigate = useNavigate()
  const { data: status, isLoading, isError, error, refetch, isFetching } = useInterviewStatus()

  // Poll the status endpoint every 5 seconds while processing.
  useEffect(() => {
    if (status && status.status === 'completed') {
      toast.success('Your interview report is ready!')
      const t = setTimeout(() => navigate('/dashboard/results'), 1200)
      return () => clearTimeout(t)
    }
  }, [status, navigate])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Processing Your Interview" />
        <Card>
          <CardContent className="flex flex-col items-center gap-6 p-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError || !status) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load status"
        description={getErrorMessage(error)}
        action={
          <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
            Retry
          </Button>
        }
      />
    )
  }

  if (status.status === 'failed') {
    return (
      <div className="space-y-6">
        <PageHeader title="Processing Failed" />
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </span>
            <h2 className="font-display text-xl font-bold text-foreground">Something went wrong</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {status.failure_reason || status.error_message || 'The interview could not be processed.'}
            </p>
            <Button onClick={() => navigate('/upload')}>Upload again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const current = stageIndex(status.status)
  const activeStep = STAGE_STEPS[current]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Processing Your Interview"
        description="Hang tight — our AI is analyzing your responses."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Progress checklist */}
        <Card>
          <CardContent className="p-8">
            <div className="space-y-5">
              {STAGE_STEPS.map((step, i) => {
                const done = i < current || status.status === 'completed'
                const active = i === current && status.status !== 'completed'
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
                      {done ? <CheckCircle2 className="h-5 w-5" /> : active ? <step.icon className="h-5 w-5 animate-pulse" /> : <step.icon className="h-5 w-5" />}
                    </span>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${done ? 'text-foreground' : active ? 'text-primary' : 'text-muted-foreground'}`}>
                        {step.label}
                      </p>
                      {active && (
                        <Progress value={step.progress} className="mt-2 h-1.5" />
                      )}
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
            <h3 className="mt-6 font-display text-lg font-bold text-foreground">
              {status.status === 'completed' ? 'Completed!' : activeStep.label}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {status.status === 'completed'
                ? 'Your report is ready.'
                : 'This usually takes a few minutes. You can close this page and check back later.'}
            </p>
            <Progress value={activeStep.progress} className="mt-6 h-2" indicatorClassName="bg-gradient-to-r from-primary to-blue-400" />
            <p className="mt-2 text-xs font-medium text-muted-foreground">{activeStep.progress}% complete</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
