import {
  Archive,
  File as FileGeneric,
  FileCode,
  FileSpreadsheet,
  FileText,
  Film,
  Folder,
  Image as ImageIcon,
  Music,
  Presentation,
} from 'lucide-react'

const KIND_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'heic', 'tiff'],
  video: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'],
  audio: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma', 'opus', 'oga'],
  pdf: ['pdf'],
  document: ['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'log'],
  spreadsheet: ['xls', 'xlsx', 'csv', 'ods'],
  presentation: ['ppt', 'pptx', 'odp'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'tgz'],
  code: [
    'js', 'jsx', 'ts', 'tsx', 'py', 'json', 'html', 'css', 'java', 'c', 'cpp', 'h', 'go', 'rs',
    'sh', 'xml', 'yml', 'yaml', 'sql', 'php', 'rb', 'kt', 'swift', 'toml', 'ini',
  ],
}

const EXTENSION_TO_KIND = Object.entries(KIND_EXTENSIONS).reduce((map, [kind, extensions]) => {
  extensions.forEach((ext) => {
    map[ext] = kind
  })
  return map
}, {})

const KIND_STYLES = {
  folder: { Icon: Folder, color: 'text-amber-500 fill-amber-100' },
  image: { Icon: ImageIcon, color: 'text-emerald-500' },
  video: { Icon: Film, color: 'text-purple-500' },
  audio: { Icon: Music, color: 'text-pink-500' },
  pdf: { Icon: FileText, color: 'text-red-500' },
  document: { Icon: FileText, color: 'text-blue-500' },
  spreadsheet: { Icon: FileSpreadsheet, color: 'text-green-600' },
  presentation: { Icon: Presentation, color: 'text-orange-500' },
  archive: { Icon: Archive, color: 'text-yellow-600' },
  code: { Icon: FileCode, color: 'text-cyan-600' },
  file: { Icon: FileGeneric, color: 'text-slate-400' },
}

// Ekstensi yang bisa dipratinjau di dalam aplikasi
const PREVIEW_IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'avif', 'svg'])
const PREVIEW_VIDEO = new Set(['mp4', 'webm', 'm4v', 'mov', 'mkv', 'ogv'])
const PREVIEW_AUDIO = new Set(['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'opus', 'flac'])
const PREVIEW_TEXT = new Set([
  'txt', 'md', 'log', 'json', 'csv', 'xml', 'yml', 'yaml', 'ini', 'toml', 'py', 'js', 'jsx', 'ts', 'tsx',
  'css', 'html', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'sh', 'sql', 'php', 'rb', 'kt', 'swift',
])

export function getFileKind(item) {
  if (item.is_dir) return 'folder'
  return EXTENSION_TO_KIND[(item.extension || '').toLowerCase()] || 'file'
}

// 'image' | 'video' | 'audio' | 'pdf' | 'text' | null
export function getPreviewKind(item) {
  if (item.is_dir) return null
  const ext = (item.extension || '').toLowerCase()
  if (PREVIEW_IMAGE.has(ext)) return 'image'
  if (PREVIEW_VIDEO.has(ext)) return 'video'
  if (PREVIEW_AUDIO.has(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  if (PREVIEW_TEXT.has(ext)) return 'text'
  return null
}

export default function FileIcon({ item, className = 'h-5 w-5' }) {
  const { Icon, color } = KIND_STYLES[getFileKind(item)]
  return <Icon className={`${className} ${color} shrink-0`} />
}
