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

const ADMIN_STATUS_META: Record<string, { variant: BadgeProps['variant']; dot?: string }> = {
  Pending: { variant: 'secondary' },
  Processing: { variant: 'default', dot: '#2563EB' },
  Completed: { variant: 'success' },
  Recommended: { variant: 'success' },
  'Not Recommended': { variant: 'destructive' },
  'Need Further Review': { variant: 'warning' },
  Rejected: { variant: 'destructive' },
  Selected: { variant: 'success' },
}

/** Badge for the admin-controlled review status (human-set). */
export function AdminStatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = ADMIN_STATUS_META[status] ?? { variant: 'secondary' as const }
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.dot && <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: meta.dot }} />}
      {status || 'Pending'}
    </Badge>
  )
}
