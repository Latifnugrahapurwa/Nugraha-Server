import { AlertCircle, Cloud, Eye, EyeOff, Loader2, Lock, User } from 'lucide-react'
import { useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../services/api'

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading) return

    if (!username.trim() || !password) {
      setError('Username dan password wajib diisi')
      return
    }

    setLoading(true)
    setError('')
    try {
      // Setelah berhasil, AuthContext menyimpan token dan PublicRoute otomatis
      // mengarahkan ke Dashboard.
      await login(username.trim(), password)
    } catch (err) {
      setError(getErrorMessage(err, 'Login gagal'))
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30">
            <Cloud className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">My Cloud Storage</h1>
          <p className="mt-1 text-sm text-slate-500">Masuk untuk mengakses file Anda</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" noValidate>
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
            Username
          </label>
          <div className="relative mb-4">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50"
              placeholder="admin"
            />
          </div>

          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative mb-5">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Akun admin pertama dibuat lewat endpoint <code className="rounded bg-slate-200 px-1">/api/auth/register</code> di
          dokumentasi backend (<code className="rounded bg-slate-200 px-1">/docs</code>).
        </p>
      </div>
    </div>
  )
}
