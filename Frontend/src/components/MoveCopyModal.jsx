import { Copy, FolderInput, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { filesApi, getErrorMessage } from '../services/api'
import { parentPath } from '../utils/format'
import Breadcrumb from './Breadcrumb'
import FileIcon from './FileIcon'
import Modal from './Modal'

// Pilih folder tujuan, lalu Pindahkan atau Salin
export default function MoveCopyModal({ item, onClose, onDone }) {
  const originPath = parentPath(item.path)
  const [browsePath, setBrowsePath] = useState(originPath)
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('') // '' | 'move' | 'copy'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    filesApi
      .list(browsePath, { sortBy: 'name', order: 'asc' })
      .then((data) => {
        if (cancelled) return
        // Folder yang sedang dipindah/disalin tidak ditampilkan sebagai tujuan
        setFolders(data.items.filter((entry) => entry.is_dir && entry.path !== item.path))
        setError('')
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Gagal memuat folder'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [browsePath, item.path])

  const insideSelf = item.is_dir && (browsePath === item.path || browsePath.startsWith(`${item.path}/`))
  const sameFolder = browsePath === originPath

  const run = async (mode) => {
    setBusy(mode)
    setError('')
    try {
      const result = mode === 'move' ? await filesApi.move(item.path, browsePath) : await filesApi.copy(item.path, browsePath)
      onDone(mode, item, result, browsePath)
    } catch (err) {
      setError(getErrorMessage(err, mode === 'move' ? 'Gagal memindahkan' : 'Gagal menyalin'))
      setBusy('')
    }
  }

  return (
    <Modal
      title="Pindahkan atau Salin"
      onClose={onClose}
      closable={!busy}
      size="md"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={Boolean(busy)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={() => run('copy')}
            disabled={Boolean(busy) || insideSelf}
            className="flex items-center gap-2 rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'copy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Salin ke sini
          </button>
          <button
            onClick={() => run('move')}
            disabled={Boolean(busy) || insideSelf || sameFolder}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'move' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderInput className="h-4 w-4" />}
            Pindahkan ke sini
          </button>
        </>
      }
    >
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
        <FileIcon item={item} />
        <span className="truncate text-sm font-medium text-slate-800" title={item.name}>
          {item.name}
        </span>
      </div>

      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Pilih folder tujuan</p>
      <div className="mb-2 rounded-lg border border-slate-200 px-2 py-1">
        <Breadcrumb path={browsePath} onNavigate={setBrowsePath} />
      </div>

      <div className="h-56 overflow-y-auto rounded-lg border border-slate-200">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Memuat...
          </div>
        ) : folders.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
            Tidak ada subfolder di sini
          </div>
        ) : (
          <ul>
            {folders.map((folder) => (
              <li key={folder.path}>
                <button
                  onClick={() => setBrowsePath(folder.path)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <FileIcon item={folder} />
                  <span className="truncate">{folder.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {insideSelf && <p className="mt-2 text-xs text-amber-600">Folder tidak dapat dipindah/disalin ke dalam dirinya sendiri.</p>}
      {!insideSelf && sameFolder && (
        <p className="mt-2 text-xs text-slate-500">Item sudah berada di folder ini. Anda masih bisa membuat salinan.</p>
      )}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}
