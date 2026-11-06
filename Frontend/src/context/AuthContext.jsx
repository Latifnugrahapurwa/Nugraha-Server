import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { authApi, getErrorMessage, TOKEN_KEY, UNAUTHORIZED_EVENT } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)))
  const [authError, setAuthError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    setAuthError('')
  }, [])

  // Validasi token yang tersimpan setiap aplikasi dibuka
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return undefined
    }
    if (user) {
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setAuthError('')

    authApi
      .me()
      .then((profile) => {
        if (!cancelled) setUser(profile)
      })
      .catch((error) => {
        if (cancelled) return
        if (error.response?.status === 401) {
          clearSession()
        } else {
          // Server mati / jaringan bermasalah: jangan hapus token, biarkan user mencoba lagi
          setAuthError(getErrorMessage(error, 'Gagal memverifikasi sesi'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, user, reloadKey, clearSession])

  // Interceptor Axios memberi sinyal ini saat server menjawab 401
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, clearSession)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, clearSession)
  }, [clearSession])

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password)
    localStorage.setItem(TOKEN_KEY, data.access_token)
    setAuthError('')
    setUser(data.user)
    setToken(data.access_token)
    return data.user
  }, [])

  const logout = useCallback(() => {
    clearSession()
  }, [clearSession])

  const retry = useCallback(() => setReloadKey((key) => key + 1), [])

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      authError,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      retry,
    }),
    [token, user, loading, authError, login, logout, retry],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  }
  return context
}
