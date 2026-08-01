import { api, getToken } from './client'

export interface TTSVoice {
  id: string
  name: string
  labels?: Record<string, string>
}

export interface TTSService {
  /** Synthesize text into an audio blob via the backend (never exposes the key). */
  synthesize: (text: string, voiceId?: string) => Promise<Blob>
  /** List available ElevenLabs voices. */
  listVoices: () => Promise<TTSVoice[]>
}

/** In-memory voice cache — avoids re-fetching on every player mount. */
let voicesCache: TTSVoice[] | null = null

export const ttsService: TTSService = {
  synthesize: async (text, voiceId) => {
    const res = await api.post<Blob>(
      '/api/tts',
      { text, voice_id: voiceId ?? '' },
      { responseType: 'blob', timeout: 60000 },
    )
    return res.data
  },

  listVoices: async () => {
    if (voicesCache) return voicesCache
    const res = await api.get<{ voices: TTSVoice[] }>('/api/tts/voices')
    voicesCache = res.data.voices ?? []
    return voicesCache
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
