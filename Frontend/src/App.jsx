import { Cloud, Loader2, LogOut, RefreshCw, WifiOff } from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from './context/AuthContext'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'

function FullScreenLoader() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Cloud className="h-10 w-10 text-blue-600" />
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat...
        </div>
      </div>
    </div>
  )
}

function SessionErrorScreen({ message, onRetry, onLogout }) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <WifiOff className="h-6 w-6 text-red-500" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Server tidak dapat dijangkau</h1>
        <p className="mt-2 text-sm text-slate-500">
          {message || 'Gagal memverifikasi sesi Anda. Pastikan backend sedang berjalan.'}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onRetry}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Coba lagi
          </button>
          <button
            onClick={onLogout}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </div>
    </div>
  )
}

// Hanya bisa diakses jika sudah login
function ProtectedRoute({ children }) {
  const { token, user, loading, authError, retry, logout } = useAuth()

  if (loading) return <FullScreenLoader />
  if (!token) return <Navigate to="/login" replace />
  if (!user) return <SessionErrorScreen message={authError} onRetry={retry} onLogout={logout} />
  return children
}

// Halaman login: jika sudah login langsung ke dashboard
function PublicRoute({ children }) {
  const { token, user, loading } = useAuth()

  if (loading) return <FullScreenLoader />
  if (token && user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
