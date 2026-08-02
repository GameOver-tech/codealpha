import { useEffect, useRef } from 'react'

/**
 * Cooperative auto-scroll for the reading experience.
 *
 * - Scrolls ONLY when the active spoken word is outside the viewport — never
 *   fights the user's reading position.
 * - After the user scrolls manually, auto-scroll yields for a short grace
 *   period (1.5s) so the user can read in peace, then re-engages only when
 *   the next spoken word leaves the viewport again. It is never permanently
 *   disabled.
 * - Stopping speech cancels every pending scroll instantly.
 * - Respects prefers-reduced-motion.
 */

const USER_SCROLL_COOLDOWN_MS = 1500

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
  // Timestamp of the last manual scroll — auto-scroll yields briefly after it.
  const suppressUntilRef = useRef(0)

  // Detect manual scrolling (wheel/touch). We only remember the time — the
  // auto-scroll effect below checks it and gives the user a grace period.
  useEffect(() => {
    const onScroll = () => {
      suppressUntilRef.current = Date.now() + USER_SCROLL_COOLDOWN_MS
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

      // Respect the grace period after a manual scroll — the user is reading.
      if (Date.now() < suppressUntilRef.current) return
      // Only scroll when the word is actually out of view.
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
