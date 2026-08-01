import { cn } from '@/lib/utils'

interface SpeakingAnimationProps {
  /** True while audio is playing. */
  active: boolean
  /** True while paused (bars frozen). */
  paused?: boolean
  className?: string
}

/**
 * Minimal animated waveform — a row of bars that ripple while speaking.
 * The pause state freezes the bars; idle shows a flat static row.
 */
export function SpeakingAnimation({ active, paused, className }: SpeakingAnimationProps) {
  return (
    <span
      className={cn('flex h-4 items-center justify-center gap-[2.5px]', className)}
      aria-hidden="true"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'w-[3px] rounded-full bg-current transition-all duration-200',
            active ? 'tts-bar-animate' : paused ? 'h-2' : 'h-1.5',
          )}
          style={active ? { animationDelay: `${i * 0.12}s`, height: 6 + ((i * 7) % 10) } : undefined}
        />
      ))}
    </span>
  )
}
