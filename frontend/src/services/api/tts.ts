import { api, getToken } from './client'

export interface TTSVoice {
  id: string
  name: string
  labels?: Record<string, string>
}

export interface TTSService {
  /** Synthesize text into an audio blob via the backend (never exposes the key). */
  synthesize: (text: string, voiceId?: string) => Promise<Blob>
  /** Synthesize with an in-memory cache — identical text is never regenerated. */
  synthesizeCached: (text: string, voiceId?: string) => Promise<Blob>
  /** List available ElevenLabs voices. */
  listVoices: () => Promise<TTSVoice[]>
}

/** In-memory voice cache + in-flight promise — never duplicate requests. */
let voicesCache: TTSVoice[] | null = null
let voicesPromise: Promise<TTSVoice[]> | null = null

/** LRU-ish cache of synthesized audio keyed by text+voice (bounded size). */
const audioCache = new Map<string, Blob>()
const AUDIO_CACHE_MAX = 20

function cacheKey(text: string, voiceId?: string): string {
  return `${voiceId ?? 'default'}::${text}`
}

export const ttsService: TTSService = {
  synthesize: async (text, voiceId) => {
    const res = await api.post<Blob>(
      '/api/tts',
      { text, voice_id: voiceId ?? '' },
      { responseType: 'blob', timeout: 60000 },
    )
    return res.data
  },

  synthesizeCached: async (text, voiceId) => {
    const key = cacheKey(text, voiceId)
    const hit = audioCache.get(key)
    if (hit) return hit

    const blob = await ttsService.synthesize(text, voiceId)
    // Bound the cache — evict oldest entries when it grows too large.
    audioCache.set(key, blob)
    if (audioCache.size > AUDIO_CACHE_MAX) {
      const oldest = audioCache.keys().next().value
      if (oldest !== undefined) audioCache.delete(oldest)
    }
    return blob
  },

  listVoices: async () => {
    if (voicesCache) return voicesCache
    if (voicesPromise) return voicesPromise

    voicesPromise = api
      .get<{ voices: TTSVoice[] }>('/api/tts/voices')
      .then((res) => {
        voicesCache = res.data.voices ?? []
        return voicesCache
      })
      .finally(() => {
        voicesPromise = null
      })

    return voicesPromise
  },
}

/** Fetch a TTS audio URL (used for streaming into an <audio> element). */
export async function ttsAudioUrl(text: string, voiceId?: string): Promise<string> {
  const blob = await ttsService.synthesize(text, voiceId)
  return URL.createObjectURL(blob)
}

/** Cleanup helper for object URLs created above. */
export function revokeTtsUrl(url: string | null) {
  if (url) URL.revokeObjectURL(url)
}

// Keep the token interceptor working for the raw fetch path.
export function ttsAuthHeader(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
