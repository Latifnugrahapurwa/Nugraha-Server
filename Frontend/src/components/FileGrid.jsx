import { Download, EllipsisVertical } from 'lucide-react'
import { useState } from 'react'

import { filesApi } from '../services/api'
import { formatDate } from '../utils/format'
import FileIcon, { getFileKind } from './FileIcon'

const THUMBNAIL_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'ico'])

function Preview({ item }) {
  const [failed, setFailed] = useState(false)
  const canThumb = getFileKind(item) === 'image' && THUMBNAIL_EXTENSIONS.has(item.extension) && !failed

  if (!canThumb) {
    return (
      <div className="flex h-24 w-full items-center justify-center">
        <FileIcon item={item} className="h-12 w-12" />
      </div>
    )
  }

  return (
    <img
      src={filesApi.downloadUrl(item.path, { inline: true })}
      alt={item.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-24 w-full rounded-lg bg-slate-100 object-cover"
    />
  )
}

export default function FileGrid({ items, onOpen, onDownload, onContextMenu, activePath }) {
  const openMenuFromButton = (item, event) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    onContextMenu(item, rect.right, rect.bottom)
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.path}
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onContextMenu(item, event.clientX, event.clientY)
          }}
          className={`group relative rounded-xl border bg-white transition focus-within:border-blue-300 hover:border-blue-300 hover:shadow-sm ${
            activePath === item.path ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
          }`}
        >
          <button onClick={() => onOpen(item)} className="flex w-full flex-col items-center p-3 text-center" title={item.name}>
            <Preview item={item} />
            <span className="mt-2 line-clamp-2 w-full break-words text-sm font-medium text-slate-800">{item.name}</span>
            <span className="mt-1 text-xs text-slate-500">{item.is_dir ? 'Folder' : item.size_human}</span>
            <span className="text-xs text-slate-400">{formatDate(item.modified)}</span>
          </button>

          <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
            {!item.is_dir && (
              <button
                onClick={() => onDownload(item)}
                className="rounded-lg bg-white/90 p-1.5 text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-blue-600"
                title="Download"
                aria-label={`Download ${item.name}`}
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={(event) => openMenuFromButton(item, event)}
              className="rounded-lg bg-white/90 p-1.5 text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-slate-800"
              title="Aksi lainnya"
              aria-label={`Aksi untuk ${item.name}`}
            >
              <EllipsisVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
