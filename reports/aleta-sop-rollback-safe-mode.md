# SOP: Kembali Ke Mode Aman

## Tujuan

Menjaga ALETA tetap dapat digunakan secara internal sambil menahan pengiriman WhatsApp otomatis yang berisiko.

## Checklist Mode Aman

1. Matikan pengiriman otomatis sementara (`botEnabled=false`).
2. Matikan notifikasi otomatis sementara (`notificationsEnabled=false`) jika insiden luas.
3. Tahan Penjadwal/Pengingat production bila sumber masalah berasal dari jadwal otomatis.
4. Pause Pemroses Pesan jika Antrean Pesan gagal bertambah.
5. Pastikan tidak ada broadcast atau pengiriman pihak luar tanpa persetujuan.
6. Tetap jalankan Manajemen Surat dan Pusat Tugas jika portal sehat.
7. Tetap buka Admin ALETA Bot untuk monitoring.
8. Jalankan preflight dan smoke dry-run setelah kondisi stabil.

## Kapan Masuk Mode Aman

- WhatsApp tidak terhubung lama.
- Sesi WhatsApp dipakai proses lain.
- Pemroses Pesan tidak aktif atau dijeda tanpa alasan jelas.
- Antrean Pesan gagal lebih dari 0.
- Pesan Gagal aktif lebih dari 0.
- Persetujuan tertunda muncul tidak wajar.
- Salah penerima, kirim ganda, atau pengiriman massal tidak wajar terindikasi.
- Penjadwal mengirim di luar Jam Aman Pengiriman.
- Persetujuan wajib terlewati.

## Kriteria Keluar Mode Aman

- Preflight tidak memiliki blocker.
- Smoke dry-run tidak memiliki blocker.
- WhatsApp terhubung.
- Antrean Pesan menunggu/diproses/gagal sehat.
- Pesan Gagal aktif 0.
- Persetujuan tertunda sudah jelas.
- Batas pengiriman dan persetujuan wajib tetap aktif.
- Super Admin menyetujui pengiriman otomatis berjalan kembali.
