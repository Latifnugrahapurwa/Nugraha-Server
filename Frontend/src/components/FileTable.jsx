import { ChevronDown, ChevronUp, Download, EllipsisVertical } from 'lucide-react'

import { formatDate, parentPath } from '../utils/format'
import FileIcon from './FileIcon'

function SortHeader({ label, field, sortBy, order, onSort, className = '' }) {
  const active = sortBy === field
  return (
    <th
      scope="col"
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}
    >
      <button onClick={() => onSort(field)} className="inline-flex items-center gap-1 hover:text-slate-900">
        {label}
        {active && (order === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
      </button>
    </th>
  )
}

export default function FileTable({
  items,
  sortBy,
  order,
  onSort,
  onOpen,
  onDownload,
  onContextMenu, // (item, x, y)
  activePath,
  showLocation = false,
}) {
  const openMenuFromButton = (item, event) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    onContextMenu(item, rect.right, rect.bottom)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            <SortHeader label="Nama" field="name" sortBy={sortBy} order={order} onSort={onSort} />
            <SortHeader label="Ukuran" field="size" sortBy={sortBy} order={order} onSort={onSort} className="hidden w-32 sm:table-cell" />
            <SortHeader label="Diubah" field="modified" sortBy={sortBy} order={order} onSort={onSort} className="hidden w-56 md:table-cell" />
            <th scope="col" className="w-24 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.path}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onContextMenu(item, event.clientX, event.clientY)
              }}
              className={`border-t border-slate-100 ${activePath === item.path ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
            >
              <td className="max-w-0 px-4 py-2.5">
                <button
                  onClick={() => onOpen(item)}
                  className="flex w-full min-w-0 items-center gap-3 text-left"
                  title={item.name}
                >
                  <FileIcon item={item} className="h-6 w-6" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800 hover:text-blue-600">{item.name}</span>
                    {showLocation && (
                      <span className="block truncate text-xs text-slate-400">{`/${parentPath(item.path)}`}</span>
                    )}
                    <span className="block truncate text-xs text-slate-500 md:hidden">
                      {item.is_dir ? 'Folder' : item.size_human} · {formatDate(item.modified)}
                    </span>
                  </span>
                </button>
              </td>
              <td className="hidden px-4 py-2.5 text-slate-600 sm:table-cell">{item.is_dir ? '-' : item.size_human}</td>
              <td className="hidden px-4 py-2.5 text-slate-600 md:table-cell">{formatDate(item.modified)}</td>
              <td className="px-4 py-2.5">
                <div className="flex justify-end gap-1">
                  {!item.is_dir && (
                    <button
                      onClick={() => onDownload(item)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                      title="Download"
                      aria-label={`Download ${item.name}`}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={(event) => openMenuFromButton(item, event)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    title="Aksi lainnya"
                    aria-label={`Aksi untuk ${item.name}`}
                  >
                    <EllipsisVertical className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
