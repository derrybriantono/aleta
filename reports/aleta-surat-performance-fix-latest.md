# ALETA Surat Performance Fix

Tanggal: 2026-05-03

## Ringkasan

Patch ini membuat daftar Surat Masuk/Surat Keluar memakai server-side pagination, filter, search, dan sorting. Default halaman sekarang 25 data. UI menyediakan pilihan 5, 10, 25, 50, 100, dan Semua. Opsi Semua tetap dilindungi guard server: jika total lebih dari 500, API menolak dengan pesan aman dan pengguna diarahkan memakai filter atau Export CSV.

## Root Cause

Sebelumnya halaman surat bergantung pada data surat dari portal state/client state. Endpoint `/api/surat` hanya menerima filter dasar dan limit, belum punya metadata pagination/sorting. Route juga mengambil semua disposisi lalu menjalankan access filtering di memory, sementara list surat memakai payload detail yang memuat relasi berat seperti lampiran dan delivery WhatsApp.

Akibatnya render awal halaman surat berpotensi menunggu data terlalu banyak, dan filter/pencarian/pemotongan data cenderung terjadi setelah payload besar sampai ke client.

## Perubahan API

Endpoint: `GET /api/surat`

Parameter baru/dirapikan:

- `type=masuk|keluar|all`
- `page`
- `pageSize=5|10|25|50|100|all`
- `search`
- `sortBy`
- `sortDirection=asc|desc`
- `status`
- `workflowStatus`
- `priority`
- `dateFrom`
- `dateTo`
- `dispositionStatus`
- `unreadOnly`
- `overdueOnly`
- `dueTodayOnly`

Default:

- `page=1`
- `pageSize=25`
- `sortBy=tanggal`
- `sortDirection=desc`

Response sekarang menyertakan `items`, `data`, `pagination`, `filters`, `sort`, dan `meta`.

## List Ringan

List `/api/surat` sekarang mengembalikan field ringkas untuk tabel:

- id, type, nomor agenda, nomor surat
- tanggal surat/terima/kirim
- asal/tujuan
- perihal, status, workflow status, priority
- ringkasan dipotong 320 karakter
- created/updated metadata yang diperlukan tabel

List tidak lagi memuat:

- lampiran lengkap
- document text penuh
- audit log
- riwayat disposisi penuh
- detail delivery WhatsApp
- payload viewer berat

Detail surat tetap melalui endpoint detail existing.

## Server-Side Safety

RBAC tetap diterapkan di server. Untuk user non-admin, query list hanya mengembalikan surat yang punya disposisi terkait user, posisi efektif, atau unit kerja yang sesuai. Filter disposisi juga diterapkan di SQL, bukan di frontend.

Sorting memakai whitelist kolom aman. `sortBy` mentah tidak disisipkan langsung ke SQL.

## UI

Halaman `/surat` sekarang:

- fetch langsung ke `/api/surat` dengan parameter halaman/filter/sort
- punya dropdown "Tampilkan" 5/10/25/50/100/Semua
- punya kontrol First/Previous/Next/Last
- menampilkan info rentang, misalnya "Menampilkan 1-25 dari 240 surat"
- reset ke page 1 saat page size, filter, atau search berubah
- search debounce 400 ms
- punya loading/error/empty state khusus tabel
- tidak memanggil export otomatis

## App State

Sync background portal tetap dibatasi eksplisit ke `/api/surat?pageSize=100`, sehingga tidak membuat request surat tanpa limit.

## Test

Test backend ditambahkan untuk:

- parsing pagination default dan valid options
- invalid page/pageSize fallback aman
- `pageSize=all` diterima oleh parser
- whitelist sorting
- pagination server-side memakai offset
- list payload ringan tanpa lampiran/delivery WhatsApp
- filter type dan search server-side
- RBAC server-side untuk user yang tidak berhak melihat surat tertentu

## Validasi

- `npx tsc --noEmit --pretty false`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 52/52 tests

Preflight/smoke ALETA Bot tidak dijalankan karena patch ini hanya menyentuh `manajemen_surat` dan tidak mengubah runtime WhatsApp, scheduler, reminder, atau `aleta_bot`.

## Perbandingan

Sebelum:

- request list tidak punya pagination metadata
- akses surat dihitung dengan dispositions penuh di memory
- list bisa membawa relasi/payload detail
- halaman memfilter dari state client

Sesudah:

- default hanya 25 row dari server
- SQL count + limit/offset
- access filter berada di SQL
- list payload ringan
- search/filter/sort dikirim ke server

## Risiko Tersisa

- Jika data surat tumbuh sangat besar, index database pada kolom `type`, `status`, `workflow_status`, tanggal administratif, dan `search_document` akan makin penting.
- Filter berbasis teks masih memakai `LIKE` pada `search_document`; untuk skala lebih besar bisa dipertimbangkan full-text index PostgreSQL.
- Opsi Semua sengaja bukan default dan tetap dibatasi 500 row; export tetap jalur yang benar untuk dataset besar.
