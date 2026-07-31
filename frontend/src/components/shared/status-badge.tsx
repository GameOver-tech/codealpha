import { Badge, type BadgeProps } from '@/components/ui/badge'
import type { InterviewStatusValue, RecommendationVerdict } from '@/types'

const STATUS_META: Record<InterviewStatusValue, { label: string; variant: BadgeProps['variant'] }> = {
  uploaded: { label: 'Uploaded', variant: 'secondary' },
  processing: { label: 'Processing', variant: 'default' },
  transcript_ready: { label: 'Transcribing', variant: 'default' },
  ai_evaluation: { label: 'AI Evaluation', variant: 'default' },
  pdf_generated: { label: 'Generating PDF', variant: 'default' },
  completed: { label: 'Completed', variant: 'success' },
  failed: { label: 'Failed', variant: 'destructive' },
}

export function statusLabel(status: InterviewStatusValue): string {
  return STATUS_META[status]?.label ?? status
}

export function statusVariant(status: InterviewStatusValue): BadgeProps['variant'] {
  return STATUS_META[status]?.variant ?? 'secondary'
}

export function StatusBadge({ status, className }: { status: InterviewStatusValue; className?: string }) {
  return (
    <Badge variant={statusVariant(status)} className={className}>
      {status === 'processing' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {statusLabel(status)}
    </Badge>
  )
}

const REC_META: Record<RecommendationVerdict, BadgeProps['variant']> = {
  Recommended: 'success',
  'Not Recommended': 'destructive',
  'Need Further Review': 'warning',
}

export function RecommendationBadge({
  verdict,
  className,
}: {
  verdict: RecommendationVerdict | null | undefined
  className?: string
}) {
  if (!verdict) return <Badge variant="secondary" className={className}>Pending</Badge>
  return <Badge variant={REC_META[verdict] ?? 'secondary'} className={className}>{verdict}</Badge>
}
