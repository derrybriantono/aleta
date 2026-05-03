# SOP: Antrean Pesan Gagal

## Tujuan

Mencegah percobaan ulang yang berlebihan dan menemukan penyebab Antrean Pesan gagal.

## Jangan Lakukan

- Jangan retry pesan massal.
- Jangan kirim ulang otomatis.
- Jangan broadcast.
- Jangan ubah pengamanan pengiriman.
- Jangan bypass persetujuan wajib.

## Langkah

1. Cek Antrean Pesan: menunggu, diproses, gagal, dan Pesan Gagal.
2. Cek Pemroses Pesan: aktif, timer berjalan, tidak dijeda.
3. Cek WhatsApp Gateway.
4. Cek Jam Aman Pengiriman.
5. Cek batas pengiriman dan laporan pengiriman tidak wajar.
6. Jika gagal masih lebih dari 0, kembali ke mode aman.
7. Review satu item gagal dalam satu waktu.
8. Kirim ulang hanya setelah sumber, penerima, template, dan persetujuan dinyatakan aman.
9. Jalankan preflight dan smoke dry-run setelah recovery.

## Dampak Operasional

- Antrean Pesan gagal lebih dari 0 yang tidak jelas adalah alasan rollback.
- Manajemen Surat tetap boleh berjalan bila tidak terkait masalah WhatsApp.
- Jangan menambah pengiriman baru sampai penyebab jelas.
