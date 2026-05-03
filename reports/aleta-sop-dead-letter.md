# SOP: Pesan Gagal Aktif

## Tujuan

Menangani Pesan Gagal dengan aman tanpa salah kirim, kirim ganda, atau kirim ulang massal.

## Jangan Lakukan

- Jangan kirim ulang langsung.
- Jangan broadcast.
- Jangan hapus riwayat antrean atau Pesan Gagal secara permanen.
- Jangan kirim ke pihak luar tanpa persetujuan.
- Jangan bypass batas pengiriman.

## Langkah

1. Buka Admin ALETA Bot bagian Antrean Pesan/Pesan Gagal.
2. Cek kategori penerima dan sumber pengiriman.
3. Baca error yang sudah disaring.
4. Jika item hanya artefak validasi, tandai sebagai sudah ditangani.
5. Jika item operasional, cek WhatsApp Gateway, Jam Aman Pengiriman, Pemroses Pesan, batas pengiriman, dan validitas penerima.
6. Tahan pengiriman otomatis bila penyebab belum jelas.
7. Putuskan apakah kirim ulang boleh dilakukan. Pengiriman berisiko wajib persetujuan.
8. Setelah tindakan, jalankan smoke dry-run.

## Dampak Operasional

- Pesan Gagal aktif lebih dari 0 adalah alasan kembali ke mode aman.
- Jangan kirim ulang otomatis.
- Aplikasi internal tetap dapat digunakan jika masalah hanya pada WhatsApp.
