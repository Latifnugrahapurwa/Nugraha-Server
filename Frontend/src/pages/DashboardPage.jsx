import {
  AlertCircle,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardCopy,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  FolderInput,
  FolderOpen,
  FolderPlus,
  FolderUp,
  Info,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import Breadcrumb from '../components/Breadcrumb'
import ConfirmModal from '../components/ConfirmModal'
import ContextMenu from '../components/ContextMenu'
import CreateFolderModal from '../components/CreateFolderModal'
import DetailsModal from '../components/DetailsModal'
import FileGrid from '../components/FileGrid'
import { getPreviewKind } from '../components/FileIcon'
import FileTable from '../components/FileTable'
import MoveCopyModal from '../components/MoveCopyModal'
import Navbar from '../components/Navbar'
import PreviewModal from '../components/PreviewModal'
import RenameModal from '../components/RenameModal'
import Sidebar from '../components/Sidebar'
import TrashTable from '../components/TrashTable'
import UploadPanel from '../components/UploadPanel'
import useUploader from '../hooks/useUploader'
import { filesApi, getErrorMessage, systemApi, trashApi, triggerDownload } from '../services/api'
import { copyToClipboard } from '../utils/clipboard'
import { collectDroppedFiles, collectInputFiles } from '../utils/dropFiles'
import { buildBreadcrumbs, normalizePath, parentPath } from '../utils/format'
import { getView, getViewMode, VIEW_IDS } from '../utils/views'

const VIEW_KEY = 'cloud_storage_view_mode'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function DashboardPage() {
  // Tampilan & lokasi disimpan di URL: /?path=Documents/Work  atau  /?view=photos  atau  /?view=trash
  const [searchParams, setSearchParams] = useSearchParams()
  const rawView = searchParams.get('view') || 'files'
  const view = VIEW_IDS.includes(rawView) ? rawView : 'files'
  const mode = getViewMode(view) // 'files' | 'category' | 'trash'
  const viewMeta = getView(view)
  const currentPath = mode === 'files' ? normalizePath(searchParams.get('path') || '') : ''

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [sortPrefs, setSortPrefs] = useState({
    files: { by: 'name', order: 'asc' },
    category: { by: 'modified', order: 'desc' },
  })
  const sortKey = mode === 'category' ? 'category' : 'files'
  const sortBy = sortPrefs[sortKey].by
  const order = sortPrefs[sortKey].order

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search.trim(), 300)
  const [viewMode, setViewMode] = useState(() => (localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list'))

  const [storageInfo, setStorageInfo] = useState(null)
  const [storageLoading, setStorageLoading] = useState(true)
  const [storageError, setStorageError] = useState(false)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [previewPath, setPreviewPath] = useState(null)
  const [renameTarget, setRenameTarget] = useState(null)
  const [moveCopyTarget, setMoveCopyTarget] = useState(null)
  const [detailsTarget, setDetailsTarget] = useState(null) // { item, trash }
  const [confirm, setConfirm] = useState(null) // { type: 'forever', item } | { type: 'empty' }
  const [menu, setMenu] = useState(null) // { x, y, items, activePath, activeId }
  const [toast, setToast] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  const requestId = useRef(0)
  const dragDepth = useRef(0)
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)

  // ---------- Toast ----------
  const showToast = useCallback((type, text, action) => setToast({ id: Date.now(), type, text, action }), [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), toast.action ? 8000 : 4000)
    return () => clearTimeout(timer)
  }, [toast])

  // ---------- Data loading ----------
  const loadItems = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++requestId.current
      if (!silent) setLoading(true)
      try {
        let next
        if (mode === 'trash') {
          const res = await trashApi.list({ search: debouncedSearch })
          next = {
            kind: 'trash',
            items: res.items,
            total: res.total,
            totalSize: res.total_size_human,
            retentionDays: res.retention_days,
          }
        } else if (mode === 'category') {
          const res = await filesApi.category(view, { sortBy, order, search: debouncedSearch })
          next = {
            kind: 'category',
            items: res.items,
            total: res.total,
            totalSize: res.total_size_human,
            truncated: res.truncated,
          }
        } else {
          const res = await filesApi.list(currentPath, { sortBy, order, search: debouncedSearch })
          next = { kind: 'files', items: res.items, totalFolders: res.total_folders, totalFiles: res.total_files }
        }
        if (id !== requestId.current) return // abaikan respons usang
        setData(next)
        setError('')
      } catch (err) {
        if (id !== requestId.current) return
        setData(null)
        setError(getErrorMessage(err, 'Gagal memuat daftar file'))
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    },
    [mode, view, currentPath, sortBy, order, debouncedSearch],
  )

  const loadStorage = useCallback(async () => {
    try {
      setStorageInfo(await systemApi.storageInfo())
      setStorageError(false)
    } catch (err) {
      setStorageError(true)
    } finally {
      setStorageLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  useEffect(() => {
    loadStorage()
  }, [loadStorage])

  // ---------- Upload otomatis ----------
  const handleBatchComplete = useCallback(() => {
    loadItems({ silent: true })
    loadStorage()
  }, [loadItems, loadStorage])

  const uploader = useUploader({ onBatchComplete: handleBatchComplete })

  // Peringatan jika tab ditutup saat upload berjalan
  useEffect(() => {
    if (!uploader.isUploading) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploader.isUploading])

  const uploadLabel = buildBreadcrumbs(currentPath).map((crumb) => crumb.name).join(' / ')

  const pickFiles = () => fileInputRef.current?.click()
  const pickFolder = () => folderInputRef.current?.click()

  const handleFilesPicked = (event) => {
    const files = Array.from(event.target.files || []).map((file) => ({ file, relDir: '' }))
    event.target.value = ''
    uploader.add({ files, dirs: [] }, currentPath)
  }

  const handleFolderPicked = (event) => {
    const collected = collectInputFiles(event.target.files)
    event.target.value = ''
    uploader.add(collected, currentPath)
  }

  // ---------- Drag & drop di seluruh halaman ----------
  const hasFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files')

  const handleDragEnter = (event) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current += 1
    setDragActive(true)
  }

  const handleDragOver = (event) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = mode === 'trash' ? 'none' : 'copy'
  }

  const handleDragLeave = () => {
    dragDepth.current = Math.max(dragDepth.current - 1, 0)
    if (dragDepth.current === 0) setDragActive(false)
  }

  const handleDrop = async (event) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current = 0
    setDragActive(false)

    if (mode === 'trash') {
      showToast('error', 'Tidak dapat meng-upload ke Sampah')
      return
    }
    const collected = await collectDroppedFiles(event.dataTransfer)
    uploader.add(collected, currentPath)
  }

  // ---------- Navigasi ----------
  const goToView = useCallback(
    (nextView) => {
      setSearch('')
      setSearchParams(nextView === 'files' ? {} : { view: nextView })
    },
    [setSearchParams],
  )

  const navigateTo = useCallback(
    (path) => {
      const normalized = normalizePath(path)
      setSearch('')
      setSearchParams(normalized ? { path: normalized } : {})
    },
    [setSearchParams],
  )

  const setSort = (by, nextOrder) => setSortPrefs((prefs) => ({ ...prefs, [sortKey]: { by, order: nextOrder } }))

  const handleSort = (field) => {
    if (sortBy === field) setSort(field, order === 'asc' ? 'desc' : 'asc')
    else setSort(field, field === 'name' ? 'asc' : 'desc')
  }

  const changeViewMode = (nextMode) => {
    setViewMode(nextMode)
    localStorage.setItem(VIEW_KEY, nextMode)
  }

  const refreshAll = () => {
    loadItems()
    loadStorage()
  }

  // ---------- Aksi item ----------
  const ready = data?.kind === mode
  const items = ready ? data.items : []
  const previewItems = mode === 'trash' ? [] : items.filter((item) => getPreviewKind(item))

  const handleDownload = (item) => triggerDownload(filesApi.downloadUrl(item.path), item.name)

  const handleOpen = (item) => {
    if (item.is_dir) navigateTo(item.path)
    else if (getPreviewKind(item)) setPreviewPath(item.path)
    else handleDownload(item)
  }

  const handleTrash = async (item) => {
    try {
      const res = await filesApi.remove(item.path)
      const undo = res.trash_id
        ? {
            label: 'Urungkan',
            onClick: async () => {
              try {
                await trashApi.restore(res.trash_id)
                showToast('success', `"${item.name}" dipulihkan`)
                loadItems({ silent: true })
                loadStorage()
              } catch (err) {
                showToast('error', getErrorMessage(err, 'Gagal memulihkan'))
              }
            },
          }
        : undefined
      showToast('success', `"${item.name}" dipindahkan ke Sampah`, undo)
      loadItems({ silent: true })
      loadStorage()
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Gagal memindahkan ke Sampah'))
    }
  }

  const handleCopyPath = async (item) => {
    try {
      await copyToClipboard(`/${item.path}`)
      showToast('success', 'Path disalin ke clipboard')
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Gagal menyalin path'))
    }
  }

  const handleRenamed = (oldItem, renamed) => {
    setRenameTarget(null)
    showToast('success', `Diganti menjadi "${renamed.name}"`)
    loadItems({ silent: true })
  }

  const handleMoveCopyDone = (action, item, result, destination) => {
    setMoveCopyTarget(null)
    const where = `/${destination}`
    showToast('success', `"${item.name}" ${action === 'move' ? 'dipindahkan' : 'disalin'} ke ${where}`)
    loadItems({ silent: true })
    if (action === 'copy') loadStorage()
  }

  const handleFolderCreated = (folder) => {
    setShowCreateFolder(false)
    showToast('success', `Folder "${folder.name}" berhasil dibuat`)
    loadItems({ silent: true })
  }

  // ---------- Aksi Sampah ----------
  const handleRestore = async (item) => {
    try {
      const res = await trashApi.restore(item.id)
      showToast('success', `"${item.name}" dipulihkan ke /${parentPath(res.path || '')}`)
      loadItems({ silent: true })
      loadStorage()
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Gagal memulihkan'))
      loadItems({ silent: true })
    }
  }

  const confirmDeleteForever = async () => {
    const { item } = confirm
    await trashApi.remove(item.id)
    setConfirm(null)
    showToast('success', `"${item.name}" dihapus permanen`)
    loadItems({ silent: true })
    loadStorage()
  }

  const confirmEmptyTrash = async () => {
    const res = await trashApi.empty()
    setConfirm(null)
    showToast('success', res.message || 'Sampah dikosongkan')
    loadItems({ silent: true })
    loadStorage()
  }

  // ---------- Menu klik kanan ----------
  const openItemMenu = (item, x, y) => {
    const isFolder = item.is_dir
    const previewable = Boolean(getPreviewKind(item))

    const moreItems = [
      { key: 'rename', label: 'Ganti Nama', icon: Pencil, onClick: () => setRenameTarget(item) },
      { key: 'copypath', label: 'Salin Path', icon: ClipboardCopy, onClick: () => handleCopyPath(item) },
    ]
    if (!isFolder && previewable) {
      moreItems.push({
        key: 'newtab',
        label: 'Buka di Tab Baru',
        icon: ExternalLink,
        onClick: () => window.open(filesApi.downloadUrl(item.path, { inline: true }), '_blank', 'noopener'),
      })
    }
    if (mode !== 'files') {
      moreItems.push({
        key: 'location',
        label: 'Buka Lokasi File',
        icon: FolderOpen,
        onClick: () => navigateTo(parentPath(item.path)),
      })
    }

    const entries = [
      {
        key: 'open',
        label: isFolder ? 'Buka' : previewable ? 'Pratinjau' : 'Buka',
        icon: isFolder ? FolderOpen : Eye,
        onClick: () => handleOpen(item),
      },
    ]
    if (!isFolder) entries.push({ key: 'download', label: 'Download', icon: Download, onClick: () => handleDownload(item) })
    entries.push(
      { key: 'trash', label: 'Pindahkan ke Sampah', icon: Trash2, danger: true, onClick: () => handleTrash(item) },
      { key: 'movecopy', label: 'Pindahkan atau Salin', icon: FolderInput, onClick: () => setMoveCopyTarget(item) },
      { type: 'separator', key: 'sep1' },
      { key: 'details', label: 'Detail', icon: Info, onClick: () => setDetailsTarget({ item, trash: false }) },
      { key: 'more', label: 'Aksi Lainnya', icon: Ellipsis, submenu: moreItems },
    )

    setMenu({ x, y, items: entries, activePath: item.path })
  }

  const openTrashMenu = (item, x, y) => {
    setMenu({
      x,
      y,
      activeId: item.id,
      items: [
        { key: 'restore', label: 'Pulihkan', icon: ArchiveRestore, onClick: () => handleRestore(item) },
        { key: 'forever', label: 'Hapus Permanen', icon: Trash2, danger: true, onClick: () => setConfirm({ type: 'forever', item }) },
        { type: 'separator', key: 'sep1' },
        { key: 'details', label: 'Detail', icon: Info, onClick: () => setDetailsTarget({ item, trash: true }) },
      ],
    })
  }

  const handleBackgroundContextMenu = (event) => {
    if (event.target.closest('input, textarea, select')) return
    event.preventDefault()

    let entries
    if (mode === 'trash') {
      entries = [
        {
          key: 'empty',
          label: 'Kosongkan Sampah',
          icon: Trash2,
          danger: true,
          disabled: items.length === 0,
          onClick: () => setConfirm({ type: 'empty' }),
        },
        { type: 'separator', key: 'sep1' },
        { key: 'refresh', label: 'Muat Ulang', icon: RefreshCw, onClick: refreshAll },
      ]
    } else {
      entries = [{ key: 'upload', label: 'Upload File', icon: Upload, onClick: pickFiles }]
      entries.push({ key: 'uploadfolder', label: 'Upload Folder', icon: FolderUp, onClick: pickFolder })
      if (mode === 'files') {
        entries.push({ key: 'newfolder', label: 'Folder Baru', icon: FolderPlus, onClick: () => setShowCreateFolder(true) })
      }
      entries.push(
        { type: 'separator', key: 'sep1' },
        {
          key: 'toggleview',
          label: viewMode === 'list' ? 'Tampilan Grid' : 'Tampilan Daftar',
          icon: viewMode === 'list' ? LayoutGrid : List,
          onClick: () => changeViewMode(viewMode === 'list' ? 'grid' : 'list'),
        },
        { key: 'refresh', label: 'Muat Ulang', icon: RefreshCw, onClick: refreshAll },
      )
    }
    setMenu({ x: event.clientX, y: event.clientY, items: entries })
  }

  const closeMenu = useCallback(() => setMenu(null), [])

  // ---------- Render ----------
  const hasSearch = debouncedSearch.length > 0
  const ViewIcon = viewMeta.icon
  const searchPlaceholder =
    mode === 'files' ? 'Cari di folder ini...' : mode === 'trash' ? 'Cari di Sampah...' : `Cari di ${viewMeta.label}...`

  return (
    <div
      className="flex h-dvh flex-col bg-slate-50"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Navbar onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          view={view}
          onSelectView={goToView}
          canUpload={mode !== 'trash'}
          canCreateFolder={mode === 'files'}
          onUpload={pickFiles}
          onCreateFolder={() => setShowCreateFolder(true)}
          storageInfo={storageInfo}
          storageLoading={storageLoading}
          storageError={storageError}
        />

        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6" onContextMenu={handleBackgroundContextMenu}>
          <div className="min-h-full">
            {/* Judul / breadcrumb */}
            <div className="mb-4 flex items-center justify-between gap-3">
              {mode === 'files' ? (
                <Breadcrumb path={currentPath} onNavigate={navigateTo} />
              ) : (
                <div className="flex min-w-0 items-center gap-2">
                  <ViewIcon className={`h-6 w-6 shrink-0 ${viewMeta.color || 'text-slate-600'}`} />
                  <h1 className="truncate text-lg font-semibold text-slate-900">{viewMeta.label}</h1>
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                    aria-label="Hapus pencarian"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="ml-auto flex items-center gap-2">
                {mode !== 'trash' && viewMode === 'grid' && (
                  <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 bg-white">
                    <select
                      value={sortBy}
                      onChange={(event) => setSort(event.target.value, order)}
                      className="bg-transparent py-2 pl-3 pr-1 text-sm text-slate-700 outline-none"
                      aria-label="Urutkan berdasarkan"
                    >
                      <option value="name">Nama</option>
                      <option value="size">Ukuran</option>
                      <option value="modified">Tanggal</option>
                    </select>
                    <button
                      onClick={() => setSort(sortBy, order === 'asc' ? 'desc' : 'asc')}
                      className="border-l border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                      aria-label="Balik urutan"
                      title={order === 'asc' ? 'Naik' : 'Turun'}
                    >
                      {order === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </button>
                  </div>
                )}

                {mode !== 'trash' && (
                  <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
                    <button
                      onClick={() => changeViewMode('list')}
                      className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                      aria-label="Tampilan daftar"
                      title="Daftar"
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => changeViewMode('grid')}
                      className={`border-l border-slate-200 p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                      aria-label="Tampilan grid"
                      title="Grid"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <button
                  onClick={refreshAll}
                  className="rounded-lg border border-slate-300 bg-white p-2 text-slate-500 hover:bg-slate-50"
                  aria-label="Muat ulang"
                  title="Muat ulang"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>

                {mode === 'files' && (
                  <button
                    onClick={() => setShowCreateFolder(true)}
                    className="hidden items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:flex"
                  >
                    <FolderPlus className="h-4 w-4" />
                    Folder Baru
                  </button>
                )}
                {mode !== 'trash' && (
                  <button
                    onClick={pickFiles}
                    className="hidden items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:flex"
                  >
                    <Upload className="h-4 w-4" />
                    Upload
                  </button>
                )}
                {mode === 'trash' && (
                  <button
                    onClick={() => setConfirm({ type: 'empty' })}
                    disabled={items.length === 0}
                    className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Kosongkan Sampah
                  </button>
                )}
              </div>
            </div>

            {mode === 'trash' && ready && (
              <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Item di Sampah dihapus permanen otomatis setelah {data.retentionDays} hari. Klik kanan item untuk memulihkan.
              </p>
            )}

            {/* Konten */}
            {error ? (
              <div className="rounded-xl border border-red-200 bg-white p-8 text-center">
                <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
                <p className="mt-3 text-sm font-medium text-slate-800">{error}</p>
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    onClick={() => loadItems()}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Coba lagi
                  </button>
                  {(currentPath !== '' || mode !== 'files') && (
                    <button
                      onClick={() => goToView('files')}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Kembali ke Home
                    </button>
                  )}
                </div>
              </div>
            ) : !ready ? (
              <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-24 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Memuat...
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
                  <span>
                    {data.kind === 'files' && `${data.totalFolders} folder · ${data.totalFiles} file`}
                    {data.kind === 'category' &&
                      `${data.total} file · ${data.totalSize}${data.truncated ? ` (menampilkan ${data.items.length} teratas)` : ''}`}
                    {data.kind === 'trash' && `${data.total} item · ${data.totalSize}`}
                    {hasSearch && ` · hasil pencarian "${debouncedSearch}"`}
                  </span>
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </div>

                {items.length === 0 ? (
                  <div className="flex flex-col items-center px-4 py-16 text-center">
                    {mode === 'files' ? (
                      <FolderOpen className="h-14 w-14 text-slate-300" />
                    ) : (
                      <ViewIcon className="h-14 w-14 text-slate-300" />
                    )}
                    <p className="mt-3 text-sm font-medium text-slate-700">
                      {hasSearch
                        ? 'Tidak ada hasil yang cocok'
                        : mode === 'files'
                          ? 'Folder ini masih kosong'
                          : mode === 'trash'
                            ? 'Sampah kosong'
                            : `Belum ada file di kategori ${viewMeta.label}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {hasSearch
                        ? 'Coba kata kunci lain.'
                        : mode === 'trash'
                          ? 'File yang Anda hapus akan muncul di sini selama 30 hari.'
                          : 'Seret file ke sini atau gunakan tombol Upload.'}
                    </p>
                    {!hasSearch && mode !== 'trash' && (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={pickFiles}
                          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          <Upload className="h-4 w-4" />
                          Upload File
                        </button>
                        {mode === 'files' && (
                          <button
                            onClick={() => setShowCreateFolder(true)}
                            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <FolderPlus className="h-4 w-4" />
                            Folder Baru
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                    {mode === 'trash' ? (
                      <TrashTable
                        items={items}
                        activeId={menu?.activeId}
                        onRestore={handleRestore}
                        onDeleteForever={(item) => setConfirm({ type: 'forever', item })}
                        onContextMenu={openTrashMenu}
                      />
                    ) : viewMode === 'list' ? (
                      <FileTable
                        items={items}
                        sortBy={sortBy}
                        order={order}
                        onSort={handleSort}
                        onOpen={handleOpen}
                        onDownload={handleDownload}
                        onContextMenu={openItemMenu}
                        activePath={menu?.activePath}
                        showLocation={mode === 'category'}
                      />
                    ) : (
                      <FileGrid
                        items={items}
                        onOpen={handleOpen}
                        onDownload={handleDownload}
                        onContextMenu={openItemMenu}
                        activePath={menu?.activePath}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Input file tersembunyi */}
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilesPicked} />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFolderPicked}
        webkitdirectory=""
        directory=""
      />

      {/* Overlay drag & drop */}
      {dragActive && mode !== 'trash' && (
        <div className="pointer-events-none fixed inset-0 z-[65] flex items-center justify-center bg-blue-600/10 p-6">
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-blue-500 bg-white/95 px-10 py-8 shadow-xl">
            <UploadCloud className="h-12 w-12 text-blue-600" />
            <p className="mt-3 text-base font-semibold text-slate-900">Lepaskan untuk meng-upload</p>
            <p className="mt-1 text-sm text-slate-500">
              Tujuan: <span className="font-medium text-slate-700">{uploadLabel}</span>
            </p>
          </div>
        </div>
      )}

      {/* Panel progres upload */}
      <UploadPanel
        items={uploader.items}
        isUploading={uploader.isUploading}
        preparing={uploader.preparing}
        onCancel={uploader.cancelAll}
        onRetry={uploader.retryFailed}
        onClear={uploader.clearFinished}
      />

      {/* Menu klik kanan */}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />}

      {/* Modals */}
      {showCreateFolder && (
        <CreateFolderModal
          currentPath={currentPath}
          onClose={() => setShowCreateFolder(false)}
          onCreated={handleFolderCreated}
        />
      )}
      {renameTarget && <RenameModal item={renameTarget} onClose={() => setRenameTarget(null)} onRenamed={handleRenamed} />}
      {moveCopyTarget && (
        <MoveCopyModal item={moveCopyTarget} onClose={() => setMoveCopyTarget(null)} onDone={handleMoveCopyDone} />
      )}
      {detailsTarget && (
        <DetailsModal item={detailsTarget.item} trash={detailsTarget.trash} onClose={() => setDetailsTarget(null)} />
      )}
      {confirm?.type === 'forever' && (
        <ConfirmModal
          title="Hapus Permanen"
          message={`Hapus permanen "${confirm.item.name}"?`}
          detail="Item tidak dapat dikembalikan setelah dihapus permanen."
          confirmLabel="Hapus Permanen"
          onClose={() => setConfirm(null)}
          onConfirm={confirmDeleteForever}
        />
      )}
      {confirm?.type === 'empty' && (
        <ConfirmModal
          title="Kosongkan Sampah"
          message="Hapus permanen semua item di Sampah?"
          detail="Tindakan ini tidak dapat dibatalkan."
          confirmLabel="Kosongkan"
          onClose={() => setConfirm(null)}
          onConfirm={confirmEmptyTrash}
        />
      )}
      {previewPath && previewItems.some((item) => item.path === previewPath) && (
        <PreviewModal
          items={previewItems}
          startPath={previewPath}
          onClose={() => setPreviewPath(null)}
          onDownload={handleDownload}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 z-[90] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-fade-in items-center gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'
          }`}
          role="status"
        >
          {toast.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
          )}
          <span className="min-w-0 break-words">{toast.text}</span>
          {toast.action && (
            <button
              onClick={() => {
                const { onClick } = toast.action
                setToast(null)
                onClick()
              }}
              className="shrink-0 font-semibold text-blue-300 hover:text-blue-200"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
