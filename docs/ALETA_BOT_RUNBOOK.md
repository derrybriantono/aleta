# ALETA Bot Runbook

Runbook ini untuk operasi terbatas ALETA Bot sebagai WhatsApp Gateway tunggal.

## Menjalankan Layanan

1. Jalankan `aleta_bot` dari folder `aleta_bot` dengan `npm start`.
2. Jalankan portal `manajemen_surat` dari folder `manajemen_surat` dengan `npm run dev`.
3. Pastikan env internal sama di kedua aplikasi:
   - `ALETA_BOT_INTERNAL_API_TOKEN`
   - `ALETA_BOT_BASE_URL`
   - `WHATSAPP_RUNTIME_MODE=aleta_bot`

## WhatsApp Gateway

1. QR hanya boleh dibaca dari portal ALETA Bot atau endpoint gateway `aleta_bot`.
2. Jangan scan QR dari legacy portal jika `WHATSAPP_RUNTIME_MODE=aleta_bot`.
3. Jangan logout/reset session tanpa jadwal maintenance.
4. Jangan membagikan folder session WhatsApp seperti `.wwebjs_auth`.

## Cara Connect WhatsApp Gateway

1. Jalankan `aleta_bot`.
2. Jalankan `manajemen_surat`.
3. Login sebagai Super Admin.
4. Buka menu `ALETA Bot`.
5. Pastikan runtime tertulis `ALETA Bot Gateway`.
6. Klik `Connect WhatsApp Gateway`.
7. Tunggu status `Initializing` lalu `QR Needed` jika login diperlukan.
8. Scan QR yang muncul memakai WhatsApp kantor melalui menu `Perangkat Tertaut`.
9. Jika sudah connected, QR hilang dan status berubah `Connected`.

## Jika QR Tidak Muncul

1. Pastikan `aleta_bot` hidup di port/runtime URL yang benar, misalnya `http://127.0.0.1:3003`.
2. Pastikan `ALETA_BOT_BASE_URL` di portal mengarah ke runtime `aleta_bot`.
3. Pastikan `ALETA_BOT_INTERNAL_API_TOKEN` sama di portal dan runtime.
4. Test endpoint status: `/internal/aleta-bot/whatsapp/status`.
5. Test endpoint QR: `/internal/aleta-bot/whatsapp/qr`.
6. Test endpoint connect: `/internal/aleta-bot/whatsapp/connect`.
7. Pastikan `WHATSAPP_RUNTIME_MODE=aleta_bot`, bukan `legacy_portal`.
8. Jika status sudah `connected`, QR memang tidak akan tampil.
9. Jika status `auth_failure`, cek log runtime dan jangan reset session tanpa jadwal maintenance.

## AI Bridge

1. Atur provider/model/API key dari menu Pengaturan AI portal.
2. Buka menu ALETA Bot, lalu klik `Sync AI ke ALETA Bot`.
3. Jika status `needs_sync` setelah restart, lakukan sync ulang dari portal.
4. Jangan aktifkan fallback env AI di production.

## Queue dan Worker

1. Cek worker di tab Queue Recovery.
2. Gunakan pause saat maintenance atau saat ada risiko pengiriman tidak diinginkan.
3. Resume setelah konfigurasi aman.
4. Dead-letter hanya boleh di-resend melalui modal konfirmasi Super Admin.

## Log dan Observability

1. Dashboard menampilkan status WhatsApp, AI Bridge, worker, queue, SQL, Public Q&A, approval, dan legacy migration.
2. Gunakan endpoint health check lokal:
   `node scripts/health-check.js`
3. Log sensitif harus tetap termasking; jangan menyalin token/API key/password ke tiket dukungan.

## Mode Runtime

1. `WHATSAPP_RUNTIME_MODE=aleta_bot`: produksi terbatas, portal menjadi control panel.
2. `WHATSAPP_RUNTIME_MODE=legacy_portal`: fallback sementara, hindari menjalankan dua QR.
3. `WHATSAPP_RUNTIME_MODE=disabled`: pengiriman portal dilewati.

## Failure Handling

1. `aleta_bot` unreachable: portal harus menampilkan error gateway, tidak crash.
2. Token salah: perbaiki env token di dua aplikasi lalu restart.
3. WhatsApp disconnected: cek status gateway, tunggu QR jika diperlukan, jangan reset session spontan.
4. AI provider error: sync ulang AI config, test runtime, fallback Public Q&A tetap aktif.
5. SQL connection failed: test koneksi dari tab Sumber Data SQL, jangan aktifkan query baru sebelum valid.

## Larangan Operasional

1. Jangan menghapus legacy tanpa rollback.
2. Jangan membuka endpoint internal tanpa token.
3. Jangan mengirim broadcast manual tanpa queue dan approval.
4. Jangan export/import secret dari UI.
5. Jangan edit query/template high-risk langsung aktif tanpa validasi dan persetujuan.
6. Jangan menjalankan dua client WhatsApp produksi untuk nomor yang sama.
7. Jangan share atau commit folder `.wwebjs_auth`.
8. Jangan mengaktifkan fallback env AI di production.

## Production Pilot Plan

### Pilot 1 — Public Command Low Risk

- Scope: `greeting`, `alamat-pengadilan`, dan `info-layanan`.
- Durasi observasi: 3-5 hari kerja.
- Success metric: fallback rendah, tidak ada jawaban unsafe, log Public Q&A terbaca.
- Rollback trigger: safety block berulang atau intent salah arah.
- Log yang dicek: Public Q&A logs, AI logs, system logs.

### Pilot 2 — Notifikasi Pegawai Low Risk

- Scope: pengingat kasir dan penjaga sidang hari ini.
- Durasi observasi: 1 minggu.
- Success metric: queue dry-run/sent stabil, tidak ada duplicate idempotency.
- Rollback trigger: nomor pegawai salah, queue failed meningkat, atau worker error.
- Log yang dicek: message queue, message logs, worker heartbeat.

### Pilot 3 — Notifikasi Pihak Dry-run

- Scope: perkara baru, akta cerai, dan sisa panjar.
- Durasi observasi: 1-2 minggu dry-run.
- Success metric: nomor tervalidasi, template aman, tidak ada data sensitif bocor.
- Rollback trigger: verifikasi gagal, placeholder mentah, atau query mismatch.
- Log yang dicek: dry-run queue, notification run, query error, public safety logs.
