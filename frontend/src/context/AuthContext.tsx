import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  authApi,
  clearAuthStorage,
  getToken,
  setToken,
  setRefreshToken,
  USER_KEY,
} from '@/services/api'
import type { User } from '@/types'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (payload: {
    first_name: string
    last_name: string
    email: string
    password: string
    phone?: string
    gender?: string
  }) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser)
  const [isLoading, setIsLoading] = useState(true)

  // Listen for the 401 interceptor event -> clear session state.
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null)
      window.location.href = '/login'
    }
    window.addEventListener('hirelens:unauthorized', onUnauthorized)
    return () => window.removeEventListener('hirelens:unauthorized', onUnauthorized)
  }, [])

  // Restore session: if a token exists, validate it against /me.
  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      if (!getToken()) {
        setIsLoading(false)
        return
      }
      try {
        const res = await authApi.me()
        if (!cancelled) {
          setUser(res.data)
          localStorage.setItem(USER_KEY, JSON.stringify(res.data))
        }
      } catch {
        if (!cancelled) {
          clearAuthStorage()
          setUser(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password })
    setToken(res.data.access_token)
    setRefreshToken(res.data.refresh_token)
    const me = await authApi.me()
    setUser(me.data)
    localStorage.setItem(USER_KEY, JSON.stringify(me.data))
    return me.data
  }, [])

  const register = useCallback(
    async (payload: {
      first_name: string
      last_name: string
      email: string
      password: string
      phone?: string
      gender?: string
    }) => {
      const res = await authApi.register(payload)
      if (res.data.access_token) {
        setToken(res.data.access_token)
        setRefreshToken(res.data.refresh_token)
        const me = await authApi.me()
        setUser(me.data)
        localStorage.setItem(USER_KEY, JSON.stringify(me.data))
        return me.data
      }
      // Token exchange failed on the backend — instruct to log in.
      throw new Error('Account created. Please sign in to continue.')
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // JWT is stateless — ignore errors and clear locally regardless.
    } finally {
      clearAuthStorage()
      setUser(null)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const res = await authApi.me()
    setUser(res.data)
    localStorage.setItem(USER_KEY, JSON.stringify(res.data))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token: getToken(),
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
