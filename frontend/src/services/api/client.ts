import axios, { AxiosError } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || ''

export const TOKEN_KEY = 'hirelens_token'
export const USER_KEY = 'hirelens_user'
export const REFRESH_TOKEN_KEY = 'hirelens_refresh_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string | undefined) {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function clearAuthStorage() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function redirectToLogin() {
  clearAuthStorage()
  window.dispatchEvent(new Event('hirelens:unauthorized'))
}

// Shared guards so concurrent 401s don't each trigger a logout or a refresh.
let isRefreshing = false
let loggedOut = false
let pendingRetries: Array<() => void> = []

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  try {
    const res = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
      refresh_token: refreshToken,
    })
    const data = res.data as { access_token?: string; refresh_token?: string }
    if (!data.access_token) return false
    setToken(data.access_token)
    if (data.refresh_token) setRefreshToken(data.refresh_token)
    return true
  } catch {
    return false
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const url = error.config?.url ?? ''
    const isAuthCall =
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/refresh')

    // A genuine 401 on login/register means wrong credentials — never logout.
    if (error.response?.status === 401 && isAuthCall) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !loggedOut) {
      // Try a silent refresh once, then retry the original request. Only if
      // refresh fails do we actually log the user out — this prevents
      // transient 401s (token expiry mid-processing) from kicking the admin
      // back to the login page.
      if (isRefreshing) {
        // Another request is already refreshing — wait for it, then retry.
        return new Promise((resolve, reject) => {
          pendingRetries.push(() => {
            retryOriginal(error)
              .then(resolve)
              .catch(reject)
          })
        })
      }

      isRefreshing = true
      try {
        const ok = await refreshAccessToken()
        if (ok) {
          const pending = pendingRetries
          pendingRetries = []
          pending.forEach((fn) => fn())
          return retryOriginal(error)
        }
      } finally {
        isRefreshing = false
      }

      // Refresh failed — the session is genuinely dead.
      loggedOut = true
      redirectToLogin()
      setTimeout(() => {
        loggedOut = false
      }, 1000)
    }

    return Promise.reject(error)
  },
)

/** Retry a failed request with the (possibly refreshed) token. */
async function retryOriginal(error: AxiosError): Promise<unknown> {
  const config = error.config
  if (!config) throw error
  const token = getToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return api.request(config)
}

/** Extract a human-readable message from any axios error. */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: unknown; message?: string; reason?: string }
      | undefined
    if (data) {
      if (typeof data.message === 'string') return data.message
      if (typeof data.reason === 'string') return data.reason
      if (typeof data.detail === 'string') return data.detail
      if (Array.isArray(data.detail)) {
        return data.detail
          .map((d) => (typeof d === 'object' && d && 'msg' in d ? String(d.msg) : String(d)))
          .join(', ')
      }
    }
    if (error.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.'
    if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.'
  }
  return error instanceof Error ? error.message : 'Something went wrong'
}

export { API_BASE_URL }
