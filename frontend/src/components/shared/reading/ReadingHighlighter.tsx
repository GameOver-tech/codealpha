import { memo, useMemo } from 'react'
import { SpokenWord } from './SpokenWord'

interface ReadingHighlighterProps {
  text: string
  /** Index of the word currently being spoken (-1 = none). */
  activeWordIndex: number
  /** Callback fired when the active word mounts (for auto-scroll). */
  onActiveWordRef?: (el: HTMLElement | null) => void
}

/**
 * Renders a paragraph as individual words so the active spoken word can be
 * highlighted precisely. Words before the active index are "spoken" (faded),
 * the active word glows, and upcoming words stay untouched.
 *
 * Each word is a memoized component, so a moving active index only
 * re-renders the handful of words whose state actually changed — this keeps
 * reports with thousands of words smooth at 60fps.
 */
export const ReadingHighlighter = memo(function ReadingHighlighter({
  text,
  activeWordIndex,
  onActiveWordRef,
}: ReadingHighlighterProps) {
  const words = useMemo(() => text.match(/\S+/g) ?? [], [text])

  return (
    <span className="leading-relaxed">
      {words.map((word, i) => (
        <span key={`${i}-${word}`}>
          <SpokenWord
            ref={i === activeWordIndex ? onActiveWordRef : undefined}
            word={word}
            active={i === activeWordIndex}
            spoken={activeWordIndex >= 0 && i < activeWordIndex}
          />
          {/* Trailing space keeps word-wrap intact and layout stable. */}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  )
})
