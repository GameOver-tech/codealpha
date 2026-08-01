import { memo } from 'react'
import { cn } from '@/lib/utils'

interface SpokenWordProps {
  word: string
  /** True when this word is the one currently being spoken. */
  active: boolean
  /** True when this word has already been spoken (fades back). */
  spoken: boolean
}

/**
 * A single word in the reading view.
 *
 * The active word gets a soft accent highlight with a small animated bar
 * sliding underneath it — like a reading cursor traveling through the
 * sentence. Critically, the active word keeps its exact width/weight, so
 * the surrounding text never reflows while reading. Spoken words settle
 * back to normal text color.
 */
export const SpokenWord = memo(function SpokenWord({ word, active, spoken }: SpokenWordProps) {
  return (
    <span
      className={cn(
        'relative rounded-[3px] px-[1.5px] transition-colors duration-150',
        active && 'bg-primary/12 text-primary',
        !active && spoken && 'text-foreground/70',
        !active && !spoken && 'text-foreground',
      )}
    >
      {word}
      {/* Animated reading-cursor bar under the active word — moves with it,
          never changes the text layout. */}
      {active && (
        <span
          aria-hidden
          className="absolute -bottom-[3px] left-0 right-0 h-[2.5px] overflow-hidden rounded-full"
        >
          <span className="block h-full w-1/2 animate-reading-bar rounded-full bg-primary shadow-[0_0_6px_rgba(59,130,246,0.7)]" />
        </span>
      )}
    </span>
  )
})
