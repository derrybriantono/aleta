# ALETA Soft Launch Internal Readiness

Generated: 2026-05-02 19:32 WITA

## Overall

Status: **WARN**

ALETA boleh digunakan untuk **soft launch internal**. Warning yang tersisa bukan blocker operasional: endpoint proxy WhatsApp portal mengembalikan `401` dari shell tanpa sesi, sesuai auth guard. Smoke dry-run terakhir **PASS**.

Production WhatsApp tetap **tidak boleh** dijalankan.

## Status Aplikasi

| Area | Status | Catatan |
| --- | --- | --- |
| Portal | PASS | Portal reachable HTTP 200. |
| Manajemen Surat | PASS | Boleh digunakan untuk pilot operasional internal. |
| ALETA Bot | PASS | Runtime reachable. |
| WhatsApp Runtime | PASS | Connected, tidak initializing, tidak ada QR aktif, tidak ada error lock. |
| Worker | PASS | Enabled, active timer, tidak paused, idle sehat. |
| Queue | PASS | Pending 0, processing 0, failed 0. |
| Dead-letter | PASS | Aktif 0, resolved 1 sebagai riwayat validasi. |
| Approval | PASS | Pending 0. |
| Nomor WhatsApp Pegawai | PASS | 42/42 lengkap, missing 0, priority missing 0. |
| Safe Sending Window | PASS | Enabled 07:30-21:00, saat validasi allowed. |
| AI Bridge | PASS | Synced. |
| Public Q&A | PASS | Pending human review 0. |
| Scheduler/Reminder | PASS | Reminder disabled, mode dry_run, scheduler disabled/dry_run, kill switch off. |
| botEnabled | PASS | `false` sebagai default setelah uji terbatas. |

## Fitur Yang Boleh Dipakai

- Portal internal ALETA.
- Manajemen Surat untuk pilot operasional.
- Pusat Tugas.
- Patch Notes.
- Panduan.
- Pusat Masukan.
- Dashboard/monitoring Admin ALETA Bot secara read-only.
- Preflight dan smoke dry-run.
- Uji WhatsApp terbatas hanya dengan persetujuan eksplisit, whitelist, dan gate aman.

## Fitur Yang Tetap Ditahan

- WhatsApp production otomatis.
- Broadcast WhatsApp.
- Notifikasi pihak eksternal.
- Scheduler reminder production.
- Reminder H-1 production.
- Resend dead-letter tanpa review manual.
- Approval produksi massal.
- `botEnabled=true` permanen.

## Checklist Operator/Admin

- Pastikan WhatsApp runtime tetap connected sebelum aktivitas yang membutuhkan WhatsApp.
- Pastikan worker enabled, active timer, dan tidak paused.
- Pantau queue pending/processing/failed sebelum dan sesudah uji terbatas.
- Pastikan dead-letter aktif tetap 0.
- Pastikan approval pending tidak muncul tanpa konteks jelas.
- Pastikan scheduler/reminder tetap dry_run/disabled.
- Jalankan preflight dan smoke dry-run sebelum uji WhatsApp lanjutan.
- Jangan mengubah `botEnabled` menjadi true tanpa whitelist dan persetujuan eksplisit.

## Checklist User Pegawai

- Gunakan Manajemen Surat untuk registrasi, detail, disposisi, deadline, dan status baca.
- Gunakan Pusat Tugas untuk memantau tugas internal.
- Gunakan Panduan dan Patch Notes untuk memahami batas fitur pilot.
- Laporkan kendala lewat Pusat Masukan.
- Jangan mengandalkan WhatsApp otomatis untuk proses produksi selama fase pilot internal.

## SOP Singkat: WhatsApp Disconnected

1. Jangan scan QR dari script atau shell.
2. Buka Status WhatsApp Gateway dari UI Super Admin.
3. Cek apakah runtime ALETA Bot reachable dan tidak `browser_locked`.
4. Hubungkan ulang hanya lewat alur Super Admin yang aman.
5. Jangan logout/reset session kecuali menjadi keputusan operasional terpisah.

## SOP Singkat: Dead-letter Muncul

1. Jangan langsung resend.
2. Buka Queue Recovery/Pesan Gagal.
3. Baca error yang sudah disanitasi.
4. Jika artefak validasi, tandai ditangani.
5. Jika pesan operasional, review penerima, kategori, dan policy sebelum tindakan ulang.

## SOP Singkat: Queue Gagal

1. Jangan retry massal.
2. Cek WhatsApp status, safe sending window, worker, dan policy skip.
3. Pastikan `botEnabled` tidak berubah tanpa persetujuan.
4. Gunakan preflight dan smoke dry-run untuk membedakan masalah runtime dan data.
5. Eskalasikan jika failed count bertambah atau dead-letter aktif muncul.

## Rekomendasi Hari Pertama Pilot

- Mulai dari alur non-WA: Manajemen Surat, Pusat Tugas, Panduan, Patch Notes, dan Masukan.
- Pantau Admin ALETA Bot secara read-only.
- Jalankan preflight dan smoke dry-run di awal dan akhir hari pilot.
- Jika ingin menguji WhatsApp lagi, gunakan whitelist kecil internal dan idempotency key baru.
- Tahan semua production WhatsApp sampai ada keputusan approval dan runbook production terpisah.

## Validasi

| Command | Status |
| --- | --- |
| `node scripts/aleta-preflight.mjs` | WARN, tanpa blocker |
| `node scripts/aleta-smoke-dry-run.mjs` | PASS |
| `node --check app.js` | PASS |
| `node --check whatsapp.js` | PASS |
| `node --check services/whatsappStatusService.js` | PASS |
| `node --check routes/internalGatewayRoutes.js` | PASS |
| `npx tsc --noEmit --pretty false` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm test` | PASS, 38/38 tests |

## Risiko Tersisa

- Production WhatsApp belum boleh dijalankan.
- `botEnabled` harus tetap false kecuali ada uji terbatas eksplisit.
- Satu queue item lama berstatus skipped tetap ada sebagai riwayat, bukan blocker.
- Endpoint admin portal mengembalikan 401 dari shell tanpa sesi; verifikasi UI dilakukan lewat sesi admin.
- Soft launch hari pertama harus dipantau untuk feedback pengguna dan anomali queue.

## Catatan

Sebelum validasi ulang, artefak generated `.next/dev/types/validator.ts` yang korup dibersihkan. Source aplikasi tidak diubah untuk itu.

Tidak ada pengiriman WhatsApp, resend, QR scan, logout/reset, atau aktivasi production pada checkpoint ini.
