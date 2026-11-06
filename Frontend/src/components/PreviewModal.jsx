import { AlertCircle, ChevronLeft, ChevronRight, Download, Loader2, Music, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { filesApi, getErrorMessage } from '../services/api'
import { getPreviewKind } from './FileIcon'

function TextPreview({ path }) {
  const [state, setState] = useState({ loading: true, text: '', truncated: false, error: '' })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, text: '', truncated: false, error: '' })
    filesApi
      .readText(path)
      .then(({ text, truncated }) => {
        if (!cancelled) setState({ loading: false, text, truncated, error: '' })
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, text: '', truncated: false, error: getErrorMessage(err, 'Gagal membaca file') })
      })
    return () => {
      cancelled = true
    }
  }, [path])

  if (state.loading) {
    return (
      <div className="flex items-center gap-2 text-white/80">
        <Loader2 className="h-5 w-5 animate-spin" />
        Memuat...
      </div>
    )
  }
  if (state.error) return <p className="text-red-300">{state.error}</p>

  return (
    <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-sm text-slate-800">
        {state.text || '(file kosong)'}
      </pre>
      {state.truncated && (
        <p className="border-t border-slate-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          Hanya sebagian awal file yang ditampilkan. Download untuk melihat selengkapnya.
        </p>
      )}
    </div>
  )
}

function MediaError({ onDownload }) {
  return (
    <div className="max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
      <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
      <p className="mt-3 text-sm font-medium text-slate-800">File ini tidak dapat diputar/ditampilkan oleh browser.</p>
      <p className="mt-1 text-xs text-slate-500">Format atau codec-nya mungkin tidak didukung. Silakan download file.</p>
      <button
        onClick={onDownload}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Download className="h-4 w-4" />
        Download
      </button>
    </div>
  )
}

// Pratinjau gambar, video, audio, PDF, dan teks. items = daftar file yang bisa dipratinjau (untuk navigasi ← →).
export default function PreviewModal({ items, startPath, onClose, onDownload }) {
  const [index, setIndex] = useState(() => Math.max(items.findIndex((entry) => entry.path === startPath), 0))
  const [failed, setFailed] = useState(false)

  const item = items[index]
  const kind = item ? getPreviewKind(item) : null
  const hasMultiple = items.length > 1

  const goTo = useCallback(
    (delta) => {
      setFailed(false)
      setIndex((current) => (current + delta + items.length) % items.length)
    },
    [items.length],
  )

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft' && hasMultiple) goTo(-1)
      else if (event.key === 'ArrowRight' && hasMultiple) goTo(1)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose, goTo, hasMultiple])

  if (!item || !kind) return null

  const url = filesApi.downloadUrl(item.path, { inline: true })

  let content
  if (failed) {
    content = <MediaError onDownload={() => onDownload(item)} />
  } else if (kind === 'image') {
    content = (
      <img
        key={item.path}
        src={url}
        alt={item.name}
        onError={() => setFailed(true)}
        className="max-h-full max-w-full rounded object-contain"
      />
    )
  } else if (kind === 'video') {
    content = (
      <video
        key={item.path}
        src={url}
        controls
        autoPlay
        playsInline
        onError={() => setFailed(true)}
        className="max-h-full max-w-full rounded bg-black"
      />
    )
  } else if (kind === 'audio') {
    content = (
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-pink-50">
          <Music className="h-12 w-12 text-pink-500" />
        </div>
        <p className="mt-4 break-words text-sm font-semibold text-slate-900">{item.name}</p>
        <audio key={item.path} src={url} controls autoPlay onError={() => setFailed(true)} className="mt-5 w-full" />
      </div>
    )
  } else if (kind === 'pdf') {
    content = <iframe key={item.path} src={url} title={item.name} className="h-full w-full max-w-5xl rounded bg-white" />
  } else {
    content = <TextPreview key={item.path} path={item.path} />
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label={item.name}>
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <p className="min-w-0 flex-1 truncate text-sm font-medium" title={item.name}>
          {item.name}
          {hasMultiple && <span className="ml-2 text-xs text-white/60">{index + 1} / {items.length}</span>}
        </p>
        <button
          onClick={() => onDownload(item)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-white/10"
          title="Download"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Download</span>
        </button>
        <button onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" aria-label="Tutup">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-16"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        {hasMultiple && (
          <button
            onClick={() => goTo(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <div
          className="flex h-full w-full items-center justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          {content}
        </div>
        {hasMultiple && (
          <button
            onClick={() => goTo(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Berikutnya"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  )
}
