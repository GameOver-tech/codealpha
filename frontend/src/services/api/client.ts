import axios, { AxiosError } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const TOKEN_KEY = 'hirelens_token'
export const USER_KEY = 'hirelens_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuthStorage() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
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

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Ignore the /api/auth/login call itself (wrong credentials).
      const url = error.config?.url ?? ''
      if (!url.includes('/api/auth/login') && !url.includes('/api/auth/register')) {
        redirectToLogin()
      }
    }
    return Promise.reject(error)
  },
)

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
