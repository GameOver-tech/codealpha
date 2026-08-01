import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getAvailableVoices, preferEnglishVoices, speechSupported } from '@/lib/speech'

export type SpeechStatus = 'idle' | 'playing' | 'paused' | 'stopped'

interface SpeechContextValue {
  supported: boolean
  status: SpeechStatus
  /** The text currently (or last) being spoken. */
  text: string
  /** Selected voice URI (persisted). */
  voiceURI: string | null
  /** All voices the browser provides. */
  voices: SpeechSynthesisVoice[]
  speak: (text: string) => void
  pause: () => void
  resume: () => void
  stop: () => void
  /** True when the given text is the active speech. */
  isSpeaking: (text: string) => boolean
}

const SpeechContext = createContext<SpeechContextValue | null>(null)

const VOICE_KEY = 'hirelens_tts_voice'

function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function writePref(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable — ignore */
  }
}

/**
 * Global speech state. Guarantees exactly ONE speech instance at a time:
 * starting new speech cancels whatever is playing. The chosen voice
 * preference persists across sessions.
 */
export function SpeechProvider({ children }: { children: ReactNode }) {
  const supported = speechSupported()
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [text, setText] = useState('')
  const [voiceURI, setVoiceURI] = useState<string | null>(() => readPref(VOICE_KEY, null))
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Load available voices (Chrome loads them async).
  useEffect(() => {
    if (!supported) return
    const loadVoices = () => setVoices(getAvailableVoices())
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [supported])

  // Default to a good English voice when the user hasn't picked one.
  useEffect(() => {
    if (!supported || voiceURI || !voices.length) return
    const preferred = preferEnglishVoices(voices).find((v) => v.lang?.toLowerCase().startsWith('en'))
    if (preferred) {
      setVoiceURI(preferred.voiceURI)
      writePref(VOICE_KEY, preferred.voiceURI)
    }
  }, [supported, voiceURI, voices])

  // Cleanup on unmount — never leave speech running.
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel()
    }
  }, [supported])

  // Keyboard shortcuts: Space pauses/resumes, Esc stops. Ignored while the
  // user is typing in an input/textarea so chat is never interrupted.
  useEffect(() => {
    if (!supported) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (typing) return

      if (event.key === 'Escape') {
        window.speechSynthesis.cancel()
        setStatus('idle')
        setText('')
      } else if (event.code === 'Space' && status !== 'idle' && status !== 'stopped') {
        event.preventDefault()
        if (status === 'playing') {
          window.speechSynthesis.pause()
          setStatus('paused')
        } else {
          window.speechSynthesis.resume()
          setStatus('playing')
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [supported, status])

  const speak = useCallback(
    (speechText: string) => {
      if (!supported) return
      const cleaned = (speechText || '').trim()
      if (!cleaned) return

      // One speech instance only — cancel anything currently playing.
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(cleaned)
      const selectedVoice = voices.find((v) => v.voiceURI === voiceURI)
      if (selectedVoice) utterance.voice = selectedVoice
      utterance.rate = 1
      utterance.volume = 1
      utterance.pitch = 1

      utterance.onstart = () => setStatus('playing')
      utterance.onend = () => {
        setStatus('idle')
        setText('')
        utteranceRef.current = null
      }
      utterance.onerror = (event) => {
        // A new speak() cancels the previous one — that's not an error.
        if (event.error === 'interrupted' || event.error === 'canceled') return
        setStatus('idle')
        setText('')
        utteranceRef.current = null
      }

      utteranceRef.current = utterance
      setText(cleaned)
      setStatus('playing')

      // Chrome needs a tick after cancel() before speak() works reliably.
      window.setTimeout(() => window.speechSynthesis.speak(utterance), 60)
    },
    [supported, voices, voiceURI],
  )

  const pause = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.pause()
    setStatus('paused')
  }, [supported])

  const resume = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.resume()
    setStatus('playing')
  }, [supported])

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setStatus('idle')
    setText('')
    utteranceRef.current = null
  }, [supported])

  const isSpeaking = useCallback(
    (target: string) => status !== 'idle' && text === target.trim(),
    [status, text],
  )

  const value = useMemo<SpeechContextValue>(
    () => ({
      supported,
      status,
      text,
      voiceURI,
      voices,
      speak,
      pause,
      resume,
      stop,
      isSpeaking,
    }),
    [supported, status, text, voiceURI, voices, speak, pause, resume, stop, isSpeaking],
  )

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>
}

export function useSpeech(): SpeechContextValue {
  const ctx = useContext(SpeechContext)
  if (!ctx) throw new Error('useSpeech must be used within SpeechProvider')
  return ctx
}
