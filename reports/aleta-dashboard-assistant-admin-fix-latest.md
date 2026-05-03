# ALETA Dashboard + Asisten Hakim Admin Fix

Tanggal: 2026-05-03

## Overall

PASS

## Ringkasan

- Grid ringkasan Dashboard Manajemen Surat sudah dibuat 4 kolom di desktop, 2 kolom di tablet, dan 1 kolom di mobile.
- Kartu Surat Masuk, Surat Keluar, Inbox Tugas, dan Disposisi Terlambat dibuat lebih compact tanpa mengubah data statistik.
- Pengaturan Asisten Hakim sekarang mendukung menu AI dinamis yang persistent melalui `assistant_judge_settings`.
- Super Admin dapat mengedit URL, label, deskripsi, status aktif, sort order, role access, user access, dan menambah menu AI baru.
- User biasa hanya menerima menu Asisten Hakim yang sudah difilter server-side sesuai role atau user id.

## File Dashboard Diubah

- `D:\aleta\manajemen_surat\src\components\portal\mail-dashboard-page.tsx`

## File Asisten Hakim Diubah

- `D:\aleta\manajemen_surat\src\app\(portal)\admin\asisten-hakim\page.tsx`
- `D:\aleta\manajemen_surat\src\app\(portal)\asisten-hakim\page.tsx`
- `D:\aleta\manajemen_surat\src\app\api\settings\assistant-judge\route.ts`
- `D:\aleta\manajemen_surat\src\components\layout\portal-shell-v2.tsx`
- `D:\aleta\manajemen_surat\src\lib\app-state.tsx`
- `D:\aleta\manajemen_surat\src\lib\assistant-judge.ts`
- `D:\aleta\manajemen_surat\src\lib\types.ts`
- `D:\aleta\manajemen_surat\src\server\modules\settings\service.ts`

## Storage

Tidak ada migration baru. Patch memakai storage existing:

- Tabel: `assistant_judge_settings`
- Kolom JSON: `links_json`, `visible_roles_json`

Default link tetap tersedia:

- ChatGPT
- Gemini
- Claude

Konfigurasi link sekarang mendukung:

- `id`
- `provider`
- `url`
- `label`
- `description`
- `iconKey`
- `enabled`
- `sortOrder`
- `allowedRoles`
- `allowedUserIds`
- `openInNewTab`
- metadata audit ringan `createdAt/updatedAt/createdBy/updatedBy`

## API

- `GET /api/settings/assistant-judge`
  - Super Admin menerima konfigurasi penuh.
  - User lain menerima konfigurasi yang sudah difilter.

- `PUT /api/settings/assistant-judge`
  - Hanya Super Admin.
  - Validasi URL server-side.
  - Validasi role dikenal.
  - Validasi user id aktif.
  - Audit log mencatat perubahan tanpa menyimpan URL penuh di payload audit.

## RBAC dan Security

- Edit konfigurasi: Super Admin only.
- Admin biasa dapat melihat menu jika role/user diizinkan, tetapi tidak bisa mengedit.
- Role default yang boleh melihat Asisten Hakim: Super Admin, Admin, Ketua, Wakil Ketua, Hakim.
- Per-menu AI dapat dibatasi lagi berdasarkan `allowedRoles` dan `allowedUserIds`.
- Link nonaktif dan URL invalid tidak ditampilkan ke user.
- URL `javascript:` dan `data:` ditolak.
- Endpoint admin tanpa session atau tanpa Super Admin tetap ditolak oleh auth/RBAC existing.

## UI

Admin Asisten Hakim:

- List menu AI dinamis.
- Tambah menu AI baru.
- Edit label, URL, deskripsi, icon, urutan.
- Toggle aktif/nonaktif.
- Toggle role per menu.
- Toggle user spesifik per menu.
- Preview link.
- Loading/error/success state saat simpan.

User Asisten Hakim:

- Hanya menampilkan link aktif, URL valid, dan sesuai role/user.
- Empty state: "Belum ada Asisten AI yang tersedia untuk akun Anda."

## Test Ditambahkan

- `D:\aleta\manajemen_surat\src\test\assistant-judge.test.ts`
- `D:\aleta\manajemen_surat\src\test\mail-dashboard-page.test.tsx`

Test backend ditambah di:

- `D:\aleta\manajemen_surat\src\test\backend-db.test.ts`

Coverage baru:

- Default link Asisten Hakim muncul untuk Hakim.
- Link nonaktif difilter.
- User-specific access bekerja.
- URL unsafe ditolak.
- Super Admin-only update di backend.
- Admin biasa tidak bisa update.
- User view difilter server-side.
- Grid dashboard memiliki class desktop 4 kolom dan 4 kartu summary tetap render.

## Validasi

- `npx tsc --noEmit --pretty false`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 58/58 tests

## Risiko Tersisa

- User picker di admin Asisten Hakim masih berupa daftar scroll sederhana; jika jumlah user bertambah besar, sebaiknya ditambah search/pagination.
- Icon provider masih sederhana berbasis `iconKey` (`sparkles`/`scale`).
- Storage masih memakai JSON setting existing, bukan tabel relational per-link; cukup untuk patch terukur saat ini, tetapi audit detail per link bisa dibuat lebih granular jika kebutuhan meningkat.

## Hal yang Sengaja Tidak Diubah

- Auth guard.
- RBAC global.
- Sistem login.
- WhatsApp production config.
- `botEnabled`.
- Scheduler/reminder.
