import { AlertTriangle, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { getErrorMessage } from '../services/api'
import Modal from './Modal'

// Dialog konfirmasi umum. onConfirm boleh async; jika melempar error, pesan ditampilkan di dialog.
export default function ConfirmModal({ title, message, detail, confirmLabel = 'Hapus', onClose, onConfirm }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    setSubmitting(true)
    setError('')
    try {
      await onConfirm()
    } catch (err) {
      setError(getErrorMessage(err, 'Aksi gagal'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      closable={!submitting}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <div className="min-w-0 text-sm text-slate-600">
          <p className="break-words">{message}</p>
          {detail && <p className="mt-1">{detail}</p>}
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-red-600">{error}</p>}
        </div>
      </div>
    </Modal>
  )
}
