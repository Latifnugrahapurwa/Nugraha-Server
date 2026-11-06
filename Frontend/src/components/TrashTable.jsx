import { ArchiveRestore, EllipsisVertical, Trash2 } from 'lucide-react'

import { formatDate, formatDaysLeft } from '../utils/format'
import FileIcon from './FileIcon'

export default function TrashTable({ items, onRestore, onDeleteForever, onContextMenu, activeId }) {
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
            <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Nama</th>
            <th scope="col" className="hidden w-28 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">Ukuran</th>
            <th scope="col" className="hidden w-52 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Dihapus</th>
            <th scope="col" className="hidden w-36 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Dihapus permanen</th>
            <th scope="col" className="w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onContextMenu(item, event.clientX, event.clientY)
              }}
              className={`border-t border-slate-100 ${activeId === item.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
            >
              <td className="max-w-0 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <FileIcon item={item} className="h-6 w-6" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800" title={item.name}>{item.name}</span>
                    <span className="block truncate text-xs text-slate-400">{`Dari /${item.parent_path}`}</span>
                    <span className="block truncate text-xs text-slate-500 md:hidden">{formatDaysLeft(item.days_left)}</span>
                  </span>
                </div>
              </td>
              <td className="hidden px-4 py-2.5 text-slate-600 sm:table-cell">{item.size_human}</td>
              <td className="hidden px-4 py-2.5 text-slate-600 md:table-cell">{formatDate(item.deleted_at)}</td>
              <td className={`hidden px-4 py-2.5 md:table-cell ${item.days_left <= 3 ? 'font-medium text-red-600' : 'text-slate-600'}`}>
                {formatDaysLeft(item.days_left)}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => onRestore(item)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-green-50 hover:text-green-600"
                    title="Pulihkan"
                    aria-label={`Pulihkan ${item.name}`}
                  >
                    <ArchiveRestore className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDeleteForever(item)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                    title="Hapus permanen"
                    aria-label={`Hapus permanen ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
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
