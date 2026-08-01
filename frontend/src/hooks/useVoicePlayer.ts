import { useCallback, useEffect, useRef, useState } from 'react'
import { ttsService, ttsAudioUrl, revokeTtsUrl, type TTSVoice } from '@/services/api/tts'

export type VoiceStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

const VOICE_PREF_KEY = 'hirelens_tts_voice_id'

function readVoicePref(): string {
  try {
    return localStorage.getItem(VOICE_PREF_KEY) ?? ''
  } catch {
    return ''
  }
}

export interface UseVoicePlayerResult {
  status: VoiceStatus
  error: string | null
  /** 0-100 playback progress. */
  progress: number
  voices: TTSVoice[]
  selectedVoiceId: string
  play: (text: string) => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => void
  replay: () => Promise<void>
  setVoice: (voiceId: string) => void
  /** True when this hook is the active playback source. */
  isActive: boolean
}

let activeController: AbortController | null = null

/**
 * Voice player backed by the ElevenLabs TTS API (through the backend).
 *
 * - Only ONE voice plays at a time across the app: starting playback
 *   cancels any previous audio element.
 * - Voice preference is persisted in localStorage.
 * - Audio is loaded lazily as a blob URL and revoked on stop/unmount.
 */
export function useVoicePlayer(): UseVoicePlayerResult {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const textRef = useRef('')
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [voices, setVoices] = useState<TTSVoice[]>([])
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => readVoicePref())
  const [isActive, setIsActive] = useState(false)

  // Load voice list once.
  useEffect(() => {
    let cancelled = false
    ttsService
      .listVoices()
      .then((list) => {
        if (!cancelled && list.length) setVoices(list)
      })
      .catch(() => {
        /* voices are optional — playback still works with the default */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    revokeTtsUrl(urlRef.current)
    urlRef.current = null
    activeController = null
    setStatus('idle')
    setError(null)
    setProgress(0)
    setIsActive(false)
    textRef.current = ''
  }, [])

  // Cleanup on unmount.
  useEffect(() => {
    return stop
  }, [stop])

  const play = useCallback(
    async (text: string) => {
      const cleaned = (text || '').trim()
      if (!cleaned) return

      // Cancel any previous playback (global single-instance rule).
      if (activeController) activeController.abort()
      activeController = new AbortController()

      const audio = audioRef.current ?? new Audio()
      audioRef.current = audio

      // Reset the element for a fresh play.
      audio.pause()
      revokeTtsUrl(urlRef.current)
      urlRef.current = null

      textRef.current = cleaned
      setError(null)
      setStatus('loading')
      setIsActive(true)
      setProgress(0)

      try {
        const url = await ttsAudioUrl(cleaned, selectedVoiceId || undefined)
        if (activeController?.signal.aborted) {
          revokeTtsUrl(url)
          return
        }
        urlRef.current = url
        audio.src = url
        audio.preload = 'auto'
        await audio.play()
      } catch (err) {
        if (activeController?.signal.aborted) return
        setStatus('error')
        setError(
          err instanceof Error
            ? err.message
            : 'Voice could not be loaded. Please try again.',
        )
        setIsActive(false)
      }
    },
    [selectedVoiceId],
  )

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setStatus('paused')
  }, [])

  const resume = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.play().catch(() => {
      setStatus('error')
      setError('Could not resume playback.')
    })
    setStatus('playing')
  }, [])

  const replay = useCallback(async () => {
    if (textRef.current) await play(textRef.current)
  }, [play])

  const setVoice = useCallback((voiceId: string) => {
    setSelectedVoiceId(voiceId)
    try {
      localStorage.setItem(VOICE_PREF_KEY, voiceId)
    } catch {
      /* storage unavailable — ignore */
    }
  }, [])

  // Wire audio element events.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100)
    }
    const onEnded = () => {
      setStatus('idle')
      setProgress(0)
      setIsActive(false)
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnded)
    }
  }, [status])

  return {
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
  }
}
