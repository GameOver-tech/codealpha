import { cn } from '@/lib/utils'

interface VoiceIndicatorProps {
  /** True while audio is being spoken. */
  active: boolean
  /** True while paused (bars frozen). */
  paused?: boolean
  className?: string
}

/**
 * Minimal voice indicator — animated sound-wave bars shown near the AI
 * avatar while the assistant is speaking. Fades out when idle.
 */
export function VoiceIndicator({ active, paused, className }: VoiceIndicatorProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[2px] rounded-full px-1.5 py-1 transition-all duration-200',
        active || paused ? 'opacity-100' : 'opacity-0',
        className,
      )}
      role="status"
      aria-label={active ? 'Assistant is speaking' : paused ? 'Speech paused' : ''}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'w-[3px] rounded-full bg-current',
            active ? 'tts-bar-animate' : 'h-1',
          )}
          style={active ? { animationDelay: `${i * 0.12}s` } : undefined}
        />
      ))}
    </span>
  )
}
