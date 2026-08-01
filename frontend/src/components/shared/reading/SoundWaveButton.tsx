import { memo } from 'react'
import { cn } from '@/lib/utils'

interface SoundWaveButtonProps {
  /** True while speech is actively playing. */
  speaking: boolean
  /** True while paused (mid-reading). */
  paused?: boolean
  /** True while the report is loaded for speech but not yet started. */
  ready?: boolean
  onClick: () => void
  className?: string
}

/**
 * Clean sound-wave "Listen" button — icon-only, ChatGPT-style.
 *
 * OFF  — dim equalizer bars, quiet.
 * ON   — bright gradient circle, bars pulse.
 * PAUSED — bars frozen mid-height, clearly resumable.
 */
export const SoundWaveButton = memo(function SoundWaveButton({
  speaking,
  paused = false,
  ready = false,
  onClick,
  className,
}: SoundWaveButtonProps) {
  const on = speaking || paused || ready

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={speaking ? 'Pause reading' : paused ? 'Resume reading' : 'Listen to report'}
      title={speaking ? 'Pause reading' : paused ? 'Resume reading' : 'Listen to report'}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200',
        on
          ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-[0_2px_12px_rgba(59,130,246,0.4)]'
          : 'border border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-primary',
        className,
      )}
    >
      {/* Animated equalizer bars */}
      <span className="flex h-4 items-end gap-[2px]" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'w-[2.5px] rounded-full transition-all duration-200',
              on ? 'bg-current' : 'bg-current opacity-50',
              speaking
                ? 'animate-eq-bar'
                : paused
                  ? 'h-1.5'
                  : ready
                    ? 'h-1'
                    : 'h-2',
            )}
            style={
              speaking
                ? {
                    animationDelay: `${i * 120}ms`,
                    animationDuration: `${700 + i * 130}ms`,
                  }
                : undefined
            }
          />
        ))}
      </span>
    </button>
  )
})
