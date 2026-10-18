# Daftar cek isian popup blangko Derry (Isi dari SIPP & input ke ABT)

Dibangun 2026-10-18 oleh `scripts/isi-sipp-abt/bangun-daftar-cek.cjs` (data diukur, bukan ditebak). Berkas mesin: `DAFTAR-CEK.json` (dipakai uji penjaga).

## Ringkasan

- Blangko Derry aktif di pohon server: **1121** (32 tanpa isian popup).
- Isian popup (data_teks / data_tanggal / tanya_jawab, kata ABT "isian tangan"): **296** unik.
- Sudah otomatis (ya): **151** - sebagian: **37** - belum (tidak): **108**, di antaranya **45** memang tanpa sumber data (penilaian hakim / tidak tercatat).
- Penanda yang dirujuk rantai variabel tetapi tidak ada di katalog ABT lokal: 51 (lihat bawah).

## Membangun ulang (blangko baru wajib dicek)

Uji penjaga `isi-sipp-abt-daftar-cek.test.ts` gagal bila pohon server (fixture `blangko-derry-server-17okt.json` atau gantinya) memuat blangko yang tidak ada di `DAFTAR-CEK.json`. Cara memperbarui (butuh MySQL lokal berisi `aps_badilag_i18` dan `sipp_donggala`):

```
cd manajemen_surat && npx tsx ../scripts/isi-sipp-abt/analisa-isian.mts <analisa.json>
node scripts/isi-sipp-abt/beban-manual.cjs docs/isi-sipp-abt/BEBAN-MANUAL.json
node scripts/isi-sipp-abt/ukur-lanjutan.cjs docs/isi-sipp-abt/UKURAN-LANJUTAN.json
node scripts/isi-sipp-abt/bangun-daftar-cek.cjs <analisa.json>
node scripts/isi-sipp-abt/gerbang-tombol.cjs <analisa.json>   # periksa gerbang tombol
```

Isian baru yang muncul harus diberi pengisi (kode + berkas di `scripts/isi-sipp-abt/pengisi-kurasi.cjs`) atau keterangan sumbernya; pengisi yang ditandai ya/sebagian diperiksa uji (kode benar-benar ada di berkasnya).

## Sumber dan cara membaca

- Pohon blangko: manajemen_surat/src/test/fixtures/blangko-derry-server-17okt.json (kunci berkas).
- Isi RTF: RTF terbaru dari arsip lokal (paket batch-14okt-sore, server-asal, XAMPP). Katalog variabel: aps_badilag_pm56 (1703 variabel). Frekuensi: sipp_donggala perkara terdaftar sejak 2023-01-01 (3267 perkara).
- "Isian popup" = hasil `susunIsian` (blangko-derry/susun.ts): penanda RTF + rantai variabel bertipe data_teks, data_tanggal, tanya_jawab. Penanda data_sql/data_sipp/terbilang dihitung ABT sendiri.
- Urutan = bobot: jumlah blangko pemakai x jumlah perkara jenis folder itu sejak 2023 (relaas/sita/PTSP bobot 1 per blangko karena lintas jenis).
- **ya** = ada pengisi yang menghasilkan nilai untuk SEMUA jenis perkara pemakai blangko itu; **sebagian** = hanya sebagian jenis/blangko; **tidak** = belum ada pengisi.
- Pengisi diperiksa uji penjaga (`isi-sipp-abt-daftar-cek.test.ts`): kode harus benar-benar ada di berkas pengisinya.

## Dibangun 18 Okt (agen Z1) - isian popup yang datanya ada di SIPP

Kode: `aleta_bot/services/abtIsianSippLanjutan.js`, dipanggil dari `dariSipp` (kanal "Isi dari SIPP"); SELECT saja. Diukur atas 3267 perkara sipp_donggala sejak 2023 (tanpa menulis apa pun):

| nomor | isian | sumber SIPP | perkara kini terisi | tingkat | pembanding isian petugas (ABT lokal) |
| --- | --- | --- | ---: | --- | --- |
| 8705 | Tanggal kesepakatan perdamaian | perkara_mediasi.tgl_kesepakatan_perdamaian (hasil Y1) | 8 | otomatis | belum ada isian petugas (variabel baru 15 Okt) |
| 8704 | Isi kesepakatan perdamaian | perkara_mediasi.isi_kesepakatan_perdamaian, HTML jadi baris | 8 | otomatis | belum ada isian petugas |
| 8433 | Alasan pencabutan perkara | hasil mediasi Y2 (berhasil dengan pencabutan) | 26 | otomatis | 41 isian petugas sejak 2023, hanya 4 dari Y2 |
| 8899 | Pokok kesepakatan perdamaian sebagian | topik kata kunci pada perkara_mediasi.isi_kesepakatan_perdamaian (hasil S) | 121 | otomatis (ragu bila isi berupa laporan mediator) | belum ada isian petugas (variabel baru 15 Okt); 140 perkara hasil S sejak 2023 |
| 1183 | Tgl. batas waktu ikrar talak | perkara_ikrar_talak.tanggal_sidang_pertama + 6 bulan | 328 | usulan ragu | 7 dari 11 persis sama |
| 0303 | Tgl. pengumuman itsbat (voluntair, alur 16) | perkara.tanggal_pendaftaran | 699 | usulan ragu | 186 dari 409 persis sama (92% dalam 0-1 hari) |
| 0185 | Tgl. surat kuasa Tergugat | perkara_pengacara pihak 2 | 34 | usulan ragu | 1 dari 1 persis sama |

"Otomatis" = tercentang sendiri bila isian blangko kosong; "usulan ragu" = ditampilkan tanpa centang dan tidak menimpa isian petugas (aturan yang sama dengan usulan lain).

## Per blangko

- Blangko yang seluruh isian popupnya sudah otomatis (ya): **230** dari 1089 yang punya isian popup.
- Blangko yang masih punya sekurang-kurangnya satu isian manual TANPA syarat keadaan (bukan kuasa/prodeo/ghaib/insidentil/alasan C-H): **188**. 25 terbanyak (sebagian besar isian manual itu keputusan/penilaian hakim atau kesepakatan para pihak):

| blangko | ya | sebagian | tidak (semua) | tidak tanpa syarat keadaan | opsional |
| --- | ---: | ---: | ---: | ---: | ---: |
| 9 Penetapan Ahli Waris/[01c] [Kabul] PAW - Susunan Ahli Waris Lengkap (Cucu Pengganti, Kakek, Nenek, Saudara S | 12 | 1 | 14 | 13 | 0 |
| 1 Perceraian CG/[02c] [Kabul] CG - Kumulasi Nafkah Istri (Madliyah, Iddah, Mutah) - Kontradiktoir.rtf | 21 | 8 | 9 | 7 | 0 |
| 9 Penetapan Ahli Waris/[01b] [Kabul] PAW - Susunan Ahli Waris Dinamis (Pasangan, Anak, Ayah, Ibu - Pertimbanga | 12 | 1 | 8 | 7 | 0 |
| 5b Pencegahan Perkawinan/[03] [Tolak] Pencegahan Perkawinan - Alasan Pencegahan Tidak Terbukti.rtf | 8 | 2 | 8 | 7 | 0 |
| 5b Pencegahan Perkawinan/[99b] [NO] Pencegahan Perkawinan - Perkawinan Telah Dilangsungkan.rtf | 8 | 2 | 8 | 7 | 0 |
| 4c Wasiat/[01] [Kabul] Wasiat - Kontradiktoir.rtf | 16 | 6 | 8 | 6 | 0 |
| 4c Wasiat/[01a] [Kabul] Wasiat - T Tidak Hadir Setelah Mediasi.rtf | 14 | 4 | 8 | 6 | 0 |
| 4c Wasiat/[01b] [Kabul Verstek] Wasiat.rtf | 14 | 4 | 8 | 6 | 0 |
| 4c Wasiat/[03] [Tolak] Wasiat - Kontradiktoir - Dalil Tidak Terbukti.rtf | 16 | 6 | 8 | 6 | 0 |
| 4c Wasiat/[03b] [Tolak Verstek] Wasiat - Dalil Tidak Terbukti.rtf | 14 | 4 | 8 | 6 | 0 |
| 5b Pencegahan Perkawinan - BAS/BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti & 2 Saksi, Penetapa | 8 | 2 | 6 | 6 | 0 |
| 5b Pencegahan Perkawinan - BAS/BAS ALUR 41 Pencegahan - [1a] Sidang 1 - Calon Hadir - Bukti & 2 Saksi, Tunda P | 8 | 2 | 6 | 6 | 0 |
| 5b Pencegahan Perkawinan - BAS/BAS ALUR 41 Pencegahan - [1b] Sidang 1 - Calon Tidak Hadir - Bukti Surat, Tunda | 6 | 2 | 6 | 6 | 0 |
| 5b Pencegahan Perkawinan - BAS/BAS ALUR 41 Pencegahan - [2] Sidang Lanjutan - Calon Mempelai & 2 Saksi, Tunda  | 8 | 2 | 6 | 6 | 0 |
| 5b Pencegahan Perkawinan - BAS/BAS ALUR 41 Pencegahan - [2b] Sidang Lanjutan - Calon Mempelai & 2 Saksi, Penet | 8 | 2 | 6 | 6 | 0 |
| 5b Pencegahan Perkawinan - BAS/BAS ALUR 41 Pencegahan - [3] Sidang Terakhir - Pembacaan Penetapan.rtf | 6 | 2 | 6 | 6 | 0 |
| 5b Pencegahan Perkawinan/[01] [Kabul] Pencegahan Perkawinan - Calon Mempelai Hadir.rtf | 8 | 2 | 7 | 6 | 0 |
| 5b Pencegahan Perkawinan/[01a] [Kabul] Pencegahan Perkawinan - Calon Mempelai Tidak Hadir.rtf | 8 | 2 | 7 | 6 | 0 |
| 5b Pencegahan Perkawinan/[99a] [NO] Pencegahan Perkawinan - Pemohon Tidak Berhak Mencegah.rtf | 8 | 2 | 7 | 6 | 0 |
| 1 Perceraian CG/[01d] [Kabul Verstek] Cerai (Format Lengkap) - Kumulasi Nafkah Istri (Madliyah, Iddah, Mutah). | 21 | 1 | 10 | 5 | 0 |
| 1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[02b] [Kabul] Putusan CG Kumulasi Hak Asuh dan Nafkah Anak - Kon | 22 | 9 | 6 | 4 | 0 |
| 4b Kewarisan - BAS/BAS ALUR 32 Waris - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] da | 1 | 0 | 4 | 4 | 0 |
| 4a Harta Bersama - BAS/BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi Objek (antara ALUR 04 [7] d | 1 | 0 | 4 | 4 | 0 |
| 7 Wali Adhal/[01a] [Kabul] Wali Adhal - Wali Hadir Tetap Enggan.rtf | 15 | 3 | 5 | 4 | 0 |
| 7 Wali Adhal/[03] [Tolak] Wali Adhal - Keengganan Wali Beralasan Hukum.rtf | 15 | 3 | 5 | 4 | 0 |

## Temuan gerbang tombol (diperiksa 18 Okt)

Pengisi di bot tidak berguna bila tombolnya tidak muncul di blangko itu. `scripts/isi-sipp-abt/gerbang-tombol.cjs` membaca cermin gerbang langsung dari `ekstensi-sipp/abt.js` dan memeriksa tiap blangko x isian berpengisi posita: untuk jenis utama (cerai, itsbat, dispensasi kawin, ahli waris, perwalian) tombolnya selalu terpicu. Celah yang tersisa kecil: BAS sita insidentil harta bersama/kewarisan (9161-9163), pencegahan perkawinan (1029, tanpa modul jenisnya), dan blangko cerai kumulasi cacat formil ([99b]) yang memang tidak memerlukan fakta.

## Tabel per isian (urut bobot)

| # | nomor | nama | jml blangko | diketik petugas (perkara sejak 2023) | contoh blangko | otomatis? | sumber / pengisi | catatan |
| ---: | --- | --- | ---: | ---: | --- | --- | --- | --- |
| 1 | 8537 | Nama advokat Penggugat/Pemohon | 989 | 0 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ABT sendiri dari SIPP bila dikosongkan; kuasa-penggugat |  |
| 2 | 0132 | Tanggal register surat kuasa Penggugat/Pemohon di kepaniteraan | 567 | 13 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ABT sendiri dari SIPP bila dikosongkan; kuasa-penggugat; deteksi cerai |  |
| 3 | 0184 | Tanggal surat kuasa Penggugat/Pemohon | 567 | 25 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | kuasa-penggugat; deteksi cerai |  |
| 4 | 8538 | Alamat kantor advokat Penggugat/Pemohon | 567 | 0 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | kuasa-penggugat |  |
| 5 | 8539 | Nomor register surat kuasa Penggugat/Pemohon | 567 | 0 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ABT sendiri dari SIPP bila dikosongkan; kuasa-penggugat |  |
| 6 | 8548 | Alamat Putusan Penggugat/Pemohon | 564 | 0 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ABT sendiri dari SIPP bila dikosongkan; alamat-putusan |  |
| 7 | 0185 | Tanggal surat kuasa Tergugat/Termohon | 404 | 1 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | sebagian | SIPP perkara_pengacara.tanggal_kuasa pihak 2 (usulan ragu) / e-Court lampiran surat kuasa (terisi di: sipp-lanjutan-ragu) | Kolom SIPP sering tanggal register, bukan tanggal surat kuasa; Tergugat berkuasa ±1% perkara (34 dari 3267 sejak 2023). |
| 8 | 8549 | Alamat Putusan Tergugat/Termohon | 395 | 0 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | ya | ABT sendiri dari SIPP bila dikosongkan; alamat-putusan |  |
| 9 | 8503 | Alasan perceraian | 127 | 359 | [01b] (E-Court) BAS 2 P Hadir & T Tidak Hadir Pokok Perkara  | ya | deteksi cerai |  |
| 10 | 5058, 2021 | TanyaJwb Saksi 1 P [tanya jawab saksi 1 p] | 298 | 0 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | susun saksi |  |
| 11 | 5059, 2022 | TanyaJwb Saksi 2 P [tanya jawab saksi 2 p] | 298 | 0 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | susun saksi |  |
| 12 | 8894 | Nama penerima kuasa insidentil | 332 | 0 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | SIPP perkara_jadwal_sidang.keterangan / penetapan izin kuasa insidentil (tidak terstruktur) | Kuasa insidentil tidak punya kolom sendiri di SIPP; ±jarang. |
| 13 | 0663 | Tanggal penetapan prodeo | 231 | 3 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | tidak ada | Tanggal penetapan prodeo tidak disimpan SIPP (hasil putusan sela/pertimbangan hakim). |
| 14 | 7139 | Beracara secara elektronik | 253 | 30 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | ya | elitigasi |  |
| 15 | 1214 | Alat bukti surat Penggugat/Pemohon | 94 | 2009 | [01b] (E-Court) BAS 2 P Hadir & T Tidak Hadir Pokok Perkara  | ya | ktp-teks; deteksi cerai |  |
| 16 | 7084 | Penanda konvensi/rekonvensi (1 apabila ada) | 180 | 3 | [02] BAS 3 P & T Hadir Jawaban dan (Apabila ada Gugatan Reko | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: jawab-menjawab-ecourt) |  |
| 17 | 0156 | Nama kantor advokat Penggugat/Pemohon | 136 | 44 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | ya | kuasa-penggugat; deteksi cerai |  |
| 18 | 5197 | Tgl Nikah | 114 | 706 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | terisi di jenis utama; belum di: 4a Harta Bersama (terisi di: deteksi itsbat-nikah; deteksi perwalian; deteksi waris; deteksi lain-lain) | Pada blangko cerai isian ini hanya terbaca lewat variabel 7184 (kumulasi itsbat, bersyarat jenis perkara 360); pada cerai biasa tidak tercetak. Terukur atas isian petugas: itsbat 232/296 benar; asal-usul 1/2 benar. Terisi dari posita sejak 2023: perwalian 39/43; waris 29/61; lain-lain 1/6 perkara. |
| 19 | 5178 | KUA Kec. | 106 | 298 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah; deteksi dispensasi-kawin; deteksi perwalian | Pada blangko cerai isian ini hanya terbaca lewat variabel 7184 (kumulasi itsbat, bersyarat jenis perkara 360); pada cerai biasa tidak tercetak. Terukur atas isian petugas: itsbat 260/269 benar; dispensasi-kawin 6/7 benar. Terisi dari posita sejak 2023: itsbat-nikah 686/738; perwalian 28/43 perkara. |
| 20 | 8892 | Pengadilan Tinggi tempat advokat Penggugat/Pemohon disumpah | 173 | 0 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | ya | bawaan ABT bila dikosongkan | Bawaan layar Perlu diisi: Pengadilan Tinggi Sulawesi Tengah; ABT mengisi bila dikosongkan pada sebagian blangko. |
| 21 | 9955 | Bukti surat perceraian (otomatis) | 161 | 53 | [02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan | ya | ABT sendiri dari SIPP bila dikosongkan; ktp-teks |  |
| 22 | 1268 | Upaya damai oleh keluarga | 68 | 370 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 23 | 0222 | Awal perselisihan | 67 | 364 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 24 | 9944 | Lama pisah rumah | 67 | 373 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 25 | 7035 | Yang meninggalkan rumah bersama | 63 | 374 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 26 | 8921, 6122 | TanyaJwb Saksi 3 T [tanya jawab saksi 3 t] | 59 | 0 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 27 | 0157 | Nama kantor advokat Tergugat/Termohon | 103 | 0 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | tidak | e-Court (surat kuasa/jawaban Tergugat) | Nama kantor advokat tidak disimpan SIPP; Tergugat berkuasa ±1% perkara. |
| 28 | 0246 | Pisah rumah sejak | 59 | 359 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | ya | deteksi cerai |  |
| 29 | 0007 | Anak dari pernikahan ini | 71 | 681 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | gugatan-ecourt; deteksi itsbat-nikah; deteksi cerai; deteksi perwalian | Terukur atas isian petugas: itsbat 511/560 benar. Terisi dari posita sejak 2023: itsbat-nikah 656/738; cerai 1938/2339; perwalian 32/43 perkara. |
| 30 | 6124, 8920 | TanyaJwb Saksi 4 P [tanya jawab saksi 4 p] | 60 | 0 | [02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 31 | 5227 | Rincian alasan cerai (sesuai gugatan) | 54 | 319 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | ya | gugatan-ecourt; deteksi cerai |  |
| 32 | 9911 | Alat bukti surat Tergugat/Termohon | 104 | 12 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | ktp-teks |  |
| 33 | 1006 | Tempat tinggal setelah menikah | 42 | 34 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 34 | 5127 | Alasan-Alasan Cerai | 34 | 25 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 35 | 1267 | Masih berkomunikasi atau tidak | 33 | 17 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | sebagian | jarang tertulis di posita: cerai 19/2339 perkara (terisi di: deteksi cerai) | Terisi dari posita sejak 2023: cerai 19/2339 perkara. |
| 36 | 2557 | (Saksi I) Berapa Kali Melihat dan Mendengar Pertengkaran | 33 | 15 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | tidak | keterangan saksi pada BAS (teks bebas) | Registri cerai: belum - tidak tertulis di posita. |
| 37 | 2558 | (Saksi II) Berapa Kali Melihat dan Mendengar Pertengkaran | 32 | 13 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | tidak | keterangan saksi pada BAS (teks bebas) | Registri cerai: belum - tidak tertulis di posita. |
| 38 | 5105 | Alamat Tempat Menikah | 75 | 711 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah; deteksi cerai; deteksi perwalian; deteksi lain-lain | Terukur atas isian petugas: itsbat 627/675 benar. Terisi dari posita sejak 2023: itsbat-nikah 734/738; cerai 2151/2339; perwalian 29/43; lain-lain 1/6 perkara. |
| 39 | 5060, 2031 | TanyaJwb Saksi 3 P [tanya jawab saksi 3 p] | 60 | 0 | [02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 40 | 8564 | Tanggal pengumuman panggilan ghaib pertama dan kedua | 43 | 0 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | ya | ABT sendiri dari SIPP bila dikosongkan | Tanggal pengumuman ghaib pertama dan kedua. |
| 41 | 8436 | Kesimpulan Penggugat/Pemohon | 116 | 13 | [02] [Kabul] CG - F.rtf | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: jawab-menjawab-ecourt) |  |
| 42 | 0227 | Tanggal Tergugat/Termohon berpindah agama | 36 | 1 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | tidak ada | Tanggal Tergugat berpindah agama/fasakh: SIPP tidak punya kolomnya. |
| 43 | 0661 | Nomor penetapan prodeo | 36 | 3 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | tidak ada | Nomor SK prodeo tidak disimpan SIPP; ecourt_prodeo tidak memuat nomor penetapan. Terbukti di kode (abtUsulanService tidak_ada_sumber). |
| 44 | 8536 | Putusan pidana Tergugat/Termohon (nomor, tanggal, lama hukuman) | 36 | 0 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | tidak ada (putusan pidana Tergugat diketahui dari bukti surat) | Alasan C; ±jarang. |
| 45 | 9881 | lisan atau tertulis (jawaban replik dan duplik) | 122 | 15 | [02] [Kabul] CG - F.rtf | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: jawab-menjawab-ecourt) |  |
| 46 | 6112, 2018 | Jawaban Lisan Tergugat/Termohon [tanya jawab jawaban lisan 0047] | 39 | 0 | BAS ALUR 05 [2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Ja | sebagian | lisan: diketik panitera (tidak ada kolom terstruktur di SIPP). Tertulis: berkas jawaban e-Court yang rapi ditulis otomatis ke tanya-jawab sidang beragenda jawaban bila barisnya kosong; yang tidak rapi disalin petugas (kalimat salin 'jawab-tertulis-jawaban') (terisi di: tanya-jawab-jawab-menjawab) | Blangko putusan: 'COPY FILE JAWABAN APABILA TERTULIS' - JJ2: ditulis otomatis bila rapi; 9881 diisi 'tertulis' bila berkasnya ada. |
| 47 | 6114, 2020 | Duplik Lisan Tergugat/Termohon [tanya jawab duplik lisan 0047] | 38 | 0 | BAS ALUR 05 [2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Ja | sebagian | lisan: diketik panitera. Tertulis: duplik e-Court yang rapi ditulis otomatis ke tanya-jawab sidang beragenda duplik bila barisnya kosong; yang tidak rapi disalin (kalimat salin 'jawab-tertulis-duplik'); rereplik tidak punya kolom sendiri (terisi di: tanya-jawab-jawab-menjawab) |  |
| 48 | 6113, 2019 | Replik Lisan Penggugat/Pemohon [tanya jawab replik lisan 0046] | 38 | 0 | BAS ALUR 05 [2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Ja | sebagian | lisan: diketik panitera. Tertulis: replik e-Court yang rapi ditulis otomatis ke tanya-jawab sidang beragenda replik bila barisnya kosong; yang tidak rapi disalin (kalimat salin 'jawab-tertulis-replik') (terisi di: tanya-jawab-jawab-menjawab) |  |
| 49 | 8437 | Kesimpulan Tergugat/Termohon | 80 | 3 | [02] [Kabul] CG - F.rtf | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: jawab-menjawab-ecourt) |  |
| 50 | 8931, 8932 | TanyaJwb Saksi 5 P [tanya jawab saksi 5 p] | 30 | 0 | [02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 51 | 8433 | Alasan pencabutan perkara | 99 | 41 | BAS ALUR 08 [A] BAS 1 P Hadir & T Tidak Hadir - Cabut di Sid | sebagian | hakim mengetik (usulan hanya bila mediasi Y2) (terisi di: sipp-mediasi-cabut) | Sejak 2023: 41 isian petugas, hanya 4 berasal dari mediasi Y2; alasan lain (perbaikan gugatan, alamat tidak ditemukan) bebas. |
| 52 | 6120, 2023 | TanyaJwb Saksi 1 T [tanya jawab saksi 1 t] | 93 | 0 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 53 | 6121, 2024 | TanyaJwb Saksi 2 T [tanya jawab saksi 2 t] | 93 | 0 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 54 | 7178 | Alasan panggilan dianggap tidak patut | 22 | 4 | [99] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas Atau | tidak | relaas panggilan (ALETA relaas) - penilaian hakim |  |
| 55 | 8603 | Nama anak yang dimohonkan | 50 | 0 | BAS KUMULASI [2] BAS Putus Verstek CG Kumulasi Hak Asuh Anak | ya | deteksi hadhanah; deteksi asal-usul; deteksi pengangkatan-anak; deteksi lain-lain | Terisi dari posita sejak 2023: asal-usul 8/8; lain-lain 5/6 perkara. |
| 56 | 1046 | Status Wali Nikah | 44 | 701 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah; deteksi wali-adhol | Terukur atas isian petugas: itsbat 614/631 benar. Terisi dari posita sejak 2023: itsbat-nikah 694/738; wali-adhol 3/3 perkara. |
| 57 | 0650 | Saksi Nikah 1 | 38 | 696 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 509/569 benar; asal-usul 2/2 benar. |
| 58 | 0651 | Saksi Nikah 2 | 38 | 697 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 476/543 benar; asal-usul 2/2 benar. |
| 59 | 1001 | Mas kawin | 38 | 697 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 285/643 benar; asal-usul 2/2 benar. |
| 60 | 1217 | Nama Wali Nikah | 38 | 678 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | bawaan ABT bila dikosongkan; deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 578/637 benar; asal-usul 2/2 benar. |
| 61 | 8087 | Yang Menikahkan | 38 | 696 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 266/517 benar; asal-usul 2/2 benar. |
| 62 | 9958 | C3. Alat Bukti Isbat Nikah Terpadu | 30 | 188 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ktp-teks; deteksi itsbat-nikah |  |
| 63 | 7211 | Umur Isbat P1 (Laki-Laki) | 24 | 277 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 183/230 benar. Terisi dari posita sejak 2023: itsbat-nikah 681/738 perkara. |
| 64 | 7212 | Umur Isbat P2 (Perempuan) | 24 | 277 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 180/231 benar. Terisi dari posita sejak 2023: itsbat-nikah 683/738 perkara. |
| 65 | 1002 | Status Penggugat/Pemohon sblm nikah (IN) | 34 | 699 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | terisi di jenis utama; belum di: 7 Wali Adhal (terisi di: deteksi itsbat-nikah) | Terukur atas isian petugas: itsbat 655/670 benar. Terisi dari posita sejak 2023: itsbat-nikah 736/738 perkara. |
| 66 | 1003 | Status #2027# sblm nikah (IN) | 31 | 699 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 654/670 benar. Terisi dari posita sejak 2023: itsbat-nikah 736/738 perkara. |
| 67 | 5271 | Penghasilan Tergugat/Termohon Perbulan | 16 | 0 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | tidak | berkas e-Court (gugatan: penghasilan) |  |
| 68 | 6071 | Nafkah Anak | 6 | 5 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: gugatan-ecourt) |  |
| 69 | 9050 | Kenaikan nafkah anak per tahun | 5 | 0 | BAS KUMULASI [2b] BAS Putus Verstek CG Kumulasi Hak Asuh Ana | tidak | berkas e-Court (petitum kenaikan nafkah anak) |  |
| 70 | 8941 | TanyaJwb Saksi 4 T [tanya jawab saksi 4 t] | 14 | 0 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 71 | 9134 | Bas permohonan | 38 | 0 | BAS ALUR 17 IN 2+ Sidang - [1a] Sidang 1 - Pemeriksaan, Bukt | tidak | opsional: bila dikosongkan ABT mencetak titik-titik/bawaan; isi hanya bila hakim ingin | belum dikaji |
| 72 | 0364 | Tgl. KTP Penggugat/Pemohon | 11 | 267 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ktp-tanggal; deteksi itsbat-nikah |  |
| 73 | 0366 | Tgl. KTP Penggugat/Pemohon II | 11 | 263 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ktp-tanggal; deteksi itsbat-nikah |  |
| 74 | 8171 | Alasan Permohonan untuk | 21 | 456 | BAS ALUR 17 IN 2+ Sidang - [1a] Sidang 1 - Pemeriksaan, Bukt | ya | deteksi itsbat-nikah; deteksi perwalian; deteksi lain-lain | Terukur atas isian petugas: perwalian 0/5 benar. Terisi dari posita sejak 2023: perwalian 20/43 perkara. |
| 75 | 8712 | Nomor dan tanggal surat teguran panitera | 22 | 0 | [98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar H | tidak | opsional: bila dikosongkan ABT mencetak titik-titik/bawaan; isi hanya bila hakim ingin | ALETA Kasir (teguran panjar) - belum dicatat terstruktur |
| 76 | 8713 | Batas waktu menambah panjar | 22 | 0 | [98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar H | tidak | opsional: bila dikosongkan ABT mencetak titik-titik/bawaan; isi hanya bila hakim ingin | ALETA Kasir (teguran panjar) - belum dicatat terstruktur |
| 77 | 8714 | Nomor dan tanggal laporan panjar tidak ditambah | 22 | 0 | [98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar H | tidak | opsional: bila dikosongkan ABT mencetak titik-titik/bawaan; isi hanya bila hakim ingin | ALETA Kasir (laporan panjar) - belum dicatat terstruktur |
| 78 | 8729 | Penilaian keterangan saksi dan fakta yang tidak terbukti | 6 | 0 | [03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 79 | 9681 | EKSEPSI KEWENANGAN - ISI EKSEPSI TERGUGAT/TERMOHON (isian | 8 | 0 | [99c] [NO] CG - Eksepsi Kewenangan Absolut Dikabulkan.rtf | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: jawab-menjawab-ecourt) |  |
| 80 | 9682 | Eksepsi kewenangan dikabulkan - fakta/alasan perkara di luar kewenangan | 8 | 0 | [99c] [NO] CG - Eksepsi Kewenangan Absolut Dikabulkan.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 81 | 9684 | Eksepsi kewenangan ditolak - fakta/alasan perkara termasuk kewenangan pengadilan agama | 8 | 0 | [98e] [Sela] CG - Eksepsi Kewenangan Absolut Ditolak.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 82 | 9685 | Eksepsi kewenangan | 8 | 0 | [98e] [Sela] CG - Eksepsi Kewenangan Absolut Ditolak.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 83 | 0182 | Tanggal izin kuasa insidentil | 4 | 0 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | tidak | tidak ada terstruktur (penetapan izin Ketua) |  |
| 84 | 8895 | Hubungan penerima kuasa dengan Penggugat/Pemohon | 4 | 0 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | tidak | tidak ada terstruktur (penetapan izin Ketua) | Hubungan penerima kuasa dengan pemberi kuasa. |
| 85 | 8896 | Nomor izin Ketua Pengadilan | 4 | 0 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | tidak | tidak ada terstruktur (penetapan izin Ketua) | Nomor izin Ketua Pengadilan. |
| 86 | 9123 | Sebab kuasa insidentil tidak sah (huruf a sampai d) | 4 | 0 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | ya | bawaan ABT bila dikosongkan |  |
| 87 | 5171 | Penghasilan Penggugat/Pemohon Perbulan | 10 | 3 | [01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - | tidak | berkas e-Court (gugatan: penghasilan) |  |
| 88 | 6054 | Nafkah iddah | 10 | 8 | [01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - | ya | gugatan-ecourt; deteksi cerai |  |
| 89 | 6055 | Mut'ah | 10 | 7 | [01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: gugatan-ecourt) |  |
| 90 | 8899 | Pokok kesepakatan perdamaian sebagian | 3 | 0 | [02b] [Kabul] CG - F - Mediasi Berhasil Sebagian (Kesepakata | ya | sipp-mediasi-sebagian |  |
| 91 | 8902 | Isi pasal kesepakatan perdamaian sebagian | 3 | 0 | [02b] [Kabul] CG - F - Mediasi Berhasil Sebagian (Kesepakata | ya | bawaan ABT bila dikosongkan |  |
| 92 | 9711 | NAFKAH MADLIYAH (cerai gugat) | 2 | 0 | [02c] [Kabul] CG - Kumulasi Nafkah Istri (Madliyah, Iddah, M | tidak | belum dikaji |  |
| 93 | 9712 | NAFKAH IDDAH (cerai gugat) | 2 | 0 | [02c] [Kabul] CG - Kumulasi Nafkah Istri (Madliyah, Iddah, M | tidak | belum dikaji |  |
| 94 | 9713 | MUT'AH (cerai gugat) | 2 | 0 | [02c] [Kabul] CG - Kumulasi Nafkah Istri (Madliyah, Iddah, M | tidak | belum dikaji |  |
| 95 | 9714 | Nafkah istri - dasar kemampuan tergugat dan kebutuhan hidup | 2 | 0 | [02c] [Kabul] CG - Kumulasi Nafkah Istri (Madliyah, Iddah, M | tidak | belum dikaji |  |
| 96 | 9715 | Nafkah istri - pembayaran sebelum tergugat mengambil akta cerai | 2 | 0 | [02c] [Kabul] CG - Kumulasi Nafkah Istri (Madliyah, Iddah, M | tidak | belum dikaji |  |
| 97 | 0228 | Alasan Syahadah Istifadhah (Itsbat Nikah / Isbat / PAW) | 4 | 3 | [01ab] BAS 1 IN - Kabul Syahadah Istifadhah.rtf | ya | deteksi itsbat-nikah |  |
| 98 | 9501 | Penilaian jawaban dan bukti Tergugat/Termohon (bantahan apa yang didukung bukti atau saksi, dan mengapa melemahkan dalil Penggugat/Pemohon; kosong = titik-titik) | 4 | 0 | [03a] [Tolak] Cerai - Kontradiktoir (T Hadir Jawab-Menjawab) | tidak | opsional: bila dikosongkan ABT mencetak titik-titik/bawaan; isi hanya bila hakim ingin |  |
| 99 | 9680 | Pencabutan ditolak - alasan tergugat/termohon tidak menyetujui pencabutan | 3 | 0 | [02c] [Kabul] CG - F - Pencabutan Ditolak T Sesudah Jawaban. | tidak | belum dikaji |  |
| 100 | 8901 | Amar kesepakatan perdamaian sebagian (satu butir per baris) | 2 | 0 | [02b] [Kabul] CG - F - Mediasi Berhasil Sebagian (Kesepakata | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 101 | 9120 | Panggilan ulang karena kuasa insidentil tidak sah | 2 | 0 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | ya | bawaan ABT bila dikosongkan |  |
| 102 | 9125 | Keadaan kuasa insidentil tidak sah | 2 | 0 | [98] [NO] 4b. Cerai P Diwakili Kuasa Insidentil Tidak Sah.rt | tidak | penilaian hakim |  |
| 103 | 1183 | Tgl. Batas Waktu Ikrar Talak | 1 | 11 | [3] BAS Ikrar Talak - P Tidak Hadir & T Hadir, Tunda Tenggan | sebagian | SIPP perkara_ikrar_talak.tanggal_sidang_pertama + 6 bulan (usulan ragu) (terisi di: sipp-lanjutan-ragu) | Cocok persis dengan 7 dari 11 isian petugas; sisanya sidang ikrar pertama diundur. |
| 104 | 1025 | Nama Almarhum / Almarhumah | 50 | 28 | BAS ALUR 35 IN Kontensius - Sidang 1 - Jawaban T Mengakui, P | ya | itsbat-pasangan-meninggal; deteksi waris; deteksi perwalian; deteksi lain-lain | Terukur atas isian petugas: perwalian 2/5 benar. Terisi dari posita sejak 2023: waris 57/61; perwalian 32/43; lain-lain 1/6 perkara. |
| 105 | 9683 | Itsbat ditolak - pihak yang masih terikat perkawinan lain | 4 | 0 | [99d] [NO] Putusan CG Kumulasi Itsbat Nikah - Itsbat NO (Pol | tidak | belum dikaji |  |
| 106 | 1021 | Nama Istri Pertama | 2 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | sebagian | jarang tertulis di posita: itsbat-nikah 5/738 perkara (terisi di: deteksi itsbat-nikah) | Terisi dari posita sejak 2023: itsbat-nikah 5/738 perkara. |
| 107 | 1513 | Nama Suami Meninggal (bukti Pemohon2) | 2 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | tidak | posita/bukti (akta kematian) | Itsbat dengan suami meninggal. |
| 108 | 0600 | Nama Pria (Dispensasi) | 23 | 34 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 33/36 benar. Terisi dari posita sejak 2023: dispensasi-kawin 56/56 perkara. |
| 109 | 0606 | Nama Wanita (Dispensasi) | 23 | 41 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 43/44 benar. Terisi dari posita sejak 2023: dispensasi-kawin 56/56 perkara. |
| 110 | 6331 | Pekerjaan Calon Suami/Anak Para Pemohon DK / Pekerjaan Perwalian Orang Tua | 25 | 12 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | sebagian | terisi di jenis utama; belum di: 7 Wali Adhal (terisi di: deteksi dispensasi-kawin; deteksi perwalian) |  |
| 111 | 0601 | Umur Pria (dispensasi) | 20 | 23 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 10/11 benar. Terisi dari posita sejak 2023: dispensasi-kawin 18/56 perkara. |
| 112 | 0607 | Umur Wanita (dispensasi) | 20 | 33 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 34/36 benar. Terisi dari posita sejak 2023: dispensasi-kawin 53/56 perkara. |
| 113 | 1551 | Nama Ayah Calon Suami/Istri DK | 20 | 8 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 2/7 benar. Terisi dari posita sejak 2023: dispensasi-kawin 56/56 perkara. |
| 114 | 1552 | Nama Ayah Calon Suami/Istri DK | 20 | 9 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 115 | 2029 | Status Anak Pria (DK) | 20 | 17 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 116 | 2030 | Status Anak Wanita (DK) | 20 | 9 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 117 | 9956 | Detektor klasifikasi bukti surat sesuai dengan jenis perkara | 20 | 8 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | ktp-teks; deteksi dispensasi-kawin |  |
| 118 | 0609 | Pendidikan Wanita (dispensasi) | 18 | 35 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 119 | 1666 | lama pacaran (DK) | 18 | 9 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 4/8 benar. Terisi dari posita sejak 2023: dispensasi-kawin 56/56 perkara. |
| 120 | 0709 | ibu kandung/bapak kandung perkara Hadhanah | 11 | 7 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | ya | deteksi cerai; deteksi perwalian | Terukur atas isian petugas: perwalian 5/5 benar. Terisi dari posita sejak 2023: perwalian 20/43 perkara. |
| 121 | 5110 | Nama anak | 11 | 6 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | ya | gugatan-ecourt; deteksi perwalian | Terukur atas isian petugas: perwalian 1/1 benar. Terisi dari posita sejak 2023: perwalian 42/43 perkara. |
| 122 | 6072 | Nafkah anak (masing-masing anak) | 2 | 2 | [01a] [Kabul Verstek] CT - F (Ex Offiicio mutah iddah dan na | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: gugatan-ecourt) |  |
| 123 | 1246 | Tanggal meninggalnya #2026# | 26 | 18 | [01] [Kabul] IN Kontensius - Pasangan Meninggal, Ahli Waris  | ya | itsbat-pasangan-meninggal; deteksi waris | Terisi dari posita sejak 2023: waris 54/61 perkara. |
| 124 | 1509 | Tempat Meninggal Dunia | 21 | 16 | [01] [Kabul] IN Kontensius - Pasangan Meninggal, Ahli Waris  | ya | itsbat-pasangan-meninggal; deteksi waris | Terisi dari posita sejak 2023: waris 7/61 perkara. |
| 125 | 1247 | Sebab meninggalnya #2026# | 20 | 17 | [01] [Kabul] IN Kontensius - Pasangan Meninggal, Ahli Waris  | ya | itsbat-pasangan-meninggal; deteksi waris | Terisi dari posita sejak 2023: waris 46/61 perkara. |
| 126 | 1321 | No. Akta Cerai P I (Bukti) | 3 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 127 | 1322 | Tgl. Akta Cerai P I (Bukti) | 3 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 128 | 1324 | Penerbit Akta Cerai P I (Bukti) | 1 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 129 | 1325 | No. Akta Cerai P II (Bukti) | 1 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 130 | 1329 | Tgl. Akta Cerai P II (Bukti) | 1 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 131 | 1331 | Penerbit Akta Cerai P II (Bukti) | 1 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 132 | 1514 | Tanggal Suami Meninggal (bukti Pemohon2) | 1 | 0 | [99aa] Pertimbangan - Cerai Mati P1 P2 Pasangan Sebelumnya.r | tidak | posita/bukti (akta kematian) |  |
| 133 | 1515 | Penyebab Suami Meninggal (bukti Pemohon2) | 1 | 0 | [99aa] Pertimbangan - Cerai Mati P1 P2 Pasangan Sebelumnya.r | tidak | posita/bukti (akta kematian) |  |
| 134 | 5015 | Tgl meninggal isteri/ibu | 1 | 0 | [99aa] Pertimbangan - Cerai Mati P1 P2 Pasangan Sebelumnya.r | sebagian | jarang tertulis di posita: itsbat-nikah 10/738 perkara (terisi di: deteksi itsbat-nikah) | Terisi dari posita sejak 2023: itsbat-nikah 10/738 perkara. |
| 135 | 5016 | Sebab meninggal isteri/ibu | 1 | 0 | [99aa] Pertimbangan - Cerai Mati P1 P2 Pasangan Sebelumnya.r | sebagian | jarang tertulis di posita: itsbat-nikah 0/738 perkara (terisi di: deteksi itsbat-nikah) |  |
| 136 | 9686 | Itsbat no - pernikahan sesudah 2019 tidak dicatatkan | 1 | 0 | [99d] [NO] IN - Pernikahan Sesudah 2019 Tidak Dicatatkan Tan | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 137 | 9687 | Itsbat no - pernikahan sesudah 2019 tidak dicatatkan | 1 | 0 | [99d] [NO] IN - Pernikahan Sesudah 2019 Tidak Dicatatkan Tan | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 138 | 8614 | Harta peninggalan pewaris | 11 | 0 | BAS ALUR 14 PAW - [1] Sidang 1 - Pemeriksaan, Bukti Surat da | ya | deteksi waris | Terisi dari posita sejak 2023: waris 22/61 perkara. |
| 139 | 0999 | Umur Kandungan Hamil DK Perempuan | 9 | 5 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 1/3 benar. Terisi dari posita sejak 2023: dispensasi-kawin 24/56 perkara. |
| 140 | 0349 | Tgl. Lahir Wanita (Dispensasi) | 8 | 20 | [01] [Kabul] DK - (Anak P Cewek) Hamil.rtf | ya | deteksi dispensasi-kawin | Terisi dari posita sejak 2023: dispensasi-kawin 1/56 perkara. |
| 141 | 0712 | Bapak/Ibu yang meninggal dari anak yang di walikan Perwalian | 10 | 5 | BAS ALUR 16 Perwalian - [1] Sidang 1 - Pemeriksaan, Bukti Su | ya | deteksi perwalian | Terukur atas isian petugas: perwalian 5/5 benar. Terisi dari posita sejak 2023: perwalian 20/43 perkara. |
| 142 | 1230 | Tanggal meninggalnya suami | 10 | 4 | BAS ALUR 16 Perwalian - [1] Sidang 1 - Pemeriksaan, Bukti Su | ya | deteksi perwalian | Terisi dari posita sejak 2023: perwalian 32/43 perkara. |
| 143 | 0711 | kalah Tergugat ibu kandung/bapak kandung perkara Hadhanah | 1 | 2 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | tidak | posita/petitum hadhanah (belum ada aturan) | Hanya 1 blangko. |
| 144 | 2004 | kini anak tersebut diasuh oleh | 1 | 3 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: gugatan-ecourt) |  |
| 145 | 7120 | Nafkah Lampau (Madhiyah / Madliyah) | 1 | 1 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: gugatan-ecourt) |  |
| 146 | 8570 | Kediaman bersama terakhir Penggugat/Pemohon dan Tergugat/Termohon sebelum berpisah | 1 | 0 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | ya | deteksi cerai |  |
| 147 | 9220 | Ikrar: keadaan Tergugat/Termohon saat ikrar | 1 | 0 | [90a] [Ikrar] Penetapan Ikrar Talak - P & T Hadir.rtf | tidak | keterangan Termohon di sidang ikrar (BAS ikrar) | Hanya 1 blangko. |
| 148 | 8132 | Alat Bukti PAW | 8 | 30 | BAS ALUR 14 PAW - [1] Sidang 1 - Pemeriksaan, Bukti Surat da | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 149 | 8812 | Tanggal Ijazah | 6 | 6 | [01] [Kabul] DK - (Anak P Cewek) Hamil.rtf | ya | deteksi dispensasi-kawin |  |
| 150 | 8131 | Alat Bukti Perwalian Anak | 6 | 35 | BAS ALUR 16 Perwalian - [1] Sidang 1 - Pemeriksaan, Bukti Su | ya | deteksi perwalian |  |
| 151 | 0610 | Pekerjaan Wanita (dispensasi) | 4 | 29 | [01] [Kabul] DK - (Anak P Cowok) Calon Istri Hamil.rtf | ya | deteksi dispensasi-kawin |  |
| 152 | 8706 | DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama | 16 | 0 | [97] [Perdamaian] Akta Perdamaian.rtf | sebagian | terisi di jenis utama; belum di: 4b Kewarisan; 6a Hak Asuh Anak (Hadhanah); 6b Penguasaan Anak (terisi di: deteksi harta-bersama) | Terisi dari posita sejak 2023: harta-bersama 6/8 perkara. |
| 153 | 0997 | UPT Puskesmas DK | 3 | 6 | [01] [Kabul] DK - (Anak P Cewek) Hamil.rtf | ya | deteksi dispensasi-kawin | Terisi dari posita sejak 2023: dispensasi-kawin 2/56 perkara. |
| 154 | 9771 | Alasan yang dikemukakan Penggugat/Pemohon untuk mendesaknya perkawinan anak (satu frasa tanpa titik akhir, mis. khawatir terjadi pelanggaran norma agama) | 2 | 0 | [03b] [Tolak] DK - (Anak P Cewek) Alasan Sangat Mendesak Tid | tidak | posita permohonan dispensasi (alasan mendesak yang dikemukakan Pemohon; belum ada aturan baca) | Dispensasi kawin ditolak dengan alasan selain kehamilan atau pacaran; jarang. |
| 155 | 8616 | Pengakuan Penggugat/Pemohon atas cacat permohonan | 2 | 0 | BAS ALUR 14 PAW - [NO] Permohonan Kabur, Tetap Tidak Diperba | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 156 | 8617 | Uraian cacat formil permohonan (no obscuur) | 2 | 0 | BAS ALUR 14 PAW - [NO] Permohonan Kabur, Tetap Tidak Diperba | tidak | tidak ada (penilaian hakim atas cacat formil) |  |
| 157 | 9700 | Pencairan dana | 2 | 0 | [01b] [Kabul] PAW - Susunan Ahli Waris Dinamis (Pasangan, An | tidak | belum dikaji |  |
| 158 | 9701 | AHLI WARIS - PASANGAN PEWARIS YANG MASIH HIDUP (isian | 2 | 0 | [01b] [Kabul] PAW - Susunan Ahli Waris Dinamis (Pasangan, An | tidak | belum dikaji |  |
| 159 | 9702 | AHLI WARIS - ANAK KANDUNG PEWARIS (isian | 2 | 0 | [01b] [Kabul] PAW - Susunan Ahli Waris Dinamis (Pasangan, An | tidak | belum dikaji |  |
| 160 | 9703 | AHLI WARIS - AYAH KANDUNG PEWARIS YANG MASIH HIDUP (isian | 2 | 0 | [01b] [Kabul] PAW - Susunan Ahli Waris Dinamis (Pasangan, An | tidak | belum dikaji |  |
| 161 | 9704 | AHLI WARIS - IBU KANDUNG PEWARIS YANG MASIH HIDUP (isian | 2 | 0 | [01b] [Kabul] PAW - Susunan Ahli Waris Dinamis (Pasangan, An | tidak | belum dikaji |  |
| 162 | 9718 | AHLI WARIS - SAUDARA KANDUNG ATAU SEAYAH PEWARIS (isian | 2 | 0 | [01b] [Kabul] PAW - Susunan Ahli Waris Dinamis (Pasangan, An | tidak | belum dikaji |  |
| 163 | 9169 | Itsbat nikah kontensius | 2 | 0 | BAS ALUR 35 IN Kontensius - Sidang 1 - Jawaban T Mengakui, P | ya | bawaan ABT bila dikosongkan |  |
| 164 | 9772 | Rukun atau syarat nikah yang tidak terbukti (satu kalimat tanpa titik akhir, mis. wali nikah bukan wali yang berhak) | 2 | 0 | [03b] [Tolak] Putusan CG Kumulasi Itsbat Nikah - Itsbat Dito | tidak | tidak ada (penilaian hakim atas rukun atau syarat nikah yang tidak terbukti) | Cerai kumulasi itsbat yang itsbatnya ditolak; sangat jarang. |
| 165 | 8717 | Kewarisan | 5 | 0 | BAS ALUR 33 Waris - Sidang 2 - T Tetap Tidak Hadir - Pembukt | ya | deteksi waris |  |
| 166 | 8718 | Kewarisan | 5 | 0 | BAS ALUR 33 Waris - Sidang 2 - T Tetap Tidak Hadir - Pembukt | ya | deteksi waris |  |
| 167 | 8719 | Kewarisan | 5 | 0 | BAS ALUR 33 Waris - Sidang 2 - T Tetap Tidak Hadir - Pembukt | ya | f23 waris |  |
| 168 | 8704 | Isi kesepakatan perdamaian | 14 | 0 | BAS ALUR 43 ES Acara Biasa - Sidang 2 - Mediasi Berhasil - A | ya | sipp-lanjutan-pasti |  |
| 169 | 8705 | Tanggal kesepakatan perdamaian | 14 | 0 | BAS ALUR 43 ES Acara Biasa - Sidang 2 - Mediasi Berhasil - A | ya | sipp-lanjutan-pasti |  |
| 170 | 8608 | Nama ahli waris | 1 | 0 | [01] [Kabul] PAW - Ahli Waris Anak Kandung (Suami-Istri dan  | ya | deteksi waris | Terisi dari posita sejak 2023: waris 20/61 perkara. |
| 171 | 8610 | Nama suami/istri pewaris | 1 | 0 | [01] [Kabul] PAW - Ahli Waris Anak Kandung (Suami-Istri dan  | ya | deteksi waris | Terisi dari posita sejak 2023: waris 24/61 perkara. |
| 172 | 8613 | Kematian suami/istri pewaris | 1 | 0 | [01] [Kabul] PAW - Ahli Waris Anak Kandung (Suami-Istri dan  | ya | deteksi waris | Terisi dari posita sejak 2023: waris 9/61 perkara. |
| 173 | 9762 | Ahli waris pengganti: satu anak Pewaris yang meninggal lebih dahulu (satu nama lengkap dengan bin atau binti; harus berpasangan dengan cucu Pewaris; kosong = tidak ada) | 1 | 0 | [01c] [Kabul] PAW - Susunan Ahli Waris Lengkap (Cucu Penggan | tidak | bukti dan posita permohonan (susunan keluarga Pewaris; belum ada aturan baca - isian manual menang atas data keluarga yang dimiliki ALETA) | PAW lanjutan: ahli waris pengganti harus berpasangan dengan cucu Pewaris (9763); sangat jarang. |
| 174 | 9763 | Cucu Pewaris, anak dari ahli waris pengganti (nama lengkap dengan bin atau binti; beberapa nama dipisah titik koma; kosong = tidak ada) | 1 | 0 | [01c] [Kabul] PAW - Susunan Ahli Waris Lengkap (Cucu Penggan | tidak | bukti dan posita permohonan (susunan keluarga Pewaris; belum ada aturan baca) | Berpasangan dengan 9762; sangat jarang. |
| 175 | 9764 | Kakek, ayah dari ayah Pewaris (nama lengkap dengan bin; kosong = tidak ada) | 1 | 0 | [01c] [Kabul] PAW - Susunan Ahli Waris Lengkap (Cucu Penggan | tidak | bukti dan posita permohonan (susunan keluarga Pewaris; belum ada aturan baca) | Kakek Pewaris; sangat jarang. |
| 176 | 9765 | Nenek dari pihak ibu Pewaris (nama lengkap dengan binti; kosong = tidak ada) | 1 | 0 | [01c] [Kabul] PAW - Susunan Ahli Waris Lengkap (Cucu Penggan | tidak | bukti dan posita permohonan (susunan keluarga Pewaris; belum ada aturan baca) | Nenek dari pihak ibu; sangat jarang. |
| 177 | 9766 | Nenek dari pihak ayah Pewaris (nama lengkap dengan binti; kosong = tidak ada) | 1 | 0 | [01c] [Kabul] PAW - Susunan Ahli Waris Lengkap (Cucu Penggan | tidak | bukti dan posita permohonan (susunan keluarga Pewaris; belum ada aturan baca) | Nenek dari pihak ayah; sangat jarang. |
| 178 | 9767 | Saudara seibu Pewaris (nama lengkap dengan bin atau binti; beberapa nama dipisah titik koma; kosong = tidak ada) | 1 | 0 | [01c] [Kabul] PAW - Susunan Ahli Waris Lengkap (Cucu Penggan | tidak | bukti dan posita permohonan (susunan keluarga Pewaris; belum ada aturan baca) | Saudara seibu Pewaris; sangat jarang. |
| 179 | 8618 | TEMPAT DAN TANGGAL LAHIR ANAK (pengangkatan anak) | 9 | 0 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 180 | 8619 | NAMA ORANG TUA KANDUNG ANAK (pengangkatan anak) | 9 | 0 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain | Terisi dari posita sejak 2023: lain-lain 4/6 perkara. |
| 181 | 8622 | STATUS PERKAWINAN Penggugat/Pemohon (pengangkatan anak) | 9 | 0 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain | Terisi dari posita sejak 2023: lain-lain 4/6 perkara. |
| 182 | 8623 | Hubungan Penggugat/Pemohon dengan calon anak angkat | 9 | 0 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 183 | 1029 | Nama Calon Suami | 23 | 3 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | sebagian | terisi di jenis utama; belum di: 5b Pencegahan Perkawinan; 5b Pencegahan Perkawinan - BAS (terisi di: deteksi wali-adhol) | Terisi dari posita sejak 2023: wali-adhol 3/3 perkara. |
| 184 | 8730 | Harta bersama | 5 | 0 | BAS ALUR 31 HB - Sidang 2 - T Tetap Tidak Hadir - Pembuktian | ya | deteksi harta-bersama | Terisi dari posita sejak 2023: harta-bersama 8/8 perkara. |
| 185 | 9719 | Pencairan dana | 1 | 0 | [01c] [Kabul] IN Kontensius - Pasangan Meninggal, Pencairan  | tidak | belum dikaji |  |
| 186 | 9303 | Identitas anak (nama, tempat dan tanggal lahir; satu anak satu baris) | 36 | 0 | BAS ALUR 38 Hak Asuh - Sidang 2 - T Tetap Tidak Hadir - Pemb | ya | bawaan ABT bila dikosongkan |  |
| 187 | 9347 | Wakil atau kuasa Penggugat/Pemohon yang berbadan hukum (nama, jabatan, dasar penunjukan) | 27 | 0 | BAS ALUR 40 ES GS - [1d] Sidang 1 - T Tidak Diketahui Tempat | ya | bawaan ABT bila dikosongkan | Hanya perkara ekonomi syariah badan hukum. |
| 188 | 9348 | Wakil atau kuasa Tergugat/Termohon yang berbadan hukum (nama, jabatan, dasar penunjukan) | 27 | 0 | BAS ALUR 40 ES GS - [1d] Sidang 1 - T Tidak Diketahui Tempat | ya | bawaan ABT bila dikosongkan | Hanya perkara ekonomi syariah badan hukum. |
| 189 | 8621 | Alat bukti surat pengangkatan anak | 6 | 0 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 190 | 1014 | Eratnya Hubungan Calon | 9 | 23 | BAS ALUR 19 Wali Adhal - [1] Sidang 1 - Pemeriksaan, Bukti S | ya | deteksi wali-adhol | Terisi dari posita sejak 2023: wali-adhol 3/3 perkara. |
| 191 | 1030 | Umur Calon/Suami | 9 | 3 | BAS ALUR 19 Wali Adhal - [1] Sidang 1 - Pemeriksaan, Bukti S | ya | deteksi wali-adhol | Terisi dari posita sejak 2023: wali-adhol 3/3 perkara. |
| 192 | 6087 | Alasan Wali Nikah Menolak | 9 | 3 | BAS ALUR 19 Wali Adhal - [1] Sidang 1 - Pemeriksaan, Bukti S | ya | deteksi wali-adhol | Terisi dari posita sejak 2023: wali-adhol 3/3 perkara. |
| 193 | 8620 | Keterangan orang tua kandung di persidangan | 5 | 0 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 194 | 0378 | Bukti Surat IN | 3 | 439 | [03] [Tolak] AUA - Dalil Tidak Terbukti.rtf | ya | ktp-teks; deteksi asal-usul |  |
| 195 | 9162 | Objek yang dimohonkan untuk disita (satu per baris) | 5 | 0 | BAS ALUR 30 HB - Sidang Insidentil 1 - Pemeriksaan Permohona | ya | f23 harta-bersama; f23 waris |  |
| 196 | 9163 | Alasan permohonan sita | 4 | 0 | BAS ALUR 30 HB - Sidang Insidentil 1 - Pemeriksaan Permohona | ya | f23 harta-bersama; f23 waris |  |
| 197 | 9164 | Tanggapan Tergugat/Termohon atas permohonan sita (dari jawaban atau sidang insidentil) | 4 | 0 | BAS ALUR 30 HB - Sidang Insidentil 1 - Pemeriksaan Permohona | sebagian | jawaban e-Court (dalil Tergugat tentang sita) - JJ2: diusulkan ragu; tanggapan yang hanya diucapkan di sidang insidentil diketik petugas (terisi di: jawaban-sita-hb-rekonvensi) | JJ2 18 Okt: hanya dalil yang subjeknya Tergugat dan bersikap tegas; belum diukur atas berkas sungguhan. |
| 198 | 9161 | SITA: JENIS SITA YANG DIMOHONKAN; contoh lain: sita marital | 2 | 0 | BAS ALUR 30 HB - Sidang Insidentil 1 - Pemeriksaan Permohona | ya | bawaan ABT bila dikosongkan; f23 harta-bersama; f23 waris |  |
| 199 | 9165 | Pemeriksaan setempat | 2 | 0 | BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi  | tidak | tidak ada (hasil pemeriksaan setempat) | Perkara kebendaan, sangat jarang. |
| 200 | 9166 | Pemeriksaan setempat | 2 | 0 | BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi  | tidak | tidak ada (hasil pemeriksaan setempat) |  |
| 201 | 9167 | Pemeriksaan setempat | 2 | 0 | BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi  | tidak | tidak ada (hasil pemeriksaan setempat) |  |
| 202 | 9168 | Pemeriksaan setempat | 2 | 0 | BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi  | tidak | tidak ada (hasil pemeriksaan setempat) |  |
| 203 | 9743 | Sita jaminan: objek yang dirinci (letak, luas, batas, sertifikat) dan nomor serta tanggal berita acara sita (kosong = tanpa sita) | 19 | 0 | [02] [Kabul] Hak Asuh dan Nafkah Anak - Kontradiktoir - Anak | ya | bawaan ABT bila dikosongkan |  |
| 204 | 9340 | Akad yang disengketakan (jenis akad, nomor, tanggal) | 13 | 0 | BAS ALUR 40 ES GS - [2a] Sidang 2 - T Tetap Tidak Hadir - Bu | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 205 | 9135 | Alat bukti surat wali adhal | 6 | 0 | BAS ALUR 19 Wali Adhal - [1] Sidang 1 - Pemeriksaan, Bukti S | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 206 | 0889 | Tanggal Duplikat Kutipan Akta Nikah | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | posita itsbat (duplikat akta nikah; belum ada aturan) | Jarang. |
| 207 | 1108 | Nomor duplikat surat nikah | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | posita itsbat (duplikat akta nikah; belum ada aturan) | Jarang. |
| 208 | 5032 | Harta bersama/gono-gini | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | ya | deteksi harta-bersama | Terisi dari posita sejak 2023: harta-bersama 8/8 perkara. |
| 209 | 8605 | Pernikahan resmi/tercatat para pemohon (aua) | 2 | 0 | [98] [Cabut] AUA - Setelah Pembuktian.rtf | ya | deteksi asal-usul | Terisi dari posita sejak 2023: asal-usul 8/8 perkara. |
| 210 | 8607 | Fakta tambahan keterangan saksi (aua) | 2 | 0 | [98] [Cabut] AUA - Setelah Pembuktian.rtf | ya | deteksi asal-usul |  |
| 211 | 9110 | Pengadilan tinggi tempat advokat Tergugat/Termohon disumpah | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | ya | bawaan ABT bila dikosongkan | Tergugat berkuasa ±1% perkara; bawaan layar: Pengadilan Tinggi Sulawesi Tengah. |
| 212 | 9282 | Harta bersama | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 213 | 9283 | Harta bersama rekonvensi | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | sebagian | jawaban/gugatan rekonvensi e-Court - JJ2: objek dari daftar bernomor sesudah kalimat 'harta bersama berupa' di bagian rekonvensi (usulan ragu) (terisi di: jawaban-sita-hb-rekonvensi) | Harta bersama dengan rekonvensi, sangat jarang; belum diukur atas berkas sungguhan. |
| 214 | 9951 | Bukti elektronik Penggugat/Pemohon | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: bukti-daftar-ecourt) |  |
| 215 | 9952 | Bukti elektronik Tergugat/Termohon | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: bukti-daftar-ecourt) |  |
| 216 | 9460 | Nama calon istri (nama lengkap binti ...; nama calon suami diisi di kolom nama calon suami) | 14 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | gugatan e-Court pencegahan perkawinan | Jenis 342: 0 perkara sejak 2023 (2 sejak 2018); belum ada modul jenisnya. |
| 217 | 9748 | Fakta pengasuhan dan kelalaian nafkah (berpisah sejak kapan, anak diasuh siapa, tidak diberi nafkah; kosong = kalimat bawaan) | 12 | 0 | [02] [Kabul] Hak Asuh dan Nafkah Anak - Kontradiktoir - Anak | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 218 | 9749 | Kedudukan Penggugat/Pemohon bila bukan ibu atau ayah kandung anak (kosong = ibu atau ayah kandung) | 12 | 0 | [02] [Kabul] Hak Asuh dan Nafkah Anak - Kontradiktoir - Anak | ya | bawaan ABT bila dikosongkan |  |
| 219 | 9461 | Wilayah KUA tempat perkawinan akan dilangsungkan (tulis "Kecamatan ..., Kabupaten ...") | 11 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | gugatan e-Court pencegahan perkawinan | Jenis 342 sangat jarang. |
| 220 | 9462 | Kedudukan Penggugat/Pemohon terhadap calon mempelai (mis. ayah kandung calon istri, wali nikah, istri sah calon suami, Pegawai Pencatat Nikah KUA ...) | 11 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | gugatan e-Court pencegahan perkawinan | Jenis 342 sangat jarang. |
| 221 | 9463 | Alasan pencegahan perkawinan (pilih satu huruf) | 11 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 222 | 9466 | Fakta alasan pencegahan yang terbukti (uraian singkat dari bukti, saksi, dan keterangan calon mempelai) | 11 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 223 | 9468 | Pokok keterangan calon mempelai di persidangan (satu kalimat) | 11 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 224 | 9470 | Alat bukti surat Penggugat/Pemohon (daftar bukti P.1 dst.; kosong = tanpa daftar) | 11 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: bukti-daftar-ecourt) |  |
| 225 | 9488 | Alat bukti surat Penggugat/Pemohon (daftar bukti P.1 dst.; kosong = tanpa daftar) | 10 | 0 | BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: bukti-daftar-ecourt) |  |
| 226 | 9740 | Nafkah anak ke depan: jumlah setiap bulan (rupiah, angka saja; kosong = tidak dituntut) | 10 | 0 | [02] [Kabul] Hak Asuh dan Nafkah Anak - Kontradiktoir - Anak | ya | bawaan ABT bila dikosongkan |  |
| 227 | 9741 | Kenaikan nafkah anak setiap tahun (persen, angka 10 sampai 20 saja; kosong = tidak dituntut) | 10 | 0 | [02] [Kabul] Hak Asuh dan Nafkah Anak - Kontradiktoir - Anak | ya | bawaan ABT bila dikosongkan |  |
| 228 | 9742 | Biaya pendidikan dan kesehatan anak (rincian; kosong = tidak dituntut) | 10 | 0 | [02] [Kabul] Hak Asuh dan Nafkah Anak - Kontradiktoir - Anak | ya | bawaan ABT bila dikosongkan |  |
| 229 | 9744 | Dasar kemampuan Tergugat/Termohon dan standar biaya hidup minimal setempat (pekerjaan, penghasilan, UMK atau garis kemiskinan) | 10 | 0 | [02] [Kabul] Hak Asuh dan Nafkah Anak - Kontradiktoir - Anak | ya | bawaan ABT bila dikosongkan |  |
| 230 | 9745 | Pemotongan langsung dari penghasilan Tergugat/Termohon: nama instansi atau perusahaan tempat bekerja (kosong = tanpa pemotongan) | 10 | 0 | [02] [Kabul] Hak Asuh dan Nafkah Anak - Kontradiktoir - Anak | ya | bawaan ABT bila dikosongkan |  |
| 231 | 9746 | Nafkah lampau anak: jangka waktu (mis. sejak bulan ... sampai bulan ...) | 10 | 0 | [02] [Kabul] Hak Asuh dan Nafkah Anak - Kontradiktoir - Anak | ya | bawaan ABT bila dikosongkan |  |
| 232 | 9747 | Nafkah lampau anak: jumlah (rupiah dan terbilang, mis. jumlah bulan x besaran) | 10 | 0 | [02] [Kabul] Hak Asuh dan Nafkah Anak - Kontradiktoir - Anak | ya | bawaan ABT bila dikosongkan |  |
| 233 | 9341 | Jumlah kewajiban Tergugat/Termohon yang dikabulkan (rupiah, angka saja) | 7 | 0 | BAS ALUR 40 ES GS - [2a] Sidang 2 - T Tetap Tidak Hadir - Bu | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 234 | 8723 | Izin poligami | 5 | 0 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | deteksi izin-poligami | Terisi dari posita sejak 2023: izin-poligami 2/2 perkara. |
| 235 | 9492 | Alat bukti surat Penggugat/Pemohon (daftar bukti P.1 dst.: akad, jadwal angsuran, somasi, ...) | 9 | 0 | BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: bukti-daftar-ecourt) |  |
| 236 | 9592 | Tempat tinggal anak senyatanya (satu kalimat, mis. "bertempat tinggal di Desa ..."; kosong = wilayah hukum Pengadilan ini) | 9 | 0 | [01] [Kabul] Penguasaan Anak - Kontradiktoir - Anak Belum Mu | ya | bawaan ABT bila dikosongkan |  |
| 237 | 0652 | No. Surat Penolakan KUA | 3 | 0 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | tidak | berkas e-Court (lampiran surat penolakan KUA; butuh baca dokumen) | Dispensasi/wali adhal; belum dibaca OCR. |
| 238 | 0653 | Tgl. Surat Penolakan KUA | 3 | 0 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | tidak | berkas e-Court (lampiran surat penolakan KUA; butuh baca dokumen) | Dispensasi/wali adhal; belum dibaca OCR. |
| 239 | 9201 | Wali adhal | 3 | 0 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | ya | f23 wali-adhol |  |
| 240 | 9203 | Wali adhal | 3 | 0 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | ya | f23 wali-adhol |  |
| 241 | 9204 | Wali adhal | 3 | 0 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | ya | f23 wali-adhol |  |
| 242 | 9206 | Wali adhal | 3 | 0 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | ya | bawaan ABT bila dikosongkan; f23 wali-adhol |  |
| 243 | 9305 | Keadaan pengasuhan anak saat ini (boleh dikosongkan, nanti memakai kalimat bawaan) | 8 | 0 | [01] [Kabul] Hak Asuh - Kontradiktoir - Anak Belum Mumayyiz. | ya | bawaan ABT bila dikosongkan |  |
| 244 | 8722 | Izin poligami | 4 | 0 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | deteksi izin-poligami | Terisi dari posita sejak 2023: izin-poligami 2/2 perkara. |
| 245 | 9434 | Objek rekonvensi yang ditetapkan sebagai harta bersama (satu per baris; kosong = seluruh objek gugatan rekonvensi) | 1 | 0 | [01a] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonven | ya | bawaan ABT bila dikosongkan |  |
| 246 | 9709 | AUA - TEMPAT DAN TANGGAL LAHIR ANAK (isian | 1 | 0 | [01] [Kabul] AUA - Anak Sah dari Perkawinan Tercatat, Belum  | tidak | belum dikaji |  |
| 247 | 9710 | AUA - ALASAN ANAK BELUM MEMPUNYAI AKTA KELAHIRAN (isian | 1 | 0 | [01] [Kabul] AUA - Anak Sah dari Perkawinan Tercatat, Belum  | tidak | belum dikaji |  |
| 248 | 9324 | Kedudukan Penggugat/Pemohon (mis. ayah kandung Tergugat/Termohon, istri pertama, Kepala KUA; kosong = suami atau istri Tergugat/Termohon) | 7 | 0 | [01] [Kabul] Pembatalan Perkawinan - Kontradiktoir.rtf | ya | bawaan ABT bila dikosongkan |  |
| 249 | 9590 | Keadaan penguasaan anak yang sebenarnya saat ini (penguasaan faktual: siapa yang menguasai anak, sejak kapan, dan di mana; dari bukti dan saksi; kosong = kalimat bawaan) | 7 | 0 | [01] [Kabul] Penguasaan Anak - Kontradiktoir - Anak Belum Mu | ya | bawaan ABT bila dikosongkan |  |
| 250 | 9345 | Fakta wanprestasi (sejak kapan tidak membayar, somasi, sisa kewajiban) | 5 | 0 | [01] [Kabul] ES Gugatan Sederhana - Wanprestasi - P & T Hadi | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 251 | 9326 | Waktu dan tempat perkawinan (kosong = dari SIPP) | 6 | 0 | BAS ALUR 39 Pembatalan Nikah - Sidang 2 - T Tetap Tidak Hadi | ya | ABT sendiri dari SIPP bila dikosongkan |  |
| 252 | 9328 | Akta nikah (nomor, tanggal, KUA penerbit; kosong = dari SIPP) | 6 | 0 | BAS ALUR 39 Pembatalan Nikah - Sidang 2 - T Tetap Tidak Hadi | ya | ABT sendiri dari SIPP bila dikosongkan |  |
| 253 | 9475 | Pokok tuntutan wasiat (pilih satu huruf) | 6 | 0 | BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir - Pembuk | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 254 | 9478 | Bentuk dan tanggal wasiat (mis. "secara tertulis tertanggal ... di hadapan 2 (dua) orang saksi" atau "dengan akta Notaris ... Nomor ...") | 6 | 0 | BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir - Pembuk | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 255 | 9479 | Objek wasiat (benda atau manfaat yang diwasiatkan: objek, bukti hak, luas, letak, dan batas-batas) | 6 | 0 | BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir - Pembuk | tidak | gugatan e-Court wasiat | Jenis 365: 1 perkara sejak 2023. |
| 256 | 9480 | Penerima wasiat (nama atau sebutan; kosong = otomatis) | 6 | 0 | BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir - Pembuk | ya | bawaan ABT bila dikosongkan |  |
| 257 | 9486 | Kedudukan Penggugat/Pemohon (mis. ahli waris dari pewasiat, penerima wasiat, anak angkat pewasiat) | 6 | 0 | [01] [Kabul] Wasiat - Kontradiktoir.rtf | tidak | gugatan e-Court wasiat |  |
| 258 | 9487 | Kedudukan Tergugat/Termohon (mis. penerima wasiat, ahli waris lain yang menguasai objek wasiat) | 6 | 0 | [01] [Kabul] Wasiat - Kontradiktoir.rtf | tidak | gugatan e-Court wasiat |  |
| 259 | 9489 | Alat bukti surat Tergugat/Termohon (daftar bukti T.1 dst.; kosong = tanpa daftar) | 6 | 0 | BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: bukti-daftar-ecourt) |  |
| 260 | 9720 | Apakah gugatan meminta Tergugat/Termohon menyerahkan anak? | 6 | 0 | BAS ALUR 44 Penguasaan Anak - Sidang 2 - T Tetap Tidak Hadir | ya | bawaan ABT bila dikosongkan; deteksi hadhanah |  |
| 261 | 8724 | Izin poligami | 3 | 0 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | deteksi izin-poligami | Terisi dari posita sejak 2023: izin-poligami 2/2 perkara. |
| 262 | 9310 | Pertimbangan penolakan hak asuh | 5 | 0 | [03] [Tolak] Hak Asuh - Kontradiktoir - Kepentingan Terbaik  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 263 | 9320 | Alasan pembatalan perkawinan | 5 | 0 | [01] [Kabul] Pembatalan Perkawinan - Kontradiktoir.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 264 | 9493 | Alat bukti surat Tergugat/Termohon (daftar bukti T.1 dst.) | 5 | 0 | BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: bukti-daftar-ecourt) |  |
| 265 | 9750 | Alasan petitum ditolak (untuk putusan dikabulkan sebagian atau ditolak; kosong = kalimat bawaan) | 5 | 0 | [02] [Kabul Sebagian] Nafkah Anak - Kontradiktoir - Petitum  | tidak | belum dikaji |  |
| 266 | 9346 | Pertimbangan penolakan gugatan | 3 | 0 | [03] [Tolak] ES Gugatan Sederhana - Wanprestasi Tidak Terbuk | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 267 | 8725 | Izin poligami | 2 | 0 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | deteksi izin-poligami | Terisi dari posita sejak 2023: izin-poligami 2/2 perkara. |
| 268 | 8726 | Izin poligami | 2 | 0 | [01] [Kabul] Izin Poligami.rtf | ya | deteksi izin-poligami |  |
| 269 | 9352 | Isi kesepakatan perdamaian di hadapan hakim (pasal demi pasal) | 2 | 0 | BAS ALUR 40 ES GS - [1a] Sidang 1 - P & T Hadir - Damai Berh | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 270 | 9353 | Tanggal kesepakatan perdamaian | 2 | 0 | BAS ALUR 40 ES GS - [1a] Sidang 1 - P & T Hadir - Damai Berh | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 271 | 9354 | Pihak yang menanggung biaya perkara menurut kesepakatan | 2 | 0 | BAS ALUR 40 ES GS - [1a] Sidang 1 - P & T Hadir - Damai Berh | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 272 | 9355 | Pokok jawaban Tergugat/Termohon (satu kalimat) | 2 | 0 | [01] [Kabul] ES Gugatan Sederhana - Wanprestasi - P & T Hadi | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: jawab-menjawab-ecourt) |  |
| 273 | 9329 | Fakta alasan pembatalan yang terbukti di persidangan | 3 | 0 | [01] [Kabul] Pembatalan Perkawinan - Kontradiktoir.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 274 | 9482 | Fakta pokok tuntutan yang terbukti (uraian singkat dari bukti dan saksi) | 3 | 0 | [01] [Kabul] Wasiat - Kontradiktoir.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 275 | 9207 | Wali adhal | 1 | 0 | [01a] [Kabul] Wali Adhal - Wali Hadir Tetap Enggan.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 276 | 9208 | Wali adhal (tolak) | 1 | 0 | [03] [Tolak] Wali Adhal - Keengganan Wali Beralasan Hukum.rt | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 277 | 0303 | Tanggal pengumuman | 2 | 416 | [JS] 9.1. Pengumuman Permohonan Itsbat Nikah (2 Pemohon).rtf | sebagian | tidak ada tanggal pasti di SIPP; usulan ragu = tanggal pendaftaran (terisi di: sipp-lanjutan-ragu) | 409 isian petugas (voluntair dan kontensius): 186 persis sama (45%), 92% jatuh 0-1 hari dari tanggal pendaftaran; juru sita memilih hari pengumuman. |
| 278 | 9307 | Pilihan anak yang sudah mumayyiz di persidangan | 2 | 0 | [01c] [Kabul] Hak Asuh - Kontradiktoir - Anak Mumayyiz Memil | ya | bawaan ABT bila dikosongkan |  |
| 279 | 9309 | Mengapa pemegang hak asuh tidak dapat menjamin keselamatan anak | 2 | 0 | [01d] [Kabul] Hak Asuh - Kontradiktoir - Pemegang Hadhanah T | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 280 | 9330 | Pertimbangan penolakan pembatalan perkawinan | 2 | 0 | [03] [Tolak] Pembatalan Perkawinan - Kontradiktoir - Alasan  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 281 | 9483 | Pertimbangan mengapa dalil gugatan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak) | 2 | 0 | [03] [Tolak] Wasiat - Kontradiktoir - Dalil Tidak Terbukti.r | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 282 | 9726 | Alasan sebagian petitum ditolak (untuk putusan dikabulkan sebagian; kosong = kalimat bawaan) | 2 | 0 | [02] [Kabul Sebagian] Penguasaan Anak - Kontradiktoir - Peti | ya | bawaan ABT bila dikosongkan |  |
| 283 | 1152 | Alasan poligami | 1 | 0 | [01] [Kabul] Izin Poligami.rtf | ya | deteksi izin-poligami | Terisi dari posita sejak 2023: izin-poligami 2/2 perkara. |
| 284 | 8720 | Izin poligami | 1 | 0 | [01] [Kabul] Izin Poligami.rtf | ya | deteksi izin-poligami |  |
| 285 | 9170 | Izin poligami | 1 | 0 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | bawaan ABT bila dikosongkan |  |
| 286 | 9171 | Izin poligami | 1 | 0 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 287 | 1081 | Tgl. PHS Baru Ikrar Talak | 1 | 1 | @ 3b - PHS Ikrar Talak Lanjutan.rtf | tidak | SIPP perkara_ikrar_talak (tanggal PHS baru) | Hanya 1 blangko. |
| 288 | 1154 | Nomor surat permintaan bantuan panggilan | 1 | 0 | [JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf | tidak | ALETA/SIPP bantuan panggilan | Hanya 1 blangko. |
| 289 | 1232 | Tanggal surat | 1 | 0 | [JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf | tidak | ALETA/SIPP bantuan panggilan | Hanya 1 blangko. |
| 290 | 5230 | Ongkos panggilan permintaan bantuan | 1 | 0 | [JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf | tidak | ALETA Kasir (ongkos panggilan) | Hanya 1 blangko. |
| 291 | 9432 | Fakta pengasuhan anak oleh Tergugat/Termohon (dari bukti dan saksi; kosong = kalimat bawaan) | 1 | 0 | [03a] [Tolak] Hak Asuh - Kontradiktoir - Hadhanah Ditetapkan | ya | bawaan ABT bila dikosongkan |  |
| 292 | 9467 | Pertimbangan mengapa alasan pencegahan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak) | 1 | 0 | [03] [Tolak] Pencegahan Perkawinan - Alasan Pencegahan Tidak | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 293 | 9469 | Waktu dan tempat perkawinan yang ternyata sudah dilangsungkan | 1 | 0 | [99b] [NO] Pencegahan Perkawinan - Perkawinan Telah Dilangsu | tidak | tidak ada (fakta persidangan) | Jenis 342 sangat jarang. |
| 294 | 9485 | Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak (untuk putusan tidak dapat diterima karena kurang pihak) | 1 | 0 | [99a] [NO] Wasiat - Kurang Pihak (Plurium Litis Consortium). | tidak | tidak ada (penilaian hakim) |  |
| 295 | 9490 | Klausula arbitrase dalam akad (pasal akad dan lembaga arbitrase yang dipilih) | 1 | 0 | [99a] [NO] ES Acara Biasa - Eksepsi Klausula Arbitrase Dikab | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 296 | 9491 | Pokok eksepsi Tergugat/Termohon (satu kalimat) | 1 | 0 | [99a] [NO] ES Acara Biasa - Eksepsi Klausula Arbitrase Dikab | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: jawab-menjawab-ecourt) |  |

## Penanda tak dikenal (bukan isian popup)

3121(574), 3122(564), 3123(564), 3124(564), 3125(564), 3127(564), 3128(564), 3129(564), 3131(10), 3510(21), 3511(21), 3512(21), 3513(21), 3514(21), 3515(21), 5078(405), 5079(405), 5080(405), 5081(405), 5082(405), 5083(405), 5084(405), 5085(405), 5086(405), 5087(405), 5088(405), 5089(405), 5090(405), 5091(405), 5092(405), 5093(405), 5094(405), 5095(405), 5096(405), 5097(405), 5098(405), 5099(395), 5102(395), 5103(395), 5104(395), 5106(395), 5107(395), 5117(395), 7064(574), 9650(6), 9651(6), 9652(6), 9653(5), 9654(6), 0243(561), 03517(21)
