# Tunda otomatis 16.30 (22 Okt 2026)

Saklar di Jadwal Sidang (tombol **Tunda otomatis** di kepala, sebelah "Tautan jadwal"). Bawaan **MATI** dan **mode kering**; hanya Super Admin yang mengubahnya. Sarannya: nyalakan dalam mode kering beberapa hari dan baca daftarnya sebelum mematikan mode kering.

## Cara kerja

| Bagian | Tempat |
| :--- | :--- |
| Aturan (fungsi murni) | `manajemen_surat/src/lib/tunda-otomatis.ts` |
| Bahan, daftar harian, penjadwal, penulis | `manajemen_surat/src/server/modules/tunda-otomatis/layanan.ts` |
| Rute | `GET/POST /api/aleta-ecourt/tunda-otomatis` |
| Layar | `src/components/portal/tunda-otomatis-panel.tsx` (dipasang di Jadwal Sidang) |
| Pemberitahuan | sumber tugas `/api/tasks` (lonceng portal + widget) |
| Bahan dari bot (baca saja) | `aleta_bot/services/tundaOtomatisBahanService.js`, rute `/internal/aleta-bot/jadwal-sidang/tunda-otomatis/*` |
| Penjaga sebelum menulis | `sidangHasilService.penjagaTundaOtomatis` |

- Setelan dan daftar harian disimpan di `aleta_ekstensi_setelan` (pengguna `*sistem*`, kunci `sistem:tunda-otomatis` dan `sistem:tunda-otomatis:hari:YYYY-MM-DD`), tanpa migrasi.
- Jam pemicu: 16.30 WITA. Pada hari yang saklar Sidang keliling-nya aktif (`aleta_sidang_keliling_hari`, migrasi 0083 milik fitur itu), jamnya 14.00. Tabel atau baris yang belum ada dibaca sebagai 16.30. Satu tanggal hanya dijalankan sekali.
- Sebelum jam pemicu, daftar berupa **pratinjau** (yang akan terjadi). Pada jam pemicu daftar **dibekukan** dan tiap tunda dikirim ke **penulis tunda yang sudah ada** (`/sidang/tunda`, atas akun PP perkara) dengan `otomatis: true`.
  - Mode kering mengirim `kering: true`: bot menyusun rencananya (akun PP, hari libur, tanggal) tetapi tidak menulis apa pun.
  - Di luar jam kerja (16.30 sudah lewat jam kerja Senin-Kamis), tulisan diantrekan ke jam kerja berikutnya. Antrean memakai kunci `sidang-tunda:otomatis:<jadwal>` dan asal `otomatis`.
  - Sesaat sebelum menulis, bot membaca ulang keadaan sidang dan menolak bila: hasil sidang sudah diisi (termasuk "putus ..."), perkara sudah diputus, tanggal sidang berubah, sudah ada sidang berikutnya, sidang ikrar, atau perkara sedang dikunci petugas.
- **Jangan tunda otomatis** per baris. Sebelum jam pemicu, baris itu dilewati. Sesudahnya, baris otomatis yang masih menunggu di antrean dibatalkan. Baris yang dibuat manual tidak pernah disentuh.
- Alamat audit: alamat peramban Super Admin saat menyimpan saklar, sama dengan cara Jadwalkan Putusan. Kolom penekan (operator) hanya tercatat di jejak ALETA. Tidak ada kata "Aleta" yang dikirim ke SIPP.

## Tafsir aturan (urutan: yang pertama cocok menang)

1. **Sasaran**: sidang bertanggal hari ini yang pada jam pemicu belum ditunda, belum diputus, alasan/hasilnya masih kosong (`''`/`'0'`), dan belum punya sidang sesudahnya.
2. **Dilewati** (dengan sebab): ikrar talak, putusan sela, agenda musyawarah/pembacaan putusan/penetapan, verzet, kunci petugas, sidang yang masih berlangsung di antrian, bahan yang tidak terbaca, PP tidak jelas, dan sidang yang ditandai "jangan tunda otomatis".
3. **7 Gugur**: Penggugat/Pemohon tidak hadir di sidang pertama (dihadiri_oleh 3/4), dan hari ini sidang kedua tanpa bukti ia hadir. Hasilnya **usulan**, bukan tunda.
4. **8 Tidak dapat diterima**: ia pernah hadir, lalu tidak hadir di sidang sebelumnya dan hari ini. Hasilnya juga **usulan**.
   - Perkara ber-Court Calendar menganggap semua pihak hadir bila kehadiran hari ini tidak tercatat (aturan 3), jadi 7/8 tidak terpicu tanpa bukti ketidakhadiran.
5. **Perkiraan verstek** (dilewati, sesudah 7/8): sidang ke-2 atau lebih yang pihak lawannya belum pernah hadir. Sidang seperti ini kemungkinan besar diputus verstek, dan menundanya menutup jalan untuk mencatat putusnya.
6. **5 Permohonan** (alur 16 / Pdt.P): tunda 7 hari. Cerai talak (Pdt.G) bukan permohonan.
7. **4 Court Calendar + pembuktian** (agenda hari ini pembuktian): tunda 7 hari bila Tergugat/Termohon punya email e-Court, 14 hari bila tidak.
8. **3 Court Calendar**: dihadiri semua pihak; tanggal dan agenda mengikuti rencana berikutnya yang belum menjadi sidang. Bila tidak ada rencana lagi, tunda 14 hari.
9. **2 Tanpa Court Calendar**: tunda 14 hari.
10. **Tanggal**:
    - Tanggal yang jatuh pada Sabtu, Minggu, atau libur (SKB 2024-2027 + libur tambahan Pengaturan) digeser ke hari kerja berikutnya. Tabel `hari_libur` SIPP kosong di server, jadi daftar ALETA yang dipakai.
    - Sidang keliling memakai hari keliling berikutnya di lokasi yang sama (nama ruangan) pada atau sesudah tanggal aturan. Bila tidak ada, dipakai aturan umum dan baris ditandai "periksa lokasi".
11. **Alasan, agenda, jam, kehadiran** diambil dari `bawaanTunda`, aturan yang sama dengan borang tunda.

## Yang TIDAK ditulis ke SIPP

Gugur dan tidak dapat diterima tidak ditulis. Di SIPP, kedua hasil itu hanya tersimpan sebagai `alasan_ditunda = "putus ..."` lewat borang Edit Jadwal/Putusan Akhir, yaitu catatan putusan yang menjadi wewenang majelis. Kolom `keterangan` jadwal hanya catatan bebas, bukan hasil sidang. Karena itu keduanya hanya tampil sebagai usulan di daftar dan di pemberitahuan majelis/PP. Pengesahannya lewat Putusan Otomatis atau tombol Putus.

## Ukur kering

Diukur atas data server dengan SELECT saja: 294 sidang dari 21 Sep sampai 21 Okt 2026. Skripnya ada di luar repo, `D:/aleta-dev/kerja/tunda-otomatis-42/ukur.ts`. Rinciannya ada di laporan agen W42.
