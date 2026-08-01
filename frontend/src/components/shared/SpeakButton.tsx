import { memo, useRef } from 'react'
import { useVoice } from '@/hooks/useVoice'
import { cn } from '@/lib/utils'

interface SpeakButtonProps {
  /** The text to read aloud. */
  text: string
  /** Optional accessible label override. */
  label?: string
  /** Small inline variant for dense contexts (tables, cards). */
  variant?: 'icon' | 'inline'
  className?: string
}

/**
 * Minimal speaker button backed by the global ElevenLabs voice engine.
 * Clicking reads ONLY the associated text (single-instance — any other
 * speech stops first). Icon animates while playing; click pauses, click
 * again resumes.
 */
export const SpeakButton = memo(function SpeakButton({
  text,
  label,
  variant = 'icon',
  className,
}: SpeakButtonProps) {
  const voice = useVoice()
  const lastTapRef = useRef(0)

  const cleaned = (text || '').trim()
  if (!cleaned) return null

  const speakingThis = voice.text === cleaned
  const playing = speakingThis && voice.state === 'playing'
  const paused = speakingThis && voice.state === 'paused'

  const handleClick = () => {
    if (speakingThis) {
      if (playing) {
        voice.pause()
      } else if (paused) {
        voice.resume()
      }
      return
    }

    // Double-click restarts from the beginning; single click starts speaking.
    const now = Date.now()
    if (now - lastTapRef.current < 350) {
      lastTapRef.current = 0
      void voice.speak(cleaned)
      return
    }
    lastTapRef.current = now
    void voice.speak(cleaned)
  }

  const ariaLabel =
    label ??
    (playing ? 'Pause reading' : paused ? 'Resume reading' : 'Listen to this text')

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary',
          playing && 'text-primary',
          className,
        )}
        aria-label={ariaLabel}
        aria-pressed={playing}
        title={playing ? 'Pause' : paused ? 'Resume' : 'Listen'}
      >
        <SoundWave playing={playing} paused={paused} />
        {label && <span className="text-xs font-medium">{label}</span>}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        playing && 'text-primary',
        className,
      )}
      aria-label={ariaLabel}
      aria-pressed={playing}
      title={playing ? 'Pause' : paused ? 'Resume' : 'Listen'}
    >
      <SoundWave playing={playing} paused={paused} />
    </button>
  )
})

/** Animated speaker icon: three bars that ripple while playing. */
function SoundWave({ playing, paused }: { playing: boolean; paused: boolean }) {
  return (
    <span className="flex h-3.5 w-3.5 items-center justify-center gap-[2px]" aria-hidden="true">
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className={cn(
            'w-[2px] rounded-full bg-current transition-all duration-200',
            active(playing) ? 'tts-bar tts-bar-animate' : paused ? 'h-1.5' : 'h-[5px]',
          )}
          style={playing ? { animationDelay: `${bar * 0.15}s` } : undefined}
        />
      ))}
    </span>
  )
}

function active(playing: boolean): boolean {
  return playing
}
