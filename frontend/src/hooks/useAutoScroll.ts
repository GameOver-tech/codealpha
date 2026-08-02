import { useEffect, useRef } from 'react'

/**
 * Smart auto-scroll for the reading experience.
 *
 * - Scrolls ONLY when the active word is outside the viewport (or near the
 *   edges) — never fights the user's reading position.
 * - The moment the user scrolls manually, auto-scroll pauses and yields
 *   control; it resumes only when a word leaves the viewport again.
 * - Stopping speech cancels every pending scroll instantly.
 * - Respects prefers-reduced-motion.
 */

function isOutOfViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  const vh = window.innerHeight || document.documentElement.clientHeight
  // Treat the word as "in view" when it sits comfortably inside the
  // middle band of the screen (top 15% .. bottom 15% margin).
  const margin = vh * 0.15
  return rect.top < margin || rect.bottom > vh - margin
}

export function useAutoScroll(activeElement: HTMLElement | null, active: boolean) {
  const activeRef = useRef(active)
  activeRef.current = active

  const pendingRef = useRef<number | null>(null)
  const lastElementRef = useRef<HTMLElement | null>(null)

  // Detect manual scrolling — the user takes control momentarily, but
  // auto-scroll re-engages as soon as the next word leaves the viewport.
  // (Previously it disabled permanently, which made the highlight stop
  // following after any manual wheel/touch scroll.)
  const suppressUntilRef = useRef(0)
  useEffect(() => {
    const onScroll = () => {
      suppressUntilRef.current = Date.now() + 400
      if (pendingRef.current !== null) {
        window.clearTimeout(pendingRef.current)
        pendingRef.current = null
      }
    }
    window.addEventListener('wheel', onScroll, { passive: true })
    window.addEventListener('touchmove', onScroll, { passive: true })
    return () => {
      window.removeEventListener('wheel', onScroll)
      window.removeEventListener('touchmove', onScroll)
    }
  }, [])

  useEffect(() => {
    // Speech stopped — cancel any pending scroll immediately.
    if (!active) {
      if (pendingRef.current !== null) {
        window.clearTimeout(pendingRef.current)
        pendingRef.current = null
      }
      suppressUntilRef.current = 0
      lastElementRef.current = null
      return
    }
    if (!activeElement) return

    lastElementRef.current = activeElement

    if (pendingRef.current !== null) {
      window.clearTimeout(pendingRef.current)
      pendingRef.current = null
    }

    pendingRef.current = window.setTimeout(() => {
      pendingRef.current = null
      if (!activeRef.current) return

      // Skip auto-scroll only briefly after a manual wheel/touch scroll —
      // the next word leaving the viewport re-engages it.
      if (Date.now() < suppressUntilRef.current) return
      if (!isOutOfViewport(activeElement)) return

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      activeElement.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'center',
      })
    }, 60)

    return () => {
      if (pendingRef.current !== null) {
        window.clearTimeout(pendingRef.current)
        pendingRef.current = null
      }
    }
  }, [activeElement, active])
}
