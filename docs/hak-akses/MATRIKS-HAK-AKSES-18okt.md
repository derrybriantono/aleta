# Matriks hak akses per peran - 18 Oktober 2026

> Dokumen ini DIBANGKITKAN dari `manajemen_surat/src/lib/hak-akses-peta.ts` (data yang sama dengan halaman portal Pengaturan > Hak akses per peran). Jangan disunting tangan: ubah petanya lalu jalankan `npx tsx scripts/hak-akses-md.ts` dari folder `manajemen_surat/`. Uji `hak-akses-peta-18okt` merah bila dokumen ini menyimpang.

## Cara membaca

- **Lihat (L)**: melihat atau membaca saja. **Pakai (P)**: menjalankan fitur dalam tugasnya (membuat, mengisi, mencetak, menarik). **Ubah (U)**: mengubah data atau pengaturan satker, atau menulis hasil substantif. **-**: tidak diberi (menu tidak tampil dan rute menjawab 403).
- Super Admin (SA) memegang tingkat tertinggi di SEMUA baris dan semuanya ditampilkan. Admin (Adm) pengelola satker: semua yang matang, kecuali yang tertulis sebaliknya di kolom catatan.
- Satu orang dapat memiliki beberapa golongan (jabatan utama ditambah peran tambahan Kasir, PTSP, mediator, operator, atau meja SIPP): haknya gabungan; peran tambahan hanya menambah.

### Kolom peran

| Singkatan | Golongan | Isi |
| :-- | :-- | :-- |
| SA | Super Admin | Super Admin |
| Adm | Admin | Admin |
| Pim | Ketua / Wakil Ketua | Ketua dan Wakil Ketua |
| Hak | Hakim | Hakim |
| Pan | Panitera | Panitera (Wakil Panitera) |
| Pmd | Panitera Muda | Panitera Muda (gugatan, permohonan, hukum) |
| PP | Panitera Pengganti | Panitera Pengganti |
| JS | Jurusita / JSP | Jurusita dan Jurusita Pengganti |
| Ksr | Kasir | Analis Keuangan; peran tambahan kasir, petugas keuangan perkara, bendahara |
| PTS | PTSP / Operator | Operator; petugas PTSP, meja informasi, pendaftaran, operator SIPP/e-Doc; Meja 1 SIPP |
| Med | Mediator non-hakim | Mediator non-hakim (peran tambahan) |
| Sdg | Petugas Sidang (penjaga/operator antrian) | Penjaga sidang; operator antrian, panggilan, dan video sidang |
| Anl | Analis Perkara | Analis perkara, pengelola penanganan perkara, dokumentalis hukum; Meja 2/3 SIPP |
| Sek | Kesekretariatan | Sekretaris, Kepala Subbagian, pejabat struktural, staf umum, kepegawaian, dan keuangan APBN |
| TI | Pranata Komputer / TI | Pranata Komputer, staf PTIP |
| Plk | Pelaksana / Staf | Pelaksana, PPPK, dan staf tanpa tugas khusus |

### Peran akun di portal menjadi golongan

| Peran akun | Golongan dasar |
| :-- | :-- |
| Operator | PTSP / Operator |
| Super Admin | Super Admin |
| Admin | Admin |
| Ketua | Ketua / Wakil Ketua |
| Wakil Ketua | Ketua / Wakil Ketua |
| Hakim | Hakim |
| Sekretaris | Kesekretariatan |
| Panitera | Panitera |
| Panitera Muda | Panitera Muda |
| Panitera Pengganti | Panitera Pengganti |
| Kepala Subbagian | Kesekretariatan |
| Jurusita | Jurusita / JSP |
| Pranata Komputer | Pranata Komputer / TI |
| Analis Keuangan | Kasir |
| Analis Perkara | Analis Perkara |
| Pelaksana | Pelaksana / Staf |
| PPPK | Pelaksana / Staf |
| Pejabat Struktural | Kesekretariatan |
| Staf Pelaksana | Pelaksana / Staf |

Jabatan (misalnya Panitera Muda Gugatan, Jurusita Pengganti, Pranata Komputer) dan peran tambahan menggeser golongan: peran tambahan hanya MENAMBAH golongan, tidak pernah mengganti golongan utama dan tidak memberi hak di atas golongan itu.

| Peran tambahan | Menambah golongan |
| :-- | :-- |
| kasir, petugas_keuangan_perkara, bendahara_penerimaan, bendahara_pengeluaran | Kasir |
| petugas_ptsp, petugas_meja_informasi, petugas_pendaftaran_perkara, resepsionis, operator_sipp, operator_edoc, petugas_ecourt, petugas_validasi_ecourt, petugas_gugatan_mandiri, operator, petugas_meja_1_* (Meja 1 SIPP) | PTSP / Operator |
| petugas_meja_2_*, petugas_meja_3_* (Meja 2 dan 3 SIPP) | Analis Perkara |
| mediator, mediator_non_hakim | Mediator non-hakim |
| penjaga_sidang, operator_antrian_sidang, operator_panggilan_sidang, operator_video_sidang, operator | Petugas Sidang (penjaga/operator antrian) |

## Aplikasi dan menu portal

| Fitur | SA | Adm | Pim | Hak | Pan | Pmd | PP | JS | Ksr | PTS | Med | Sdg | Anl | Sek | TI | Plk |
| :-- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Dashboard Surat | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
| Pusat Tugas | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
| Kelola PLH dan PLT | U | U | U | U | U | U | - | - | - | - | - | - | - | U | - | - |
| Surat Masuk | U | U | P | P | P | P | P | P | P | P | P | P | P | U | P | P |
| Surat Keluar | U | U | P | P | P | P | P | P | P | P | P | P | P | U | P | P |
| Arsip Surat | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L |
| Statistik | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L |
| Disposisi Digital | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
| Pencarian Global | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L |
| Laporan | L | L | L | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Menu E-Kepegawaian (cuti, presensi, SKP pribadi) | U | U | P | P | P | P | P | P | P | P | P | P | P | U | P | P |
| ALETA e-Court | U | U | P | P | P | P | P | P | P | P | P | L | L | L | L | L |
| Manajemen Surat | U | U | P | P | P | P | P | P | P | P | P | P | P | U | P | P |
| E-Kepegawaian | U | U | P | P | P | P | P | P | P | P | P | P | P | U | P | P |
| ALETA Bot | U | U | L | L | L | L | L | L | L | L | L | - | L | - | L | - |
| Ruang Kerja Perkara | U | U | P | P | P | P | P | - | - | - | - | - | L | - | - | - |
| Alat Bantu Tulis BAS | U | U | L | P | P | P | U | - | - | - | - | - | P | - | - | - |
| SIPP (SSO) | U | U | L | L | L | L | L | L | L | L | L | L | L | L | L | L |
| APS Badilag / ABT (SSO) | U | U | L | L | L | L | L | L | - | L | L | - | L | - | - | - |
| Asisten Hakim | U | U | L | L | - | - | - | - | - | - | - | - | - | - | - | - |
| Audit Trail | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| ALETA e-Court (pengaturan) | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Peta Perkara (modul) | U | U | L | L | L | L | - | - | - | - | - | - | - | L | - | - |
| Blangko Saya (buat blangko sendiri) | U | U | U | U | U | U | U | - | - | - | - | - | - | - | - | - |
| ALETA Ai | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| SKP (kinerja pegawai) | U | U | L | L | L | L | L | L | L | L | L | L | L | L | L | L |
| Beban Konseptor (modul) | U | U | L | - | L | - | - | - | - | - | - | - | - | - | - | - |
| ALETA x SIPP | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| ALETA Judicia (Legal Form / JLF) | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| ALETA e-Audit | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| E-Status | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Antrian Sidang | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| E-Keuangan | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Manajemen Aset | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Perpustakaan | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Notifikasi (gateway) | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |

Catatan kewenangan:

- **Kelola PLH dan PLT**: Pejabat struktural dan kesekretariatan menetapkan penggantinya sendiri; Plt/Plh yang berlaku tidak dapat menetapkan lagi.
- **Audit Trail**: Hanya Super Admin (halaman dan rutenya menolak Admin).
- **Blangko Saya (buat blangko sendiri)**: Tahap awal (18 Okt 2026): ubin dan menu hanya tampil bagi Super Admin sampai saklar Fitur Satker 'Blangko Saya untuk semua peran' dinyalakan; kolom peran lain berlaku sesudahnya.
- **ALETA Ai**: Belum dibuka untuk peran lain: aplikasi masih dalam penyempurnaan. Super Admin dapat membukanya per peran lewat Akses Menu.
- **ALETA x SIPP**: Belum dibuka untuk peran lain: aplikasi masih dalam penyempurnaan. Super Admin dapat membukanya per peran lewat Akses Menu.
- **ALETA Judicia (Legal Form / JLF)**: Belum dibuka untuk peran lain: aplikasi masih dalam penyempurnaan. Super Admin dapat membukanya per peran lewat Akses Menu.
- **ALETA e-Audit**: Belum dibuka untuk peran lain: aplikasi masih dalam penyempurnaan. Super Admin dapat membukanya per peran lewat Akses Menu.
- **E-Status**: Belum dibuka untuk peran lain: aplikasi masih dalam penyempurnaan. Super Admin dapat membukanya per peran lewat Akses Menu.
- **Antrian Sidang**: Belum dibuka untuk peran lain: aplikasi masih dalam penyempurnaan. Super Admin dapat membukanya per peran lewat Akses Menu.
- **E-Keuangan**: Belum dibuka untuk peran lain: aplikasi masih dalam penyempurnaan. Super Admin dapat membukanya per peran lewat Akses Menu.
- **Manajemen Aset**: Belum dibuka untuk peran lain: aplikasi masih dalam penyempurnaan. Super Admin dapat membukanya per peran lewat Akses Menu.
- **Perpustakaan**: Belum dibuka untuk peran lain: aplikasi masih dalam penyempurnaan. Super Admin dapat membukanya per peran lewat Akses Menu.
- **Notifikasi (gateway)**: Belum dibuka untuk peran lain: aplikasi masih dalam penyempurnaan. Super Admin dapat membukanya per peran lewat Akses Menu.

## ALETA e-Court: tab dan tombol aksi

| Fitur | SA | Adm | Pim | Hak | Pan | Pmd | PP | JS | Ksr | PTS | Med | Sdg | Anl | Sek | TI | Plk |
| :-- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Tab Beranda e-Court | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L |
| Tab Jadwal Sidang | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L |
| Tab Jadwal Mediasi | L | L | L | L | L | L | L | - | - | L | L | - | L | - | - | - |
| Tab Status Perkara | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L |
| Tab Kendali Berkas | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L |
| Tab Riwayat ALETA | L | L | L | - | - | - | - | - | - | L | - | - | - | - | - | - |
| Tab Tanda tangan dan cap pejabat | L | L | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Tab Unduh ekstensi | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L |
| Tunda / Putus sidang (tulis ke SIPP) | U | U | U | U | U | U | U | - | - | - | - | - | - | - | - | - |
| Tandai selesai / sedang berjalan / skors | U | U | U | U | U | U | U | - | - | - | - | U | - | - | - | - |
| Antrian sidang (ambil/batal nomor, daftarkan, panggil pihak) | U | U | U | U | U | U | U | - | - | U | - | U | - | - | - | - |
| Pilih mediator | U | U | U | U | U | U | U | - | - | - | - | - | - | - | - | - |
| Keterangan perkara | U | U | U | U | U | U | U | U | - | - | - | U | - | - | - | - |
| Nyalakan / matikan Sidang keliling per tanggal | U | U | U | U | U | - | U | - | - | - | - | - | - | - | - | - |
| Pilih hakim yang menyidangkan per perkara | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Tunjuk konseptor sementara | U | U | U | U | U | U | - | - | - | - | - | - | - | - | - | - |
| Kehadiran pihak untuk BAS | U | U | U | U | U | U | U | - | - | - | - | U | - | - | - | - |
| Isi Court Calendar ke SIPP | U | U | - | - | U | U | U | - | - | - | - | - | - | - | - | - |
| Tarik dokumen belum diunggah (e-Court) | P | P | P | P | P | P | P | - | - | - | - | - | - | - | - | - |
| Kasir (menulis jurnal, setoran, saklar otomatis) | U | U | - | - | - | - | - | - | U | - | - | - | - | - | - | - |
| Kasir (membaca jurnal, usulan, harian, pengingat, rekap) | L | L | - | - | L | L | - | - | L | - | - | - | - | - | - | - |
| Cetak relaas massal | P | P | - | - | - | - | - | P | - | - | - | - | - | - | - | - |
| Verifikasi dokumen e-Court (hakim) | U | U | U | U | - | - | - | - | - | - | - | - | - | - | - | - |
| TTE salinan putusan (panitera) | U | U | - | - | U | U | - | - | - | - | - | - | - | - | - | - |
| Menyalakan / mematikan penarikan berkala e-Court (widget ekstensi) | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Catat kehadiran & status mediasi | U | U | U | U | U | U | U | - | - | - | U | - | - | - | - | - |
| Buat hasil mediasi (.rtf) | P | P | - | P | - | - | - | - | - | - | P | - | - | - | - | - |
| Tunda mediasi (tulis ke SIPP) | U | U | U | U | U | U | U | - | - | - | U | - | - | - | - | - |
| Isi hasil mediasi (tulis ke SIPP) | U | U | U | U | - | - | U | - | - | - | U | - | - | - | - | - |
| Melihat dan mengunduh berkas hasil mediasi (arsip perkara) | L | L | L | L | L | L | L | - | - | - | L | - | - | - | - | - |
| Mengunggah dan mengganti berkas hasil mediasi (arsip perkara) | U | U | U | U | U | U | U | - | - | - | U | - | - | - | - | - |
| Menghapus berkas hasil mediasi (arsip perkara) | U | U | U | U | U | U | U | - | - | - | U | - | - | - | - | - |
| Panduan pemeriksaan saksi | L | L | L | L | L | L | L | - | - | - | - | - | - | - | - | - |
| Identitas & riwayat para pihak | L | L | L | L | L | L | L | L | L | L | L | - | L | - | - | - |
| Analisa perkara & prompt putusan | L | L | L | L | L | L | L | - | - | - | - | - | - | - | - | - |
| Tarik berkas satu perkara dari e-Court | P | P | P | P | P | P | P | P | - | P | - | - | P | - | - | - |
| Mulai sinkron Kendali Berkas SIPP | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Simpan draf putusan & jejak berkas perkara | U | U | U | U | U | U | U | - | - | - | - | - | - | - | - | - |
| Unggah putusan ke SIPP/e-Court | U | U | U | U | - | - | - | - | - | - | - | - | - | - | - | - |
| Kelola tanda tangan pejabat & cap | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Membaca lembar BAS dan naskahnya | L | L | L | L | L | L | L | - | - | - | - | - | L | - | - | - |
| Menyusun dan menyimpan lembar BAS | U | U | - | U | U | U | U | - | - | - | - | - | U | - | - | - |
| Set pertanyaan saksi untuk tanya jawab ABT | L | L | L | L | L | L | L | - | - | - | - | - | L | - | - | - |
| Menyimpan isian perkara untuk naskah (Kelas B) | U | U | U | U | U | U | U | U | - | - | - | - | U | - | - | - |
| Mencatat kirim laporan perkara (LIPA) | U | U | - | - | U | U | - | - | - | - | - | - | - | - | - | - |
| Melihat riwayat masuk, sesi aktif, dan perangkat semua akun; mengeluarkan sesi | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Mengatur pengecualian batas perangkat per akun | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Mengatur batas perangkat per peran dan setelan riwayat masuk | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Melihat Pengaturan Keamanan (kebijakan sandi, batas jaringan, pengaman aksi, uji pulih cadangan) | L | L | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Mengubah Pengaturan Keamanan dan menjalankan uji pulih cadangan | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Melihat Pusat kesehatan sistem, catatan error, dan hasil uji beban | L | L | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Menandai catatan error sudah ditangani | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Menyalakan pemeriksaan berkala dan peringatan WhatsApp Pusat kesehatan; mengimpor hasil uji beban | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Menyalakan Mode pemeliharaan, mengatur pesan dan jadwalnya | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Mengatur ambang peringatan kapasitas penyimpanan dan pembersihan otomatis sisa pembuatan pembaruan; meminta pemeriksaan ruang | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Mengatur tampilan ALETA di halaman SIPP per peran dan per pengguna | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Betulkan pilihan kehadiran sidang di SIPP (dari BAS atau amar verstek) | U | U | - | - | - | - | U | - | - | - | - | - | - | - | - | - |
| Kartu tautan akun pegawai (ALETA, SIPP, ABT, e-Court): menautkan akun SIPP dan mengisi akun e-Court pegawai | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Lihat sebagai akun atau peran (pratinjau menu dan hak, baca-saja, tercatat) | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Menyalakan verifikasi dua langkah (OTP WhatsApp, authenticator), aturan per peran, dan jaringan kantor | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Membantu pengguna yang kehilangan HP: kode cadangan dan reset authenticator | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Melihat temuan penjaga integritas berkas (PHP mencurigakan, webshell, kata judi online) | L | L | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Mengatur penjaga integritas: folder yang dijaga, memindai sekarang, menandai temuan ditangani atau diketahui aman | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Peta perkara & beban konseptor | L | L | L | L | L | L | - | - | - | - | - | - | - | L | - | - |
| Dompet ALETA Ai milik sendiri (saldo, mutasi, perkiraan biaya, struk) | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L |
| Kelola dompet ALETA Ai (isi & koreksi saldo, kuota peran, laporan laba, ekspor, rekonsiliasi) | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Tunda otomatis 16.30 dan putus otomatis gugur / tidak dapat diterima | U | P | P | P | P | P | P | L | L | L | L | L | L | L | L | L |
| Tautan rahasia Jadwal Sidang (tanpa masuk akun) | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |

Catatan kewenangan:

- **Tunda / Putus sidang (tulis ke SIPP)**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Pilih mediator**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Keterangan perkara**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Tunjuk konseptor sementara**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Kehadiran pihak untuk BAS**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Isi Court Calendar ke SIPP**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Tarik dokumen belum diunggah (e-Court)**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Cetak relaas massal**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Verifikasi dokumen e-Court (hakim)**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Catat kehadiran & status mediasi**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Buat hasil mediasi (.rtf)**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Tunda mediasi (tulis ke SIPP)**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Isi hasil mediasi (tulis ke SIPP)**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Mengunggah dan mengganti berkas hasil mediasi (arsip perkara)**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Menghapus berkas hasil mediasi (arsip perkara)**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Analisa perkara & prompt putusan**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Simpan draf putusan & jejak berkas perkara**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Unggah putusan ke SIPP/e-Court**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Membaca lembar BAS dan naskahnya**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Menyusun dan menyimpan lembar BAS**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Menyimpan isian perkara untuk naskah (Kelas B)**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Betulkan pilihan kehadiran sidang di SIPP (dari BAS atau amar verstek)**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Dompet ALETA Ai milik sendiri (saldo, mutasi, perkiraan biaya, struk)**: Hanya atas perkara yang ia tangani (majelis, PP, atau juru sitanya); Ketua, Wakil, dan Admin semua perkara.
- **Tunda otomatis 16.30 dan putus otomatis gugur / tidak dapat diterima**: Saklar dan Jalankan sekarang HANYA Super Admin (keputusan 22 Okt 2026). Mengecualikan satu perkara (Jangan tunda/putus otomatis, Ikutkan lagi) mengikuti aksi Tunda / Putus sidang. Tidak tampil pada tautan rahasia Jadwal Sidang.
- **Tautan rahasia Jadwal Sidang (tanpa masuk akun)**: Mengelola tautan hanya Super Admin dan Admin. Pemakai tautan tidak mendapat unduhan berkas, Kasir, antrean, tunda/putus otomatis, pilih hakim, maupun penetapan; tulisannya terbatas daftar izin rute dan 60 tindakan per jam.

## Fitur kerja perkara

| Fitur | SA | Adm | Pim | Hak | Pan | Pmd | PP | JS | Ksr | PTS | Med | Sdg | Anl | Sek | TI | Plk |
| :-- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Acc berita acara sidang (BAS) | U | - | U | U | - | - | - | - | - | - | - | - | - | - | - | - |
| Unggah massal putusan dan putusan anonim ke e-Doc SIPP | U | U | U | U | - | - | - | - | - | - | - | - | - | - | - | - |
| Unggah massal BAS ke e-Doc SIPP | U | U | - | - | U | U | U | - | - | - | - | - | U | - | - | - |
| Putusan Advance (periksa dan susun draf putusan utuh) | P | P | P | P | - | - | - | - | - | - | - | - | - | - | - | - |
| Draf putusan H-7 (isi lengkap) | P | P | P | P | P | P | P | - | - | - | - | - | - | - | - | - |
| BAS sidang berikutnya disiapkan otomatis (H-1) | L | L | L | L | L | L | L | - | - | - | - | - | L | - | - | - |
| Susun keterangan saksi menurut keadaan perkara (panel ABT) | P | P | - | - | P | P | P | - | - | - | - | - | P | - | - | - |
| Blangko Saya: pemakai selama tahap awal | U | U | U | U | U | U | U | - | - | - | - | - | - | - | - | - |
| Penetapan PMH, PPP, PJS, dan PHS di panel SIPP | U | U | U | - | - | - | - | - | - | P | - | - | - | - | - | - |
| Ikrar talak: tunda, putus, isi form, dan e-Doc penetapan | U | U | U | U | U | U | U | - | - | - | - | - | - | - | - | - |
| SKP: melihat dan mengisi SKP sendiri | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
| SKP: melihat SKP bawahan dan seluruh pegawai | L | L | L | - | L | - | - | - | - | - | - | - | - | - | - | - |
| SKP: mengubah target dan pemetaan akun-pegawai-jabatan | U | U | U | - | U | - | - | - | - | - | - | - | - | - | - | - |
| SKP: menyetujui isian manual dan mengunci penetapan | U | U | U | - | U | - | - | - | - | - | - | - | - | - | - | - |
| Eviden SKP hakim, PP, juru sita, dan mediator (unduhan) | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L | L |
| Sesi e-Court saya (sambungkan akun e-Court sendiri) | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
| Sesi e-Court semua akun dan riwayat login WhatsApp | U | L | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Lihat sebagai peran atau akun lain | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Tautan akun ALETA ke akun SIPP | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |

Catatan kewenangan:

- **Acc berita acara sidang (BAS)**: Pemeriksaan oleh orang lain: panitera tidak meng-acc BAS-nya sendiri, dan Admin tidak meng-acc. Super Admin ikut (keputusan 18 Okt 2026) karena akunnya dipegang seorang hakim.
- **Unggah massal putusan dan putusan anonim ke e-Doc SIPP**: Keputusan 9 Okt 2026: unggah putusan hanya Super Admin, Admin, dan hakim. Hakim hanya putusan perkara majelisnya.
- **Putusan Advance (periksa dan susun draf putusan utuh)**: Konseptor (biasanya Panitera Pengganti) ikut untuk perkara yang ia konsep. Daftar akun yang memakainya diatur Super Admin di Pengaturan SIPP & ABT; saklar fitur satker harus menyala. Draf hanya diunduh ke komputer sendiri.
- **Draf putusan H-7 (isi lengkap)**: Isi lengkap ikut aksi 'Simpan draf putusan' (18 Okt 2026: juru sita tidak lagi dapat membaca isi draf).
- **BAS sidang berikutnya disiapkan otomatis (H-1)**: Hanya membaca SIPP/ABT; isi lengkap ikut aksi 'Membaca lembar BAS'. Menjalankan sekarang hanya Admin/Super Admin.
- **Susun keterangan saksi menurut keadaan perkara (panel ABT)**: Menu panel ABT 'Susun keterangan saksi' hanya golongan kepaniteraan; hakim memakai Panduan pertanyaan saksi (baca). Katalog pertanyaannya dijaga aksi 'Set pertanyaan saksi'.
- **Blangko Saya: pemakai selama tahap awal**: Tahap awal (keputusan 18 Okt 2026): ubin, menu, dan rute tertutup bagi selain Super Admin. Hak di kolom ini berlaku setelah Super Admin menyalakan saklar (status bawaan: Mati). Admin juga baru bisa setelah saklar menyala.
- **Penetapan PMH, PPP, PJS, dan PHS di panel SIPP**: Keputusan 111 (18 Okt 2026): yang boleh MENJALANKAN adalah Ketua, Wakil Ketua, Admin, Super Admin, dan pengguna dengan sub-peran Operator, Petugas Meja (Meja 1, 2, 3, informasi), atau PTSP. Hakim dan Panitera tidak mendapat tab sendiri. Sub-peran disimpan di akun (peran utama tidak berubah); Petugas Meja 2 dan 3 dikenali dari sub-perannya, bukan dari golongannya, sehingga analis perkara tanpa sub-peran itu tidak. Pencatatan di SIPP tetap atas akun pejabat pilihan (keputusan 13 Okt), bukan akun penekan tombol. Tombol otomatis tetap ikut pengaturan Admin, tetapi hanya untuk yang memenuhi syarat itu.
- **Ikrar talak: tunda, putus, isi form, dan e-Doc penetapan**: Mengikuti aksi 'Tunda / Putus sidang'. Penyimpanan form saat halaman dibuka mengikuti saklar Penunjukan otomatis (bawaan mati).
- **SKP: melihat SKP bawahan dan seluruh pegawai**: Atasan langsung (dari data kepegawaian) dapat melihat bawahannya walau golongannya tidak tercantum di kolom ini.
- **SKP: mengubah target dan pemetaan akun-pegawai-jabatan**: Ketua mengubah; Wakil Ketua hanya melihat. Pemilik tidak menyetujui isiannya sendiri.
- **SKP: menyetujui isian manual dan mengunci penetapan**: Ketua menyetujui; Wakil Ketua hanya bila ia atasan langsungnya.
- **Eviden SKP hakim, PP, juru sita, dan mediator (unduhan)**: BELUM DIBATASI per orang: unduhan lama ini terbuka bagi semua pegawai berpanel. SKP jabatan di menu SKP sudah memakai hak sendiri, atasan, dan pimpinan. Menunggu keputusan pengguna.
- **Sesi e-Court semua akun dan riwayat login WhatsApp**: Keputusan 18 Okt 2026: riwayat login WhatsApp hanya Super Admin dan Admin.
- **Lihat sebagai peran atau akun lain**: Keputusan pengguna 23 Okt 2026: Super Admin dan Admin (Blangko ABT by Derry Briantono dan Perkara saya). Hanya meniru tampilan; tulisan tetap atas akun yang masuk, tanpa hak tambahan.
- **Tautan akun ALETA ke akun SIPP**: Keputusan 14 Okt 2026: alat tidak pernah mengubah peran utama; akun baru memulai dari peran terendah.

## Ekstensi di SIPP dan ABT

| Fitur | SA | Adm | Pim | Hak | Pan | Pmd | PP | JS | Ksr | PTS | Med | Sdg | Anl | Sek | TI | Plk |
| :-- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Tombol Jadwalkan BAS di halaman SIPP | P | P | - | - | P | P | P | - | - | - | - | - | P | - | - | - |
| Tombol Jadwalkan Tunda di halaman SIPP | P | P | P | P | P | P | P | - | - | - | - | - | - | - | - | - |
| Tombol Putusan Otomatis dan Jadwalkan Putusan di halaman SIPP | P | P | P | P | - | - | - | - | - | - | - | - | - | - | - | - |
| Tombol Penetapan Otomatis di halaman SIPP | P | P | P | - | - | - | - | - | - | P | - | - | - | - | - | - |
| Panel SIPP: tab Penetapan | P | P | P | - | - | - | - | - | - | P | - | - | - | - | - | - |
| Panel SIPP: tab PTSP | P | P | P | - | P | P | - | - | - | P | - | - | - | - | - | - |
| Panel SIPP: tab Putusan | P | P | P | P | - | - | - | - | - | - | - | - | - | - | - | - |
| Panel SIPP: tab Juru Sita | P | P | - | - | - | - | - | P | - | - | - | - | - | - | - | - |
| Panel SIPP: tab Berkas e-Court | P | P | P | P | P | P | P | P | - | P | P | - | P | - | - | - |
| Panel SIPP: tab Perkara | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P |
| Panel SIPP: tab Kasir | P | P | - | - | P | P | - | - | P | - | - | - | - | - | - | - |
| Daftar SIPP: penetapan massal | P | P | P | - | - | - | - | - | - | P | - | - | - | - | - | - |
| Daftar SIPP: BAS massal | P | P | - | - | P | P | P | - | - | - | - | - | P | - | - | - |
| Daftar SIPP: relaas dan PBT massal | P | P | - | - | - | - | - | P | - | - | - | - | - | - | - | - |
| Daftar SIPP: putusan massal | P | P | P | P | - | - | - | - | - | - | - | - | - | - | - | - |
| Panel ABT: seluruh bagian panel | P | P | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Panel ABT: Isi dari SIPP dan input ke ABT | P | P | P | P | - | - | - | - | - | P | - | - | - | - | - | - |
| Panel ABT: unggah putusan | P | P | P | P | - | - | - | - | - | - | - | - | - | - | - | - |
| Panel ABT: susun keterangan saksi | P | P | - | - | P | P | P | - | - | - | - | - | P | - | - | - |
| Panel ABT: Isi dari SIPP untuk blangko BAS | P | P | - | - | P | P | P | - | - | - | - | - | P | - | - | - |
| Panel ABT: relaas dan PBT | P | P | - | - | - | - | - | P | - | - | - | - | - | - | - | - |
| Beranda ABT: putusan massal | P | P | P | P | - | - | - | - | - | - | - | - | - | - | - | - |
| Beranda ABT: BAS massal | P | P | - | - | P | P | P | - | - | - | - | - | P | - | - | - |
| Beranda ABT: relaas dan PBT massal | P | P | - | - | - | - | - | P | - | - | - | - | - | - | - | - |
| Penanda: ada sita | L | L | L | L | L | L | L | L | - | - | - | - | - | - | - | - |
| Penanda: ada permohonan eksekusi | L | L | L | L | L | L | L | L | - | - | - | - | - | - | - | - |
| Penanda: perlu izin atasan (pihak PNS, TNI/Polri) | L | L | L | L | L | L | L | - | - | - | - | - | - | - | - | - |
| Penanda: penetapan awal belum lengkap (PMH, PPP, PJS, PHS) | L | L | L | - | L | L | L | - | - | - | - | - | - | - | - | - |
| Penanda: sidang lewat tanpa penundaan tercatat | L | L | L | L | L | L | L | - | - | - | - | - | - | - | - | - |
| Penanda: berpotensi putusan verstek | L | L | L | L | - | - | L | - | - | - | - | - | - | - | - | - |
| Penanda: umur perkara mendekati batas | L | L | L | L | L | L | L | - | - | - | - | - | - | - | - | - |
| Penanda: belum ada sidang berikutnya | L | L | L | L | L | L | L | - | - | - | - | - | - | - | - | - |
| Penanda: sisa waktu ikrar talak | L | L | L | L | L | L | L | - | - | - | - | - | - | - | - | - |
| Penanda: akta cerai dan BHT verstek | L | L | L | - | L | L | L | - | - | L | - | - | - | - | - | - |
| Penanda: perkara lewat 5 bulan | L | L | L | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Penanda: dokumen e-Court belum diverifikasi | L | L | L | L | - | - | L | - | - | - | - | - | - | - | - | - |
| Penanda: putusan belum diunggah / belum TTE panitera di e-Court | L | L | L | L | L | L | L | - | - | - | - | - | - | - | - | - |
| Popup: tandai halaman SIPP | P | P | P | P | P | P | P | P | - | P | P | P | P | P | P | P |
| Popup: sisipkan berkas ke Jadwal Sidang | P | P | P | P | P | P | P | - | - | - | P | - | - | - | - | - |
| Popup: cetak tiga berkas dari ABT | P | P | P | P | - | - | P | - | - | - | - | - | - | - | - | - |
| Popup: sunting langsung tabel ABT | P | P | P | P | - | - | P | - | - | - | - | - | - | - | - | - |
| Widget: checklist pekerjaan penting | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P | P |

Catatan kewenangan:

- **Tombol Jadwalkan BAS di halaman SIPP**: Hak yang sama dengan unggah massal BAS (golongan BAS massal); dinilai lagi saat dijalankan server. Panitera Pengganti hanya sidang perkaranya sendiri; Admin dan Super Admin semua.
- **Tombol Jadwalkan Tunda di halaman SIPP**: Mengikuti aksi 'Tunda / Putus sidang' (dinilai lagi saat dijalankan server). Kasir, PTSP, dan juru sita tidak mendapat tombolnya.
- **Tombol Putusan Otomatis dan Jadwalkan Putusan di halaman SIPP**: Keputusan pengguna 21 Okt 2026: hanya Ketua, Wakil Ketua, Hakim, Admin, dan Super Admin. Unggahnya dijaga hak unggah putusan (keputusan 9 Okt).
- **Tombol Penetapan Otomatis di halaman SIPP**: Keputusan pengguna 21 Okt 2026: hanya PTSP (termasuk Operator dan Petugas Meja), Ketua, Wakil Ketua, Admin, dan Super Admin. Tombolnya juga menuntut kemampuan Kerjakan (menulis ke SIPP) yang bawaannya hanya Operator; peran lain mendapatkannya dari Super Admin di Akses ekstensi.
- **Panel SIPP: tab Penetapan**: Keputusan 111: Ketua, Wakil, Admin, PTSP, Operator, dan Petugas Meja (termasuk Meja 2 dan 3 lewat sub-peran) mendapat tab ini; hakim dan Panitera tidak.
- **Panel SIPP: tab Kasir**: Panitera dan panmud: tab ditambahkan ekstensi sesuai aturan Kasir (hanya membaca bagi mereka).
- **Daftar SIPP: penetapan massal**: Keputusan 111: Petugas Meja 2 dan 3 serta Operator (sub-peran) juga mendapat menu ini.
- **Panel ABT: Isi dari SIPP dan input ke ABT**: Keputusan 112: PTSP di ABT hanya mendapat menu ini (untuk blangko PTSP).

## Blangko

| Fitur | SA | Adm | Pim | Hak | Pan | Pmd | PP | JS | Ksr | PTS | Med | Sdg | Anl | Sek | TI | Plk |
| :-- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Tes putusan di Blangko ABT by Derry Briantono | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Blangko putusan dan penetapan hakim (Blangko Derry, folder per jenis perkara) | P | P | P | P | - | - | - | - | - | - | - | - | - | - | - | - |
| Blangko BAS (pasangan '<Jenis> - BAS') | P | P | - | - | P | P | P | - | - | - | - | - | P | - | - | - |
| Blangko relaas (folder '98 Relaas') | P | P | - | - | - | - | - | P | - | - | - | - | - | - | - | - |
| Blangko PTSP (folder '99 PTSP') | P | P | - | - | - | - | - | - | - | P | - | - | - | - | - | - |
| Blangko penetapan awal di ABT (PMH, penunjukan PP, penunjukan JS, PHS) | P | P | P | - | P | P | P | - | - | - | - | - | - | - | - | - |
| Blangko ikrar talak (persiapan, BAS, dan penetapan) | P | P | - | P | - | P | P | - | - | - | - | - | - | - | - | - |
| Blangko relaas ikrar talak | P | P | - | - | - | - | - | P | - | - | - | - | - | - | - | - |
| Blangko akta cerai (Cerai Gugat dan Cerai Talak) | P | P | - | - | - | P | - | - | - | - | - | - | P | - | - | - |
| Blangko mediasi | P | P | P | P | P | P | P | - | - | - | - | - | - | - | - | - |
| Blangko surat kuasa insidentil | P | P | - | - | - | P | P | - | - | - | - | - | - | - | - | - |
| Blangko e-Court | P | P | - | P | - | P | P | P | - | - | - | - | - | - | - | - |
| Blangko Saya (blangko pribadi, putusan mandiri, ajukan paket ABT) | U | U | U | U | U | U | U | - | - | - | - | - | - | - | - | - |
| Pengelolaan blangko mandiri ALETA (kamus, korpus, templat) | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Pengaturan SIPP & ABT: hak menu folder, variabel, blangko tanya jawab, identitas satker | U | P | - | - | - | - | - | - | - | - | - | - | - | - | - | - |

Catatan kewenangan:

- **Tes putusan di Blangko ABT by Derry Briantono**: Hanya Super Admin. Selama mode tes tidak ada yang ditulis ke ABT, SIPP, maupun e-Court (keputusan 22 Okt 2026).
- **Blangko putusan dan penetapan hakim (Blangko Derry, folder per jenis perkara)**: Panitera Pengganti ikut membukanya hanya bila saklar 'Panitera Pengganti boleh blangko putusan' di Pengaturan SIPP & ABT menyala (bawaan mati).
- **Blangko BAS (pasangan '<Jenis> - BAS')**: Hakim ikut membukanya hanya bila saklar 'Hakim boleh blangko BAS' di Pengaturan SIPP & ABT menyala (bawaan mati). BAS di-acc hakim sebelum dipakai.
- **Blangko relaas (folder '98 Relaas')**: Keputusan 16 Okt 2026: Panitera, PP, Ketua/Wakil, panmud, dan hakim tidak. Relaas tidak pernah terbuka lewat saklar.
- **Blangko PTSP (folder '99 PTSP')**: Mengikuti hak menu ABT (folder per jenis dan tahapan); Super Admin melewati cek proses.
- **Blangko penetapan awal di ABT (PMH, penunjukan PP, penunjukan JS, PHS)**: Ketua/Wakil selalu boleh untuk PMH dan PHS; Panitera selalu boleh untuk penunjukan PP dan JS. Penetapan yang ditulis ke SIPP mengikuti Kewenangan khusus (atas akun pejabat).
- **Blangko akta cerai (Cerai Gugat dan Cerai Talak)**: Panitera selalu boleh.
- **Blangko mediasi**: Mediator non-hakim tidak punya akun ABT: hasil mediasi dibuat dari ALETA e-Court.
- **Blangko Saya (blangko pribadi, putusan mandiri, ajukan paket ABT)**: Tahap awal: hanya Super Admin sampai saklar 'Blangko Saya untuk semua peran' dinyalakan. Pemilik saja yang mengubah; Super Admin melihat, memutus paket ABT, dan menghapus. Hanya Blangko Derry yang dipakai di ABT.
- **Pengaturan SIPP & ABT: hak menu folder, variabel, blangko tanya jawab, identitas satker**: Admin membuka, mengubah isian bawaan dan templat; hak menu folder, saklar kebijakan, dan kueri variabel hanya Super Admin.

### Hak menu ABT per folder (kelompok pengguna SIPP)

Dari salinan lokal ABT (hanya dibaca, paket yang siap; yang berjalan di server dapat berbeda sampai paketnya dipasang). Hak diatur per folder: membuka folder berarti membuka seluruh isinya. Folder terbuka bila tahap perkara di SIPP berada dalam rentang tahap DAN jenis atau alur perkara cocok; Super Admin melewati cek tahap.

| Folder | Tahap SIPP | Kelompok yang membuka | Acc/pemeriksa |
| :-- | :-: | :-- | :-- |
| Putusan per jenis perkara (1 Perceraian CG, 1a CT, 2 Itsbat, 3 Dispensasi, ... 97 Sita) | 80-297 | Super Admin, Ketua/Wakil Ketua, Hakim | - |
| BAS per jenis perkara ('<Jenis> - BAS') dan BAS alur 01-13 | 80-297 (BAS ikrar 210-297) | Super Admin, Panitera/Wakil Panitera, Panitera Pengganti, Panmud Hukum, Panmud Gugatan, Panmud Permohonan, Panmud Jinayat | Ketua/Wakil Ketua, Hakim |
| 98 Relaas (panggilan sidang dan pemberitahuan) | 20-1000 | Super Admin, Jurusita | - |
| 99 PTSP (form bantu PTSP) | 20-1000 | Super Admin, Panitera/Wakil Panitera, Panitera Pengganti, Panmud Hukum, Panmud Gugatan, Panmud Permohonan, Panmud Jinayat, Meja I Perkara, Meja I Gugatan, Meja I Permohonan | - |
| Blangko Derry (induk, Daftar sampai Produk) | 20-1000 | Super Admin, Panitera/Wakil Panitera, Panmud Hukum, Panitera Pengganti, Jurusita, Koordinator Delegasi, Panmud Gugatan, Meja I Gugatan, Panmud Permohonan, Meja I Permohonan, Panmud Jinayat, Meja I Perkara | - |
| Penetapan awal: PMH, Penunjukan PP, Penunjukan JS, Penetapan Hari Sidang | 20-220 (PHS 80-220) | Super Admin, Panitera/Wakil Panitera, Panitera Pengganti, Panmud Hukum, Panmud Gugatan, Panmud Permohonan, Panmud Jinayat, Panmud Perkara, Panmud PHI, Panmud Pidana | Ketua/Wakil Ketua |
| Relaas Panggilan (blangko lama) | 80-220 | Super Admin, Jurusita, Koordinator Delegasi | - |
| Kuasa Insidentil | 10-200 | Super Admin, Panitera Pengganti, Panmud Hukum, Panmud Gugatan, Panmud Permohonan, Panmud Jinayat | - |
| Mediasi | 120-230 | Super Admin, Panitera/Wakil Panitera, Panitera Pengganti, Panmud Hukum, Panmud Gugatan, Panmud Permohonan, Panmud Jinayat | Hakim |
| Ikrar talak: persiapan, BAS, dan penetapan | 290-600 | Super Admin, Hakim, Panitera Pengganti, Panmud Hukum, Panmud Gugatan, Panmud Permohonan, Panmud Jinayat | - |
| Ikrar talak: relaas | 290-600 | Super Admin, Jurusita, Koordinator Delegasi | - |
| Akta cerai (Cerai Gugat, Cerai Talak) | 296 | Super Admin, Panmud Hukum, Staf Panitera Hukum, Panmud Gugatan, Meja III Gugatan | Panitera/Wakil Panitera |
| Blangko e-Court | 0-1000 | Super Admin, Hakim, Panitera Pengganti, Panmud Hukum, Jurusita, Koordinator Delegasi, Panmud Gugatan, Panmud Permohonan, Panmud Jinayat | - |
| Gugatan dan Permohonan | 0-1000 | Super Admin, Panitera/Wakil Panitera, Panitera Pengganti, Panmud Hukum, Panmud Gugatan, Panmud Permohonan, Panmud Jinayat, Meja I Perkara, Meja I Gugatan, Meja I Permohonan | - |

- **Putusan per jenis perkara (1 Perceraian CG, 1a CT, 2 Itsbat, 3 Dispensasi, ... 97 Sita)**: Hakim dan Ketua/Wakil; Panitera Pengganti hanya bila saklar 'PP boleh blangko putusan' menyala.
- **BAS per jenis perkara ('<Jenis> - BAS') dan BAS alur 01-13**: Disusun kepaniteraan; Ketua/Wakil dan hakim memeriksa dan meng-acc.
- **98 Relaas (panggilan sidang dan pemberitahuan)**: Khusus juru sita (keputusan 16 Okt 2026).
- **Penetapan awal: PMH, Penunjukan PP, Penunjukan JS, Penetapan Hari Sidang**: PMH dan PHS: Ketua/Wakil selalu boleh; PP dan JS: Panitera selalu boleh.

## Pengaturan dan pengelolaan

| Fitur | SA | Adm | Pim | Hak | Pan | Pmd | PP | JS | Ksr | PTS | Med | Sdg | Anl | Sek | TI | Plk |
| :-- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Pusat Kendali | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Manajemen Akun (pengguna, jabatan, peran tambahan, tautan SIPP) | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Akses Menu per peran | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Hak akses per peran (halaman ini) | U | L | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Identitas Instansi | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Pengaturan Panel | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Akses Publik dan layar antrian | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Status WhatsApp | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Masukan Pengguna (kotak masuk pengelola) | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Pembaruan Sistem | U | L | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Backup Sistem | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Sumber Daya Server | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Kapasitas penyimpanan | U | L | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Sinkron dan cadangan | U | L | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Pemantau Cermin Perkara | U | L | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Sinkron kembaran (mode laptop saat server mati) | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Fitur Satker (stabil, uji coba, mati per fitur) | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Integrasi e-Court (akun, akses ekstensi, penarikan) | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Pengaturan SIPP & ABT (menu pengelola) | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| ALETA Bot (WhatsApp, antrian pesan, tindakan) | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Notifikasi WA | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Pengaturan E-Kepegawaian | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Pengaturan ALETA x SIPP | U | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Pengaturan ALETA Judicia | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Pengaturan AI ALETA | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Pengaturan Asisten Hakim | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Audit Trail (jejak seluruh perubahan) | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Database (penampil) | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Pengaturan E-Status | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Keuangan dan Aset (kerangka) | U | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |

Catatan kewenangan:

- **Hak akses per peran (halaman ini)**: Super Admin melihat juga kunci, rute, dan daftar perubahan; Admin hanya membaca tabelnya.
- **Sinkron kembaran (mode laptop saat server mati)**: Persetujuan pengiriman ke server hanya Super Admin.
- **Integrasi e-Court (akun, akses ekstensi, penarikan)**: Mengubah kemampuan ekstensi per peran hanya Super Admin; Admin membaca matriksnya. Pegawai lain hanya melihat kartu Sesi e-Court saya.
- **Pengaturan SIPP & ABT (menu pengelola)**: Pembagian rincian Super Admin dan Admin ada di butir Blangko: Pengaturan SIPP & ABT.
- **Pengaturan ALETA x SIPP**: Aplikasi ALETA x SIPP belum dibuka untuk peran lain.

## Kewenangan khusus

- **Super Admin**: Memegang dan melihat semua fitur, halaman, menu ekstensi, dan blangko. Satu-satunya yang membuka aplikasi belum fix, mengubah Akses Menu, Fitur Satker, dan hak menu ABT.
- **Admin**: Pengelola satker: semua aplikasi matang dan semua aksi e-Court; tidak membuka aplikasi belum fix, tidak meng-acc BAS, tidak memakai Lihat sebagai, tidak mengubah Fitur Satker maupun kemampuan ekstensi per peran.
- **Unggah putusan ke SIPP dan e-Court**: Hanya Super Admin, Admin, dan hakim (termasuk Ketua/Wakil). Hakim hanya putusan perkara majelisnya; Ketua, Wakil, dan Admin semua perkara (16 Okt 2026). PP, panitera, juru sita, dan lainnya tidak, walau kemampuan papan penunjukan menyala.
- **Penetapan PMH, PPP, PJS, PHS**: Atas akun pejabat yang berwenang (Ketua, Panitera, ketua majelis), tercatat sebagai penginput petugas yang menekan (keputusan 13 Okt 2026). Penetapan ikrar talak diunggah sebagai e-Doc atas akun ketua majelis ikrar (18 Okt 2026).
- **Acc BAS**: Hakim (termasuk Ketua/Wakil) dan Super Admin; BAS disusun Panitera Pengganti. Panitera tidak meng-acc BAS-nya sendiri.
- **Kasir**: Jurnal keuangan semua perkara untuk kasir, petugas keuangan perkara, bendahara, panitera, dan panmud; panitera/panmud hanya membaca. Panitera Pengganti, hakim, dan juru sita tidak.
- **Relaas dan PBT**: Khusus juru sita dan juru sita pengganti (dan Super Admin/Admin). Panitera, PP, Ketua/Wakil, panmud, dan hakim tidak.
- **Data pribadi para pihak (NIK, KTP, kontak, riwayat)**: Hanya yang melayani perkara; NIK disamarkan, KTP 'pasti' menimpa, kesekretariatan, TI, pelaksana, dan petugas sidang tidak melihatnya (UU PDP).
- **Mediasi**: Tertutup untuk umum (PERMA 1/2016): mediator, majelis/kepaniteraan, dan meja informasi PTSP. Hasil mediasi hanya mediator perkara itu (nama akun cocok di SIPP) atau Super Admin.
- **Blangko Saya**: Tahap awal hanya Super Admin; setelah saklar menyala: hakim, panitera/panmud, dan konseptor. Pemilik saja mengubah. Tidak ada tanda ALETA yang masuk ke SIPP maupun ABT.
- **Hak menu ABT (folder Blangko Derry)**: Per folder: perkara harus berada di tahap dan jenis yang cocok dengan folder itu; Super Admin melewati pemeriksaan tahap. Salinan database lokal hanya dibaca; perubahannya lewat paket ABT atas persetujuan.
- **Peran utama akun**: Ditentukan pengguna sendiri; alat Tautan SIPP hanya memetakan sub-peran. Meja 1 masuk golongan PTSP; Meja 2/3 masuk staf kepaniteraan (analis perkara).
- **Pengecualian untuk satu orang**: Super Admin dapat memberi atau mencabut kemampuan ekstensi (panel, berkas, penunjukan, blangko ABT, Kerjakan) bagi SATU akun di Integrasi e-Court, lengkap dengan alasan dan masa berlaku, tanpa mengubah seluruh peran. Tanpa pengecualian, akun mengikuti perannya. Halaman ini memperlihatkan hak gabungan satu akun lewat Per akun.
- **Mode kembaran (laptop saat server mati)**: SIPP dan ABT di laptop hanya dapat dibaca; tulisan diantrekan, dikirim setelah pemeriksaan bentrok dan persetujuan Super Admin.

## Perubahan dibanding sebelumnya (18 Okt 2026)

Tanda: *sesuai keputusan* = sudah diputuskan pengguna; *pilihan baru* = dipilih agen di area yang belum pernah diputuskan, menunggu konfirmasi.

1. **Data pribadi pihak lewat panel (kontak e-Court, tanggal KTP, pekerjaan, kuasa, isi gugatan, pindai KTP saksi)** (pilihan baru)
   - Sebelum: Semua pegawai berpanel (hampir semua peran) dapat memanggil rutenya.
   - Sesudah: Hanya pemegang perkara (Ketua/Wakil, hakim, panitera, panmud, PP, juru sita, analis perkara), kasir, PTSP, dan mediator; Admin dan Super Admin.
   - Alasan: Sama dengan aksi 'Identitas dan riwayat para pihak' yang sudah ada: data pribadi (UU PDP) hanya untuk yang melayani perkara.
2. **Lembar BAS, naskah, blangko, tanya jawab, dan pemeriksaannya** (pilihan baru)
   - Sebelum: Dapat dibaca dan disimpan semua pegawai berpanel.
   - Sesudah: Dibaca: Ketua/Wakil, hakim, panitera, panmud, PP, analis perkara. Disimpan: hakim, panitera, panmud, PP, analis perkara.
   - Alasan: BAS memuat keterangan saksi dan para pihak; alur acc hakim hanya bermakna bila penyusunnya terbatas.
3. **Aplikasi Alat Bantu Tulis BAS: panmud dan analis perkara** (pilihan baru)
   - Sebelum: Panmud dan analis perkara: Lihat.
   - Sesudah: Panmud dan analis perkara: Pakai (menulis).
   - Alasan: Keduanya sudah memegang menu Isi BAS dan BAS massal di ekstensi (keputusan 12-16 Okt); matriks diselaraskan, bukan diperluas.
4. **Acc BAS oleh Super Admin** (sesuai keputusan)
   - Sebelum: Hanya Ketua, Wakil Ketua, dan hakim.
   - Sesudah: Ditambah Super Admin (Admin tetap tidak).
   - Alasan: Perintah pengguna: Super Admin boleh semua; akun Super Admin satker dipegang seorang hakim.
5. **Jadwal Mediasi (data jadwal)** (pilihan baru)
   - Sebelum: Tab disembunyikan dari peran tanpa urusan mediasi, tetapi rute datanya masih dapat dipanggil semua pegawai berpanel.
   - Sesudah: Rutenya ikut menolak (403) bagi golongan yang tabnya disembunyikan: hanya Ketua/Wakil, hakim, panitera, panmud, PP, mediator, PTSP, dan analis perkara.
   - Alasan: Mediasi tertutup untuk umum (PERMA 1/2016 ps. 5); menyembunyikan tab bukan penjagaan.
6. **Set pertanyaan saksi di Blangko Derry** (pilihan baru)
   - Sebelum: Semua pegawai berpanel.
   - Sesudah: Ketua/Wakil, hakim, panitera, panmud, PP, analis perkara.
   - Alasan: Hanya katalog pertanyaan, tetapi hanya dipakai penyusun tanya jawab; menyamai Panduan pertanyaan saksi.
7. **Isi lengkap draf putusan H-7** (pilihan baru)
   - Sebelum: Pemegang perkara termasuk juru sita.
   - Sesudah: Ketua/Wakil, hakim, panitera, panmud, PP (aksi 'Simpan draf putusan').
   - Alasan: Juru sita tidak menyusun putusan; lencana kesiapan tetap terlihat.
8. **Ubin Audit Trail** (sesuai keputusan)
   - Sebelum: Tampil bagi Admin, tetapi halaman dan rutenya menolak Admin.
   - Sesudah: Hanya Super Admin.
   - Alasan: Menu yang pasti ditolak tidak boleh tampil. Admin tidak kehilangan akses nyata. Disetujui pengguna (keputusan 114).
9. **Siapa menjalankan Penetapan PMH, PPP, PJS, dan PHS di panel** (sesuai keputusan)
   - Sebelum: Kemampuan penunjukan bawaan Ketua, Wakil, hakim, dan Panitera; PTSP hanya bila diberi Admin.
   - Sesudah: Ketua, Wakil, Admin, Super Admin, dan pengguna bersub-peran Operator, Petugas Meja, atau PTSP (otomatis, tanpa diatur per peran). Hakim dan Panitera tidak mendapat tab sendiri; tab Riwayat ALETA ikut hanya untuk yang menjalankan.
   - Alasan: Keputusan 111: yang berubah hanya siapa yang menjalankan; pencatatan tetap atas akun pejabat pilihan (13 Okt).
10. **PTSP di panel ABT** (sesuai keputusan)
   - Sebelum: Susunan lama: seluruh panel digambar walau server menolak BAS, saksi, dan relaas.
   - Sesudah: Hanya menu 'Isi dari SIPP dan input ke ABT' (untuk blangko PTSP); tanpa menu massal.
   - Alasan: Keputusan 112: disetujui sesuai usulan.
11. **Ubin dan menu Blangko Saya** (sesuai keputusan)
   - Sebelum: Tampil bagi hakim, panitera, panmud, PP, Ketua/Wakil, dan Admin walau server menolak selama tahap awal.
   - Sesudah: Hanya Super Admin selama saklar Fitur Satker 'Blangko Saya untuk semua peran' mati; otomatis tampil bagi yang berhak saat saklar menyala.
   - Alasan: Keputusan 18 Okt 2026 (butir 10): tahap awal hanya Super Admin. Sekarang tampilan sama dengan haknya.
12. **Halaman Hak akses per peran** (sesuai keputusan)
   - Sebelum: Tidak ada; hak tersebar di kode.
   - Sesudah: Pengaturan > Hak akses per peran: Admin membaca, Super Admin lengkap dengan kunci dan daftar perubahan.
   - Alasan: Permintaan pengguna 18 Okt 2026.

## Keputusan pengguna 18 Okt 2026 malam (sudah berlaku)

- **111 Penetapan di panel**: Dijalankan Ketua, Wakil, Super Admin, Admin, dan sub-peran Operator, Petugas Meja, dan PTSP. Hakim dan Panitera tidak mendapat tab sendiri. Pencatatan tetap atas akun pejabat pilihan.
- **112 PTSP di panel ABT**: Hanya 'Isi dari SIPP dan input ke ABT'.
- **113 Eviden SKP unduhan lama**: Dibatasi sesuai usulan, menunggu pemetaan akun SIPP ke pegawai (Senin).
- **114 Audit Trail**: Hanya Super Admin.
- **115 Acc BAS oleh Super Admin dan penulisan BAS oleh analis perkara**: Tetap seperti sekarang.
- **116 Ringkasan perkara terbuka dan Blangko Saya untuk Admin**: Tetap seperti sekarang.

## Hal yang menunggu keputusan pengguna

1. **Eviden SKP hakim, PP, juru sita, dan mediator (unduhan lama)**
   - Keadaan: Unduhan lama ini terbuka bagi semua pegawai berpanel sehingga eviden SKP orang lain dapat dipanggil bila tahu nomor SIPP-nya. SKP jabatan di menu SKP sudah dibatasi (sendiri, atasan, Ketua/Wakil/Panitera, Admin).
   - Usul: Disetujui (keputusan 113): samakan dengan SKP jabatan - pemilik, atasan langsung, Ketua/Wakil, Panitera, dan Admin. Dikerjakan SETELAH pemetaan akun SIPP ke pegawai selesai (Senin); sementara belum dibatasi.
