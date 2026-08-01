import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useSpeech } from '@/context'

/**
 * Stops any active speech whenever the route changes. Renders nothing —
 * it exists purely for the side effect.
 */
export function StopOnRouteChange() {
  const { pathname } = useLocation()
  const { stop } = useSpeech()

  useEffect(() => {
    stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
