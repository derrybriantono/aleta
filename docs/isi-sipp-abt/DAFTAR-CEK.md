# Daftar cek isian popup blangko Derry (Isi dari SIPP & input ke ABT)

Dibangun 2026-10-18 oleh `scripts/isi-sipp-abt/bangun-daftar-cek.cjs` (data diukur, bukan ditebak). Berkas mesin: `DAFTAR-CEK.json` (dipakai uji penjaga).

## Ringkasan

- Blangko Derry aktif di pohon server: **982** (31 tanpa isian popup).
- Isian popup (data_teks / data_tanggal / tanya_jawab, kata ABT "isian tangan"): **252** unik.
- Sudah otomatis (ya): **102** - sebagian: **30** - belum (tidak): **120**, di antaranya **44** memang tanpa sumber data (penilaian hakim / tidak tercatat).
- Penanda yang dirujuk rantai variabel tetapi tidak ada di katalog ABT lokal: 53 (lihat bawah).

## Sumber dan cara membaca

- Pohon blangko: manajemen_surat/src/test/fixtures/blangko-derry-server-17okt.json (kunci berkas).
- Isi RTF: RTF terbaru dari arsip lokal (paket batch-14okt-sore, server-asal, XAMPP). Katalog variabel: aps_badilag_i18 (1628 variabel). Frekuensi: sipp_donggala perkara terdaftar sejak 2023-01-01 (3267 perkara).
- "Isian popup" = hasil `susunIsian` (blangko-derry/susun.ts): penanda RTF + rantai variabel bertipe data_teks, data_tanggal, tanya_jawab. Penanda data_sql/data_sipp/terbilang dihitung ABT sendiri.
- Urutan = bobot: jumlah blangko pemakai x jumlah perkara jenis folder itu sejak 2023 (relaas/sita/PTSP bobot 1 per blangko karena lintas jenis).
- **ya** = ada pengisi yang menghasilkan nilai untuk SEMUA jenis perkara pemakai blangko itu; **sebagian** = hanya sebagian jenis/blangko; **tidak** = belum ada pengisi.
- Pengisi diperiksa uji penjaga (`isi-sipp-abt-daftar-cek.test.ts`): kode harus benar-benar ada di berkas pengisinya.

## Tabel per isian (urut bobot)

| # | nomor | nama | jml blangko | contoh blangko | otomatis? | sumber / pengisi | catatan |
| ---: | --- | --- | ---: | --- | --- | --- | --- |
| 1 | 8537 | Nama advokat Penggugat/Pemohon | 856 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ABT sendiri (kosong = dari SIPP); kuasa-penggugat |  |
| 2 | 0132 | Tanggal register surat kuasa Penggugat/Pemohon di kepaniteraan | 490 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ABT sendiri (kosong = dari SIPP); kuasa-penggugat; deteksi cerai |  |
| 3 | 0184 | Tanggal surat kuasa Penggugat/Pemohon | 490 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | kuasa-penggugat; deteksi cerai |  |
| 4 | 8538 | Alamat kantor advokat Penggugat/Pemohon | 490 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | kuasa-penggugat |  |
| 5 | 8539 | Nomor register surat kuasa Penggugat/Pemohon | 490 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ABT sendiri (kosong = dari SIPP); kuasa-penggugat |  |
| 6 | 8548 | Alamat Putusan Penggugat/Pemohon | 487 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ABT sendiri (kosong = dari SIPP); alamat-putusan |  |
| 7 | 0185 | Tanggal surat kuasa Tergugat/Termohon | 345 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | tidak | e-Court (lampiran surat kuasa Tergugat) | SIPP perkara_pengacara.tanggal_kuasa pihak 2 = tanggal register kepaniteraan, bukan tanggal surat kuasa; Tergugat berkuasa hanya ±1% perkara (34 dari 3267 sejak 2023). |
| 8 | 8549 | Alamat Putusan Tergugat/Termohon | 338 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | ya | ABT sendiri (kosong = dari SIPP); alamat-putusan |  |
| 9 | 8503 | Alasan perceraian | 123 | [01b] (E-Court) BAS 2 P Hadir & T Tidak Hadir Pokok Perkara  | ya | deteksi cerai |  |
| 10 | 5058, 2021 | TanyaJwb Saksi 1 P [tanya jawab saksi 1 p] | 259 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | susun saksi |  |
| 11 | 5059, 2022 | TanyaJwb Saksi 2 P [tanya jawab saksi 2 p] | 259 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | susun saksi |  |
| 12 | 1214 | Alat bukti surat Penggugat/Pemohon | 90 | [01b] (E-Court) BAS 2 P Hadir & T Tidak Hadir Pokok Perkara  | ya | ktp-teks; deteksi cerai |  |
| 13 | 5197 | Tgl Nikah | 104 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | belum dikaji (terisi di: deteksi itsbat-nikah; deteksi perwalian; deteksi waris; deteksi lain-lain) |  |
| 14 | 7084 | Penanda konvensi/rekonvensi (1 apabila ada) | 168 | [02] BAS 3 P & T Hadir Jawaban dan (Apabila ada Gugatan Reko | sebagian | belum dikaji (terisi di: gugatan-ecourt) |  |
| 15 | 8894 | Nama penerima kuasa insidentil | 276 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | SIPP perkara_jadwal_sidang.keterangan / penetapan izin kuasa insidentil (tidak terstruktur) | Kuasa insidentil tidak punya kolom sendiri di SIPP; ±jarang. |
| 16 | 5178 | KUA Kec. | 97 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | belum dikaji (terisi di: deteksi itsbat-nikah; deteksi dispensasi-kawin; deteksi perwalian) |  |
| 17 | 0156 | Nama kantor advokat Penggugat/Pemohon | 126 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | ya | kuasa-penggugat; deteksi cerai |  |
| 18 | 7139 | Beracara secara elektronik | 204 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | ya | elitigasi |  |
| 19 | 0663 | Tanggal penetapan prodeo | 189 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | tidak ada | Tanggal penetapan prodeo tidak disimpan SIPP (hasil putusan sela/pertimbangan hakim). |
| 20 | 9955 | Bukti surat perceraian (otomatis) | 132 | [02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan | ya | ABT sendiri (kosong = dari SIPP); ktp-teks |  |
| 21 | 8921, 6122 | TanyaJwb Saksi 3 T [tanya jawab saksi 3 t] | 57 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 22 | 6124, 8920 | TanyaJwb Saksi 4 P [tanya jawab saksi 4 p] | 58 | [02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 23 | 1268 | Upaya damai oleh keluarga | 64 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 24 | 0157 | Nama kantor advokat Tergugat/Termohon | 94 | [02] BAS 1 P & T Hadir Mediasi P dan T PERMA 7 2022 & Keputu | tidak | e-Court (surat kuasa/jawaban Tergugat) | Nama kantor advokat tidak disimpan SIPP; Tergugat berkuasa ±1% perkara. |
| 25 | 8892 | Pengadilan Tinggi tempat advokat Penggugat/Pemohon disumpah | 141 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | e-Court (kartu advokat/berita acara sumpah pada lampiran kuasa) | Bawaan layar Perlu diisi: Pengadilan Tinggi Sulawesi Tengah; ABT mengisi bila dikosongkan pada sebagian blangko. |
| 26 | 0222 | Awal perselisihan | 63 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 27 | 9944 | Lama pisah rumah | 63 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 28 | 7035 | Yang meninggalkan rumah bersama | 59 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 29 | 0007 | Anak dari pernikahan ini | 64 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | gugatan-ecourt; deteksi itsbat-nikah; deteksi cerai; deteksi perwalian |  |
| 30 | 0246 | Pisah rumah sejak | 55 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | ya | deteksi cerai |  |
| 31 | 5227 | Rincian alasan cerai (sesuai gugatan) | 50 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | ya | gugatan-ecourt; deteksi cerai |  |
| 32 | 5060, 2031 | TanyaJwb Saksi 3 P [tanya jawab saksi 3 p] | 57 | [02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 33 | 5105 | Alamat Tempat Menikah | 65 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | belum dikaji (terisi di: deteksi itsbat-nikah; deteksi cerai; deteksi perwalian; deteksi lain-lain) |  |
| 34 | 1006 | Tempat tinggal setelah menikah | 39 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 35 | 9911 | Alat bukti surat Tergugat/Termohon | 85 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | ktp-teks |  |
| 36 | 5127 | Alasan-Alasan Cerai | 31 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 37 | 1267 | Masih berkomunikasi atau tidak | 30 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | ya | deteksi cerai |  |
| 38 | 2557 | (Saksi I) Berapa Kali Melihat dan Mendengar Pertengkaran | 30 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | tidak | keterangan saksi pada BAS (teks bebas) | Registri cerai: belum - tidak tertulis di posita. |
| 39 | 2558 | (Saksi II) Berapa Kali Melihat dan Mendengar Pertengkaran | 29 | BAS ALUR 01 [1a] BAS 1 P Hadir & T Tidak Hadir - Putus Verst | tidak | keterangan saksi pada BAS (teks bebas) | Registri cerai: belum - tidak tertulis di posita. |
| 40 | 8931, 8932 | TanyaJwb Saksi 5 P [tanya jawab saksi 5 p] | 29 | [02] BAS 6 P & T Hadir Pembuktian P PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 41 | 8564 | Tanggal pengumuman panggilan ghaib pertama dan kedua | 42 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | ALETA panggilan ghaib / pengumuman (belum tercatat terstruktur) | Tanggal pengumuman ghaib pertama dan kedua. |
| 42 | 0227 | Tanggal Tergugat/Termohon berpindah agama | 35 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | tidak ada | Tanggal Tergugat berpindah agama/fasakh: SIPP tidak punya kolomnya. |
| 43 | 0661 | Nomor penetapan prodeo | 35 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | tidak ada | Nomor SK prodeo tidak disimpan SIPP; ecourt_prodeo tidak memuat nomor penetapan. Terbukti di kode (abtUsulanService tidak_ada_sumber). |
| 44 | 8536 | Putusan pidana Tergugat/Termohon (nomor, tanggal, lama hukuman) | 35 | [01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi).rtf | tidak | tidak ada (putusan pidana Tergugat diketahui dari bukti surat) | Alasan C; ±jarang. |
| 45 | 6120, 2023 | TanyaJwb Saksi 1 T [tanya jawab saksi 1 t] | 73 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 46 | 6121, 2024 | TanyaJwb Saksi 2 T [tanya jawab saksi 2 t] | 73 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 47 | 7178 | Alasan panggilan dianggap tidak patut | 21 | [99] BAS 1 P Hadir & T Tidak Hadir - Alamat Tidak Jelas Atau | tidak | relaas panggilan (ALETA relaas) - penilaian hakim |  |
| 48 | 8436 | Kesimpulan Penggugat/Pemohon | 77 | [02] [Kabul] CG - F.rtf | tidak | berkas e-Court (kesimpulan Penggugat) | Registri cerai: belum. |
| 49 | 1046 | Status Wali Nikah | 39 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | belum dikaji (terisi di: deteksi itsbat-nikah; deteksi wali-adhol) |  |
| 50 | 0650 | Saksi Nikah 1 | 33 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | belum dikaji (terisi di: deteksi itsbat-nikah) |  |
| 51 | 0651 | Saksi Nikah 2 | 33 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | belum dikaji (terisi di: deteksi itsbat-nikah) |  |
| 52 | 1001 | Mas kawin | 33 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | belum dikaji (terisi di: deteksi itsbat-nikah) |  |
| 53 | 1217 | Nama Wali Nikah | 33 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | belum dikaji (terisi di: deteksi itsbat-nikah) |  |
| 54 | 8087 | Yang Menikahkan | 33 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | belum dikaji (terisi di: deteksi itsbat-nikah) |  |
| 55 | 9881 | lisan atau tertulis (jawaban replik dan duplik) | 82 | [02] [Kabul] CG - F.rtf | sebagian | belum dikaji (terisi di: gugatan-ecourt) |  |
| 56 | 6112, 2018 | Jawaban Lisan Tergugat/Termohon [tanya jawab jawaban lisan 0047] | 27 | BAS ALUR 05 [2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Ja | tidak | belum dikaji |  |
| 57 | 6114, 2020 | Duplik Lisan Tergugat/Termohon [tanya jawab duplik lisan 0047] | 26 | BAS ALUR 05 [2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Ja | tidak | belum dikaji |  |
| 58 | 6113, 2019 | Replik Lisan Penggugat/Pemohon [tanya jawab replik lisan 0046] | 26 | BAS ALUR 05 [2] BAS 2 P & T Hadir - Pembacaan Gugatan dan Ja | tidak | belum dikaji |  |
| 59 | 8433 | Alasan pencabutan perkara | 66 | BAS ALUR 08 [A] BAS 1 P Hadir & T Tidak Hadir - Cabut di Sid | tidak | SIPP (sidang/penetapan pencabutan) + BAS | Registri cerai: belum - tidak tertulis di posita. |
| 60 | 9958 | C3. Alat Bukti Isbat Nikah Terpadu | 25 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ktp-teks; deteksi itsbat-nikah |  |
| 61 | 8437 | Kesimpulan Tergugat/Termohon | 48 | [02] [Kabul] CG - F.rtf | tidak | berkas e-Court (kesimpulan Tergugat) | Registri cerai: belum. |
| 62 | 7211 | Umur Isbat P1 (Laki-Laki) | 19 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | belum dikaji (terisi di: deteksi itsbat-nikah) |  |
| 63 | 7212 | Umur Isbat P2 (Perempuan) | 19 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | belum dikaji (terisi di: deteksi itsbat-nikah) |  |
| 64 | 1002 | Status Penggugat/Pemohon sblm nikah (IN) | 29 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | belum dikaji (terisi di: deteksi itsbat-nikah) |  |
| 65 | 1003 | Status #2027# sblm nikah (IN) | 26 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | sebagian | belum dikaji (terisi di: deteksi itsbat-nikah) |  |
| 66 | 8941 | TanyaJwb Saksi 4 T [tanya jawab saksi 4 t] | 13 | [02] BAS 7 P & T Hadir Pembuktian T PERMA 7 2022 & Keputusan | ya | susun saksi |  |
| 67 | 9134 | Bas permohonan | 38 | BAS ALUR 17 IN 2+ Sidang - [1a] Sidang 1 - Pemeriksaan, Bukt | tidak | belum dikaji | Isian blangko BAS permohonan. |
| 68 | 0364 | Tgl. KTP Penggugat/Pemohon | 11 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ktp-tanggal; deteksi itsbat-nikah |  |
| 69 | 0366 | Tgl. KTP Penggugat/Pemohon II | 11 | [01a] BAS 1 Asal Usul Anak - Kabul.rtf | ya | ktp-tanggal; deteksi itsbat-nikah |  |
| 70 | 8171 | Alasan Permohonan untuk | 21 | BAS ALUR 17 IN 2+ Sidang - [1a] Sidang 1 - Pemeriksaan, Bukt | ya | deteksi itsbat-nikah; deteksi perwalian; deteksi lain-lain |  |
| 71 | 8729 | Penilaian keterangan saksi dan fakta yang tidak terbukti | 6 | [03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 72 | 8603 | Nama anak yang dimohonkan | 31 | BAS KUMULASI [2] BAS Putus Verstek CG Kumulasi Hak Asuh Anak | sebagian | posita (modul asal-usul/hadhanah ada); modul cerai-kumulasi belum (terisi di: deteksi hadhanah; deteksi asal-usul; deteksi pengangkatan-anak; deteksi lain-lain) |  |
| 73 | 0182 | Tanggal izin kuasa insidentil | 4 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | tidak | tidak ada terstruktur (penetapan izin Ketua) |  |
| 74 | 8895 | Hubungan penerima kuasa dengan Penggugat/Pemohon | 4 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | tidak | tidak ada terstruktur (penetapan izin Ketua) | Hubungan penerima kuasa dengan pemberi kuasa. |
| 75 | 8896 | Nomor izin Ketua Pengadilan | 4 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | tidak | tidak ada terstruktur (penetapan izin Ketua) | Nomor izin Ketua Pengadilan. |
| 76 | 9123 | Sebab kuasa insidentil tidak sah (huruf a sampai d) | 4 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | tidak | penilaian hakim |  |
| 77 | 5171 | Penghasilan Penggugat/Pemohon Perbulan | 10 | [01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - | tidak | berkas e-Court (gugatan: penghasilan) |  |
| 78 | 6054 | Nafkah iddah | 10 | [01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - | ya | gugatan-ecourt; deteksi cerai |  |
| 79 | 6055 | Mut'ah | 10 | [01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - | sebagian | belum dikaji (terisi di: gugatan-ecourt) |  |
| 80 | 8712 | Nomor dan tanggal surat teguran panitera | 21 | [98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar H | tidak | ALETA Kasir (teguran panjar) - belum dicatat terstruktur |  |
| 81 | 8713 | Batas waktu menambah panjar | 21 | [98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar H | tidak | ALETA Kasir (teguran panjar) - belum dicatat terstruktur |  |
| 82 | 8714 | Nomor dan tanggal laporan panjar tidak ditambah | 21 | [98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar H | tidak | ALETA Kasir (laporan panjar) - belum dicatat terstruktur |  |
| 83 | 0228 | Alasan Syahadah Istifadhah (Itsbat Nikah / Isbat / PAW) | 4 | [01ab] BAS 1 IN - Kabul Syahadah Istifadhah.rtf | ya | deteksi itsbat-nikah |  |
| 84 | 5271 | Penghasilan Tergugat/Termohon Perbulan | 6 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | tidak | berkas e-Court (gugatan: penghasilan) |  |
| 85 | 6071 | Nafkah Anak | 6 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | sebagian | belum dikaji (terisi di: gugatan-ecourt) |  |
| 86 | 9501 | Penilaian jawaban dan bukti Tergugat/Termohon (bantahan apa yang didukung bukti atau saksi, dan mengapa melemahkan dalil Penggugat/Pemohon; kosong = titik-titik) | 4 | [03a] [Tolak] Cerai - Kontradiktoir (T Hadir Jawab-Menjawab) | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 87 | 9050 | Kenaikan nafkah anak per tahun | 5 | BAS KUMULASI [2b] BAS Putus Verstek CG Kumulasi Hak Asuh Ana | tidak | berkas e-Court (petitum kenaikan nafkah anak) |  |
| 88 | 8899 | Pokok kesepakatan perdamaian sebagian | 3 | [02b] [Kabul] CG - F - Mediasi Berhasil Sebagian (Kesepakata | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 89 | 8902 | Isi pasal kesepakatan perdamaian sebagian | 3 | [02b] [Kabul] CG - F - Mediasi Berhasil Sebagian (Kesepakata | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 90 | 8901 | Amar kesepakatan perdamaian sebagian (satu butir per baris) | 2 | [02b] [Kabul] CG - F - Mediasi Berhasil Sebagian (Kesepakata | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 91 | 9120 | Panggilan ulang karena kuasa insidentil tidak sah | 2 | [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah | tidak | penilaian hakim |  |
| 92 | 9125 | Keadaan kuasa insidentil tidak sah | 2 | [98] [NO] 4b. Cerai P Diwakili Kuasa Insidentil Tidak Sah.rt | tidak | penilaian hakim |  |
| 93 | 1183 | Tgl. Batas Waktu Ikrar Talak | 1 | [3] BAS Ikrar Talak - P Tidak Hadir & T Hadir, Tunda Tenggan | tidak | dihitung dari SIPP (putusan berkekuatan hukum tetap + 6 bulan) | Registri cerai: belum; hanya 1 blangko. |
| 94 | 1025 | Nama Almarhum / Almarhumah | 44 | BAS ALUR 35 IN Kontensius - Sidang 1 - Jawaban T Mengakui, P | sebagian | belum dikaji (terisi di: deteksi waris; deteksi perwalian; deteksi lain-lain) |  |
| 95 | 1021 | Nama Istri Pertama | 2 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | deteksi itsbat-nikah |  |
| 96 | 1513 | Nama Suami Meninggal (bukti Pemohon2) | 2 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | tidak | posita/bukti (akta kematian) | Itsbat dengan suami meninggal. |
| 97 | 0600 | Nama Pria (Dispensasi) | 20 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 98 | 0606 | Nama Wanita (Dispensasi) | 20 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 99 | 6331 | Pekerjaan Calon Suami/Anak Para Pemohon DK / Pekerjaan Perwalian Orang Tua | 22 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | sebagian | belum dikaji (terisi di: deteksi dispensasi-kawin; deteksi perwalian) |  |
| 100 | 0601 | Umur Pria (dispensasi) | 17 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 101 | 0607 | Umur Wanita (dispensasi) | 17 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 102 | 0609 | Pendidikan Wanita (dispensasi) | 17 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 103 | 1551 | Nama Ayah Calon Suami/Istri DK | 17 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 104 | 1552 | Nama Ayah Calon Suami/Istri DK | 17 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 105 | 1666 | lama pacaran (DK) | 17 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 106 | 2029 | Status Anak Pria (DK) | 17 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 107 | 2030 | Status Anak Wanita (DK) | 17 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 108 | 9956 | Detektor klasifikasi bukti surat sesuai dengan jenis perkara | 17 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | ktp-teks; deteksi dispensasi-kawin |  |
| 109 | 0709 | ibu kandung/bapak kandung perkara Hadhanah | 11 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | ya | deteksi cerai; deteksi perwalian |  |
| 110 | 5110 | Nama anak | 11 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | ya | gugatan-ecourt; deteksi perwalian |  |
| 111 | 6072 | Nafkah anak (masing-masing anak) | 2 | [01a] [Kabul Verstek] CT - F (Ex Offiicio mutah iddah dan na | sebagian | belum dikaji (terisi di: gugatan-ecourt) |  |
| 112 | 1321 | No. Akta Cerai P I (Bukti) | 3 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | sebagian | belum dikaji (terisi di: f23 itsbat-nikah) |  |
| 113 | 1322 | Tgl. Akta Cerai P I (Bukti) | 3 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | sebagian | belum dikaji (terisi di: f23 itsbat-nikah) |  |
| 114 | 1324 | Penerbit Akta Cerai P I (Bukti) | 1 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 115 | 1325 | No. Akta Cerai P II (Bukti) | 1 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 116 | 1329 | Tgl. Akta Cerai P II (Bukti) | 1 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 117 | 1331 | Penerbit Akta Cerai P II (Bukti) | 1 | [99aa] Pertimbangan - Cerai Hidup P1 P2 Pasangan Sebelumnya. | ya | f23 itsbat-nikah |  |
| 118 | 1514 | Tanggal Suami Meninggal (bukti Pemohon2) | 1 | [99aa] Pertimbangan - Cerai Mati P1 P2 Pasangan Sebelumnya.r | tidak | posita/bukti (akta kematian) |  |
| 119 | 1515 | Penyebab Suami Meninggal (bukti Pemohon2) | 1 | [99aa] Pertimbangan - Cerai Mati P1 P2 Pasangan Sebelumnya.r | tidak | posita/bukti (akta kematian) |  |
| 120 | 5015 | Tgl meninggal isteri/ibu | 1 | [99aa] Pertimbangan - Cerai Mati P1 P2 Pasangan Sebelumnya.r | ya | deteksi itsbat-nikah |  |
| 121 | 5016 | Sebab meninggal isteri/ibu | 1 | [99aa] Pertimbangan - Cerai Mati P1 P2 Pasangan Sebelumnya.r | ya | deteksi itsbat-nikah |  |
| 122 | 1246 | Tanggal meninggalnya #2026# | 21 | [01] [Kabul] IN Kontensius - Pasangan Meninggal, Ahli Waris  | sebagian | belum dikaji (terisi di: deteksi waris) |  |
| 123 | 1247 | Sebab meninggalnya #2026# | 16 | [01] [Kabul] IN Kontensius - Pasangan Meninggal, Ahli Waris  | sebagian | belum dikaji (terisi di: deteksi waris) |  |
| 124 | 1509 | Tempat Meninggal Dunia | 16 | [01] [Kabul] IN Kontensius - Pasangan Meninggal, Ahli Waris  | sebagian | belum dikaji (terisi di: deteksi waris) |  |
| 125 | 0999 | Umur Kandungan Hamil DK Perempuan | 9 | BAS ALUR 12 DK - [1at] Sidang 1 - Calon Istri Hamil (Anak La | ya | deteksi dispensasi-kawin |  |
| 126 | 8614 | Harta peninggalan pewaris | 9 | BAS ALUR 14 PAW - [1] Sidang 1 - Pemeriksaan, Bukti Surat da | ya | deteksi waris |  |
| 127 | 0712 | Bapak/Ibu yang meninggal dari anak yang di walikan Perwalian | 10 | BAS ALUR 16 Perwalian - [1] Sidang 1 - Pemeriksaan, Bukti Su | ya | deteksi perwalian |  |
| 128 | 1230 | Tanggal meninggalnya suami | 10 | BAS ALUR 16 Perwalian - [1] Sidang 1 - Pemeriksaan, Bukti Su | ya | deteksi perwalian |  |
| 129 | 0711 | kalah Tergugat ibu kandung/bapak kandung perkara Hadhanah | 1 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | tidak | belum dikaji |  |
| 130 | 2004 | kini anak tersebut diasuh oleh | 1 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | sebagian | belum dikaji (terisi di: gugatan-ecourt) |  |
| 131 | 7120 | Nafkah Lampau (Madhiyah / Madliyah) | 1 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | sebagian | belum dikaji (terisi di: gugatan-ecourt) |  |
| 132 | 8570 | Kediaman bersama terakhir Penggugat/Pemohon dan Tergugat/Termohon sebelum berpisah | 1 | [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak).r | ya | deteksi cerai |  |
| 133 | 9220 | Ikrar: keadaan Tergugat/Termohon saat ikrar | 1 | [90a] [Ikrar] Penetapan Ikrar Talak - P & T Hadir.rtf | tidak | belum dikaji |  |
| 134 | 8132 | Alat Bukti PAW | 6 | BAS ALUR 14 PAW - [1] Sidang 1 - Pemeriksaan, Bukti Surat da | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 135 | 0349 | Tgl. Lahir Wanita (Dispensasi) | 5 | [01] [Kabul] DK - (Anak P Cewek) Hamil.rtf | ya | deteksi dispensasi-kawin |  |
| 136 | 8812 | Tanggal Ijazah | 5 | [01] [Kabul] DK - (Anak P Cewek) Hamil.rtf | ya | deteksi dispensasi-kawin |  |
| 137 | 8131 | Alat Bukti Perwalian Anak | 6 | BAS ALUR 16 Perwalian - [1] Sidang 1 - Pemeriksaan, Bukti Su | ya | deteksi perwalian |  |
| 138 | 0997 | UPT Puskesmas DK | 3 | [01] [Kabul] DK - (Anak P Cewek) Hamil.rtf | ya | deteksi dispensasi-kawin |  |
| 139 | 8706 | DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama | 14 | [97] [Perdamaian] Akta Perdamaian.rtf | sebagian | berkas e-Court (lampiran bukti; butuh baca dokumen) (terisi di: deteksi harta-bersama) |  |
| 140 | 0610 | Pekerjaan Wanita (dispensasi) | 2 | [01] [Kabul] DK - (Anak P Cowok) Calon Istri Hamil.rtf | ya | deteksi dispensasi-kawin |  |
| 141 | 8616 | Pengakuan Penggugat/Pemohon atas cacat permohonan | 2 | BAS ALUR 14 PAW - [NO] Permohonan Kabur, Tetap Tidak Diperba | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 142 | 8617 | Uraian cacat formil permohonan (no obscuur) | 2 | BAS ALUR 14 PAW - [NO] Permohonan Kabur, Tetap Tidak Diperba | tidak | belum dikaji |  |
| 143 | 9169 | Itsbat nikah kontensius | 2 | BAS ALUR 35 IN Kontensius - Sidang 1 - Jawaban T Mengakui, P | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 144 | 8704 | Isi kesepakatan perdamaian | 12 | BAS ALUR 43 ES Acara Biasa - Sidang 2 - Mediasi Berhasil - A | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 145 | 8705 | Tanggal kesepakatan perdamaian | 12 | BAS ALUR 43 ES Acara Biasa - Sidang 2 - Mediasi Berhasil - A | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 146 | 8608 | Nama ahli waris | 1 | [01] [Kabul] PAW - Ahli Waris Anak Kandung (Suami-Istri dan  | ya | deteksi waris |  |
| 147 | 8610 | Nama suami/istri pewaris | 1 | [01] [Kabul] PAW - Ahli Waris Anak Kandung (Suami-Istri dan  | ya | deteksi waris |  |
| 148 | 8613 | Kematian suami/istri pewaris | 1 | [01] [Kabul] PAW - Ahli Waris Anak Kandung (Suami-Istri dan  | ya | deteksi waris |  |
| 149 | 8618 | TEMPAT DAN TANGGAL LAHIR ANAK (pengangkatan anak) | 9 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 150 | 8619 | NAMA ORANG TUA KANDUNG ANAK (pengangkatan anak) | 9 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 151 | 8622 | STATUS PERKAWINAN Penggugat/Pemohon (pengangkatan anak) | 9 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 152 | 8623 | Hubungan Penggugat/Pemohon dengan calon anak angkat | 9 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 153 | 1029 | Nama Calon Suami | 23 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | sebagian | belum dikaji (terisi di: deteksi wali-adhol) |  |
| 154 | 8730 | Harta bersama | 5 | BAS ALUR 31 HB - Sidang 2 - T Tetap Tidak Hadir - Pembuktian | ya | deteksi harta-bersama |  |
| 155 | 8717 | Kewarisan | 3 | [01] [Kabul] Kewarisan - Kontradiktur.rtf | ya | deteksi waris |  |
| 156 | 8718 | Kewarisan | 3 | [01] [Kabul] Kewarisan - Kontradiktur.rtf | ya | deteksi waris |  |
| 157 | 8719 | Kewarisan | 3 | [01] [Kabul] Kewarisan - Kontradiktur.rtf | ya | f23 waris |  |
| 158 | 9347 | Wakil atau kuasa Penggugat/Pemohon yang berbadan hukum (nama, jabatan, dasar penunjukan) | 27 | BAS ALUR 40 ES GS - [1d] Sidang 1 - T Tidak Diketahui Tempat | tidak | e-Court (surat kuasa/anggaran dasar badan hukum) | Hanya perkara ekonomi syariah badan hukum. |
| 159 | 9348 | Wakil atau kuasa Tergugat/Termohon yang berbadan hukum (nama, jabatan, dasar penunjukan) | 27 | BAS ALUR 40 ES GS - [1d] Sidang 1 - T Tidak Diketahui Tempat | tidak | e-Court (surat kuasa/anggaran dasar badan hukum) | Hanya perkara ekonomi syariah badan hukum. |
| 160 | 8621 | Alat bukti surat pengangkatan anak | 6 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 161 | 1014 | Eratnya Hubungan Calon | 9 | BAS ALUR 19 Wali Adhal - [1] Sidang 1 - Pemeriksaan, Bukti S | ya | deteksi wali-adhol |  |
| 162 | 1030 | Umur Calon/Suami | 9 | BAS ALUR 19 Wali Adhal - [1] Sidang 1 - Pemeriksaan, Bukti S | ya | deteksi wali-adhol |  |
| 163 | 6087 | Alasan Wali Nikah Menolak | 9 | BAS ALUR 19 Wali Adhal - [1] Sidang 1 - Pemeriksaan, Bukti S | ya | deteksi wali-adhol |  |
| 164 | 8620 | Keterangan orang tua kandung di persidangan | 5 | BAS ALUR 18 Angkat Anak - [1] Sidang 1 - Pemeriksaan, Bukti  | ya | deteksi pengangkatan-anak; deteksi lain-lain |  |
| 165 | 9162 | Objek yang dimohonkan untuk disita (satu per baris) | 5 | BAS ALUR 30 HB - Sidang Insidentil 1 - Pemeriksaan Permohona | ya | f23 harta-bersama; f23 waris |  |
| 166 | 9163 | Alasan permohonan sita | 4 | BAS ALUR 30 HB - Sidang Insidentil 1 - Pemeriksaan Permohona | ya | f23 harta-bersama; f23 waris |  |
| 167 | 9164 | Tanggapan Tergugat/Termohon atas permohonan sita (dari jawaban atau sidang insidentil) | 4 | BAS ALUR 30 HB - Sidang Insidentil 1 - Pemeriksaan Permohona | tidak | belum dikaji |  |
| 168 | 9161 | SITA: JENIS SITA YANG DIMOHONKAN; contoh lain: sita marital | 2 | BAS ALUR 30 HB - Sidang Insidentil 1 - Pemeriksaan Permohona | ya | f23 harta-bersama; f23 waris |  |
| 169 | 9165 | Pemeriksaan setempat | 2 | BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi  | tidak | belum dikaji |  |
| 170 | 9166 | Pemeriksaan setempat | 2 | BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi  | tidak | belum dikaji |  |
| 171 | 9167 | Pemeriksaan setempat | 2 | BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi  | tidak | belum dikaji |  |
| 172 | 9168 | Pemeriksaan setempat | 2 | BAS ALUR 30 HB - Sidang PS - Pemeriksaan Setempat di Lokasi  | tidak | belum dikaji |  |
| 173 | 9303 | Identitas anak (nama, tempat dan tanggal lahir; satu anak satu baris) | 18 | BAS ALUR 38 Hak Asuh - Sidang 2 - T Tetap Tidak Hadir - Pemb | tidak | belum dikaji |  |
| 174 | 9340 | Akad yang disengketakan (jenis akad, nomor, tanggal) | 13 | BAS ALUR 40 ES GS - [2a] Sidang 2 - T Tetap Tidak Hadir - Bu | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 175 | 9135 | Alat bukti surat wali adhal | 6 | BAS ALUR 19 Wali Adhal - [1] Sidang 1 - Pemeriksaan, Bukti S | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 176 | 0378 | Bukti Surat IN | 2 | [03] [Tolak] AUA - Dalil Tidak Terbukti.rtf | ya | ktp-teks; deteksi asal-usul |  |
| 177 | 0889 | Tanggal Duplikat Kutipan Akta Nikah | 2 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | belum dikaji |  |
| 178 | 1108 | Nomor duplikat surat nikah | 2 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 179 | 5032 | Harta bersama/gono-gini | 2 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | ya | deteksi harta-bersama |  |
| 180 | 9110 | Pengadilan tinggi tempat advokat Tergugat/Termohon disumpah | 2 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | e-Court (kartu advokat/berita acara sumpah) | Tergugat berkuasa ±1% perkara; bawaan layar: Pengadilan Tinggi Sulawesi Tengah. |
| 181 | 9282 | Harta bersama | 2 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 182 | 9283 | Harta bersama rekonvensi | 2 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | belum dikaji |  |
| 183 | 9951 | Bukti elektronik Penggugat/Pemohon | 2 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 184 | 9952 | Bukti elektronik Tergugat/Termohon | 2 | [01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvens | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 185 | 9460 | Nama calon istri (nama lengkap binti ...; nama calon suami diisi di kolom nama calon suami) | 14 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | belum dikaji |  |
| 186 | 9461 | Wilayah KUA tempat perkawinan akan dilangsungkan (tulis "Kecamatan ..., Kabupaten ...") | 11 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | belum dikaji |  |
| 187 | 9462 | Kedudukan Penggugat/Pemohon terhadap calon mempelai (mis. ayah kandung calon istri, wali nikah, istri sah calon suami, Pegawai Pencatat Nikah KUA ...) | 11 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | belum dikaji |  |
| 188 | 9463 | Alasan pencegahan perkawinan (pilih satu huruf) | 11 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 189 | 9466 | Fakta alasan pencegahan yang terbukti (uraian singkat dari bukti, saksi, dan keterangan calon mempelai) | 11 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 190 | 9468 | Pokok keterangan calon mempelai di persidangan (satu kalimat) | 11 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 191 | 9470 | Alat bukti surat Penggugat/Pemohon (daftar bukti P.1 dst.; kosong = tanpa daftar) | 11 | BAS ALUR 41 Pencegahan - [1] Sidang 1 - Calon Hadir - Bukti  | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 192 | 9488 | Alat bukti surat Penggugat/Pemohon (daftar bukti P.1 dst.; kosong = tanpa daftar) | 10 | BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 193 | 9341 | Jumlah kewajiban Tergugat/Termohon yang dikabulkan (rupiah, angka saja) | 7 | BAS ALUR 40 ES GS - [2a] Sidang 2 - T Tetap Tidak Hadir - Bu | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 194 | 9492 | Alat bukti surat Penggugat/Pemohon (daftar bukti P.1 dst.: akad, jadwal angsuran, somasi, ...) | 9 | BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P.rtf | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 195 | 0652 | No. Surat Penolakan KUA | 3 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | tidak | belum dikaji |  |
| 196 | 0653 | Tgl. Surat Penolakan KUA | 3 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | tidak | belum dikaji |  |
| 197 | 9201 | Wali adhal | 3 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | ya | f23 wali-adhol |  |
| 198 | 9203 | Wali adhal | 3 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | ya | f23 wali-adhol |  |
| 199 | 9204 | Wali adhal | 3 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | ya | f23 wali-adhol |  |
| 200 | 9206 | Wali adhal | 3 | [01] [Kabul] Wali Adhal - Wali Tidak Hadir.rtf | ya | f23 wali-adhol |  |
| 201 | 8723 | Izin poligami | 4 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | deteksi izin-poligami |  |
| 202 | 8605 | Pernikahan resmi/tercatat para pemohon (aua) | 1 | [98] [Cabut] AUA - Setelah Pembuktian.rtf | ya | deteksi asal-usul |  |
| 203 | 8607 | Fakta tambahan keterangan saksi (aua) | 1 | [98] [Cabut] AUA - Setelah Pembuktian.rtf | ya | deteksi asal-usul |  |
| 204 | 9434 | Objek rekonvensi yang ditetapkan sebagai harta bersama (satu per baris; kosong = seluruh objek gugatan rekonvensi) | 1 | [01a] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonven | tidak | belum dikaji |  |
| 205 | 9324 | Kedudukan Penggugat/Pemohon (mis. ayah kandung Tergugat/Termohon, istri pertama, Kepala KUA; kosong = suami atau istri Tergugat/Termohon) | 7 | [01] [Kabul] Pembatalan Perkawinan - Kontradiktoir.rtf | tidak | belum dikaji |  |
| 206 | 9345 | Fakta wanprestasi (sejak kapan tidak membayar, somasi, sisa kewajiban) | 5 | [01] [Kabul] ES Gugatan Sederhana - Wanprestasi - P & T Hadi | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 207 | 9326 | Waktu dan tempat perkawinan (kosong = dari SIPP) | 6 | BAS ALUR 39 Pembatalan Nikah - Sidang 2 - T Tetap Tidak Hadi | tidak | belum dikaji |  |
| 208 | 9328 | Akta nikah (nomor, tanggal, KUA penerbit; kosong = dari SIPP) | 6 | BAS ALUR 39 Pembatalan Nikah - Sidang 2 - T Tetap Tidak Hadi | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 209 | 9475 | Pokok tuntutan wasiat (pilih satu huruf) | 6 | BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir - Pembuk | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 210 | 9478 | Bentuk dan tanggal wasiat (mis. "secara tertulis tertanggal ... di hadapan 2 (dua) orang saksi" atau "dengan akta Notaris ... Nomor ...") | 6 | BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir - Pembuk | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 211 | 9479 | Objek wasiat (benda atau manfaat yang diwasiatkan: objek, bukti hak, luas, letak, dan batas-batas) | 6 | BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir - Pembuk | tidak | belum dikaji |  |
| 212 | 9480 | Penerima wasiat (nama atau sebutan; kosong = otomatis) | 6 | BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir - Pembuk | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 213 | 9486 | Kedudukan Penggugat/Pemohon (mis. ahli waris dari pewasiat, penerima wasiat, anak angkat pewasiat) | 6 | [01] [Kabul] Wasiat - Kontradiktoir.rtf | tidak | belum dikaji |  |
| 214 | 9487 | Kedudukan Tergugat/Termohon (mis. penerima wasiat, ahli waris lain yang menguasai objek wasiat) | 6 | [01] [Kabul] Wasiat - Kontradiktoir.rtf | tidak | belum dikaji |  |
| 215 | 9489 | Alat bukti surat Tergugat/Termohon (daftar bukti T.1 dst.; kosong = tanpa daftar) | 6 | BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 216 | 8722 | Izin poligami | 3 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | deteksi izin-poligami |  |
| 217 | 8724 | Izin poligami | 3 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | deteksi izin-poligami |  |
| 218 | 9305 | Keadaan pengasuhan anak saat ini (boleh dikosongkan, nanti memakai kalimat bawaan) | 5 | [01] [Kabul] Hak Asuh - Kontradiktoir - Anak Belum Mumayyiz. | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 219 | 9310 | Pertimbangan penolakan hak asuh | 5 | [03] [Tolak] Hak Asuh - Kontradiktoir - Kepentingan Terbaik  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 220 | 9320 | Alasan pembatalan perkawinan | 5 | [01] [Kabul] Pembatalan Perkawinan - Kontradiktoir.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 221 | 9493 | Alat bukti surat Tergugat/Termohon (daftar bukti T.1 dst.) | 5 | BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T.rtf | tidak | berkas e-Court (lampiran bukti; butuh baca dokumen) |  |
| 222 | 9346 | Pertimbangan penolakan gugatan | 3 | [03] [Tolak] ES Gugatan Sederhana - Wanprestasi Tidak Terbuk | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 223 | 8725 | Izin poligami | 2 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | ya | deteksi izin-poligami |  |
| 224 | 8726 | Izin poligami | 2 | [01] [Kabul] Izin Poligami.rtf | ya | deteksi izin-poligami |  |
| 225 | 9352 | Isi kesepakatan perdamaian di hadapan hakim (pasal demi pasal) | 2 | BAS ALUR 40 ES GS - [1a] Sidang 1 - P & T Hadir - Damai Berh | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 226 | 9353 | Tanggal kesepakatan perdamaian | 2 | BAS ALUR 40 ES GS - [1a] Sidang 1 - P & T Hadir - Damai Berh | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 227 | 9354 | Pihak yang menanggung biaya perkara menurut kesepakatan | 2 | BAS ALUR 40 ES GS - [1a] Sidang 1 - P & T Hadir - Damai Berh | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 228 | 9355 | Pokok jawaban Tergugat/Termohon (satu kalimat) | 2 | [01] [Kabul] ES Gugatan Sederhana - Wanprestasi - P & T Hadi | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 229 | 9329 | Fakta alasan pembatalan yang terbukti di persidangan | 3 | [01] [Kabul] Pembatalan Perkawinan - Kontradiktoir.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 230 | 9430 | Kantor Urusan Agama tempat perkawinan dicatat (tulis "Kantor Urusan Agama Kecamatan ..., Kabupaten ..."; kosong = data SIPP) | 3 | [01] [Kabul] Pembatalan Perkawinan - Kontradiktoir.rtf | tidak | belum dikaji |  |
| 231 | 9482 | Fakta pokok tuntutan yang terbukti (uraian singkat dari bukti dan saksi) | 3 | [01] [Kabul] Wasiat - Kontradiktoir.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 232 | 9207 | Wali adhal | 1 | [01a] [Kabul] Wali Adhal - Wali Hadir Tetap Enggan.rtf | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 233 | 9208 | Wali adhal (tolak) | 1 | [03] [Tolak] Wali Adhal - Keengganan Wali Beralasan Hukum.rt | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 234 | 0303 | Tanggal pengumuman | 2 | [JS] 9.1. Pengumuman Permohonan Itsbat Nikah (2 Pemohon).rtf | tidak | ALETA panggilan ghaib / pengumuman |  |
| 235 | 9307 | Pilihan anak yang sudah mumayyiz di persidangan | 2 | [01c] [Kabul] Hak Asuh - Kontradiktoir - Anak Mumayyiz Memil | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 236 | 9330 | Pertimbangan penolakan pembatalan perkawinan | 2 | [03] [Tolak] Pembatalan Perkawinan - Kontradiktoir - Alasan  | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 237 | 9483 | Pertimbangan mengapa dalil gugatan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak) | 2 | [03] [Tolak] Wasiat - Kontradiktoir - Dalil Tidak Terbukti.r | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 238 | 1152 | Alasan poligami | 1 | [01] [Kabul] Izin Poligami.rtf | ya | deteksi izin-poligami |  |
| 239 | 8720 | Izin poligami | 1 | [01] [Kabul] Izin Poligami.rtf | ya | deteksi izin-poligami |  |
| 240 | 9170 | Izin poligami | 1 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 241 | 9171 | Izin poligami | 1 | BAS ALUR 34 Poligami - Sidang 2 - Laporan Mediasi, Permohona | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 242 | 1081 | Tgl. PHS Baru Ikrar Talak | 1 | @ 3b - PHS Ikrar Talak Lanjutan.rtf | tidak | SIPP perkara_ikrar_talak (tanggal PHS baru) | Hanya 1 blangko. |
| 243 | 1154 | Nomor surat permintaan bantuan panggilan | 1 | [JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf | tidak | ALETA/SIPP bantuan panggilan | Hanya 1 blangko. |
| 244 | 1232 | Tanggal surat | 1 | [JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf | tidak | ALETA/SIPP bantuan panggilan | Hanya 1 blangko. |
| 245 | 5230 | Ongkos panggilan permintaan bantuan | 1 | [JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf | tidak | ALETA Kasir (ongkos panggilan) | Hanya 1 blangko. |
| 246 | 9309 | Mengapa pemegang hak asuh tidak dapat menjamin keselamatan anak | 1 | [01d] [Kabul] Hak Asuh - Kontradiktoir - Pemegang Hadhanah T | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 247 | 9432 | Fakta pengasuhan anak oleh Tergugat/Termohon (dari bukti dan saksi; kosong = kalimat bawaan) | 1 | [03a] [Tolak] Hak Asuh - Kontradiktoir - Hadhanah Ditetapkan | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 248 | 9467 | Pertimbangan mengapa alasan pencegahan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak) | 1 | [03] [Tolak] Pencegahan Perkawinan - Alasan Pencegahan Tidak | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 249 | 9469 | Waktu dan tempat perkawinan yang ternyata sudah dilangsungkan | 1 | [99b] [NO] Pencegahan Perkawinan - Perkawinan Telah Dilangsu | tidak | belum dikaji |  |
| 250 | 9485 | Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak (untuk putusan tidak dapat diterima karena kurang pihak) | 1 | [99a] [NO] Wasiat - Kurang Pihak (Plurium Litis Consortium). | tidak | belum dikaji |  |
| 251 | 9490 | Klausula arbitrase dalam akad (pasal akad dan lembaga arbitrase yang dipilih) | 1 | [99a] [NO] ES Acara Biasa - Eksepsi Klausula Arbitrase Dikab | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |
| 252 | 9491 | Pokok eksepsi Tergugat/Termohon (satu kalimat) | 1 | [99a] [NO] ES Acara Biasa - Eksepsi Klausula Arbitrase Dikab | tidak | tidak ada (penilaian/keputusan hakim atau kesepakatan para pihak) |  |

## Penanda tak dikenal (bukan isian popup)

3121(497), 3122(487), 3123(487), 3124(487), 3125(487), 3127(487), 3128(487), 3129(487), 3131(10), 3510(21), 3511(21), 3512(21), 3513(21), 3514(21), 3515(21), 5078(348), 5079(348), 5080(348), 5081(348), 5082(348), 5083(348), 5084(348), 5085(348), 5086(348), 5087(348), 5088(348), 5089(348), 5090(348), 5091(348), 5092(348), 5093(348), 5094(348), 5095(348), 5096(348), 5097(348), 5098(348), 5099(338), 5102(338), 5103(338), 5104(338), 5106(338), 5107(338), 5117(338), 7064(497), 9591(4), 9593(6), 9650(6), 9651(5), 9652(5), 9653(5), 9654(6), 0243(472), 03517(21)
