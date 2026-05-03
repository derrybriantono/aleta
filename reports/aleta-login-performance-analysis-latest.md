# ALETA Login Performance Analysis

Tanggal: 2026-05-03

## Ringkasan Diagnosis

Root cause login klik dua kali:
- Tombol login adalah `type="button"` di client component, sehingga klik sebelum React hydration selesai tidak menjalankan handler apa pun.
- Profil Playwright membuktikan klik awal setelah `domcontentloaded` tidak memicu `/api/users/lookup` atau `/api/auth/sign-in/email`; halaman tetap di `/login`.
- Setelah login berhasil, kode memanggil `router.replace("/portal")` lalu langsung `router.refresh()`. Ini berisiko membatalkan/menimpa navigasi dan membuat user tetap melihat halaman login dengan pesan "Login berhasil".

Root cause login terasa lama:
- Pada cold/warm-up, `/api/auth/get-session` di halaman login memakan sekitar 1.3-1.5 detik.
- Dalam salah satu run, `/api/users/lookup?identifier=...` memakan 3.879 detik sebelum sign-in.
- Setelah sign-in, portal menunggu sinkronisasi awal sebelum shell tampil.

Root cause navigasi halaman lambat:
- `PortalProvider.runSyncDataFromBackend` memblokir shell dengan `isSyncing=true` sampai 8 endpoint selesai:
  `/api/users`, `/api/surat`, `/api/disposisi`, `/api/ai/settings`, `/api/settings/whatsapp`, `/api/settings/institution`, `/api/settings/module-visibility`, `/api/settings/assistant-judge`.
- `PortalShellV2` menampilkan layar "Menyiapkan portal..." selama `isSyncing` true.
- `/api/surat` juga memuat `listDispositionsFromDb`, sementara initial sync tetap memanggil `/api/disposisi`; ini membuat pekerjaan disposisi ganda saat boot portal.

## Bukti Profil

Login early-click sebelum hydration:
- Final URL setelah 8 detik: `/login`.
- Request login yang muncul: hanya `/login`, asset Next, dan `/api/auth/get-session`.
- Tidak ada request `/api/users/lookup` atau `/api/auth/sign-in/email`.

Login setelah hydration:
- `/api/users/lookup`: 132 ms pada warm run, 3.879 ms pada run sebelumnya.
- `/api/auth/sign-in/email`: 72 ms pada warm run, 1.823 ms pada run sebelumnya.
- Portal tampil setelah request sync awal selesai.

Profil route hard navigation sebelum patch:
- `/surat?type=masuk`: sekitar 15.999 ms, request lambat termasuk `/api/settings/module-visibility` sekitar 14.491 ms dan `/api/settings/institution` sekitar 14.468 ms.
- `/tugas`: sekitar 10.264 ms, request lambat termasuk `/api/settings/module-visibility` sekitar 8.557 ms.
- `/admin/aleta-bot`: sekitar 11.980 ms, request lambat termasuk `/api/settings/module-visibility` sekitar 10.664 ms.
- `/panduan`: sekitar 14.409 ms, request lambat termasuk `/api/settings/module-visibility` sekitar 13.051 ms.

## File Yang Perlu Diubah

- `D:\aleta\manajemen_surat\src\app\login\page.tsx`
- `D:\aleta\manajemen_surat\src\lib\app-state.tsx`

## Patch Minimal Yang Direkomendasikan

1. Login:
   - Tahan tombol login sampai client hydration siap.
   - Tambah guard duplicate submit.
   - Gunakan submit form terkontrol dengan `preventDefault`.
   - Setelah `authClient.signIn.email`, refetch session lalu navigasi sekali ke `/portal`.
   - Hilangkan `router.refresh()` yang langsung mengikuti `router.replace()`.

2. Portal sync:
   - Jadikan sync awal dua tahap.
   - Tahap blocking hanya data kritis: `/api/users` dan `/api/settings/module-visibility`.
   - Tahap non-blocking memuat surat, disposisi, AI settings, WhatsApp settings, institution, dan assistant judge config di background.
   - Error non-kritis tidak boleh menahan shell portal.

## Risiko Patch

- Halaman dapat tampil lebih cepat dengan beberapa data non-kritis masih memuat di background.
- Beberapa counter berbasis surat/disposisi dapat berubah beberapa saat setelah halaman pertama tampil.
- RBAC tetap harus memakai user dan module visibility sebagai data blocking.

## Hal Yang Tidak Diubah

- Auth guard server.
- Better Auth library.
- RBAC dan role validation.
- WhatsApp production config.
- Scheduler/reminder.
- Data user.
