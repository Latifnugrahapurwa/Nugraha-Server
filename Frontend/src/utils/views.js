import { Archive, FileText, Film, FolderOpen, Image as ImageIcon, Music, Shapes, Trash2 } from 'lucide-react'

// Daftar tampilan di sidebar. 'files' = penjelajah folder, 'trash' = Sampah, sisanya = kategori.
export const VIEWS = [
  { id: 'files', label: 'Semua File', icon: FolderOpen, group: 'main' },
  { id: 'documents', label: 'Dokumen', icon: FileText, group: 'category', color: 'text-blue-500' },
  { id: 'photos', label: 'Foto', icon: ImageIcon, group: 'category', color: 'text-emerald-500' },
  { id: 'videos', label: 'Video', icon: Film, group: 'category', color: 'text-purple-500' },
  { id: 'music', label: 'Musik', icon: Music, group: 'category', color: 'text-pink-500' },
  { id: 'archives', label: 'Arsip', icon: Archive, group: 'category', color: 'text-yellow-600' },
  { id: 'other', label: 'Lainnya', icon: Shapes, group: 'category', color: 'text-slate-500' },
  { id: 'trash', label: 'Sampah', icon: Trash2, group: 'trash', color: 'text-red-500' },
]

export const VIEW_IDS = VIEWS.map((view) => view.id)

export function getView(id) {
  return VIEWS.find((view) => view.id === id) || VIEWS[0]
}

export function getViewMode(id) {
  if (id === 'files') return 'files'
  if (id === 'trash') return 'trash'
  return 'category'
}
