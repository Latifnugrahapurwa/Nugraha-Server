import { FolderPlus, HardDrive, Loader2, Upload, X } from 'lucide-react'

import { VIEWS } from '../utils/views'
import { formatBytes } from '../utils/format'

function barColor(percent) {
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 70) return 'bg-amber-500'
  return 'bg-blue-600'
}

function StorageIndicator({ info, loading, error }) {
  if (loading && !info) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat info penyimpanan...
      </div>
    )
  }

  if (!info) {
    return <p className="text-sm text-red-500">{error ? 'Gagal memuat info penyimpanan' : '-'}</p>
  }

  const percent = Math.min(Math.max(info.percent_used || 0, 0), 100)

  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(percent)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-sm font-medium text-slate-700">
        {info.used_human} terpakai dari {info.total_human}
      </p>
      <p className="text-xs text-slate-500">
        {info.free_human} bebas · {percent.toFixed(1)}% terpakai
      </p>
      <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500">
        Isi cloud: {formatBytes(info.storage_used_bytes)} · {info.total_files} file · {info.total_folders} folder
      </p>
      {info.trash_used_bytes > 0 && (
        <p className="text-xs text-slate-500">Sampah: {info.trash_used_human}</p>
      )}
    </div>
  )
}

function NavButton({ view, active, onClick }) {
  const Icon = view.icon
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
        active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? 'text-blue-600' : view.color || ''}`} />
      {view.label}
    </button>
  )
}

export default function Sidebar({
  isOpen,
  onClose,
  view,
  onSelectView,
  canUpload,
  canCreateFolder,
  onUpload,
  onCreateFolder,
  storageInfo,
  storageLoading,
  storageError,
}) {
  // Tutup drawer (mobile) setelah memilih aksi
  const run = (action) => () => {
    action()
    onClose()
  }

  const mainViews = VIEWS.filter((entry) => entry.group === 'main')
  const categoryViews = VIEWS.filter((entry) => entry.group === 'category')
  const trashView = VIEWS.find((entry) => entry.group === 'trash')

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-30 bg-slate-900/40 md:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 transform flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4 md:hidden">
          <span className="text-sm font-semibold text-slate-700">Menu</span>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Tutup menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2 p-4">
          <button
            onClick={run(onUpload)}
            disabled={!canUpload}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Upload File
          </button>
          <button
            onClick={run(onCreateFolder)}
            disabled={!canCreateFolder}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderPlus className="h-4 w-4" />
            Folder Baru
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3">
          <div className="space-y-1">
            {mainViews.map((entry) => (
              <NavButton key={entry.id} view={entry} active={view === entry.id} onClick={run(() => onSelectView(entry.id))} />
            ))}
          </div>

          <p className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Kategori</p>
          <div className="space-y-1">
            {categoryViews.map((entry) => (
              <NavButton key={entry.id} view={entry} active={view === entry.id} onClick={run(() => onSelectView(entry.id))} />
            ))}
          </div>

          <div className="mt-4 space-y-1 border-t border-slate-100 pt-3">
            {trashView && (
              <NavButton view={trashView} active={view === trashView.id} onClick={run(() => onSelectView(trashView.id))} />
            )}
          </div>
        </nav>

        <div className="m-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <HardDrive className="h-4 w-4" />
            Penyimpanan
          </div>
          <StorageIndicator info={storageInfo} loading={storageLoading} error={storageError} />
        </div>
      </aside>
    </>
  )
}
