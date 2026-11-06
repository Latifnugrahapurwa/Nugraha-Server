import { useCallback, useEffect, useRef, useState } from 'react'

import { filesApi, getErrorMessage, isRequestCanceled } from '../services/api'
import { basename, joinPath, parentPath } from '../utils/format'

let idCounter = 0

// Antrean upload otomatis: begitu file ditambahkan, upload langsung berjalan satu per satu.
// Folder (hasil drag-and-drop folder) dibuat otomatis di server sebelum file di dalamnya di-upload.
export default function useUploader({ onBatchComplete } = {}) {
  const [items, setItems] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [preparing, setPreparing] = useState(false)

  const itemsRef = useRef([])
  const runningRef = useRef(false)
  const abortRef = useRef(null)
  const mountedRef = useRef(true)
  const completeRef = useRef(onBatchComplete)

  useEffect(() => {
    completeRef.current = onBatchComplete
  }, [onBatchComplete])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const commit = useCallback((next) => {
    itemsRef.current = next
    if (mountedRef.current) setItems(next)
  }, [])

  const patch = useCallback(
    (id, changes) => {
      commit(itemsRef.current.map((item) => (item.id === id ? { ...item, ...changes } : item)))
    },
    [commit],
  )

  const run = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    if (mountedRef.current) setIsUploading(true)

    let succeeded = 0
    let failed = 0

    try {
      for (;;) {
        if (!mountedRef.current) break
        const next = itemsRef.current.find((item) => item.status === 'pending')
        if (!next) break

        const controller = new AbortController()
        abortRef.current = controller
        patch(next.id, { status: 'uploading', progress: 0, error: '' })

        try {
          const result = await filesApi.upload(next.file, next.targetPath, {
            signal: controller.signal,
            onProgress: (fraction) => patch(next.id, { progress: fraction }),
          })
          patch(next.id, { status: 'done', progress: 1, savedAs: result?.saved_as || next.file.name })
          succeeded += 1
        } catch (error) {
          if (isRequestCanceled(error)) {
            patch(next.id, { status: 'canceled', progress: 0 })
          } else {
            patch(next.id, { status: 'error', error: getErrorMessage(error, 'Upload gagal') })
            failed += 1
          }
        }
      }
    } finally {
      abortRef.current = null
      runningRef.current = false
      if (mountedRef.current) setIsUploading(false)
      if (succeeded > 0 || failed > 0) completeRef.current?.({ succeeded, failed })
    }
  }, [patch])

  // files: [{ file, relDir }], dirs: ['Folder', ...], baseDir: folder tujuan di server
  const add = useCallback(
    async ({ files = [], dirs = [] }, baseDir = '') => {
      if (!files.length && !dirs.length) return

      // Kumpulkan semua folder (beserta induknya) yang harus ada di server
      const dirSet = new Set()
      ;[...dirs, ...files.map((entry) => entry.relDir)].forEach((dir) => {
        const parts = (dir || '').split('/').filter(Boolean)
        parts.forEach((_, index) => dirSet.add(parts.slice(0, index + 1).join('/')))
      })

      const failedDirs = new Map()
      const findFailure = (dir) => {
        for (const [failedDir, message] of failedDirs) {
          if (dir === failedDir || dir.startsWith(`${failedDir}/`)) return message
        }
        return ''
      }

      const sortedDirs = [...dirSet].sort((a, b) => a.split('/').length - b.split('/').length)
      if (sortedDirs.length && mountedRef.current) setPreparing(true)
      for (const dir of sortedDirs) {
        if (findFailure(dir)) continue
        try {
          await filesApi.createFolder(joinPath(baseDir, parentPath(dir)), basename(dir))
        } catch (error) {
          // 409 = folder sudah ada -> aman dilanjutkan
          if (error.response?.status !== 409) {
            failedDirs.set(dir, getErrorMessage(error, 'Gagal membuat folder'))
          }
        }
      }
      if (mountedRef.current) setPreparing(false)

      const created = files.map(({ file, relDir }) => {
        const failure = findFailure(relDir || '')
        return {
          id: ++idCounter,
          file,
          label: relDir ? `${relDir}/${file.name}` : file.name,
          targetPath: joinPath(baseDir, relDir || ''),
          status: failure ? 'error' : 'pending',
          progress: 0,
          error: failure,
          savedAs: '',
        }
      })

      commit([...itemsRef.current, ...created])
      run()
    },
    [commit, run],
  )

  const cancelAll = useCallback(() => {
    commit(itemsRef.current.map((item) => (item.status === 'pending' ? { ...item, status: 'canceled' } : item)))
    abortRef.current?.abort()
  }, [commit])

  const retryFailed = useCallback(() => {
    commit(
      itemsRef.current.map((item) =>
        item.status === 'error' || item.status === 'canceled'
          ? { ...item, status: 'pending', progress: 0, error: '' }
          : item,
      ),
    )
    run()
  }, [commit, run])

  const clearFinished = useCallback(() => {
    commit(itemsRef.current.filter((item) => item.status === 'pending' || item.status === 'uploading'))
  }, [commit])

  return { items, isUploading, preparing, add, cancelAll, retryFailed, clearFinished }
}
