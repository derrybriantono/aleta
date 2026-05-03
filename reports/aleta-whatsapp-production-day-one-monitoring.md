# ALETA WhatsApp Production Day-One Monitoring

## Status Baru

Pengiriman WhatsApp otomatis sudah aktif dengan pengamanan. Uji terbatas berhasil. Antrean Pesan sehat, Pesan Gagal aktif 0, Persetujuan tertunda 0, dan batas pengiriman aktif.

Full production bukan broadcast bebas. Broadcast, pengiriman ke pihak luar, kirim ulang massal, pengiriman tidak wajar, dan backlog penjadwal tetap wajib persetujuan.

## Jadwal Pantau

- Cek setiap 30 menit selama 2 jam pertama.
- Setelah itu cek setiap 2-3 jam selama jam kerja.
- Cek tambahan setelah ada perubahan konfigurasi, gangguan WhatsApp, atau laporan pengguna.

## Yang Dipantau

- WhatsApp Gateway tetap terhubung.
- Pemroses Pesan aktif dan tidak dijeda.
- Antrean Pesan: menunggu, diproses, gagal.
- Pesan Gagal aktif.
- Persetujuan tertunda.
- Penggunaan batas pengiriman.
- Penjadwal/Pengingat.
- Jam Aman Pengiriman.
- Review Pertanyaan Publik.
- Masukan pengguna.

## Kapan Kembali Ke Mode Aman

- Antrean Pesan gagal lebih dari 0 dan penyebabnya belum jelas.
- Pesan Gagal aktif lebih dari 0.
- Pesan terkirim ke penerima salah.
- Kirim ganda terdeteksi.
- Pengiriman massal tidak wajar.
- WhatsApp tidak terhubung dalam waktu lama.
- Penjadwal mengirim di luar Jam Aman Pengiriman.
- Persetujuan wajib terlewati.
- Batas pengiriman tidak bekerja.

## Tindakan Operator

- Jangan kirim ulang otomatis.
- Jangan broadcast ulang tanpa persetujuan.
- Matikan pengiriman otomatis sementara (`botEnabled=false`) jika ada insiden.
- Tahan Penjadwal/Pengingat bila sumber masalah berasal dari jadwal otomatis.
- Pause Pemroses Pesan jika antrean gagal bertambah.
- Review Pesan Gagal satu per satu.
- Buat laporan insiden singkat.
