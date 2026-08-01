/**
 * Speech utilities — voice helpers and normalization for the Web Speech API.
 * Pure functions, no React dependencies.
 */

/** Browser support check — true when the Web Speech API is available. */
export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

/** Return the browser's available voices (with async-load guard). */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return []
  return window.speechSynthesis.getVoices() ?? []
}

/** Prefer natural English voices; falls back to the full list otherwise. */
export function preferEnglishVoices(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  if (!list.length) return list
  const english = list.filter((v) => v.lang?.toLowerCase().startsWith('en'))
  return english.length ? english : list
}

/** Collapse whitespace and clean up a text fragment for speech. */
export function normalizeText(raw: string): string {
  return (raw || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim()
}
