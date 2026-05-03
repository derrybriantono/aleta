# ALETA WhatsApp Production Rollback Plan

## Tujuan

Kembali ke mode aman dipakai untuk menahan pengiriman WhatsApp otomatis saat ada gangguan, tanpa mematikan aplikasi internal dan tanpa menghapus sesi WhatsApp.

## Mode Aman Cepat

1. Matikan pengiriman otomatis sementara (`botEnabled=false`).
2. Matikan notifikasi otomatis sementara (`notificationsEnabled=false`) bila insiden menyangkut semua alur.
3. Tahan Penjadwal/Pengingat production bila sumber masalah berasal dari jadwal otomatis.
4. Pause Pemroses Pesan jika Antrean Pesan gagal bertambah.
5. Jangan kirim ulang otomatis.
6. Jangan broadcast ulang tanpa persetujuan.
7. Review Pesan Gagal satu per satu.
8. Jalankan preflight dan smoke dry-run setelah kondisi stabil.

## Pemicu Rollback

- Antrean Pesan gagal lebih dari 0 dan penyebabnya belum jelas.
- Pesan Gagal aktif lebih dari 0.
- Salah penerima terindikasi.
- Kirim ganda terindikasi.
- Pengiriman massal tidak wajar.
- WhatsApp tidak terhubung lama.
- Penjadwal mengirim di luar Jam Aman Pengiriman.
- Persetujuan wajib terlewati.
- Batas pengiriman tidak bekerja.

## Yang Tidak Boleh Dilakukan

- Jangan logout/reset WhatsApp.
- Jangan hapus `.wwebjs_auth`.
- Jangan scan QR dari script.
- Jangan membuat WhatsApp client kedua.
- Jangan resend Pesan Gagal tanpa review.
- Jangan bypass persetujuan wajib.
