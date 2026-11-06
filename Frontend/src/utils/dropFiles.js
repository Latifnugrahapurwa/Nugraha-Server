// Membaca isi hasil drag-and-drop, termasuk folder (rekursif).
// Hasil: { files: [{ file, relDir }], dirs: ['Folder', 'Folder/Sub', ...] }
// relDir = folder relatif terhadap lokasi drop ('' jika file dijatuhkan langsung).

function readFile(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

function readBatch(reader) {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
}

async function walkEntry(entry, prefix, out) {
  if (entry.isFile) {
    const file = await readFile(entry)
    out.files.push({ file, relDir: prefix })
    return
  }

  if (entry.isDirectory) {
    const dirPath = prefix ? `${prefix}/${entry.name}` : entry.name
    out.dirs.push(dirPath)
    const reader = entry.createReader()
    // readEntries mengembalikan maksimal ~100 entri per panggilan -> ulangi sampai kosong
    for (;;) {
      const batch = await readBatch(reader)
      if (!batch.length) break
      for (const child of batch) {
        await walkEntry(child, dirPath, out)
      }
    }
  }
}

export async function collectDroppedFiles(dataTransfer) {
  const out = { files: [], dirs: [] }
  const list = dataTransfer.items

  if (list && list.length && typeof list[0].webkitGetAsEntry === 'function') {
    // Entri harus diambil secara sinkron sebelum ada await apa pun
    const entries = []
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].kind !== 'file') continue
      const entry = list[i].webkitGetAsEntry()
      if (entry) entries.push(entry)
    }
    for (const entry of entries) {
      await walkEntry(entry, '', out)
    }
    return out
  }

  Array.from(dataTransfer.files || []).forEach((file) => out.files.push({ file, relDir: '' }))
  return out
}

// Hasil <input type="file" webkitdirectory> -> format yang sama
export function collectInputFiles(fileList) {
  const out = { files: [], dirs: [] }
  Array.from(fileList || []).forEach((file) => {
    const relative = file.webkitRelativePath || ''
    const index = relative.lastIndexOf('/')
    out.files.push({ file, relDir: index > 0 ? relative.slice(0, index) : '' })
  })
  return out
}
