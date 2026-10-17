# Daftar cek isian popup blangko Derry (Isi dari SIPP & input ke ABT)

Dibangun 2026-10-18 oleh `scripts/isi-sipp-abt/bangun-daftar-cek.cjs` (data diukur, bukan ditebak). Berkas mesin: `DAFTAR-CEK.json` (dipakai uji penjaga).

## Ringkasan

- Blangko Derry aktif di pohon server: **982** (31 tanpa isian popup).
- Isian popup (data_teks / data_tanggal / tanya_jawab, kata ABT "isian tangan"): **252** unik.
- Sudah otomatis (ya): **143** - sebagian: **16** - belum (tidak): **93**, di antaranya **44** memang tanpa sumber data (penilaian hakim / tidak tercatat).
- Penanda yang dirujuk rantai variabel tetapi tidak ada di katalog ABT lokal: 53 (lihat bawah).

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
- Isi RTF: RTF terbaru dari arsip lokal (paket batch-14okt-sore, server-asal, XAMPP). Katalog variabel: aps_badilag_i18 (1628 variabel). Frekuensi: sipp_donggala perkara terdaftar sejak 2023-01-01 (3267 perkara).
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

- Blangko yang seluruh isian popupnya sudah otomatis (ya): **202** dari 951 yang punya isian popup.
- Blangko yang masih punya sekurang-kurangnya satu isian manual TANPA syarat keadaan (bukan kuasa/prodeo/ghaib/insidentil/alasan C-H): **196**. 25 terbanyak (sebagian besar isian manual itu keputusan/penilaian hakim atau kesepakatan para pihak):

| blangko | ya | sebagian | tidak (semua) | tidak tanpa syarat keadaan | opsional |
| --- | ---: | ---: | ---: | ---: | ---: |
| 4c Wasiat/[01] [Kabul] Wasiat - Kontradiktoir.rtf | 16 | 2 | 12 | 10 | 0 |
| 4c Wasiat/[03] [Tolak] Wasiat - Kontradiktoir - Dalil Tidak Terbukti.rtf | 16 | 2 | 12 | 10 | 0 |
| 1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[02b] [Kabul] Putusan CG Kumulasi Hak Asuh dan Nafkah Anak - Kon | 23 | 3 | 11 | 9 | 0 |
| 1 Perceraian CG/[02b] [Kabul] CG - F - Mediasi Berhasil Sebagian (Kesepakatan Dimuat dalam Amar).rtf | 24 | 2 | 10 | 8 | 0 |
| 1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).rtf | 25 | 7 | 9 | 8 | 0 |
| 1a Perceraian CT/[02b] [Kabul] CT - F - Mediasi Berhasil Sebagian (Kesepakatan Dimuat dalam Amar).rtf | 24 | 2 | 10 | 8 | 0 |
| 4c Wasiat/[01a] [Kabul] Wasiat - T Tidak Hadir Setelah Mediasi.rtf | 14 | 2 | 10 | 8 | 0 |
| 4c Wasiat/[01b] [Kabul Verstek] Wasiat.rtf | 14 | 2 | 10 | 8 | 0 |
| 4c Wasiat/[03b] [Tolak Verstek] Wasiat - Dalil Tidak Terbukti.rtf | 14 | 2 | 10 | 8 | 0 |
| 5b Pencegahan Perkawinan/[03] [Tolak] Pencegahan Perkawinan - Alasan Pencegahan Tidak Terbukti.rtf | 8 | 1 | 9 | 8 | 0 |
| 5b Pencegahan Perkawinan/[99b] [NO] Pencegahan Perkawinan - Perkawinan Telah Dilangsungkan.rtf | 8 | 1 | 9 | 8 | 0 |
| 1 Perceraian CG/[02] [Kabul] CG - F.rtf | 22 | 2 | 9 | 7 | 0 |
| 1 Perceraian CG/[98] [NO] 8. Cerai P & T Hadir - Kontradiktoir - Cacat Formil Gugatan.rtf | 20 | 2 | 9 | 7 | 0 |
| 1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[02] [Kabul] Putusan CG Kumulasi Hak Asuh Anak - Kontradiktoir.r | 23 | 2 | 9 | 7 | 0 |
| 1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[99b] [NO] Putusan CG Kumulasi Hak Asuh Anak - Kontradiktoir - C | 20 | 2 | 9 | 7 | 0 |
| 1a Perceraian CT/[02] [Kabul] CT - F.rtf | 22 | 2 | 9 | 7 | 0 |
| 1a Perceraian CT/[98] [NO] 8. Cerai P & T Hadir - Kontradiktoir - Cacat Formil Permohonan.rtf | 20 | 2 | 9 | 7 | 0 |
| 1c Perceraian Kumulasi Itsbat Nikah/[02] [Kabul] Putusan CG Kumulasi Itsbat Nikah - Kontradiktoir.rtf | 31 | 4 | 9 | 7 | 0 |
| 1c Perceraian Kumulasi Itsbat Nikah/[02] [Kabul] Putusan CT Kumulasi Itsbat Nikah - Kontradiktoir.rtf | 31 | 4 | 9 | 7 | 0 |
| 1c Perceraian Kumulasi Itsbat Nikah/[99b] [NO] Putusan CG Kumulasi Itsbat Nikah - Kontradiktoir - Cacat Formil | 20 | 2 | 9 | 7 | 0 |
| 1c Perceraian Kumulasi Itsbat Nikah/[99b] [NO] Putusan CT Kumulasi Itsbat Nikah - Kontradiktoir - Cacat Formil | 20 | 2 | 9 | 7 | 0 |
| 10a Ekonomi Syariah Biasa/[01] [Kabul] ES Acara Biasa - Wanprestasi - Kontradiktoir.rtf | 15 | 2 | 9 | 7 | 0 |
| 4c Wasiat/[99a] [NO] Wasiat - Kurang Pihak (Plurium Litis Consortium).rtf | 13 | 2 | 9 | 7 | 0 |
| 5b Pencegahan Perkawinan - BAS/BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti & 2 Saksi, Penetapa | 8 | 1 | 7 | 7 | 0 |
| 5b Pencegahan Perkawinan - BAS/BAS ALUR 41 Pencegahan - [1a] Sidang 1 - Calon Hadir - Bukti & 2 Saksi, Tunda P | 8 | 1 | 7 | 7 | 0 |

## Temuan gerbang tombol (diperiksa 18 Okt)

Pengisi di bot tidak berguna bila tombolnya tidak muncul di blangko itu. `scripts/isi-sipp-abt/gerbang-tombol.cjs` membaca cermin gerbang langsung dari `ekstensi-sipp/abt.js` dan memeriksa tiap blangko x isian berpengisi posita: untuk jenis utama (cerai, itsbat, dispensasi kawin, ahli waris, perwalian) tombolnya selalu terpicu. Celah yang tersisa kecil: BAS sita insidentil harta bersama/kewarisan (9161-9163), pencegahan perkawinan (1029, tanpa modul jenisnya), dan blangko cerai kumulasi cacat formil ([99b]) yang memang tidak memerlukan fakta.

## Tabel per isian (urut bobot)

| # | nomor | nama | jml blangko | diketik petugas (perkara sejak 2023) | contoh blangko | otomatis? | sumber / pengisi | catatan |
| ---: | --- | --- | ---: | ---: | --- | --- | --- | --- |
| 1 | 8537 | Nama advokat Penggugat/Pemohon | 856 | 0 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ABT sendiri dari SIPP bila dikosongkan; kuasa-penggugat |  |
| 2 | 0132 | Tanggal register surat kuasa Penggugat/Pemohon di kepaniteraan | 490 | 13 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ABT sendiri dari SIPP bila dikosongkan; kuasa-penggugat; deteksi cerai |  |
| 3 | 0184 | Tanggal surat kuasa Penggugat/Pemohon | 490 | 25 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | kuasa-penggugat; deteksi cerai |  |
| 4 | 8538 | Alamat kantor advokat Penggugat/Pemohon | 490 | 0 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | kuasa-penggugat |  |
| 5 | 8539 | Nomor register surat kuasa Penggugat/Pemohon | 490 | 0 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ABT sendiri dari SIPP bila dikosongkan; kuasa-penggugat |  |
| 6 | 8548 | Alamat Putusan Penggugat/Pemohon | 487 | 0 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ABT sendiri dari SIPP bila dikosongkan; alamat-putusan |  |
| 7 | 0185 | Tanggal surat kuasa Tergugat/Termohon | 345 | 1 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | sebagian | SIPP perkara_pengacara.tanggal_kuasa pihak 2 (usulan ragu) / e-Court lampiran surat kuasa (terisi di: sipp-lanjutan-ragu) | Kolom SIPP sering tanggal register, bukan tanggal surat kuasa; Tergugat berkuasa ±1% perkara (34 dari 3267 sejak 2023). |
| 8 | 8549 | Alamat Putusan Tergugat/Termohon | 338 | 0 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | ya | ABT sendiri dari SIPP bila dikosongkan; alamat-putusan |  |
| 9 | 8503 | Alasan perceraian | 123 | 359 | [01b] (E-Court) BAS 2 P Hadir & T Tidak Hadir Pokok Perkara  | ya | deteksi cerai |  |
| 10 | 5058, 2021 | TanyaJwb Saksi 1 P [tanya jawab saksi 1 p] | 259 | 0 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | susun saksi |  |
| 11 | 5059, 2022 | TanyaJwb Saksi 2 P [tanya jawab saksi 2 p] | 259 | 0 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | susun saksi |  |
| 12 | 8894 | Nama penerima kuasa insidentil | 276 | 0 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | SIPP perkara_jadwal_sidang.keterangan / penetapan izin kuasa insidentil (tidak terstruktur) | Kuasa insidentil tidak punya kolom sendiri di SIPP; ±jarang. |
| 13 | 1214 | Alat bukti surat Penggugat/Pemohon | 90 | 2009 | [01b] (E-Court) BAS 2 P Hadir & T Tidak Hadir Pokok Perkara  | ya | ktp-teks; deteksi cerai |  |
| 14 | 0663 | Tanggal penetapan prodeo | 189 | 3 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | tidak ada | Tanggal penetapan prodeo tidak disimpan SIPP (hasil putusan sela/pertimbangan hakim). |
| 15 | 7084 | Penanda konvensi/rekonvensi (1 apabila ada) | 168 | 3 | [02] BAS 3 P & T Hadir Jawaban dan (Apabila ada Gugatan Reko | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: gugatan-ecourt) |  |
| 16 | 7139 | Beracara secara elektronik | 204 | 30 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | ya | elitigasi |  |
| 17 | 0156 | Nama kantor advokat Penggugat/Pemohon | 126 | 44 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | ya | kuasa-penggugat; deteksi cerai |  |
| 18 | 5197 | Tgl Nikah | 104 | 706 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | terisi di jenis utama; belum di: 4a Harta Bersama (terisi di: deteksi itsbat-nikah; deteksi perwalian; deteksi waris; deteksi lain-lain) | Pada blangko cerai isian ini hanya terbaca lewat variabel 7184 (kumulasi itsbat, bersyarat jenis perkara 360); pada cerai biasa tidak tercetak. Terukur atas isian petugas: itsbat 232/296 benar; asal-usul 1/2 benar. |
| 19 | 5178 | KUA Kec. | 97 | 298 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah; deteksi dispensasi-kawin; deteksi perwalian | Pada blangko cerai isian ini hanya terbaca lewat variabel 7184 (kumulasi itsbat, bersyarat jenis perkara 360); pada cerai biasa tidak tercetak. Terukur atas isian petugas: itsbat 260/269 benar; dispensasi-kawin 6/7 benar. |
| 20 | 8892 | Pengadilan Tinggi tempat advokat Penggugat/Pemohon disumpah | 141 | 0 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | ya | bawaan ABT bila dikosongkan | Bawaan layar Perlu diisi: Pengadilan Tinggi Sulawesi Tengah; ABT mengisi bila dikosongkan pada sebagian blangko. |
| 21 | 9955 | Bukti surat perceraian (otomatis) | 132 | 53 | [02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan | ya | ABT sendiri dari SIPP bila dikosongkan; ktp-teks |  |
| 22 | 1268 | Upaya damai oleh keluarga | 64 | 370 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 23 | 0222 | Awal perselisihan | 63 | 364 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 24 | 9944 | Lama pisah rumah | 63 | 373 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 25 | 8921, 6122 | TanyaJwb Saksi 3 T [tanya jawab saksi 3 t] | 57 | 0 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 26 | 0157 | Nama kantor advokat Tergugat/Termohon | 94 | 0 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | tidak | e-Court (surat kuasa/jawaban Tergugat) | Nama kantor advokat tidak disimpan SIPP; Tergugat berkuasa ±1% perkara. |
| 27 | 7035 | Yang meninggalkan rumah bersama | 59 | 374 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 28 | 6124, 8920 | TanyaJwb Saksi 4 P [tanya jawab saksi 4 p] | 58 | 0 | [02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 29 | 0246 | Pisah rumah sejak | 55 | 359 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | ya | deteksi cerai |  |
| 30 | 0007 | Anak dari pernikahan ini | 64 | 681 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | gugatan-ecourt; deteksi itsbat-nikah; deteksi cerai; deteksi perwalian | Terukur atas isian petugas: itsbat 511/560 benar. |
| 31 | 5227 | Rincian alasan cerai (sesuai gugatan) | 50 | 319 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | ya | gugatan-ecourt; deteksi cerai |  |
| 32 | 9911 | Alat bukti surat Tergugat/Termohon | 85 | 12 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | ktp-teks |  |
| 33 | 1006 | Tempat tinggal setelah menikah | 39 | 34 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 34 | 5127 | Alasan-Alasan Cerai | 31 | 25 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 35 | 1267 | Masih berkomunikasi atau tidak | 30 | 17 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 36 | 2557 | (Saksi I) Berapa Kali Melihat dan Mendengar Pertengkaran | 30 | 15 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | tidak | keterangan saksi pada BAS (teks bebas) | Registri cerai: belum - tidak tertulis di posita. |
| 37 | 5060, 2031 | TanyaJwb Saksi 3 P [tanya jawab saksi 3 p] | 57 | 0 | [02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 38 | 5105 | Alamat Tempat Menikah | 65 | 711 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah; deteksi cerai; deteksi perwalian; deteksi lain-lain | Terukur atas isian petugas: itsbat 627/675 benar. |
| 39 | 2558 | (Saksi II) Berapa Kali Melihat dan Mendengar Pertengkaran | 29 | 13 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | tidak | keterangan saksi pada BAS (teks bebas) | Registri cerai: belum - tidak tertulis di posita. |
| 40 | 8564 | Tanggal pengumuman panggilan ghaib pertama dan kedua | 42 | 0 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | ya | ABT sendiri dari SIPP bila dikosongkan | Tanggal pengumuman ghaib pertama dan kedua. |
| 41 | 0227 | Tanggal Tergugat/Termohon berpindah agama | 35 | 1 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | tidak ada | Tanggal Tergugat berpindah agama/fasakh: SIPP tidak punya kolomnya. |
| 42 | 0661 | Nomor penetapan prodeo | 35 | 3 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | tidak ada | Nomor SK prodeo tidak disimpan SIPP; ecourt_prodeo tidak memuat nomor penetapan. Terbukti di kode (abtUsulanService tidak_ada_sumber). |
| 43 | 8536 | Putusan pidana Tergugat/Termohon (nomor, tanggal, lama hukuman) | 35 | 0 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | tidak ada (putusan pidana Tergugat diketahui dari bukti surat) | Alasan C; ±jarang. |
| 44 | 8931, 8932 | TanyaJwb Saksi 5 P [tanya jawab saksi 5 p] | 29 | 0 | [02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 45 | 6120, 2023 | TanyaJwb Saksi 1 T [tanya jawab saksi 1 t] | 73 | 0 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 46 | 6121, 2024 | TanyaJwb Saksi 2 T [tanya jawab saksi 2 t] | 73 | 0 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 47 | 8436 | Kesimpulan Penggugat/Pemohon | 77 | 13 | [02] [Kabul] CG - F.rtf | tidak | berkas e-Court (kesimpulan Penggugat) | Registri cerai: belum. |
| 48 | 7178 | Alasan panggilan dianggap tidak patut | 21 | 4 | [99] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas Atau | tidak | relaas panggilan (ALETA relaas) - penilaian hakim |  |
| 49 | 9881 | lisan atau tertulis (jawaban replik dan duplik) | 82 | 15 | [02] [Kabul] CG - F.rtf | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: gugatan-ecourt) |  |
| 50 | 8603 | Nama anak yang dimohonkan | 31 | 0 | BAS KUMULASI [2] BAS Putus Verstek CG Kumulasi Hak Asuh Anak | ya | deteksi hadhanah; deteksi asal-usul; deteksi pengangkatan-anak; deteksi lain-lain |  |
| 51 | 6112, 2018 | Jawaban Lisan Tergugat/Termohon [tanya jawab jawaban lisan 0047] | 27 | 0 | BAS ALUR 05 [2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Ja | tidak | tidak ada (jawab-jinawab lisan di persidangan; diketik panitera) | Cerai kontra lisan; tidak ada kolom terstruktur di SIPP. |
| 52 | 6114, 2020 | Duplik Lisan Tergugat/Termohon [tanya jawab duplik lisan 0047] | 26 | 0 | BAS ALUR 05 [2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Ja | tidak | tidak ada (jawab-jinawab lisan di persidangan; diketik panitera) |  |
| 53 | 6113, 2019 | Replik Lisan Penggugat/Pemohon [tanya jawab replik lisan 0046] | 26 | 0 | BAS ALUR 05 [2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Ja | tidak | tidak ada (jawab-jinawab lisan di persidangan; diketik panitera) |  |
| 54 | 8437 | Kesimpulan Tergugat/Termohon | 48 | 3 | [02] [Kabul] CG - F.rtf | tidak | berkas e-Court (kesimpulan Tergugat) | Registri cerai: belum. |
| 55 | 8433 | Alasan pencabutan perkara | 66 | 41 | BAS ALUR 08 [A] BAS 1 P Hadir & T Tidak Hadir - Cabut di Sid | sebagian | hakim mengetik (usulan hanya bila mediasi Y2) (terisi di: sipp-mediasi-cabut) | Sejak 2023: 41 isian petugas, hanya 4 berasal dari mediasi Y2; alasan lain (perbaikan gugatan, alamat tidak ditemukan) bebas. |
| 56 | 1046 | Status Wali Nikah | 39 | 701 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah; deteksi wali-adhol | Terukur atas isian petugas: itsbat 614/631 benar. |
| 57 | 0650 | Saksi Nikah 1 | 33 | 696 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 509/569 benar; asal-usul 2/2 benar. |
| 58 | 0651 | Saksi Nikah 2 | 33 | 697 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 476/543 benar; asal-usul 2/2 benar. |
| 59 | 1001 | Mas kawin | 33 | 697 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 285/643 benar; asal-usul 2/2 benar. |
| 60 | 1217 | Nama Wali Nikah | 33 | 678 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | bawaan ABT bila dikosongkan; deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 578/637 benar; asal-usul 2/2 benar. |
| 61 | 8087 | Yang Menikahkan | 33 | 696 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 266/517 benar; asal-usul 2/2 benar. |
| 62 | 9958 | C3. Alat Bukti Isbat Nikah Terpadu | 25 | 188 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ktp-teks; deteksi itsbat-nikah |  |
| 63 | 5271 | Penghasilan Tergugat/Termohon Perbulan | 6 | 0 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | tidak | berkas e-Court (gugatan: penghasilan) |  |
| 64 | 6071 | Nafkah Anak | 6 | 5 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: gugatan-ecourt) |  |
| 65 | 9050 | Kenaikan nafkah anak per tahun | 5 | 0 | BAS KUMULASI [2b] BAS Putus Verstek CG Kumulasi Hak Asuh Ana | tidak | berkas e-Court (petitum kenaikan nafkah anak) |  |
| 66 | 7211 | Umur Isbat P1 (Laki-Laki) | 19 | 277 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 183/230 benar. |
| 67 | 7212 | Umur Isbat P2 (Perempuan) | 19 | 277 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 180/231 benar. |
| 68 | 1002 | Status Penggugat/Pemohon sblm nikah (IN) | 29 | 699 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | terisi di jenis utama; belum di: 7 Wali Adhal (terisi di: deteksi itsbat-nikah) | Terukur atas isian petugas: itsbat 655/670 benar. |
| 69 | 1003 | Status #2027# sblm nikah (IN) | 26 | 699 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | deteksi itsbat-nikah | Terukur atas isian petugas: itsbat 654/670 benar. |
| 70 | 8941 | TanyaJwb Saksi 4 T [tanya jawab saksi 4 t] | 13 | 0 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 71 | 9134 | Bas permohonan | 38 | 0 | BAS ALUR 17 IN 2+ Sidang - [1a] Sidang 1 - Pemeriksaan, Bukt | tidak | opsional: bila dikosongkan ABT mencetak titik-titik/bawaan; isi hanya bila hakim ingin | belum dikaji |
| 72 | 0364 | Tgl. KTP Penggugat/Pemohon | 11 | 267 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ktp-tanggal; deteksi itsbat-nikah |  |
| 73 | 0366 | Tgl. KTP Penggugat/Pemohon II | 11 | 263 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ktp-tanggal; deteksi itsbat-nikah |  |
| 74 | 8171 | Alasan Permohonan untuk | 21 | 456 | BAS ALUR 17 IN 2+ Sidang - [1a] Sidang 1 - Pemeriksaan, Bukt | ya | deteksi itsbat-nikah; deteksi perwalian; deteksi lain-lain | Terukur atas isian petugas: perwalian 0/5 benar. |
| 75 | 8712 | Nomor dan tanggal surat teguran panitera | 21 | 0 | [98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar H | tidak | opsional: bila dikosongkan ABT mencetak titik-titik/bawaan; isi hanya bila hakim ingin | ALETA Kasir (teguran panjar) - belum dicatat terstruktur |
| 76 | 8713 | Batas waktu menambah panjar | 21 | 0 | [98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar H | tidak | opsional: bila dikosongkan ABT mencetak titik-titik/bawaan; isi hanya bila hakim ingin | ALETA Kasir (teguran panjar) - belum dicatat terstruktur |
| 77 | 8714 | Nomor dan tanggal laporan panjar tidak ditambah | 21 | 0 | [98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar H | tidak | opsional: bila dikosongkan ABT mencetak titik-titik/bawaan; isi hanya bila hakim ingin | ALETA Kasir (laporan panjar) - belum dicatat terstruktur |
| 78 | 8729 | Penilaian keterangan saksi dan fakta yang tidak terbukti | 6 | 0 | [03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 79 | 0182 | Tanggal izin kuasa insidentil | 4 | 0 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | tidak | tidak ada terstruktur (penetapan izin Ketua) |  |
| 80 | 8895 | Hubungan penerima kuasa dengan Penggugat/Pemohon | 4 | 0 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | tidak | tidak ada terstruktur (penetapan izin Ketua) | Hubungan penerima kuasa dengan pemberi kuasa. |
| 81 | 8896 | Nomor izin Ketua Pengadilan | 4 | 0 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | tidak | tidak ada terstruktur (penetapan izin Ketua) | Nomor izin Ketua Pengadilan. |
| 82 | 9123 | Sebab kuasa insidentil tidak sah (huruf a sampai d) | 4 | 0 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | ya | bawaan ABT bila dikosongkan |  |
| 83 | 5171 | Penghasilan Penggugat/Pemohon Perbulan | 10 | 3 | [01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - | tidak | berkas e-Court (gugatan: penghasilan) |  |
| 84 | 6054 | Nafkah iddah | 10 | 8 | [01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - | ya | gugatan-ecourt; deteksi cerai |  |
| 85 | 6055 | Mut'ah | 10 | 7 | [01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: gugatan-ecourt) |  |
| 86 | 8899 | Pokok kesepakatan perdamaian sebagian | 3 | 0 | [02b] [Kabul] CG - F - Mediasi Berhasil Sebagian (Kesepakata | ya | sipp-mediasi-sebagian |  |
| 87 | 8902 | Isi pasal kesepakatan perdamaian sebagian | 3 | 0 | [02b] [Kabul] CG - F - Mediasi Berhasil Sebagian (Kesepakata | ya | bawaan ABT bila dikosongkan |  |
| 88 | 0228 | Alasan Syahadah Istifadhah (Itsbat Nikah / Isbat / PAW) | 4 | 3 | [01ab] BAS 1 IN - Kabul Syahadah Istifadhah.rtf | ya | deteksi itsbat-nikah |  |
| 89 | 9501 | Penilaian jawaban dan bukti Tergugat/Termohon (bantahan apa yang didukung bukti atau saksi, dan mengapa melemahkan dalil Penggugat/Pemohon; kosong = titik-titik) | 4 | 0 | [03a] [Tolak] Cerai - Kontradiktoir (T Hadir Jawab-Menjawab) | tidak | opsional: bila dikosongkan ABT mencetak titik-titik/bawaan; isi hanya bila hakim ingin |  |
| 90 | 8901 | Amar kesepakatan perdamaian sebagian (satu butir per baris) | 2 | 0 | [02b] [Kabul] CG - F - Mediasi Berhasil Sebagian (Kesepakata | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 91 | 9120 | Panggilan ulang karena kuasa insidentil tidak sah | 2 | 0 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | ya | bawaan ABT bila dikosongkan |  |
| 92 | 9125 | Keadaan kuasa insidentil tidak sah | 2 | 0 | [98] [NO] 4b. Cerai P Diwakili Kuasa Insidentil Tidak Sah.rt | tidak | penilaian hakim |  |
| 93 | 1183 | Tgl. Batas Waktu Ikrar Talak | 1 | 11 | [3] BAS Ikrar Talak - P Tidak Hadir & T Hadir, Tunda Tenggan | sebagian | SIPP perkara_ikrar_talak.tanggal_sidang_pertama + 6 bulan (usulan ragu) (terisi di: sipp-lanjutan-ragu) | Cocok persis dengan 7 dari 11 isian petugas; sisanya sidang ikrar pertama diundur. |
| 94 | 1025 | Nama Almarhum / Almarhumah | 44 | 28 | BAS ALUR 35 IN Kontensius - Sidang 1 - Jawaban T Mengakui, P | ya | itsbat-pasangan-meninggal; deteksi waris; deteksi perwalian; deteksi lain-lain | Terukur atas isian petugas: perwalian 2/5 benar. |
| 95 | 1021 | Nama Istri Pertama | 2 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | deteksi itsbat-nikah |  |
| 96 | 1513 | Nama Suami Meninggal (bukti Pemohon2) | 2 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | tidak | posita/bukti (akta kematian) | Itsbat dengan suami meninggal. |
| 97 | 0600 | Nama Pria (Dispensasi) | 20 | 34 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 33/36 benar. |
| 98 | 0606 | Nama Wanita (Dispensasi) | 20 | 41 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 43/44 benar. |
| 99 | 6331 | Pekerjaan Calon Suami/Anak Para Pemohon DK / Pekerjaan Perwalian Orang Tua | 22 | 12 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | sebagian | terisi di jenis utama; belum di: 7 Wali Adhal (terisi di: deteksi dispensasi-kawin; deteksi perwalian) |  |
| 100 | 0601 | Umur Pria (dispensasi) | 17 | 23 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 10/11 benar. |
| 101 | 0607 | Umur Wanita (dispensasi) | 17 | 33 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 34/36 benar. |
| 102 | 0609 | Pendidikan Wanita (dispensasi) | 17 | 35 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 103 | 1551 | Nama Ayah Calon Suami/Istri DK | 17 | 8 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 2/7 benar. |
| 104 | 1552 | Nama Ayah Calon Suami/Istri DK | 17 | 9 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 105 | 1666 | lama pacaran (DK) | 17 | 9 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 4/8 benar. |
| 106 | 2029 | Status Anak Pria (DK) | 17 | 17 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 107 | 2030 | Status Anak Wanita (DK) | 17 | 9 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 108 | 9956 | Detektor klasifikasi bukti surat sesuai dengan jenis perkara | 17 | 8 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | ktp-teks; deteksi dispensasi-kawin |  |
| 109 | 0709 | ibu kandung/bapak kandung perkara Hadhanah | 11 | 7 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | ya | deteksi cerai; deteksi perwalian | Terukur atas isian petugas: perwalian 5/5 benar. |
| 110 | 5110 | Nama anak | 11 | 6 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | ya | gugatan-ecourt; deteksi perwalian | Terukur atas isian petugas: perwalian 1/1 benar. |
| 111 | 6072 | Nafkah anak (masing-masing anak) | 2 | 2 | [01a] [Kabul Verstek] CT - F (Ex Offiicio mutah iddah dan na | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: gugatan-ecourt) |  |
| 112 | 1321 | No. Akta Cerai P I (Bukti) | 3 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 113 | 1322 | Tgl. Akta Cerai P I (Bukti) | 3 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 114 | 1324 | Penerbit Akta Cerai P I (Bukti) | 1 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 115 | 1325 | No. Akta Cerai P II (Bukti) | 1 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 116 | 1329 | Tgl. Akta Cerai P II (Bukti) | 1 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 117 | 1331 | Penerbit Akta Cerai P II (Bukti) | 1 | 0 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 118 | 1514 | Tanggal Suami Meninggal (bukti Pemohon2) | 1 | 0 | [99aa] Pertimbangan - Cerai Mati P1 P2 Pasangan Sebelumnya.r | tidak | posita/bukti (akta kematian) |  |
| 119 | 1515 | Penyebab Suami Meninggal (bukti Pemohon2) | 1 | 0 | [99aa] Pertimbangan - Cerai Mati P1 P2 Pasangan Sebelumnya.r | tidak | posita/bukti (akta kematian) |  |
| 120 | 5015 | Tgl meninggal isteri/ibu | 1 | 0 | [99aa] Pertimbangan - Cerai Mati P1 P2 Pasangan Sebelumnya.r | ya | deteksi itsbat-nikah |  |
| 121 | 5016 | Sebab meninggal isteri/ibu | 1 | 0 | [99aa] Pertimbangan - Cerai Mati P1 P2 Pasangan Sebelumnya.r | ya | deteksi itsbat-nikah |  |
| 122 | 1246 | Tanggal meninggalnya #2026# | 21 | 18 | [01] [Kabul] IN Kontensius - Pasangan Meninggal, Ahli Waris  | ya | itsbat-pasangan-meninggal; deteksi waris |  |
| 123 | 1247 | Sebab meninggalnya #2026# | 16 | 17 | [01] [Kabul] IN Kontensius - Pasangan Meninggal, Ahli Waris  | ya | itsbat-pasangan-meninggal; deteksi waris |  |
| 124 | 1509 | Tempat Meninggal Dunia | 16 | 16 | [01] [Kabul] IN Kontensius - Pasangan Meninggal, Ahli Waris  | ya | itsbat-pasangan-meninggal; deteksi waris |  |
| 125 | 0999 | Umur Kandungan Hamil DK Perempuan | 9 | 5 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin | Terukur atas isian petugas: dispensasi-kawin 1/3 benar. |
| 126 | 8614 | Harta peninggalan pewaris | 9 | 0 | BAS ALUR 14 PAW - [1] Sidang 1 - Pemeriksaan, Bukti Surat da | ya | deteksi waris |  |
| 127 | 0712 | Bapak/Ibu yang meninggal dari anak yang di walikan Perwalian | 10 | 5 | BAS ALUR 16 Perwalian - [1] Sidang 1 - Pemeriksaan, Bukti Su | ya | deteksi perwalian | Terukur atas isian petugas: perwalian 5/5 benar. |
| 128 | 1230 | Tanggal meninggalnya suami | 10 | 4 | BAS ALUR 16 Perwalian - [1] Sidang 1 - Pemeriksaan, Bukti Su | ya | deteksi perwalian |  |
| 129 | 0711 | kalah Tergugat ibu kandung/bapak kandung perkara Hadhanah | 1 | 2 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | tidak | posita/petitum hadhanah (belum ada aturan) | Hanya 1 blangko. |
| 130 | 2004 | kini anak tersebut diasuh oleh | 1 | 3 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: gugatan-ecourt) |  |
| 131 | 7120 | Nafkah Lampau (Madhiyah / Madliyah) | 1 | 1 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | sebagian | baru diusulkan (ragu), belum terisi otomatis (terisi di: gugatan-ecourt) |  |
| 132 | 8570 | Kediaman bersama terakhir Penggugat/Pemohon dan Tergugat/Termohon sebelum berpisah | 1 | 0 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | ya | deteksi cerai |  |
| 133 | 9220 | Ikrar: keadaan Tergugat/Termohon saat ikrar | 1 | 0 | [90a] [Ikrar] Penetapan Ikrar Talak - P & T Hadir.rtf | tidak | keterangan Termohon di sidang ikrar (BAS ikrar) | Hanya 1 blangko. |
| 134 | 8132 | Alat Bukti PAW | 6 | 30 | BAS ALUR 14 PAW - [1] Sidang 1 - Pemeriksaan, Bukti Surat da | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 135 | 0349 | Tgl. Lahir Wanita (Dispensasi) | 5 | 20 | [01] [Kabul] DK - (Anak P Cewek) Hamil.rtf | ya | deteksi dispensasi-kawin |  |
| 136 | 8812 | Tanggal Ijazah | 5 | 6 | [01] [Kabul] DK - (Anak P Cewek) Hamil.rtf | ya | deteksi dispensasi-kawin |  |
| 137 | 8131 | Alat Bukti Perwalian Anak | 6 | 35 | BAS ALUR 16 Perwalian - [1] Sidang 1 - Pemeriksaan, Bukti Su | ya | deteksi perwalian |  |
| 138 | 0997 | UPT Puskesmas DK | 3 | 6 | [01] [Kabul] DK - (Anak P Cewek) Hamil.rtf | ya | deteksi dispensasi-kawin |  |
| 139 | 8706 | DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama | 14 | 0 | [97] [Perdamaian] Akta Perdamaian.rtf | sebagian | terisi di jenis utama; belum di: 4b Kewarisan; 6a Hak Asuh Anak (Hadhanah); 6b Penguasaan Anak (terisi di: deteksi harta-bersama) |  |
| 140 | 0610 | Pekerjaan Wanita (dispensasi) | 2 | 29 | [01] [Kabul] DK - (Anak P Cowok) Calon Istri Hamil.rtf | ya | deteksi dispensasi-kawin |  |
| 141 | 8616 | Pengakuan Penggugat/Pemohon atas cacat permohonan | 2 | 0 | BAS ALUR 14 PAW - [NO] Permohonan Kabur, Tetap Tidak Diperba | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 142 | 8617 | Uraian cacat formil permohonan (no obscuur) | 2 | 0 | BAS ALUR 14 PAW - [NO] Permohonan Kabur, Tetap Tidak Diperba | tidak | tidak ada (penilaian hakim atas cacat formil) |  |
| 143 | 9169 | Itsbat nikah kontensius | 2 | 0 | BAS ALUR 35 IN Kontensius - Sidang 1 - Jawaban T Mengakui, P | ya | bawaan ABT bila dikosongkan |  |
| 144 | 8704 | Isi kesepakatan perdamaian | 12 | 0 | BAS ALUR 43 ES Acara Biasa - Sidang 2 - Mediasi Berhasil - A | ya | sipp-lanjutan-pasti |  |
| 145 | 8705 | Tanggal kesepakatan perdamaian | 12 | 0 | BAS ALUR 43 ES Acara Biasa - Sidang 2 - Mediasi Berhasil - A | ya | sipp-lanjutan-pasti |  |
| 146 | 8608 | Nama ahli waris | 1 | 0 | [01] [Kabul] PAW - Ahli Waris Anak Kandung (Suami-Istri dan  | ya | deteksi waris |  |
| 147 | 8610 | Nama suami/istri pewaris | 1 | 0 | [01] [Kabul] PAW - Ahli Waris Anak Kandung (Suami-Istri dan  | ya | deteksi waris |  |
| 148 | 8613 | Kematian suami/istri pewaris | 1 | 0 | [01] [Kabul] PAW - Ahli Waris Anak Kandung (Suami-Istri dan  | ya | deteksi waris |  |
| 149 | 8618 | TEMPAT DAN TANGGAL LAHIR ANAK (pengangkatan anak) | 9 | 0 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 150 | 8619 | NAMA ORANG TUA KANDUNG ANAK (pengangkatan anak) | 9 | 0 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 151 | 8622 | STATUS PERKAWINAN Penggugat/Pemohon (pengangkatan anak) | 9 | 0 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 152 | 8623 | Hubungan Penggugat/Pemohon dengan calon anak angkat | 9 | 0 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 153 | 1029 | Nama Calon Suami | 23 | 3 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | sebagian | terisi di jenis utama; belum di: 5b Pencegahan Perkawinan; 5b Pencegahan Perkawinan - BAS (terisi di: deteksi wali-adhol) |  |
| 154 | 8730 | Harta bersama | 5 | 0 | BAS ALUR 31 HB - Sidang 2 - T Tetap Tidak Hadir - Pembuktian | ya | deteksi harta-bersama |  |
| 155 | 8717 | Kewarisan | 3 | 0 | [01] [Kabul] Kewarisan - Kontradiktur.rtf | ya | deteksi waris |  |
| 156 | 8718 | Kewarisan | 3 | 0 | [01] [Kabul] Kewarisan - Kontradiktur.rtf | ya | deteksi waris |  |
| 157 | 8719 | Kewarisan | 3 | 0 | [01] [Kabul] Kewarisan - Kontradiktur.rtf | ya | f23 waris |  |
| 158 | 9347 | Wakil atau kuasa Penggugat/Pemohon yang berbadan hukum (nama, jabatan, dasar penunjukan) | 27 | 0 | BAS ALUR 40 ES GS - [1d] Sidang 1 - T Tidak Diketahui Tempat | ya | bawaan ABT bila dikosongkan | Hanya perkara ekonomi syariah badan hukum. |
| 159 | 9348 | Wakil atau kuasa Tergugat/Termohon yang berbadan hukum (nama, jabatan, dasar penunjukan) | 27 | 0 | BAS ALUR 40 ES GS - [1d] Sidang 1 - T Tidak Diketahui Tempat | ya | bawaan ABT bila dikosongkan | Hanya perkara ekonomi syariah badan hukum. |
| 160 | 8621 | Alat bukti surat pengangkatan anak | 6 | 0 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 161 | 1014 | Eratnya Hubungan Calon | 9 | 23 | BAS ALUR 19 Wali Adhal - [1] Sidang 1 - Pemeriksaan, Bukti S | ya | deteksi wali-adhol |  |
| 162 | 1030 | Umur Calon/Suami | 9 | 3 | BAS ALUR 19 Wali Adhal - [1] Sidang 1 - Pemeriksaan, Bukti S | ya | deteksi wali-adhol |  |
| 163 | 6087 | Alasan Wali Nikah Menolak | 9 | 3 | BAS ALUR 19 Wali Adhal - [1] Sidang 1 - Pemeriksaan, Bukti S | ya | deteksi wali-adhol |  |
| 164 | 8620 | Keterangan orang tua kandung di persidangan | 5 | 0 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 165 | 9162 | Objek yang dimohonkan untuk disita (satu per baris) | 5 | 0 | BAS ALUR 30 HB - Sidang Insidentil 1 - Pemeriksaan Permohona | ya | f23 harta-bersama; f23 waris |  |
| 166 | 9163 | Alasan permohonan sita | 4 | 0 | BAS ALUR 30 HB - Sidang Insidentil 1 - Pemeriksaan Permohona | ya | f23 harta-bersama; f23 waris |  |
| 167 | 9164 | Tanggapan Tergugat/Termohon atas permohonan sita (dari jawaban atau sidang insidentil) | 4 | 0 | BAS ALUR 30 HB - Sidang Insidentil 1 - Pemeriksaan Permohona | tidak | tidak ada (tanggapan Tergugat di sidang insidentil) |  |
| 168 | 9161 | SITA: JENIS SITA YANG DIMOHONKAN; contoh lain: sita marital | 2 | 0 | BAS ALUR 30 HB - Sidang Insidentil 1 - Pemeriksaan Permohona | ya | bawaan ABT bila dikosongkan; f23 harta-bersama; f23 waris |  |
| 169 | 9165 | Pemeriksaan setempat | 2 | 0 | BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi  | tidak | tidak ada (hasil pemeriksaan setempat) | Perkara kebendaan, sangat jarang. |
| 170 | 9166 | Pemeriksaan setempat | 2 | 0 | BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi  | tidak | tidak ada (hasil pemeriksaan setempat) |  |
| 171 | 9167 | Pemeriksaan setempat | 2 | 0 | BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi  | tidak | tidak ada (hasil pemeriksaan setempat) |  |
| 172 | 9168 | Pemeriksaan setempat | 2 | 0 | BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi  | tidak | tidak ada (hasil pemeriksaan setempat) |  |
| 173 | 9303 | Identitas anak (nama, tempat dan tanggal lahir; satu anak satu baris) | 18 | 0 | BAS ALUR 38 Hak Asuh - Sidang 2 - T Tetap Tidak Hadir - Pemb | ya | bawaan ABT bila dikosongkan |  |
| 174 | 9340 | Akad yang disengketakan (jenis akad, nomor, tanggal) | 13 | 0 | BAS ALUR 40 ES GS - [2a] Sidang 2 - T Tetap Tidak Hadir - Bu | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 175 | 9135 | Alat bukti surat wali adhal | 6 | 0 | BAS ALUR 19 Wali Adhal - [1] Sidang 1 - Pemeriksaan, Bukti S | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 176 | 0378 | Bukti Surat IN | 2 | 439 | [03] [Tolak] AUA - Dalil Tidak Terbukti.rtf | ya | ktp-teks; deteksi asal-usul |  |
| 177 | 0889 | Tanggal Duplikat Kutipan Akta Nikah | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | posita itsbat (duplikat akta nikah; belum ada aturan) | Jarang. |
| 178 | 1108 | Nomor duplikat surat nikah | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | posita itsbat (duplikat akta nikah; belum ada aturan) | Jarang. |
| 179 | 5032 | Harta bersama/gono-gini | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | ya | deteksi harta-bersama |  |
| 180 | 9110 | Pengadilan tinggi tempat advokat Tergugat/Termohon disumpah | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | ya | bawaan ABT bila dikosongkan | Tergugat berkuasa ±1% perkara; bawaan layar: Pengadilan Tinggi Sulawesi Tengah. |
| 181 | 9282 | Harta bersama | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 182 | 9283 | Harta bersama rekonvensi | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | jawaban/gugatan rekonvensi e-Court | Harta bersama dengan rekonvensi, sangat jarang. |
| 183 | 9951 | Bukti elektronik Penggugat/Pemohon | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 184 | 9952 | Bukti elektronik Tergugat/Termohon | 2 | 0 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 185 | 9460 | Nama calon istri (nama lengkap binti ...; nama calon suami diisi di kolom nama calon suami) | 14 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | gugatan e-Court pencegahan perkawinan | Jenis 342: 0 perkara sejak 2023 (2 sejak 2018); belum ada modul jenisnya. |
| 186 | 9461 | Wilayah KUA tempat perkawinan akan dilangsungkan (tulis "Kecamatan ..., Kabupaten ...") | 11 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | gugatan e-Court pencegahan perkawinan | Jenis 342 sangat jarang. |
| 187 | 9462 | Kedudukan Penggugat/Pemohon terhadap calon mempelai (mis. ayah kandung calon istri, wali nikah, istri sah calon suami, Pegawai Pencatat Nikah KUA ...) | 11 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | gugatan e-Court pencegahan perkawinan | Jenis 342 sangat jarang. |
| 188 | 9463 | Alasan pencegahan perkawinan (pilih satu huruf) | 11 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 189 | 9466 | Fakta alasan pencegahan yang terbukti (uraian singkat dari bukti, saksi, dan keterangan calon mempelai) | 11 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 190 | 9468 | Pokok keterangan calon mempelai di persidangan (satu kalimat) | 11 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 191 | 9470 | Alat bukti surat Penggugat/Pemohon (daftar bukti P.1 dst.; kosong = tanpa daftar) | 11 | 0 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 192 | 9488 | Alat bukti surat Penggugat/Pemohon (daftar bukti P.1 dst.; kosong = tanpa daftar) | 10 | 0 | BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 193 | 9341 | Jumlah kewajiban Tergugat/Termohon yang dikabulkan (rupiah, angka saja) | 7 | 0 | BAS ALUR 40 ES GS - [2a] Sidang 2 - T Tetap Tidak Hadir - Bu | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 194 | 9492 | Alat bukti surat Penggugat/Pemohon (daftar bukti P.1 dst.: akad, jadwal angsuran, somasi, ...) | 9 | 0 | BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 195 | 0652 | No. Surat Penolakan KUA | 3 | 0 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | tidak | berkas e-Court (lampiran surat penolakan KUA; butuh baca dokumen) | Dispensasi/wali adhal; belum dibaca OCR. |
| 196 | 0653 | Tgl. Surat Penolakan KUA | 3 | 0 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | tidak | berkas e-Court (lampiran surat penolakan KUA; butuh baca dokumen) | Dispensasi/wali adhal; belum dibaca OCR. |
| 197 | 9201 | Wali adhal | 3 | 0 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | ya | f23 wali-adhol |  |
| 198 | 9203 | Wali adhal | 3 | 0 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | ya | f23 wali-adhol |  |
| 199 | 9204 | Wali adhal | 3 | 0 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | ya | f23 wali-adhol |  |
| 200 | 9206 | Wali adhal | 3 | 0 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | ya | bawaan ABT bila dikosongkan; f23 wali-adhol |  |
| 201 | 8723 | Izin poligami | 4 | 0 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | deteksi izin-poligami |  |
| 202 | 8605 | Pernikahan resmi/tercatat para pemohon (aua) | 1 | 0 | [98] [Cabut] AUA - Setelah Pembuktian.rtf | ya | deteksi asal-usul |  |
| 203 | 8607 | Fakta tambahan keterangan saksi (aua) | 1 | 0 | [98] [Cabut] AUA - Setelah Pembuktian.rtf | ya | deteksi asal-usul |  |
| 204 | 9434 | Objek rekonvensi yang ditetapkan sebagai harta bersama (satu per baris; kosong = seluruh objek gugatan rekonvensi) | 1 | 0 | [01a] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonven | ya | bawaan ABT bila dikosongkan |  |
| 205 | 9324 | Kedudukan Penggugat/Pemohon (mis. ayah kandung Tergugat/Termohon, istri pertama, Kepala KUA; kosong = suami atau istri Tergugat/Termohon) | 7 | 0 | [01] [Kabul] Pembatalan Perkawinan - Kontradiktoir.rtf | ya | bawaan ABT bila dikosongkan |  |
| 206 | 9345 | Fakta wanprestasi (sejak kapan tidak membayar, somasi, sisa kewajiban) | 5 | 0 | [01] [Kabul] ES Gugatan Sederhana - Wanprestasi - P & T Hadi | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 207 | 9326 | Waktu dan tempat perkawinan (kosong = dari SIPP) | 6 | 0 | BAS ALUR 39 Pembatalan Nikah - Sidang 2 - T Tetap Tidak Hadi | ya | ABT sendiri dari SIPP bila dikosongkan |  |
| 208 | 9328 | Akta nikah (nomor, tanggal, KUA penerbit; kosong = dari SIPP) | 6 | 0 | BAS ALUR 39 Pembatalan Nikah - Sidang 2 - T Tetap Tidak Hadi | ya | ABT sendiri dari SIPP bila dikosongkan |  |
| 209 | 9475 | Pokok tuntutan wasiat (pilih satu huruf) | 6 | 0 | BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir - Pembuk | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 210 | 9478 | Bentuk dan tanggal wasiat (mis. "secara tertulis tertanggal ... di hadapan 2 (dua) orang saksi" atau "dengan akta Notaris ... Nomor ...") | 6 | 0 | BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir - Pembuk | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 211 | 9479 | Objek wasiat (benda atau manfaat yang diwasiatkan: objek, bukti hak, luas, letak, dan batas-batas) | 6 | 0 | BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir - Pembuk | tidak | gugatan e-Court wasiat | Jenis 365: 1 perkara sejak 2023. |
| 212 | 9480 | Penerima wasiat (nama atau sebutan; kosong = otomatis) | 6 | 0 | BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir - Pembuk | ya | bawaan ABT bila dikosongkan |  |
| 213 | 9486 | Kedudukan Penggugat/Pemohon (mis. ahli waris dari pewasiat, penerima wasiat, anak angkat pewasiat) | 6 | 0 | [01] [Kabul] Wasiat - Kontradiktoir.rtf | tidak | gugatan e-Court wasiat |  |
| 214 | 9487 | Kedudukan Tergugat/Termohon (mis. penerima wasiat, ahli waris lain yang menguasai objek wasiat) | 6 | 0 | [01] [Kabul] Wasiat - Kontradiktoir.rtf | tidak | gugatan e-Court wasiat |  |
| 215 | 9489 | Alat bukti surat Tergugat/Termohon (daftar bukti T.1 dst.; kosong = tanpa daftar) | 6 | 0 | BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 216 | 8722 | Izin poligami | 3 | 0 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | deteksi izin-poligami |  |
| 217 | 8724 | Izin poligami | 3 | 0 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | deteksi izin-poligami |  |
| 218 | 9305 | Keadaan pengasuhan anak saat ini (boleh dikosongkan, nanti memakai kalimat bawaan) | 5 | 0 | [01] [Kabul] Hak Asuh - Kontradiktoir - Anak Belum Mumayyiz. | ya | bawaan ABT bila dikosongkan |  |
| 219 | 9310 | Pertimbangan penolakan hak asuh | 5 | 0 | [03] [Tolak] Hak Asuh - Kontradiktoir - Kepentingan Terbaik  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 220 | 9320 | Alasan pembatalan perkawinan | 5 | 0 | [01] [Kabul] Pembatalan Perkawinan - Kontradiktoir.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 221 | 9493 | Alat bukti surat Tergugat/Termohon (daftar bukti T.1 dst.) | 5 | 0 | BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 222 | 9346 | Pertimbangan penolakan gugatan | 3 | 0 | [03] [Tolak] ES Gugatan Sederhana - Wanprestasi Tidak Terbuk | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 223 | 8725 | Izin poligami | 2 | 0 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | deteksi izin-poligami |  |
| 224 | 8726 | Izin poligami | 2 | 0 | [01] [Kabul] Izin Poligami.rtf | ya | deteksi izin-poligami |  |
| 225 | 9352 | Isi kesepakatan perdamaian di hadapan hakim (pasal demi pasal) | 2 | 0 | BAS ALUR 40 ES GS - [1a] Sidang 1 - P & T Hadir - Damai Berh | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 226 | 9353 | Tanggal kesepakatan perdamaian | 2 | 0 | BAS ALUR 40 ES GS - [1a] Sidang 1 - P & T Hadir - Damai Berh | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 227 | 9354 | Pihak yang menanggung biaya perkara menurut kesepakatan | 2 | 0 | BAS ALUR 40 ES GS - [1a] Sidang 1 - P & T Hadir - Damai Berh | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 228 | 9355 | Pokok jawaban Tergugat/Termohon (satu kalimat) | 2 | 0 | [01] [Kabul] ES Gugatan Sederhana - Wanprestasi - P & T Hadi | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 229 | 9329 | Fakta alasan pembatalan yang terbukti di persidangan | 3 | 0 | [01] [Kabul] Pembatalan Perkawinan - Kontradiktoir.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 230 | 9430 | Kantor Urusan Agama tempat perkawinan dicatat (tulis "Kantor Urusan Agama Kecamatan ..., Kabupaten ..."; kosong = data SIPP) | 3 | 0 | [01] [Kabul] Pembatalan Perkawinan - Kontradiktoir.rtf | ya | ABT sendiri dari SIPP bila dikosongkan |  |
| 231 | 9482 | Fakta pokok tuntutan yang terbukti (uraian singkat dari bukti dan saksi) | 3 | 0 | [01] [Kabul] Wasiat - Kontradiktoir.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 232 | 9207 | Wali adhal | 1 | 0 | [01a] [Kabul] Wali Adhal - Wali Hadir Tetap Enggan.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 233 | 9208 | Wali adhal (tolak) | 1 | 0 | [03] [Tolak] Wali Adhal - Keengganan Wali Beralasan Hukum.rt | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 234 | 0303 | Tanggal pengumuman | 2 | 416 | [JS] 9.1. Pengumuman Permohonan Itsbat Nikah (2 Pemohon).rtf | sebagian | tidak ada tanggal pasti di SIPP; usulan ragu = tanggal pendaftaran (terisi di: sipp-lanjutan-ragu) | 409 isian petugas (voluntair dan kontensius): 186 persis sama (45%), 92% jatuh 0-1 hari dari tanggal pendaftaran; juru sita memilih hari pengumuman. |
| 235 | 9307 | Pilihan anak yang sudah mumayyiz di persidangan | 2 | 0 | [01c] [Kabul] Hak Asuh - Kontradiktoir - Anak Mumayyiz Memil | ya | bawaan ABT bila dikosongkan |  |
| 236 | 9330 | Pertimbangan penolakan pembatalan perkawinan | 2 | 0 | [03] [Tolak] Pembatalan Perkawinan - Kontradiktoir - Alasan  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 237 | 9483 | Pertimbangan mengapa dalil gugatan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak) | 2 | 0 | [03] [Tolak] Wasiat - Kontradiktoir - Dalil Tidak Terbukti.r | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 238 | 1152 | Alasan poligami | 1 | 0 | [01] [Kabul] Izin Poligami.rtf | ya | deteksi izin-poligami |  |
| 239 | 8720 | Izin poligami | 1 | 0 | [01] [Kabul] Izin Poligami.rtf | ya | deteksi izin-poligami |  |
| 240 | 9170 | Izin poligami | 1 | 0 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | bawaan ABT bila dikosongkan |  |
| 241 | 9171 | Izin poligami | 1 | 0 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 242 | 1081 | Tgl. PHS Baru Ikrar Talak | 1 | 1 | @ 3b - PHS Ikrar Talak Lanjutan.rtf | tidak | SIPP perkara_ikrar_talak (tanggal PHS baru) | Hanya 1 blangko. |
| 243 | 1154 | Nomor surat permintaan bantuan panggilan | 1 | 0 | [JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf | tidak | ALETA/SIPP bantuan panggilan | Hanya 1 blangko. |
| 244 | 1232 | Tanggal surat | 1 | 0 | [JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf | tidak | ALETA/SIPP bantuan panggilan | Hanya 1 blangko. |
| 245 | 5230 | Ongkos panggilan permintaan bantuan | 1 | 0 | [JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf | tidak | ALETA Kasir (ongkos panggilan) | Hanya 1 blangko. |
| 246 | 9309 | Mengapa pemegang hak asuh tidak dapat menjamin keselamatan anak | 1 | 0 | [01d] [Kabul] Hak Asuh - Kontradiktoir - Pemegang Hadhanah T | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 247 | 9432 | Fakta pengasuhan anak oleh Tergugat/Termohon (dari bukti dan saksi; kosong = kalimat bawaan) | 1 | 0 | [03a] [Tolak] Hak Asuh - Kontradiktoir - Hadhanah Ditetapkan | ya | bawaan ABT bila dikosongkan |  |
| 248 | 9467 | Pertimbangan mengapa alasan pencegahan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak) | 1 | 0 | [03] [Tolak] Pencegahan Perkawinan - Alasan Pencegahan Tidak | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 249 | 9469 | Waktu dan tempat perkawinan yang ternyata sudah dilangsungkan | 1 | 0 | [99b] [NO] Pencegahan Perkawinan - Perkawinan Telah Dilangsu | tidak | tidak ada (fakta persidangan) | Jenis 342 sangat jarang. |
| 250 | 9485 | Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak (untuk putusan tidak dapat diterima karena kurang pihak) | 1 | 0 | [99a] [NO] Wasiat - Kurang Pihak (Plurium Litis Consortium). | tidak | tidak ada (penilaian hakim) |  |
| 251 | 9490 | Klausula arbitrase dalam akad (pasal akad dan lembaga arbitrase yang dipilih) | 1 | 0 | [99a] [NO] ES Acara Biasa - Eksepsi Klausula Arbitrase Dikab | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 252 | 9491 | Pokok eksepsi Tergugat/Termohon (satu kalimat) | 1 | 0 | [99a] [NO] ES Acara Biasa - Eksepsi Klausula Arbitrase Dikab | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |

## Penanda tak dikenal (bukan isian popup)

3121(497), 3122(487), 3123(487), 3124(487), 3125(487), 3127(487), 3128(487), 3129(487), 3131(10), 3510(21), 3511(21), 3512(21), 3513(21), 3514(21), 3515(21), 5078(348), 5079(348), 5080(348), 5081(348), 5082(348), 5083(348), 5084(348), 5085(348), 5086(348), 5087(348), 5088(348), 5089(348), 5090(348), 5091(348), 5092(348), 5093(348), 5094(348), 5095(348), 5096(348), 5097(348), 5098(348), 5099(338), 5102(338), 5103(338), 5104(338), 5106(338), 5107(338), 5117(338), 7064(497), 9591(4), 9593(6), 9650(6), 9651(5), 9652(5), 9653(5), 9654(6), 0243(472), 03517(21)
