# ALETA Office Server Day-One Monitoring

## Status Baru

ALETA berjalan untuk operasional internal kantor. Pengiriman WhatsApp otomatis sudah aktif dengan pengamanan. Broadcast, pengiriman ke pihak luar, kirim ulang massal, pengiriman tidak wajar, dan backlog penjadwal tetap wajib persetujuan.

## Interval

- 30 menit sekali selama 2 jam pertama.
- Setelah itu setiap 2-3 jam selama jam kerja.
- Tambahkan pengecekan setelah ada laporan pengguna, gangguan WhatsApp, atau antrean pesan yang tidak biasa.

## Pantau

- Portal dapat dibuka.
- Login user internal.
- Manajemen Surat dapat dibuka.
- Pusat Tugas dapat dibuka.
- ALETA Bot dapat diakses.
- WhatsApp Gateway terhubung.
- Pemroses Pesan aktif dan tidak dijeda.
- Antrean Pesan: menunggu, diproses, dan gagal.
- Pesan Gagal aktif.
- Persetujuan tertunda.
- Batas pengiriman.
- Penjadwal/Pengingat.
- Jam Aman Pengiriman.
- Review Pertanyaan Publik.
- Masukan pengguna.

## Kapan Kembali Ke Mode Aman

- Antrean Pesan gagal lebih dari 0 dan penyebabnya belum jelas.
- Pesan Gagal aktif lebih dari 0.
- Ada indikasi pesan terkirim ke penerima salah.
- Ada indikasi pesan terkirim ganda.
- Ada pengiriman massal yang tidak wajar.
- WhatsApp tidak terhubung dalam waktu lama.
- Penjadwal mengirim di luar Jam Aman Pengiriman.
- Persetujuan wajib terlewati.
- Batas pengiriman tidak bekerja.

## Tindakan Aman

- Matikan pengiriman otomatis sementara (`botEnabled=false`) bila ada insiden pengiriman.
- Tahan Penjadwal/Pengingat jika antrean memburuk.
- Pause Pemroses Pesan jika antrean gagal bertambah.
- Jangan kirim ulang otomatis.
- Review Pesan Gagal satu per satu.
- Catat kejadian dan tindak lanjut di laporan operator.
