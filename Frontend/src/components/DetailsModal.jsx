import { formatDate } from '../utils/format'
import FileIcon from './FileIcon'
import Modal from './Modal'

function Row({ label, children }) {
  return (
    <div className="flex gap-4 border-b border-slate-100 py-2 text-sm last:border-b-0">
      <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium text-slate-800">{children}</dd>
    </div>
  )
}

// trash=true jika item berasal dari Sampah (punya original_path, deleted_at, dst.)
export default function DetailsModal({ item, trash = false, onClose }) {
  const location = trash ? item.parent_path : item.path.split('/').slice(0, -1).join('/')
  const type = item.is_dir ? 'Folder' : item.mime_type || (item.extension ? `File .${item.extension}` : 'File')

  return (
    <Modal title="Detail" onClose={onClose} size="md">
      <div className="mb-4 flex items-center gap-3">
        <FileIcon item={item} className="h-10 w-10" />
        <p className="min-w-0 break-words text-base font-semibold text-slate-900">{item.name}</p>
      </div>
      <dl>
        <Row label="Jenis">{type}</Row>
        <Row label="Ukuran">{item.is_dir && !trash ? '-' : item.size_human}</Row>
        <Row label={trash ? 'Lokasi asal' : 'Lokasi'}>{`/${location}`}</Row>
        {trash ? (
          <>
            <Row label="Dihapus">{formatDate(item.deleted_at)}</Row>
            {item.deleted_by && <Row label="Dihapus oleh">{item.deleted_by}</Row>}
            <Row label="Hapus permanen">{formatDate(item.expires_at)}</Row>
          </>
        ) : (
          <Row label="Diubah">{formatDate(item.modified)}</Row>
        )}
      </dl>
    </Modal>
  )
}
