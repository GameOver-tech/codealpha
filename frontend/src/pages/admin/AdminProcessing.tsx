import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, CardContent, Progress } from '@/components/ui'
import { PageHeader } from '@/components/shared'
import { useAdminProgress } from '@/hooks'
import { adminApi, getErrorMessage } from '@/services/api'
import { useMutation } from '@tanstack/react-query'

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

export function AdminProcessing() {
  const { interviewId } = useParams<{ interviewId: string }>()
  const navigate = useNavigate()
  const { data: progress, isLoading, isError } = useAdminProgress(interviewId)

  const processMutation = useMutation({
    mutationFn: (id: string) => adminApi.process(id),
    onSuccess: () => {
      toast.success('Processing restarted')
      // The useAdminProgress query refetches automatically every 5s.
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  // Redirect to the report when done.
  useEffect(() => {
    if (progress?.status === 'completed') {
      toast.success('Interview processing complete!')
      const t = setTimeout(() => navigate(`/admin/candidates/${interviewId}`), 1200)
      return () => clearTimeout(t)
    }
  }, [progress?.status, navigate, interviewId])

  const current = stageIndex(progress?.stage ?? progress?.status ?? '')
  const activeStep = STAGE_STEPS[current]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Processing Interview"
        description={interviewId ? `Interview ID: ${interviewId.slice(0, 8)}…` : 'Tracking interview progress'}
        actions={
          progress?.status === 'failed' && (
            <Button onClick={() => processMutation.mutate(interviewId!)} loading={processMutation.isPending}>
              <RefreshCw />
              Retry processing
            </Button>
          )
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-5 p-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading progress…</p>
          </CardContent>
        </Card>
      ) : isError || !progress ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-muted-foreground">Could not load progress for this interview.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardContent className="p-8">
              <div className="space-y-5">
                {STAGE_STEPS.map((step, i) => {
                  const done = i < current || progress.status === 'completed'
                  const active = i === current && progress.status !== 'completed'
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
                      <p
                        className={`text-sm font-semibold ${
                          done ? 'text-foreground' : active ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {step.label}
                      </p>
                    </motion.div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardContent className="flex flex-col items-center p-8 text-center">
              <div className="relative">
                {progress.status === 'failed' ? (
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                  </span>
                ) : (
                  <>
                    <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/30" />
                    <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </span>
                  </>
                )}
              </div>
              <h3 className="mt-6 font-display text-lg font-bold text-foreground">
                {progress.status === 'failed'
                  ? 'Processing failed'
                  : progress.status === 'completed'
                    ? 'Completed!'
                    : activeStep.label}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {progress.status === 'failed'
                  ? progress.failure_reason || 'An unexpected error occurred.'
                  : 'Auto-refreshing every 5 seconds.'}
              </p>
              {progress.status !== 'failed' && (
                <>
                  <Progress
                    value={progress.status === 'completed' ? 100 : progress.progress}
                    className="mt-6 h-2"
                    indicatorClassName="bg-gradient-to-r from-primary to-accent"
                  />
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    {progress.status === 'completed' ? 100 : Math.round(progress.progress)}% complete
                  </p>
                </>
              )}
              {progress.status === 'completed' ? (
                <Button className="mt-6 w-full" onClick={() => navigate(`/admin/candidates/${interviewId}`)}>
                  View report
                </Button>
              ) : (
                <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
                  You can leave this page and come back later — processing continues in the background.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
