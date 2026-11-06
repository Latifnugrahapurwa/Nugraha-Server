const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

export function formatBytes(bytes) {
  if (!bytes || bytes < 0) return '0 B'
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / Math.pow(1024, index)
  const digits = index === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${UNITS[index]}`
}

export function formatDate(iso) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDaysLeft(days) {
  if (days <= 0) return 'Hari ini'
  if (days === 1) return '1 hari lagi'
  return `${days} hari lagi`
}

export function normalizePath(path) {
  return (path || '').split('/').filter(Boolean).join('/')
}

export function joinPath(base, name) {
  return normalizePath(`${base || ''}/${name || ''}`)
}

// 'a/b/c.txt' -> 'a/b' ; 'c.txt' -> ''
export function parentPath(path) {
  const parts = normalizePath(path).split('/').filter(Boolean)
  return parts.slice(0, -1).join('/')
}

export function basename(path) {
  const parts = normalizePath(path).split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

// 'Documents/Work' -> [{name:'Home',path:''},{name:'Documents',path:'Documents'},{name:'Work',path:'Documents/Work'}]
export function buildBreadcrumbs(path) {
  const parts = normalizePath(path).split('/').filter(Boolean)
  const crumbs = [{ name: 'Home', path: '' }]
  parts.forEach((part, index) => {
    crumbs.push({ name: part, path: parts.slice(0, index + 1).join('/') })
  })
  return crumbs
}

export function getExtension(filename) {
  const index = (filename || '').lastIndexOf('.')
  if (index <= 0 || index === filename.length - 1) return ''
  return filename.slice(index + 1).toLowerCase()
}

const INVALID_NAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/

// Mengembalikan pesan error, atau string kosong jika nama valid (dipakai untuk folder baru & ganti nama)
export function validateName(name) {
  const value = (name || '').trim()
  if (!value) return 'Nama tidak boleh kosong'
  if (value.length > 255) return 'Nama maksimal 255 karakter'
  if (value === '.' || value === '..' || value.endsWith('.')) return 'Nama tidak valid'
  if (INVALID_NAME_CHARS.test(value)) return 'Nama tidak boleh mengandung karakter: \\ / : * ? " < > |'
  return ''
}

export const validateFolderName = validateName
