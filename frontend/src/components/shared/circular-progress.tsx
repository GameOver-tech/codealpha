import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface CircularProgressProps {
  value: number
  size?: number
  strokeWidth?: number
  className?: string
  showValue?: boolean
  valueClassName?: string
  color?: string
  trackClassName?: string
  label?: string
}

export function CircularProgress({
  value,
  size = 160,
  strokeWidth = 12,
  className,
  showValue = true,
  valueClassName,
  color = '#2563EB',
  trackClassName,
  label,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, value))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn('stroke-slate-200 dark:stroke-slate-700', trackClassName)}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-display text-3xl font-bold text-foreground', valueClassName)}>
            {Math.round(clamped)}
          </span>
          {label && <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>}
        </div>
      )}
    </div>
  )
}
