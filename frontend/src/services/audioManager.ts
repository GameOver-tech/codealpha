/**
 * AudioManager — the app's single source of truth for audio playback.
 *
 * Guarantees:
 *  - Only ONE audio instance plays at any time.
 *  - Starting new audio cancels the previous playback and cleans up.
 *  - Object URLs are always revoked (no memory leaks).
 *  - Listeners are cleaned up on unmount/stop.
 *
 * Use `getAudioManager()` anywhere; it's a singleton shared across the app
 * so chat, reports, and the floating controls all control the same playback.
 */

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'

export interface AudioManager {
  readonly state: PlaybackState
  readonly error: string | null
  /** 0-100 progress for the current clip. */
  readonly progress: number
  /** Text that is currently loaded for speech. */
  readonly currentText: string
  play: (source: { text: string; url: string }) => void
  pause: () => void
  resume: () => void
  stop: () => void
  seekToStart: () => void
  setVolume: (volume: number) => void
  setSpeed: (speed: number) => void
  mute: (muted: boolean) => void
  /** Subscribe to state changes. Returns an unsubscribe fn. */
  subscribe: (listener: () => void) => () => void
  /** Create a blob URL for audio bytes and keep it managed. */
  createUrl: (blob: Blob) => string
}

class AudioManagerImpl implements AudioManager {
  private audio: HTMLAudioElement
  private _state: PlaybackState = 'idle'
  private _error: string | null = null
  private _progress = 0
  private _currentText = ''
  private _url: string | null = null
  private _volume = 1
  private _muted = false
  private listeners = new Set<() => void>()

  constructor() {
    this.audio = new Audio()
    this.audio.preload = 'auto'
    this.bindEvents()
  }

  private bindEvents() {
    this.audio.addEventListener('timeupdate', () => {
      if (this.audio.duration) {
        this._progress = (this.audio.currentTime / this.audio.duration) * 100
        this.emit()
      }
    })
    this.audio.addEventListener('play', () => {
      this._state = 'playing'
      this.emit()
    })
    this.audio.addEventListener('pause', () => {
      if (this._state === 'playing') this._state = 'paused'
      this.emit()
    })
    this.audio.addEventListener('ended', () => {
      this._state = 'ended'
      this._progress = 0
      this.emit()
    })
    this.audio.addEventListener('error', () => {
      this._state = 'error'
      this._error = 'Audio could not be played.'
      this.emit()
    })
  }

  get state() {
    return this._state
  }

  get error() {
    return this._error
  }

  get progress() {
    return this._progress
  }

  get currentText() {
    return this._currentText
  }

  createUrl(blob: Blob): string {
    this.revoke()
    this._url = URL.createObjectURL(blob)
    return this._url
  }

  private revoke() {
    if (this._url) {
      URL.revokeObjectURL(this._url)
      this._url = null
    }
  }

  play(source: { text: string; url: string }) {
    // Cancel whatever is playing first (single-instance rule).
    this.audio.pause()
    this.revoke()

    this._currentText = source.text
    this._error = null
    this._progress = 0
    this.audio.src = source.url
    this.audio.volume = this._muted ? 0 : this._volume

    this.audio
      .play()
      .then(() => {
        this._state = 'playing'
        this.emit()
      })
      .catch(() => {
        this._state = 'error'
        this._error = 'Playback could not start.'
        this.emit()
      })
  }

  pause() {
    this.audio.pause()
    this._state = 'paused'
    this.emit()
  }

  resume() {
    this.audio
      .play()
      .then(() => {
        this._state = 'playing'
        this.emit()
      })
      .catch(() => {
        this._state = 'error'
        this._error = 'Could not resume playback.'
        this.emit()
      })
  }

  stop() {
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.revoke()
    this._state = 'idle'
    this._error = null
    this._progress = 0
    this._currentText = ''
    this.emit()
  }

  seekToStart() {
    this.audio.currentTime = 0
    this._progress = 0
    this.emit()
  }

  setVolume(volume: number) {
    this._volume = Math.min(1, Math.max(0, volume))
    this.audio.volume = this._muted ? 0 : this._volume
    this.emit()
  }

  setSpeed(speed: number) {
    this.audio.playbackRate = Math.min(2, Math.max(0.5, speed))
    this.emit()
  }

  mute(muted: boolean) {
    this._muted = muted
    this.audio.volume = muted ? 0 : this._volume
    this.emit()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    this.listeners.forEach((fn) => fn())
  }
}

let instance: AudioManager | null = null

export function getAudioManager(): AudioManager {
  if (!instance) instance = new AudioManagerImpl()
  return instance
}
