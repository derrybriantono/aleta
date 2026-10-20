# Audit blangko putusan cerai Derry terhadap susunan putusan baku (U2, 20 Okt 2026)

Dibangun oleh `alat/audit_putusan.py` atas 64 blangko putusan kabul/tolak perceraian (folder 1, 1a, 1c, 1d; keadaan server 17 Okt + paket sampai 19 Okt).
Penanda #NNNN# dikembangkan dengan isi kueri variabel server sebelum dicocokkan, jadi bagian yang dibangun variabel (mis. #8528# analisis saksi) tidak dilaporkan hilang.
"wajib" = komponen yang harus ada pada blangko jenis itu (kabul/tolak, verstek, kontradiktoir, cerai talak); komponen akibat perceraian (P17-P24, A4-A10) tidak wajib pada blangko biasa tetapi dilaporkan di bagian "kemampuan menampung".

| id | komponen | blangko wajib | kurang |
|---|---|---:|---:|
| D1 | Posita ringkas | 64 | 0 |
| D2 | Petitum primer dan subsider | 64 | 13 |
| D3 | Pemanggilan dan kehadiran para pihak | 64 | 0 |
| D4 | Upaya damai oleh hakim (Ps 82 UU 7/1989, 31 PP 9/1975) | 64 | 0 |
| D5 | Mediasi dan hasilnya (PERMA 1/2016) | 64 | 0 |
| D6 | Bukti surat dan saksi dalam duduk perkara | 64 | 2 |
| D7 | Kesimpulan para pihak | 64 | 0 |
| D8 | Jawaban, replik, duplik | 16 | 0 |
| P1 | Kewenangan absolut | 64 | 4 |
| P2 | Kewenangan relatif | 64 | 2 |
| P3 | Legal standing, hubungan hukum suami istri (akta nikah) | 64 | 2 |
| P4 | Pemanggilan patut dan verstek (149 RBg) | 21 | 0 |
| P5 | Mediasi (PERMA 1/2016 Ps 4) | 64 | 1 |
| P6 | Klasifikasi dalil diakui dan dibantah | 16 | 0 |
| P7 | Beban pembuktian (283 RBg) | 64 | 2 |
| P8 | Analisis bukti surat per bukti | 64 | 2 |
| P9 | Saksi: syarat formil (172 RBg, 76 UU 7/1989, 22 PP 9/1975) | 64 | 2 |
| P10 | Saksi: analisis materiil per saksi | 64 | 2 |
| P11 | Fakta hukum bernomor | 64 | 6 |
| P12 | Unsur perceraian dan broken marriage (SEMA 3/2018) | 64 | 5 |
| P13 | Pertimbangan menurut huruf alasan A-H (Ps 19 PP 9/1975) | 64 | 5 |
| P14 | Syarat SEMA 1/2022 (pisah 6 bulan / nafkah 12 bulan) | 37 | 37 |
| P15 | Talak raji/bain (Ps 118-119 KHI) | 51 | 0 |
| P16 | Tenggang ikrar talak 6 bulan sejak penetapan hari sidang ikrar (Ps 70(6) UU 7/1989) | 22 | 22 |
| P25 | Biaya perkara (Ps 89 UU 7/1989) | 64 | 0 |
| A1 | Amar: verstek dinyatakan | 21 | 0 |
| A2 | Amar: mengabulkan | 64 | 0 |
| A3 | Amar: talak/izin ikrar/fasakh | 51 | 0 |
| A11 | Amar: biaya perkara | 64 | 0 |

## Rincian blangko yang kurang (komponen wajib)

### D2 - Petitum primer dan subsider (13 blangko)
- 1c Perceraian Kumulasi Itsbat Nikah/[01aa] [Kabul Verstek] Putusan CG Kumulasi Itsbat Nikah - Format Lengkap
- 1c Perceraian Kumulasi Itsbat Nikah/[01aa] [Kabul Verstek] Putusan CT Kumulasi Itsbat Nikah - Format Lengkap
- 1c Perceraian Kumulasi Itsbat Nikah/[01c] [Kabul] Putusan CG Kumulasi Itsbat Nikah - T Tidak Hadir Setelah Mediasi
- 1c Perceraian Kumulasi Itsbat Nikah/[01c] [Kabul] Putusan CT Kumulasi Itsbat Nikah - T Tidak Hadir Setelah Mediasi
- 1c Perceraian Kumulasi Itsbat Nikah/[02] [Kabul] Putusan CT Kumulasi Itsbat Nikah - Kontradiktoir
- 1c Perceraian Kumulasi Itsbat Nikah/[03] [Tolak] Putusan CG Kumulasi Itsbat Nikah - Itsbat Kabul, Cerai Ditolak (Kontradiktoir)
- 1c Perceraian Kumulasi Itsbat Nikah/[03] [Tolak] Putusan CT Kumulasi Itsbat Nikah - Itsbat Kabul, Cerai Ditolak (Kontradiktoir)
- 1c Perceraian Kumulasi Itsbat Nikah/[03b] [Tolak] Putusan CG Kumulasi Itsbat Nikah - Itsbat Ditolak (Rukun Syarat Tidak Terbukti), Cerai NO
- 1c Perceraian Kumulasi Itsbat Nikah/[03b] [Tolak] Putusan CT Kumulasi Itsbat Nikah - Itsbat Ditolak (Rukun Syarat Tidak Terbukti), Cerai NO
- 1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[01] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak - Anak Belum Mumayyiz
- 1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[01b] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak dan Nafkah Anak - Anak Belum Mumayyiz
- 1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[01c] [Kabul] Putusan CG Kumulasi Hak Asuh Anak - T Tidak Hadir Setelah Mediasi
- 1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak/[01d] [Kabul] Putusan CG Kumulasi Hak Asuh dan Nafkah Anak - T Tidak Hadir Setelah Mediasi

### D6 - Bukti surat dan saksi dalam duduk perkara (2 blangko)
- 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1a Perceraian CT/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti

### P1 - Kewenangan absolut (4 blangko)
- 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1a Perceraian CT/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1c Perceraian Kumulasi Itsbat Nikah/[01aa] [Kabul Verstek] IN + CG - B & F
- 1c Perceraian Kumulasi Itsbat Nikah/[01aa] [Kabul Verstek] IN + CG - F

### P2 - Kewenangan relatif (2 blangko)
- 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1a Perceraian CT/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti

### P3 - Legal standing, hubungan hukum suami istri (akta nikah) (2 blangko)
- 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1a Perceraian CT/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti

### P5 - Mediasi (PERMA 1/2016 Ps 4) (1 blangko)
- 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Unus Testis Nullus Testis

### P7 - Beban pembuktian (283 RBg) (2 blangko)
- 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1a Perceraian CT/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti

### P8 - Analisis bukti surat per bukti (2 blangko)
- 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1a Perceraian CT/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti

### P9 - Saksi: syarat formil (172 RBg, 76 UU 7/1989, 22 PP 9/1975) (2 blangko)
- 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1a Perceraian CT/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti

### P10 - Saksi: analisis materiil per saksi (2 blangko)
- 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1a Perceraian CT/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti

### P11 - Fakta hukum bernomor (6 blangko)
- 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1 Perceraian CG/[03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak Terbukti
- 1a Perceraian CT/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1a Perceraian CT/[03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak Terbukti
- 1c Perceraian Kumulasi Itsbat Nikah/[03b] [Tolak] Putusan CG Kumulasi Itsbat Nikah - Itsbat Ditolak (Rukun Syarat Tidak Terbukti), Cerai NO
- 1c Perceraian Kumulasi Itsbat Nikah/[03b] [Tolak] Putusan CT Kumulasi Itsbat Nikah - Itsbat Ditolak (Rukun Syarat Tidak Terbukti), Cerai NO

### P12 - Unsur perceraian dan broken marriage (SEMA 3/2018) (5 blangko)
- 1 Perceraian CG/[01a] [Kabul Verstek] Cerai - Alasan E (Qabla Ad Dukhul)
- 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1a Perceraian CT/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1c Perceraian Kumulasi Itsbat Nikah/[03b] [Tolak] Putusan CG Kumulasi Itsbat Nikah - Itsbat Ditolak (Rukun Syarat Tidak Terbukti), Cerai NO
- 1c Perceraian Kumulasi Itsbat Nikah/[03b] [Tolak] Putusan CT Kumulasi Itsbat Nikah - Itsbat Ditolak (Rukun Syarat Tidak Terbukti), Cerai NO

### P13 - Pertimbangan menurut huruf alasan A-H (Ps 19 PP 9/1975) (5 blangko)
- 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1 Perceraian CG/[01ab] [Tolak Verstek] Cerai - Unus Testis Nullus Testis
- 1a Perceraian CT/[01ab] [Tolak Verstek] Cerai - Tidak ada bukti
- 1c Perceraian Kumulasi Itsbat Nikah/[03b] [Tolak] Putusan CG Kumulasi Itsbat Nikah - Itsbat Ditolak (Rukun Syarat Tidak Terbukti), Cerai NO
- 1c Perceraian Kumulasi Itsbat Nikah/[03b] [Tolak] Putusan CT Kumulasi Itsbat Nikah - Itsbat Ditolak (Rukun Syarat Tidak Terbukti), Cerai NO

### P14 - Syarat SEMA 1/2022 (pisah 6 bulan / nafkah 12 bulan) (37 blangko)
- 1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi)
- 1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap) - (4 Saksi)
- 1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap) - (5 Saksi)
- 1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap)
- 1 Perceraian CG/[01a] [Kabul Verstek] Cerai - Alasan E (Qabla Ad Dukhul)
- 1 Perceraian CG/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - (3 Saksi)
- 1 Perceraian CG/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - (4 Saksi)
- 1 Perceraian CG/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - (5 Saksi)
- 1 Perceraian CG/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi
- 1 Perceraian CG/[01d] [Kabul Verstek] Cerai (Format Lengkap) - Kumulasi Nafkah Istri (Madliyah, Iddah, Mutah)
- 1 Perceraian CG/[02] [Kabul] CG - F
- 1 Perceraian CG/[02a] [Kabul] CG - T Tidak Hadir Setelah Mediasi - F
- 1 Perceraian CG/[02b] [Kabul] CG - F - Mediasi Berhasil Sebagian (Kesepakatan Dimuat dalam Amar)
- 1 Perceraian CG/[02c] [Kabul] CG - F - Pencabutan Ditolak T Sesudah Jawaban
- 1 Perceraian CG/[02c] [Kabul] CG - Kumulasi Nafkah Istri (Madliyah, Iddah, Mutah) - Kontradiktoir
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi)
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - (4 Saksi)
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - (5 Saksi)
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - (3 Saksi)
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - (4 Saksi)
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - (5 Saksi)
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap)
- 1a Perceraian CT/[01a] [Kabul Verstek] CT - F (Ex Offiicio mutah iddah dan nafkah anak)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - (3 Saksi)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - (4 Saksi)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - (5 Saksi)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - Mut'ah Iddah - (3 Saksi)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - Mut'ah Iddah - (4 Saksi)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - Mut'ah Iddah - (5 Saksi)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - Mut'ah Iddah
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi
- 1a Perceraian CT/[02] [Kabul] CT - F
- 1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak)
- 1a Perceraian CT/[02a] [Kabul] CT - T Tidak Hadir Setelah Mediasi - F
- 1a Perceraian CT/[02b] [Kabul] CT - F - Mediasi Berhasil Sebagian (Kesepakatan Dimuat dalam Amar)
- 1a Perceraian CT/[02c] [Kabul] CT - F - Pencabutan Ditolak T Sesudah Jawaban

### P16 - Tenggang ikrar talak 6 bulan sejak penetapan hari sidang ikrar (Ps 70(6) UU 7/1989) (22 blangko)
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - (3 Saksi)
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - (4 Saksi)
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - (5 Saksi)
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - (3 Saksi)
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - (4 Saksi)
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah - (5 Saksi)
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap) - Mut'ah Iddah
- 1a Perceraian CT/[01] [Kabul Verstek] Cerai (Format Lengkap)
- 1a Perceraian CT/[01a] [Kabul Verstek] CT - F (Ex Offiicio mutah iddah dan nafkah anak)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - (3 Saksi)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - (4 Saksi)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - (5 Saksi)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - Mut'ah Iddah - (3 Saksi)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - Mut'ah Iddah - (4 Saksi)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - Mut'ah Iddah - (5 Saksi)
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi - Mut'ah Iddah
- 1a Perceraian CT/[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi
- 1a Perceraian CT/[02] [Kabul] CT - F
- 1a Perceraian CT/[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak)
- 1a Perceraian CT/[02a] [Kabul] CT - T Tidak Hadir Setelah Mediasi - F
- 1a Perceraian CT/[02b] [Kabul] CT - F - Mediasi Berhasil Sebagian (Kesepakatan Dimuat dalam Amar)
- 1a Perceraian CT/[02c] [Kabul] CT - F - Pencabutan Ditolak T Sesudah Jawaban

## Kemampuan menampung akibat perceraian (bukan kewajiban, hanya fakta)

Jumlah blangko kabul yang SUDAH memuat pertimbangan/amar komponen tersebut (dari 51):

| id | komponen | memuat |
|---|---|---:|
| P17 | Pembayaran akibat cerai sebelum ikrar / sebelum akta cerai | 12 |
| P18 | Hadhanah: pertimbangan (Ps 105/156 KHI, kepentingan terbaik anak) | 10 |
| P19 | Hadhanah: anak mumayyiz (didengar, memilih)  | 2 |
| P20 | Nafkah anak (Ps 41 b UU 1/1974, 149 d, 156 d KHI, SEMA 3/2015 10-20%) | 7 |
| P21 | Nafkah iddah (Ps 149 b KHI, SEMA 3/2018) | 20 |
| P22 | Mut'ah (Ps 149 a KHI) | 12 |
| P23 | Nafkah madliyah | 12 |
| P24 | Harta bersama (Ps 86 UU 7/1989, 97 KHI) | 3 |
| A4 | Amar: hadhanah (dengan akses orang tua lain) | 10 |
| A5 | Amar: nafkah anak (kenaikan per tahun) | 3 |
| A6 | Amar: nafkah iddah | 4 |
| A7 | Amar: mut'ah | 4 |
| A8 | Amar: nafkah madliyah | 3 |
| A9 | Amar: pembayaran sebelum ikrar / akta cerai | 4 |
