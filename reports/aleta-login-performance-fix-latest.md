# ALETA Login Performance Fix

Tanggal: 2026-05-03

## Status

- Login klik 1 kali: diperbaiki.
- Login lebih cepat: alur redirect/session sudah dipangkas; cold compile/dev server tetap bisa membuat angka lokal berfluktuasi.
- Navigasi halaman lebih cepat: shell portal tidak lagi menunggu semua data berat sebelum tampil.

## Root Cause Final

Login klik 2 kali:
- Field dan tombol login bisa dipakai sebelum React hydration selesai.
- Karena form login adalah client-only, input yang diketik sebelum hydration dapat hilang dari state React.
- Setelah sign-in, `router.replace("/portal")` langsung diikuti `router.refresh()`, sehingga navigasi bisa race dan user tetap melihat halaman login.

Login lama:
- Login melakukan lookup user lalu sign-in Better Auth.
- Setelah sign-in, portal menahan shell sampai sync 8 endpoint selesai.

Halaman lambat:
- `PortalProvider` sebelumnya mengatur `isSyncing=true` sampai `/api/users`, `/api/surat`, `/api/disposisi`, `/api/ai/settings`, `/api/settings/whatsapp`, `/api/settings/institution`, `/api/settings/module-visibility`, dan `/api/settings/assistant-judge` selesai.
- `PortalShellV2` memblokir semua protected page saat `isSyncing=true`.

## File Yang Diubah

- `D:\aleta\manajemen_surat\src\app\login\page.tsx`
- `D:\aleta\manajemen_surat\src\lib\app-state.tsx`
- `D:\aleta\manajemen_surat\src\test\login-page.test.tsx`
- `D:\aleta\reports\aleta-login-performance-analysis-latest.md`
- `D:\aleta\reports\aleta-login-performance-analysis-latest.json`
- `D:\aleta\reports\aleta-login-performance-fix-latest.md`
- `D:\aleta\reports\aleta-login-performance-fix-latest.json`

## Perubahan Teknis

Login:
- Field dan tombol login disabled sampai hydration client siap.
- Submit login memakai form submit terkontrol dengan `preventDefault`.
- Duplicate submit dicegah di handler.
- Setelah sign-in sukses, session di-refetch lalu navigasi satu kali ke `/portal`.
- `router.refresh()` yang langsung mengikuti `router.replace()` dihapus dari alur login.

Portal sync/performa:
- Sync awal dibuat dua tahap.
- Data blocking hanya `/api/users` dan `/api/settings/module-visibility`.
- Surat, disposisi, AI settings, WhatsApp settings, institution settings, dan assistant judge settings dimuat background.
- Jika user sesi sudah ada di cache lokal, refresh user/RBAC dilakukan tanpa menahan shell; server layout tetap memverifikasi session dan active user.
- Error data non-kritis tidak membuat halaman utama gagal.

## Data Performa

Sebelum patch:
- Klik sebelum hydration tidak memanggil `/api/users/lookup` maupun `/api/auth/sign-in/email`; halaman tetap di `/login` setelah 8 detik.
- Hard navigation dev sebelum patch memperlihatkan beberapa route menunggu 10-16 detik karena sync awal menunggu endpoint berat.

Sesudah patch:
- Field/tombol login menunggu hydration, sehingga klik pertama tidak lagi hilang dan tidak membaca state kosong.
- Warm dev sample setelah compile: lookup sekitar 40-141 ms, sign-in sekitar 56-66 ms, portal route sekitar 495 ms, critical sync sekitar 338-426 ms.
- Dev cold compile/restart masih bisa membuat angka lokal tinggi; itu dicatat sebagai risiko lingkungan dev, bukan regresi auth.

## Test

Ditambahkan:
- Login submit diproses sekali walau tombol diklik ganda.
- Login sukses melakukan refetch session dan navigasi ke `/portal`.
- `router.refresh()` tidak dipanggil di alur login sukses.
- Input kosong menampilkan error manusiawi dan tidak memanggil sign-in.

## Validasi

- `npx tsc --noEmit --pretty false`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm test`: PASS, 48/48 tests.

## Risiko Tersisa

- Cold start Next dev server dan compile route masih bisa terasa lambat di development.
- `/api/surat` masih memuat disposisi untuk access filtering; optimasi query/pagination bisa menjadi sprint lanjutan.
- Cache lokal user/RBAC hanya dipakai sebagai tampilan awal; server guard tetap menjadi sumber keamanan.

## Sengaja Tidak Diubah

- Auth guard server.
- Better Auth library.
- RBAC.
- Validasi role/posisi.
- WhatsApp production config.
- Scheduler/reminder.
- Data user.
