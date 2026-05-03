# ALETA Surat Performance Analysis

Tanggal: 2026-05-03

## Diagnosis

Endpoint `/api/surat` belum memakai pagination server-side untuk halaman utama. Alur saat ini:

1. `readLetterSearchFiltersFromRequest` hanya membaca `query`, `type`, `status`, periode, origin, code, tag, `includeDeleted`, dan `limit`.
2. `searchLettersInDb` mengambil surat dari database dengan default `LIMIT 100`.
3. Route `/api/surat` tetap memuat `listDispositionsFromDb(db)` untuk semua disposisi aktif.
4. RBAC surat kemudian dihitung dengan `getAccessibleLetters(actor, letters, dispositions)`.
5. Frontend `/surat` melakukan filter ulang di client untuk type, status, metric, dan query.

## Root Cause Performa

- Frontend halaman surat belum memakai data paginated dari API; daftar diambil dari `PortalProvider.accessibleLetters`.
- `/api/surat` mengambil surat lebih banyak dari kebutuhan halaman dan mengembalikan bentuk `LetterDetail` yang masih membawa field detail.
- `/api/surat` memuat semua disposisi aktif untuk filtering akses, sehingga biaya bertambah walaupun tabel hanya perlu daftar ringkas.
- Search halaman surat langsung mengubah URL pada setiap ketikan; belum ada debounce.
- Tidak ada page/pageSize/sort metadata, sehingga UI tidak bisa meminta hanya 25 row pertama.

## Endpoint Saat Ini

- `GET /api/surat`
  - Parameter: `query`, `type`, `status`, `year`, `month`, `quarter`, `origin`, `code`, `dateFrom`, `dateTo`, `tags`, `classificationTags`, `includeDeleted`, `limit`.
  - Response: `{ items, total, filters }`.
  - Belum ada `page`, `pageSize`, `pagination`, `sortBy`, atau `sortDirection`.

## Komponen Terdampak

- `D:\aleta\manajemen_surat\src\app\api\surat\route.ts`
- `D:\aleta\manajemen_surat\src\server\modules\letters\http.ts`
- `D:\aleta\manajemen_surat\src\server\modules\letters\service.ts`
- `D:\aleta\manajemen_surat\src\app\(portal)\surat\page.tsx`
- `D:\aleta\manajemen_surat\src\components\portal\letter-list.tsx`

## Patch Minimal Yang Direkomendasikan

1. Tambahkan parser pagination/sort whitelist di `letters/http.ts`.
2. Tambahkan service list paginated RBAC-safe yang:
   - menerapkan filter/search/sort di SQL;
   - menerapkan access clause untuk admin dan non-admin;
   - menghitung total di server;
   - mengambil hanya page yang diminta;
   - mengembalikan list ringan tanpa document text, lampiran lengkap, dan delivery detail.
3. Route `/api/surat` mengembalikan `items`, `data`, `pagination`, `filters`, `sort`, dan `meta`.
4. UI `/surat` mengambil data langsung dari `/api/surat?page=&pageSize=&search=&sortBy=&sortDirection=`.
5. Tambahkan dropdown page size 5/10/25/50/100/Semua dan debounce search.

## Risiko

- Halaman lain yang masih memakai `PortalProvider.accessibleLetters` tetap memakai cache background; halaman `/surat` akan berpindah ke API paginated.
- Data WhatsApp detail tidak lagi ideal untuk tabel list ringan; detail surat tetap menjadi tempat data lengkap.
- Dataset sangat besar mungkin tetap perlu index tambahan untuk `search_document`, tanggal administratif, dan disposisi.
