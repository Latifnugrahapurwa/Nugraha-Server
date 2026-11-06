import axios from 'axios'

export const TOKEN_KEY = 'cloud_storage_token'
export const UNAUTHORIZED_EVENT = 'cloud-storage:unauthorized'

// Kosong = origin yang sama (lewat proxy Vite). Isi VITE_API_URL jika backend di alamat lain.
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
})

// Sisipkan Bearer token ke setiap request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Jika token ditolak server (kedaluwarsa/tidak valid), hapus sesi dan beri tahu AuthContext
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url || ''
    if (status === 401 && !url.includes('/api/auth/login')) {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    return Promise.reject(error)
  },
)

export const isRequestCanceled = (error) => axios.isCancel(error)

// Ubah error Axios/FastAPI menjadi pesan yang mudah dibaca
export function getErrorMessage(error, fallback = 'Terjadi kesalahan tak terduga') {
  if (axios.isCancel(error)) return 'Dibatalkan'

  if (error?.response) {
    const data = error.response.data
    if (typeof data?.detail === 'string') return data.detail
    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item) => (item.msg || '').replace(/^Value error,\s*/i, ''))
        .filter(Boolean)
        .join('; ')
    }
    const uploadError = data?.results?.find?.((r) => r.error)?.error
    if (uploadError) return uploadError
    return `${fallback} (HTTP ${error.response.status})`
  }

  if (error?.request) {
    return 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.'
  }

  return error?.message || fallback
}

export const authApi = {
  async login(username, password) {
    // FastAPI OAuth2PasswordRequestForm menerima application/x-www-form-urlencoded
    const body = new URLSearchParams()
    body.append('username', username)
    body.append('password', password)
    const { data } = await api.post('/api/auth/login', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return data
  },

  async me() {
    const { data } = await api.get('/api/auth/me')
    return data
  },
}

export const filesApi = {
  async list(path = '', { sortBy = 'name', order = 'asc', search = '' } = {}) {
    const params = { path, sort_by: sortBy, order }
    if (search) params.search = search
    const { data } = await api.get('/api/files', { params })
    return data
  },

  // Semua file pada satu kategori: documents | photos | videos | music | archives | other
  async category(category, { sortBy = 'modified', order = 'desc', search = '', limit = 1000 } = {}) {
    const params = { sort_by: sortBy, order, limit }
    if (search) params.search = search
    const { data } = await api.get(`/api/files/category/${category}`, { params })
    return data
  },

  async createFolder(path, name) {
    const { data } = await api.post('/api/files/create-folder', { path, name })
    return data
  },

  // Default: dipindahkan ke Sampah (response berisi trash_id). permanent=true menghapus langsung.
  async remove(path, { permanent = false } = {}) {
    const { data } = await api.delete('/api/files', { params: { path, permanent } })
    return data
  },

  async rename(path, newName) {
    const { data } = await api.put('/api/files/rename', { path, new_name: newName })
    return data
  },

  async move(path, destination) {
    const { data } = await api.put('/api/files/rename', { path, destination })
    return data
  },

  async copy(path, destination) {
    const { data } = await api.post('/api/files/copy', { path, destination })
    return data
  },

  // Upload satu file per request agar progress tiap file akurat.
  // onProgress menerima angka 0..1
  async upload(file, path = '', { overwrite = false, onProgress, signal } = {}) {
    const form = new FormData()
    form.append('path', path)
    form.append('overwrite', overwrite ? 'true' : 'false')
    form.append('files', file)

    const { data } = await api.post('/api/files/upload', form, {
      timeout: 0, // file besar tidak boleh kena timeout
      signal,
      onUploadProgress: (event) => {
        if (!onProgress) return
        if (event.total) onProgress(Math.min(event.loaded / event.total, 1))
      },
    })

    const result = data?.results?.[0]
    if (result && !result.success) {
      throw new Error(result.error || 'Upload gagal')
    }
    return result
  },

  // URL download/stream langsung. Token dikirim lewat query string karena <a>, <img>, <video>
  // tidak bisa mengirim header Authorization.
  downloadUrl(path, { inline = false } = {}) {
    const params = new URLSearchParams({ path })
    if (inline) params.set('inline', 'true')
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) params.set('token', token)
    return `${API_BASE}/api/files/download?${params.toString()}`
  },

  // Baca awal file teks untuk pratinjau (maksimal maxBytes)
  async readText(path, maxBytes = 200 * 1024) {
    const response = await api.get('/api/files/download', {
      params: { path, inline: true },
      headers: { Range: `bytes=0-${maxBytes - 1}` },
      responseType: 'text',
      transformResponse: [(data) => data],
    })
    let truncated = false
    const contentRange = response.headers['content-range']
    if (contentRange) {
      const total = Number(String(contentRange).split('/')[1])
      truncated = Number.isFinite(total) && total > maxBytes
    }
    return { text: response.data, truncated }
  },
}

export const trashApi = {
  async list({ search = '' } = {}) {
    const params = {}
    if (search) params.search = search
    const { data } = await api.get('/api/trash', { params })
    return data
  },

  async restore(id) {
    const { data } = await api.post(`/api/trash/${id}/restore`)
    return data
  },

  async remove(id) {
    const { data } = await api.delete(`/api/trash/${id}`)
    return data
  },

  async empty() {
    const { data } = await api.delete('/api/trash')
    return data
  },
}

export const systemApi = {
  async storageInfo() {
    const { data } = await api.get('/api/system/storage-info')
    return data
  },
}

export function triggerDownload(url, filename) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename || ''
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

export default api
