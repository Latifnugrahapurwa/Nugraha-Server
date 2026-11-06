# Cloud Storage Frontend

React (Vite) + Tailwind CSS + Lucide React untuk backend `cloud-storage-backend` (FastAPI).

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:5173
```

Pastikan backend berjalan di `http://localhost:8000` (`python run.py`). Saat development, request `/api/*`
diteruskan otomatis oleh proxy Vite, jadi tidak ada masalah CORS.

## Konfigurasi (`.env`)

| Variabel            | Fungsi                                                                              |
| ------------------- | ----------------------------------------------------------------------------------- |
| `VITE_API_URL`      | Kosong = origin yang sama (proxy). Isi jika backend di alamat lain, mis. `http://192.168.1.10:8000` |
| `VITE_PROXY_TARGET` | Target proxy Vite untuk `npm run dev` / `npm run preview` (default `http://localhost:8000`) |

## Build produksi

```bash
npm run build      # hasil di dist/
```

Sajikan `dist/` dengan web server yang meneruskan `/api` ke backend (Nginx/Caddy) dan memakai fallback SPA ke
`index.html`. Jika frontend dan backend beda origin, isi `VITE_API_URL` sebelum build dan atur `CORS_ORIGINS` di backend.

## Catatan

- Token JWT disimpan di `localStorage` (`cloud_storage_token`) dan dikirim lewat header `Authorization: Bearer`.
- Download dan pembukaan media memakai `?token=` di URL (browser tidak bisa mengirim header untuk unduhan langsung),
  sehingga file besar diunduh secara streaming tanpa memenuhi memori browser.
- Folder yang sedang dibuka tersimpan di URL (`/?path=Documents/Work`), jadi tombol back dan refresh berfungsi.

## Fitur

- **Sidebar kategori:** Semua File, Dokumen, Foto, Video, Musik, Arsip, Lainnya, dan Sampah. Kategori menampilkan semua file bertipe itu dari seluruh folder.
- **Upload otomatis:** seret file atau folder ke mana saja di halaman (upload langsung berjalan), atau pakai tombol Upload / klik kanan > Upload Folder. Progres tampil di panel kanan bawah.
- **Menu klik kanan** pada file/folder: Buka/Pratinjau, Download, Pindahkan ke Sampah, Pindahkan atau Salin, Detail, dan Aksi Lainnya (Ganti Nama, Salin Path, Buka di Tab Baru, Buka Lokasi File). Klik kanan di area kosong untuk Upload, Folder Baru, dll. Di layar sentuh, pakai tombol titik tiga.
- **Pratinjau media** di dalam aplikasi: gambar, video, audio, PDF, dan teks; geser dengan tombol panah kiri/kanan.
- **Sampah:** file yang dihapus dipindah ke Sampah dan dihapus permanen otomatis setelah 30 hari (diatur di `.env` backend: `TRASH_RETENTION_DAYS`). Ada tombol Urungkan, Pulihkan, Hapus Permanen, dan Kosongkan Sampah.
