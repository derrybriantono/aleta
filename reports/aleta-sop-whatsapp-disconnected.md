# SOP: WhatsApp Tidak Terhubung

## Tujuan

Memulihkan layanan WhatsApp dengan aman tanpa reset sesi dan tanpa membuat koneksi ganda.

## Jangan Lakukan

- Jangan scan QR dari shell/script.
- Jangan logout.
- Jangan reset session.
- Jangan hapus folder autentikasi/sesi.
- Jangan ganti session name.
- Jangan jalankan instance ALETA Bot kedua.
- Jangan kirim ulang pesan otomatis saat status belum stabil.

## Langkah

1. Buka Admin ALETA Bot dan cek Status WhatsApp.
2. Jalankan `node scripts/aleta-preflight.mjs`.
3. Pastikan ALETA Bot dapat diakses pada port 3003.
4. Cek diagnostics: pastikan tidak ada `browser_locked`, `initialize_timeout`, atau proses yang macet.
5. Jika WhatsApp terputus tetapi layanan sehat, gunakan alur Super Admin di UI untuk menghubungkan ulang.
6. Jika sesi terkunci, hentikan proses ALETA Bot/Chrome lama dengan hati-hati, lalu jalankan satu instance ALETA Bot. Jangan hapus data sesi.
7. Setelah terhubung, jalankan smoke dry-run.

## Dampak Operasional

- Manajemen Surat dan Pusat Tugas tetap dapat digunakan bila portal sehat.
- Pengiriman WhatsApp otomatis harus dipantau ketat setelah koneksi pulih.
- Jika antrean atau Pesan Gagal muncul, kembali ke mode aman dan jangan kirim ulang otomatis.
