import { useEffect, useRef } from 'react'

/**
 * Smoothly scrolls the active reading element into view (near vertical
 * center) while speech is active. Uses native smooth scrolling; respects
 * prefers-reduced-motion by disabling animation.
 */
export function useAutoScroll(activeElement: HTMLElement | null, active: boolean) {
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    if (!active || !activeElement) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = window.setTimeout(() => {
      if (!activeRef.current) return
      activeElement.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'center',
      })
    }, 120)
    return () => window.clearTimeout(id)
  }, [activeElement, active])
}
