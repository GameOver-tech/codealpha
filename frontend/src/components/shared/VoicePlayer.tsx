import { useEffect, useState } from 'react'
import { Loader2, Pause, Play, RotateCcw, Square, Volume2 } from 'lucide-react'
import { useVoicePlayer } from '@/hooks'
import { SpeakingAnimation } from './SpeakingAnimation'
import { cn } from '@/lib/utils'

interface VoicePlayerProps {
  /** The text to speak. */
  text: string
  /** Show the voice selector (defaults to true). */
  showVoiceSelect?: boolean
  /** Compact inline layout for chat bubbles. */
  compact?: boolean
  /** Automatically play when the component mounts (e.g. new AI reply). */
  autoPlay?: boolean
  className?: string
}

/**
 * ChatGPT-style voice player. Renders a compact control row — play/pause,
 * stop, replay, progress bar, and an optional voice selector. Only one
 * voice instance plays app-wide (enforced by useVoicePlayer).
 */
export function VoicePlayer({
  text,
  showVoiceSelect = true,
  compact = false,
  autoPlay = false,
  className,
}: VoicePlayerProps) {
  const {
    status,
    error,
    progress,
    voices,
    selectedVoiceId,
    play,
    pause,
    resume,
    stop,
    replay,
    setVoice,
    isActive,
  } = useVoicePlayer()

  const [voiceOpen, setVoiceOpen] = useState(false)
  const cleaned = (text || '').trim()

  // Auto-play new AI responses once.
  useEffect(() => {
    if (autoPlay && cleaned && status === 'idle') {
      play(cleaned)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, cleaned])

  if (!cleaned) return null

  const playing = isActive && status === 'playing'
  const loading = status === 'loading'

  const togglePlay = () => {
    if (playing) pause()
    else if (status === 'paused') resume()
    else play(cleaned)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-2.5 py-1.5',
        compact ? 'max-w-[240px]' : 'max-w-sm',
        className,
      )}
    >
      {/* Play / pause */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={loading}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        aria-label={playing ? 'Pause' : status === 'paused' ? 'Resume' : 'Play'}
        title={playing ? 'Pause' : status === 'paused' ? 'Resume' : 'Play'}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="ml-0.5 h-4 w-4" />
        )}
      </button>

      {/* Waveform / status */}
      <div className="min-w-0 flex-1">
        {playing || status === 'paused' ? (
          <SpeakingAnimation active={playing} paused={status === 'paused'} className="text-primary" />
        ) : (
          <span className="block text-[11px] font-medium text-muted-foreground">
            {loading ? 'Generating voice…' : error ? 'Voice unavailable' : 'Listen to response'}
          </span>
        )}

        {/* Progress bar */}
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stop */}
      <button
        type="button"
        onClick={stop}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Stop"
        title="Stop"
      >
        <Square className="h-3 w-3" />
      </button>

      {/* Replay */}
      <button
        type="button"
        onClick={replay}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Replay"
        title="Replay"
      >
        <RotateCcw className="h-3 w-3" />
      </button>

      {/* Voice select */}
      {showVoiceSelect && voices.length > 1 && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setVoiceOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Choose voice"
            aria-expanded={voiceOpen}
            title="Voice"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </button>
          {voiceOpen && (
            <div className="absolute bottom-full right-0 z-50 mb-1 max-h-56 w-52 overflow-y-auto rounded-lg border border-border/60 bg-popover py-1 shadow-xl">
              {voices.map((voice) => (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => {
                    setVoice(voice.id)
                    setVoiceOpen(false)
                  }}
                  className={cn(
                    'block w-full truncate px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-accent',
                    voice.id === selectedVoiceId ? 'font-bold text-primary' : 'text-foreground',
                  )}
                >
                  {voice.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
