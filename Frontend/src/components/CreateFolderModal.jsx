import { FolderPlus, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { filesApi, getErrorMessage } from '../services/api'
import { buildBreadcrumbs, validateFolderName } from '../utils/format'
import Modal from './Modal'

export default function CreateFolderModal({ currentPath, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const locationLabel = buildBreadcrumbs(currentPath)
    .map((crumb) => crumb.name)
    .join(' / ')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return

    const validationError = validateFolderName(name)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const folder = await filesApi.createFolder(currentPath, name.trim())
      onCreated(folder)
    } catch (err) {
      setError(getErrorMessage(err, 'Gagal membuat folder'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Folder Baru"
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
            form="create-folder-form"
            disabled={submitting || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            Buat
          </button>
        </>
      }
    >
      <form id="create-folder-form" onSubmit={handleSubmit}>
        <p className="mb-3 text-xs text-slate-500">
          Lokasi: <span className="font-medium text-slate-700">{locationLabel}</span>
        </p>
        <label htmlFor="folder-name" className="mb-1.5 block text-sm font-medium text-slate-700">
          Nama folder
        </label>
        <input
          id="folder-name"
          ref={inputRef}
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (error) setError('')
          }}
          maxLength={255}
          autoComplete="off"
          placeholder="Contoh: Dokumen Kerja"
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
            error ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200'
          }`}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>
    </Modal>
  )
}
