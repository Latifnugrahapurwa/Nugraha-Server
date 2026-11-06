import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { formatBytes, getExtension } from '../utils/format'
import FileIcon from './FileIcon'

// Panel upload melayang (kanan bawah). Upload berjalan otomatis; panel hanya menampilkan progres.
export default function UploadPanel({ items, isUploading, preparing, onCancel, onRetry, onClear }) {
  const [collapsed, setCollapsed] = useState(false)

  const total = items.length
  const doneCount = items.filter((item) => item.status === 'done').length
  const failedCount = items.filter((item) => item.status === 'error' || item.status === 'canceled').length
  const pendingCount = items.filter((item) => item.status === 'pending' || item.status === 'uploading').length

  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0)
  const loadedBytes = items.reduce((sum, item) => {
    if (item.status === 'done') return sum + item.file.size
    if (item.status === 'uploading') return sum + item.file.size * item.progress
    return sum
  }, 0)
  const percent = totalBytes ? Math.round((loadedBytes / totalBytes) * 100) : isUploading ? 0 : 100

  // Tutup otomatis beberapa detik setelah semua berhasil
  useEffect(() => {
    if (total > 0 && !isUploading && !preparing && pendingCount === 0 && failedCount === 0) {
      const timer = setTimeout(onClear, 4000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [total, isUploading, preparing, pendingCount, failedCount, onClear])

  if (total === 0 && !preparing) return null

  let title
  if (preparing && total === 0) title = 'Menyiapkan folder...'
  else if (isUploading) title = `Mengupload ${Math.min(doneCount + 1, total)} dari ${total} file`
  else if (failedCount > 0) title = `${doneCount} selesai, ${failedCount} gagal`
  else title = `${doneCount} file selesai di-upload`

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[22rem] max-w-[calc(100vw-2rem)] animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center gap-2 bg-slate-900 px-4 py-3 text-white">
        {(isUploading || preparing) && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
        {!isUploading && !preparing && failedCount === 0 && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />}
        {!isUploading && !preparing && failedCount > 0 && <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />}
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
        <button
          onClick={() => setCollapsed((value) => !value)}
          className="rounded p-1 hover:bg-white/10"
          aria-label={collapsed ? 'Perbesar panel' : 'Kecilkan panel'}
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {!isUploading && (
          <button onClick={onClear} className="rounded p-1 hover:bg-white/10" aria-label="Tutup panel">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {(isUploading || doneCount > 0) && total > 0 && (
        <div className="h-1 w-full bg-slate-200">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      )}

      {!collapsed && total > 0 && (
        <>
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {items.map((item) => {
              const itemPercent = Math.round(item.progress * 100)
              return (
                <li key={item.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <FileIcon item={{ is_dir: false, extension: getExtension(item.file.name) }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-800" title={item.label}>
                        {item.label}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {formatBytes(item.file.size)}
                        {item.status === 'pending' && ' · Menunggu'}
                        {item.status === 'canceled' && ' · Dibatalkan'}
                        {item.status === 'uploading' && (itemPercent >= 100 ? ' · Memproses...' : ` · ${itemPercent}%`)}
                        {item.status === 'done' && item.savedAs && item.savedAs !== item.file.name && ` · disimpan sebagai "${item.savedAs}"`}
                      </p>
                    </div>
                    {item.status === 'uploading' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />}
                    {item.status === 'done' && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />}
                    {item.status === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}
                  </div>
                  {item.status === 'uploading' && (
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${itemPercent}%` }} />
                    </div>
                  )}
                  {item.status === 'error' && <p className="mt-1 text-xs text-red-600">{item.error}</p>}
                </li>
              )
            })}
          </ul>

          {(isUploading || failedCount > 0) && (
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-2.5">
              {failedCount > 0 && !isUploading && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Coba lagi
                </button>
              )}
              {isUploading && (
                <button
                  onClick={onCancel}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Batalkan semua
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
