# ALETA Humanized Copy Review

Tanggal: 2026-05-03

## Ringkasan

Bahasa UI aplikasi `manajemen_surat` dirapikan agar lebih mudah dipahami pegawai kantor, lebih manusiawi, dan tidak terlalu teknis. Perubahan difokuskan pada label, pesan error, helper text, status, panduan, patch notes, dan panel admin yang menampilkan istilah teknis.

Tidak ada perubahan pada fungsi bisnis, API contract, database schema, RBAC, auth guard, WhatsApp config, `botEnabled`, scheduler/reminder, atau alur pengiriman WhatsApp.

## Area Diaudit dan Diperbaiki

- Login: pesan validasi dan error dibuat lebih jelas.
- Portal utama dan sidebar: istilah `role` diseragamkan menjadi `peran`.
- Dashboard Manajemen Surat: label ringkasan dibuat lebih natural.
- Surat Masuk/Keluar dan detail surat: istilah hapus/arsip, alur, dan tenggat dirapikan.
- Disposisi: istilah `node`, `deadline`, dan retry dibuat lebih mudah dipahami.
- Pusat Tugas: istilah mendesak dan tugas masuk dipertahankan konsisten.
- ALETA Bot Admin: istilah teknis diberi label manusiawi, seperti Antrean Pesan, Pesan Gagal, Pemroses Pesan, Jam Aman Pengiriman, Simulasi, dan Pengiriman Bot.
- Pusat Masukan: istilah bug diganti menjadi kendala pada teks yang tampil ke user.
- Patch Notes 0.1.0-beta.6: bagian terbaru dibuat lebih ramah dan tetap jujur bahwa WhatsApp production final belum aktif.
- Panduan Penggunaan: istilah teknis dijelaskan dengan bahasa user.
- Asisten Hakim dan admin settings: role/user/visibility diseragamkan menjadi peran/pengguna/akses tampilan.
- Error global/API yang tampil di UI: Unauthorized, Forbidden, Invalid payload, dan Entity not found diberi padanan yang manusiawi.

## Contoh Perubahan Teks

| Sebelum | Sesudah |
| --- | --- |
| Identitas login atau password tidak valid. | Masukkan identitas akun dan password. |
| Runtime | Layanan |
| WhatsApp Runtime | Layanan WhatsApp |
| Queue | Antrean Pesan |
| Worker | Pemroses Pesan |
| Dead-letter | Pesan Gagal |
| Safe Sending Window | Jam Aman Pengiriman |
| Dry-run | Simulasi |
| Production | Aktif Operasional |
| botEnabled | Pengiriman Bot |
| AI Bridge | Jembatan AI |
| Public Q&A | Pertanyaan Publik |
| Refresh Status | Perbarui Status |
| Inbox Tugas | Tugas Masuk |
| Hard Delete | Hapus Permanen |
| Delete | Arsipkan |
| Deadline | Tenggat |
| Forbidden | Anda tidak memiliki izin untuk membuka halaman ini. |
| Invalid payload | Data yang dikirim belum lengkap atau tidak sesuai. |
| Data backend sedang diperiksa | Status layanan database sedang diperiksa. |

## File Diubah

- `D:\aleta\manajemen_surat\src\lib\humanized-labels.ts`
- `D:\aleta\manajemen_surat\src\components\portal\use-whatsapp-gateway.ts`
- `D:\aleta\manajemen_surat\src\components\portal\whatsapp-control.tsx`
- `D:\aleta\manajemen_surat\src\components\portal\institution-settings-panel.tsx`
- `D:\aleta\manajemen_surat\src\components\portal\whatsapp-status.tsx`
- `D:\aleta\manajemen_surat\src\lib\disposition-status.ts`
- `D:\aleta\manajemen_surat\src\components\portal\shared.tsx`
- `D:\aleta\manajemen_surat\src\app\login\page.tsx`
- `D:\aleta\manajemen_surat\src\components\portal\mail-dashboard-page.tsx`
- `D:\aleta\manajemen_surat\src\components\portal\letter-list.tsx`
- `D:\aleta\manajemen_surat\src\app\(portal)\surat\page.tsx`
- `D:\aleta\manajemen_surat\src\components\portal\aleta-bot-admin.tsx`
- `D:\aleta\manajemen_surat\src\components\portal\aleta-bot-dashboard.tsx`
- `D:\aleta\manajemen_surat\src\components\portal\admin-hub.tsx`
- `D:\aleta\manajemen_surat\src\components\portal\admin-panels.tsx`
- `D:\aleta\manajemen_surat\src\components\portal\feedback-center.tsx`
- `D:\aleta\manajemen_surat\src\components\portal\feedback-admin-panel.tsx`
- `D:\aleta\manajemen_surat\src\lib\feedback.ts`
- `D:\aleta\manajemen_surat\src\server\shared\http.ts`
- `D:\aleta\manajemen_surat\src\app\(portal)\admin\asisten-hakim\page.tsx`
- `D:\aleta\manajemen_surat\src\app\(portal)\asisten-hakim\page.tsx`
- `D:\aleta\manajemen_surat\src\app\(portal)\admin\status-whatsapp\page.tsx`
- `D:\aleta\manajemen_surat\src\app\(portal)\admin\visibility-role\page.tsx`
- `D:\aleta\manajemen_surat\src\app\(portal)\account\page.tsx`
- `D:\aleta\manajemen_surat\src\app\(portal)\panduan\page.tsx`
- `D:\aleta\manajemen_surat\src\app\(portal)\portal\page.tsx`
- `D:\aleta\manajemen_surat\src\app\(portal)\arsip\page.tsx`
- `D:\aleta\manajemen_surat\src\app\(portal)\surat\[id]\page.tsx`
- `D:\aleta\manajemen_surat\src\app\(portal)\disposisi\[id]\page.tsx`
- `D:\aleta\manajemen_surat\src\components\layout\portal-shell-v2.tsx`
- `D:\aleta\manajemen_surat\src\components\portal\ai-control-panel.tsx`
- `D:\aleta\manajemen_surat\src\components\pdf\pdf-live-viewer.tsx`
- `D:\aleta\manajemen_surat\src\lib\patch-notes.ts`
- `D:\aleta\manajemen_surat\src\lib\user-guides.ts`
- `D:\aleta\manajemen_surat\src\test\humanized-labels.test.ts`
- `D:\aleta\manajemen_surat\src\test\whatsapp-control.test.tsx`
- `D:\aleta\manajemen_surat\src\test\login-page.test.tsx`
- `D:\aleta\manajemen_surat\src\test\mail-dashboard-page.test.tsx`

## Istilah Diseragamkan

- Runtime -> Layanan
- Queue -> Antrean Pesan
- Dead-letter -> Pesan Gagal
- Worker -> Pemroses Pesan
- Safe Sending Window -> Jam Aman Pengiriman
- Dry-run -> Simulasi
- Production -> Aktif Operasional
- Canary -> Uji Terbatas
- Shadow-run -> Simulasi Tanpa Kirim
- Approval gate -> Persetujuan Wajib
- Rate limit -> Batas Pengiriman
- Public Q&A -> Pertanyaan Publik
- AI Bridge -> Jembatan AI
- Role -> Peran
- Visibility -> Akses Tampilan
- Unauthorized -> Anda belum login atau sesi Anda telah berakhir.
- Forbidden -> Anda tidak memiliki izin untuk membuka halaman ini.

## Hal yang Sengaja Tidak Diubah

- Nilai internal enum/status seperti `connected`, `failed`, `dry_run`, `production`, `browser_locked`, dan `pending`.
- API contract dan nama field database.
- Auth guard, RBAC, role resolver, dan permission logic.
- WhatsApp production config, `botEnabled`, scheduler/reminder, queue, dan runtime ALETA Bot.
- Struktur besar layout, route, database schema, dan workflow bisnis.
- Istilah teknis yang memang masih diperlukan untuk admin debugging tetap dipertahankan, tetapi diberi label manusiawi di area tampilan.

## Validasi

- `npx tsc --noEmit --pretty false`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 16 test files, 62 tests

## Risiko Tersisa

- Beberapa istilah teknis masih sengaja dipertahankan di halaman admin teknis, file patch notes lama, dan test description agar riwayat teknis tetap dapat ditelusuri.
- Teks dari data dinamis atau pesan yang berasal dari ALETA Bot runtime masih dapat muncul teknis jika dikirim langsung dari backend eksternal; label tampilan utama sudah disiapkan untuk status umum.
