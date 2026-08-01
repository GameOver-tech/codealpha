import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAudioManager, type PlaybackState } from '@/services/audioManager'
import { ttsService, type TTSVoice } from '@/services/api/tts'
import { getToken } from '@/services/api'

const SETTINGS_KEY = 'hirelens_voice_settings'

export interface VoiceSettings {
  voiceId: string
  speed: number
  autoPlay: boolean
  volume: number
  muted: boolean
}

const DEFAULT_SETTINGS: VoiceSettings = {
  voiceId: '',
  speed: 1,
  autoPlay: true,
  volume: 1,
  muted: false,
}

function readSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<VoiceSettings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function writeSettings(settings: VoiceSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* storage unavailable — ignore */
  }
}

export interface UseVoiceResult {
  state: PlaybackState
  error: string | null
  progress: number
  isSpeaking: boolean
  /** The text currently being spoken (matches chat message content). */
  text: string
  /** The sentence currently being read (for highlight). */
  currentSentence: string
  /** Index of the current sentence in the spoken text (-1 when unknown). */
  sentenceIndex: number
  /** Index of the current word within the sentence (-1 when unknown). */
  wordIndex: number
  /** Absolute word index across the entire spoken text. */
  globalWordIndex: number
  settings: VoiceSettings
  voices: TTSVoice[]
  /** Speak the given text (ElevenLabs with browser fallback). */
  speak: (text: string) => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => void
  updateSettings: (patch: Partial<VoiceSettings>) => void
}

/** Split text into sentences so we can highlight the current one. */
function chunkSentences(text: string): string[] {
  const cleaned = (text || '').trim()
  if (!cleaned) return []
  const matches = cleaned.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)
  return (matches ?? [cleaned]).map((s) => s.trim()).filter(Boolean)
}

/** Word index within a sentence given a char offset (from onboundary). */
function wordIndexAt(sentence: string, charIndex: number): number {
  const prefix = sentence.slice(0, charIndex)
  const words = prefix.match(/\S+/g)
  return words ? Math.max(0, words.length - 1) : 0
}

/** Browser fallback engine state (module-level so pause/resume work globally). */
const browserEngine = {
  utterance: null as SpeechSynthesisUtterance | null,
  chunks: [] as string[],
  index: 0,
  wordIndex: -1,
  /** Absolute word position across ALL chunks (for cross-section sync). */
  globalWordIndex: -1,
  /** Cumulative word count before each chunk. */
  chunkWordOffsets: [] as number[],
  status: 'idle' as 'idle' | 'playing' | 'paused',
  /** Active word-advance timers (cleared on pause/stop). */
  timers: [] as number[],
  /** Calibration factor (actual vs estimated pace) — corrects drift. */
  paceFactor: 1,
}

function clearEngineTimers() {
  browserEngine.timers.forEach((id) => window.clearTimeout(id))
  browserEngine.timers.length = 0
}

/**
 * useVoice — global voice assistant.
 *
 * Primary: ElevenLabs via the backend (/api/tts).
 * Fallback: browser SpeechSynthesis when the API is unavailable, so the
 * "Listen" experience ALWAYS works.
 *
 * Only one voice instance plays at a time, preferences persist in
 * localStorage, and the current sentence is tracked for UI highlighting.
 */
export function useVoice(): UseVoiceResult {
  const manager = getAudioManager()
  const [state, setState] = useState<PlaybackState>(manager.state)
  const [error, setError] = useState<string | null>(manager.error)
  const [progress, setProgress] = useState(manager.progress)
  const [text, setText] = useState(manager.currentText)
  const [currentSentence, setCurrentSentence] = useState('')
  const [sentenceIndex, setSentenceIndex] = useState(-1)
  const [wordIndex, setWordIndex] = useState(-1)
  const [globalWordIndex, setGlobalWordIndex] = useState(-1)
  const [settings, setSettings] = useState<VoiceSettings>(readSettings)
  const [voices, setVoices] = useState<TTSVoice[]>([])

  // Subscribe to manager state changes.
  useEffect(() => {
    return manager.subscribe(() => {
      setState(manager.state)
      setError(manager.error)
      setProgress(manager.progress)
      setText(manager.currentText)
    })
  }, [manager])

  // Load the voice list lazily — only when the user first speaks. This
  // avoids a failing/blocking /api/tts/voices request on every page mount.
  const ensureVoices = useCallback(() => {
    if (!getToken() || voices.length) return
    ttsService
      .listVoices()
      .then((list) => {
        if (list.length) setVoices(list)
      })
      .catch(() => {
        /* voices are optional — default voice still works */
      })
  }, [voices.length])

  // Cleanup browser engine on unmount.
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      browserEngine.utterance = null
    }
  }, [])

  /** Speak using the browser's built-in SpeechSynthesis (fallback engine). */
  const speakBrowser = useCallback(
    (speechText: string) => {
      if (!('speechSynthesis' in window)) {
        setError('Your browser does not support text-to-speech.')
        return
      }
      // Stop any ElevenLabs playback first.
      manager.stop()

      const chunks = chunkSentences(speechText)
      if (!chunks.length) return

      browserEngine.chunks = chunks
      browserEngine.index = 0
      browserEngine.wordIndex = -1
      browserEngine.globalWordIndex = -1
      // Cumulative word offset before each chunk.
      browserEngine.chunkWordOffsets = chunks.reduce<number[]>((acc, _chunk) => {
        acc.push(
          acc.length ? acc[acc.length - 1]! + (chunks[acc.length - 1]!.match(/\S+/g)?.length ?? 0) : 0,
        )
        return acc
      }, [])
      browserEngine.status = 'playing'

      setText(speechText)
      setError(null)
      setState('playing')
      setSentenceIndex(0)
      setCurrentSentence(chunks[0] ?? '')

      // Chrome/Edge do NOT fire word boundary events, so we drive the word
      // highlight with a timer. Timing is WORD-LENGTH WEIGHTED: longer words
      // take proportionally longer to say, which keeps the highlight in sync
      // with the actual speech instead of drifting. `onboundary` (where
      // supported) still corrects the position precisely.
      clearEngineTimers()

      const advanceWord = (wi: number, chunkIdx: number) => {
        browserEngine.wordIndex = wi
        browserEngine.globalWordIndex = (browserEngine.chunkWordOffsets[chunkIdx] ?? 0) + wi
        setWordIndex(wi)
        setGlobalWordIndex(browserEngine.globalWordIndex)
      }

      /** Per-word duration in ms, proportional to length + punctuation pause. */
      const wordDuration = (word: string): number => {
        const base = 110 / (settings.speed || 1)
        const units = Math.max(2, word.length)
        const pause = /[.,!?;:]$/.test(word) ? 320 / (settings.speed || 1) : 0
        return Math.round((base * units + pause) * browserEngine.paceFactor)
      }

      const startWordTimer = (idx: number) => {
        const sentence = browserEngine.chunks[idx] ?? ''
        const words = sentence.match(/\S+/g) ?? []
        let elapsed = 0
        words.forEach((word, wi) => {
          const id = window.setTimeout(() => advanceWord(wi, idx), elapsed)
          browserEngine.timers.push(id)
          elapsed += wordDuration(word)
        })
      }

      const speakNext = (idx: number) => {
        if (idx >= browserEngine.chunks.length) {
          browserEngine.status = 'idle'
          setState('idle')
          setText('')
          setCurrentSentence('')
          setSentenceIndex(-1)
          setWordIndex(-1)
          return
        }
        const utterance = new SpeechSynthesisUtterance(browserEngine.chunks[idx]!)
        utterance.rate = settings.speed
        utterance.volume = settings.muted ? 0 : settings.volume
        browserEngine.utterance = utterance
        browserEngine.index = idx
        setSentenceIndex(idx)
        setCurrentSentence(browserEngine.chunks[idx]!)
        // Word-level sync: onboundary fires per word (Firefox/Safari).
        utterance.onboundary = (event) => {
          if (event.name !== 'word') return
          const sentence = browserEngine.chunks[idx] ?? ''
          const wi = wordIndexAt(sentence, event.charIndex ?? 0)
          browserEngine.wordIndex = wi
          browserEngine.globalWordIndex = (browserEngine.chunkWordOffsets[idx] ?? 0) + wi
          setWordIndex(wi)
          setGlobalWordIndex(browserEngine.globalWordIndex)
        }
        let sentenceStart = 0
        utterance.onstart = () => {
          sentenceStart = performance.now()
          advanceWord(0, idx)
          // Estimated total for this sentence (for calibration on end).
          const words = browserEngine.chunks[idx]?.match(/\S+/g) ?? []
          const estimated = words.reduce((sum, w) => sum + wordDuration(w), 0)
          browserEngine.paceFactor = Math.max(0.5, Math.min(2, browserEngine.paceFactor))
          ;(utterance as unknown as { __estimateMs?: number }).__estimateMs = estimated
          startWordTimer(idx)
        }
        utterance.onend = () => {
          clearEngineTimers()
          setWordIndex(-1)
          setGlobalWordIndex(-1)
          // Calibrate: actual sentence duration vs our estimate → next
          // sentence's timers match the real speaking pace.
          const estimateMs = (utterance as unknown as { __estimateMs?: number }).__estimateMs
          if (estimateMs && estimateMs > 0 && sentenceStart > 0) {
            const actual = performance.now() - sentenceStart
            const factor = Math.max(0.6, Math.min(1.6, actual / estimateMs))
            browserEngine.paceFactor = browserEngine.paceFactor * 0.7 + factor * 0.3
          }
          speakNext(idx + 1)
        }
        utterance.onerror = (event) => {
          if (event.error === 'interrupted' || event.error === 'canceled') return
          setState('idle')
          setText('')
          setCurrentSentence('')
          setSentenceIndex(-1)
          setWordIndex(-1)
          setGlobalWordIndex(-1)
        }
        window.speechSynthesis.speak(utterance)
      }

      window.speechSynthesis.cancel()
      window.setTimeout(() => speakNext(0), 60)
    },
    [manager, settings.speed, settings.volume, settings.muted],
  )

  const speak = useCallback(
    async (speechText: string) => {
      const cleaned = (speechText || '').trim()
      if (!cleaned) return

      // Stop browser engine if it's speaking.
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        browserEngine.status = 'idle'
      }

      // Browser SpeechSynthesis is the PRIMARY engine: it starts speaking
      // almost instantly (no network round trip) and fires word-boundary
      // events, giving us exact word-level synchronization with the report
      // text. ElevenLabs (blob audio) cannot provide word timing, so it is
      // only used as a premium fallback.
      if ('speechSynthesis' in window && !settings.voiceId) {
        speakBrowser(cleaned)
        return
      }

      // Premium engine: ElevenLabs via the backend, with an in-memory cache
      // so re-reading the same report never regenerates identical audio.
      if (getToken()) {
        try {
          setState('loading')
          setError(null)
          ensureVoices()
          const blob = await ttsService.synthesizeCached(cleaned, settings.voiceId || undefined)
          if (!blob || blob.size === 0) throw new Error('Empty response')
          const url = manager.createUrl(blob)
          manager.play({ text: cleaned, url })
          manager.setVolume(settings.muted ? 0 : settings.volume)
          manager.setSpeed(settings.speed)
          setCurrentSentence('')
          return
        } catch (err) {
          // Fall back to the browser engine — the button must always work.
          const message = err instanceof Error ? err.message : 'Voice generation failed.'
          setError(`${message} — using browser voice.`)
          speakBrowser(cleaned)
          return
        }
      }

      speakBrowser(cleaned)
    },
    [manager, settings.voiceId, settings.volume, settings.muted, settings.speed, speakBrowser, ensureVoices],
  )

  const pause = useCallback(() => {
    if (browserEngine.status === 'playing') {
      window.speechSynthesis.pause()
      browserEngine.status = 'paused'
      setState('paused')
    } else if (browserEngine.status === 'paused') {
      window.speechSynthesis.resume()
      browserEngine.status = 'playing'
      setState('playing')
    }
  }, [])

  const resume = useCallback(() => {
    if (browserEngine.status === 'paused') {
      window.speechSynthesis.resume()
      browserEngine.status = 'playing'
      setState('playing')
      return
    }
    manager.resume()
  }, [manager])

  const stop = useCallback(() => {
    clearEngineTimers()
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      browserEngine.status = 'idle'
    }
    manager.stop()
    setCurrentSentence('')
    setSentenceIndex(-1)
    setWordIndex(-1)
  }, [manager])

  const updateSettings = useCallback(
    (patch: Partial<VoiceSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch }
        writeSettings(next)
        // Apply live effects.
        if (patch.volume !== undefined) manager.setVolume(patch.volume)
        if (patch.muted !== undefined) manager.mute(patch.muted)
        if (patch.speed !== undefined) manager.setSpeed(patch.speed)
        return next
      })
    },
    [manager],
  )

  const isSpeaking = useMemo(
    () => state === 'playing' || state === 'loading' || browserEngine.status === 'playing',
    [state],
  )

  return {
    state: browserEngine.status === 'playing' || browserEngine.status === 'paused' ? browserEngine.status : state,
    error,
    progress,
    isSpeaking,
    text,
    currentSentence,
    sentenceIndex,
    wordIndex,
    globalWordIndex,
    settings,
    voices,
    speak,
    pause,
    resume,
    stop,
    updateSettings,
  }
}
