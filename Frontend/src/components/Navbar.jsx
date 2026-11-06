import { Cloud, LogOut, Menu, ShieldCheck } from 'lucide-react'

import { useAuth } from '../context/AuthContext'

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth()
  const initial = (user?.username || '?').charAt(0).toUpperCase()

  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-5">
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
          aria-label="Buka menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Cloud className="h-5 w-5 text-white" />
          </div>
          <span className="text-base font-semibold text-slate-900">My Cloud Storage</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
            {initial}
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium text-slate-800">{user?.username}</p>
            {user?.is_admin && (
              <p className="flex items-center gap-1 text-xs text-blue-600">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </p>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-red-600"
          title="Keluar"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  )
}
