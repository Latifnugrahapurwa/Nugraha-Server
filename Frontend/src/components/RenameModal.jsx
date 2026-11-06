import { Loader2, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { filesApi, getErrorMessage } from '../services/api'
import { validateName } from '../utils/format'
import Modal from './Modal'

export default function RenameModal({ item, onClose, onRenamed }) {
  const [name, setName] = useState(item.name)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef(null)

  // Fokus dan blok nama tanpa ekstensi
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    const dot = item.is_dir ? -1 : item.name.lastIndexOf('.')
    input.setSelectionRange(0, dot > 0 ? dot : item.name.length)
  }, [item])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return

    const trimmed = name.trim()
    if (trimmed === item.name) {
      onClose()
      return
    }
    const validationError = validateName(trimmed)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const renamed = await filesApi.rename(item.path, trimmed)
      onRenamed(item, renamed)
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal mengganti nama'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={item.is_dir ? 'Ganti Nama Folder' : 'Ganti Nama File'}
      onClose={onClose}
      closable={!submitting}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            form="rename-form"
            disabled={submitting || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            Simpan
          </button>
        </>
      }
    >
      <form id="rename-form" onSubmit={handleSubmit}>
        <label htmlFor="rename-input" className="mb-1.5 block text-sm font-medium text-slate-700">
          Nama baru
        </label>
        <input
          id="rename-input"
          ref={inputRef}
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (error) setError('')
          }}
          maxLength={255}
          autoComplete="off"
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
            error ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200'
          }`}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  )
}
