# ALETA Office Server Rollback Plan

## Rollback Aplikasi Internal

1. Informasikan admin/operator bahwa ALETA masuk mode aman.
2. Jalankan:

```powershell
cd D:\aleta
.\scripts\stop-aleta-office.ps1
```

3. Jika hanya portal bermasalah, hentikan portal dan jangan ubah database.
4. Jika hanya ALETA Bot bermasalah, hentikan ALETA Bot. Jangan hapus `.wwebjs_auth`.
5. Jalankan backup/restore database hanya dari backup resmi dan setelah disetujui admin.

## Mode Aman WhatsApp

- Matikan pengiriman otomatis sementara (`botEnabled=false`).
- Matikan notifikasi otomatis sementara (`notificationsEnabled=false`) jika insiden luas.
- Tahan Penjadwal/Pengingat production bila sumber masalah berasal dari jadwal otomatis.
- Pause Pemroses Pesan jika Antrean Pesan gagal bertambah.
- Jangan kirim ulang Pesan Gagal secara otomatis.
- Jangan logout/reset WhatsApp kecuali diputuskan manual oleh Super Admin.

## Pemicu Rollback

- Antrean Pesan gagal lebih dari 0 dan penyebabnya belum jelas.
- Pesan Gagal aktif lebih dari 0.
- Terindikasi salah penerima.
- Terindikasi kirim ganda.
- Pengiriman massal tidak wajar.
- WhatsApp tidak terhubung lama.
- Sesi WhatsApp terkunci atau proses inisialisasi macet.
- Penjadwal mengirim di luar Jam Aman Pengiriman.
- Persetujuan wajib terlewati.
