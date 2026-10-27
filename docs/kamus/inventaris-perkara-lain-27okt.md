# Inventaris variabel dan kamus blangko Derry - perkara selain cerai (27 Okt 2026)

Dibangun oleh `scripts/isi-sipp-abt/bangun-inventaris-perkara-lain-27okt.cjs` dari ukuran di `docs/kamus/data/`. Tanpa nama pihak: hanya hitungan dan nama variabel ABT.

## Cara mengukur

- **Terisi otomatis** diukur lewat rute bot `/abt/usulan` sungguhan (sumber `sipp` + `itsbat` atau `posita-lain`) dan mesin bersama ekstensi (`isi-sipp-bersama.js`) atas perkara terdaftar sejak 2023 di salinan `sipp_donggala` (maks 40 perkara per jenis/alur, terbaru dahulu; skrip `ukur-perkara-lain-27okt.cjs`). Ruas yang dihitung = isian popup bukan-bersyarat (kuasa/prodeo/alasan C-H dikecualikan) pada blangko putusan + BAS jenis itu (relaas, PTSP, sita lintas jenis tidak dihitung).
- Kelas: **otomatis** = mesin menulis (pasti/cukup); **ragu** = hanya saran bertanda 'periksa'; **manual** = ditandai 'diisi manual' beserta alasan; **ecourt** = bergantung berkas e-Court (tak terukur lokal); **kosong** = tak ada pengisi dan belum ditandai (sebagian BENAR kosong: isian berbunyi 'kosong bila tidak ada').
- **Ketepatan** diukur terhadap isian petugas yang tersimpan di ABT lokal (`aps_badilag.abt_data_teks`) lewat modul deteksi murni (`ukur-akurasi-abt-27okt.cjs`); **kamus** diukur dengan `ukur-kamus-jenis-27okt.cjs` (waktu = tercepat dari 5 putaran, CPU murni).
- Sampel kecil: jenis selain itsbat/DK/PAW/perwalian punya 1-13 perkara sejak 2023; angkanya petunjuk, bukan bukti ketepatan. Gerbang otomatis (n pembanding >= 20, cocok >= 90%) hanya mungkin untuk itsbat dan dispensasi kawin; jenis lain tetap saran 'ragu' sampai datanya cukup.
- Waktu rute (ms/perkara) ikut berubah menurut beban laptop (4 agen paralel); yang dijadikan bukti performa adalah waktu kamus murni di tabel 3.

## 1. Ringkasan per jenis/alur (sebelum -> sesudah, % dari ruas x perkara)

| jenis/alur | jenis | perkara diukur | ruas | otomatis | ragu | manual | e-Court | kosong | ms rute (min 3 putaran) |
| --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| 360/16 | Itsbat nikah (pengesahan perkawinan) | 40 | 39 | 26 -> **31.1** | 12.4 -> **7.3** | 51.3 | 7.7 | 0 | 54 -> 55 |
| 362/16 | Dispensasi kawin | 40 | 23 | 25.5 | 29.1 | 17.4 | 4.3 | 23.6 | 54 -> 55 |
| 371/16 | Penetapan ahli waris (P3HP) | 40 | 30 | 1.2 | 22.8 | 18.3 -> **25** | 0 | 54.4 -> **47.8** | 61 -> 65 |
| 354/16 | Perwalian | 40 | 17 | 7.6 | 36 | 32.6 | 6 | 11.8 | 59 -> 58 |
| 360/15 | Itsbat nikah (pengesahan perkawinan) | 39 | 50 | 23.3 -> **27.3** | 9.8 -> **7.7** | 46.4 | 18.1 | 2.5 -> **0.6** | 59 -> 60 |
| 364/15 | Kewarisan | 13 | 33 | 0 | 16.1 | 45 | 21.2 | 17.7 | 260 -> 260 |
| 358/16 | Asal usul anak | 8 | 29 | 25.4 -> **31** | 29.3 -> **23.7** | 15.5 | 14.7 | 11.6 | 59 -> 58 |
| 348/15 | Harta bersama | 8 | 38 | 2.3 | 14.5 | 39.5 | 33.6 | 10.2 | 118 -> 115 |
| 369/16 | Lain-lain (pengangkatan anak, hak asuh) | 5 | 13 | 0 | 18.5 | 55.4 | 0 | 18.5 | 52 -> 51 |
| 363/16 | Wali adhal | 3 | 20 | 5 | 41.7 | 20 -> **30** | 10 | 23.3 -> **13.3** | 77 -> 81 |
| 341/15 | Izin poligami | 2 | 18 | 0 | 33.3 | 44.4 | 22.2 | 0 | 48 -> 48 |
| 370/17 | Ekonomi syariah | 2 | 14 | 0 | 21.4 | 14.3 | 42.9 | 21.4 | 72 -> 70 |
| 365/15 | Wasiat | 1 | 25 | 0 | 16 | 36 | 28 | 20 | 90 -> 87 |
| 369/15 | Lain-lain (pengangkatan anak, hak asuh) | 1 | 33 | 0 | 3 | 21.2 | 24.2 | 51.5 | 141 -> 157 |

## 2. Ruas per jenis: keadaan sebelum dan sesudah

Kolom o/r/m/e/k = jumlah perkara (dari n) yang otomatis / ragu / manual / e-Court / kosong. `label` = punya label bahasa mudah, `pil` = punya pilihan bawaan, `gerbang` = status ledger `gerbang-isian.json` (kode@posita atau @sipp). Hanya ruas yang belum seluruhnya otomatis dan dipakai >= 3 blangko, atau yang berubah.

### 360/16 - Itsbat nikah (pengesahan perkawinan) (n = 40, 36 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 5197 | Tgl Nikah | 28 | 39/0/1/0/0 | 39/0/1/0/0 | - -> - | - -> - | sipp:saran posita:otomatis |
| 1001 | Mas kawin | 22 | 17/0/23/0/0 | 17/0/23/0/0 | - -> - | - -> - | posita:otomatis |
| 1046 | Status Wali Nikah | 22 | 38/0/2/0/0 | 38/0/2/0/0 | - -> - | - -> - | posita:otomatis |
| 1217 | Nama Wali Nikah | 22 | 39/0/1/0/0 | 39/0/1/0/0 | - -> - | - -> - | posita:otomatis |
| 9958 | C3. Alat Bukti Isbat Nikah Terpadu | 18 | 0/0/0/40/0 | 0/0/0/40/0 | - -> ada | - -> - | - |
| 5178 | KUA Kec. | 17 | 38/0/2/0/0 | 38/0/2/0/0 | - -> - | - -> - | posita:otomatis |
| 7211 | Umur Isbat P1 (Laki-Laki) | 16 | 17/21/2/0/0 | 17/21/2/0/0 | - -> - | - -> - | sipp:otomatis posita:otomatis |
| 7212 | Umur Isbat P2 (Perempuan) | 16 | 17/21/2/0/0 | 17/21/2/0/0 | - -> - | - -> - | sipp:otomatis posita:otomatis |
| 1002 | Status Penggugat/Pemohon sblm nikah (IN) | 15 | 0/40/0/0/0 | 40/0/0/0/0 | - -> ada | - -> ada | posita:otomatis sipp:saran |
| 1003 | Status #2027# sblm nikah (IN) | 15 | 0/40/0/0/0 | 40/0/0/0/0 | - -> ada | - -> ada | posita:otomatis |
| 0364 | Tgl. KTP Penggugat/Pemohon | 8 | 0/0/0/40/0 | 0/0/0/40/0 | - -> - | - -> - | - |
| 0366 | Tgl. KTP Penggugat/Pemohon II | 8 | 0/0/0/40/0 | 0/0/0/40/0 | - -> - | - -> - | - |
| 8171 | Alasan Permohonan untuk | 7 | 0/40/0/0/0 | 0/40/0/0/0 | - -> ada | - -> ada | posita:saran |
| 9134 | Petunjuk perbaikan permohonan (bila majelis memberi petunjuk | 7 | 0/0/0/0/0 | 0/0/0/0/0 | ada -> ada | - -> - | - |
| 0228 | Alasan Syahadah Istifadhah (Itsbat Nikah / Isbat / PAW) | 4 | 0/0/40/0/0 | 0/0/40/0/0 | - -> - | - -> - | - |
| 8433 | Alasan pencabutan perkara | 3 | 0/0/40/0/0 | 0/0/40/0/0 | ada -> ada | - -> - | sipp:saran |

### 362/16 - Dispensasi kawin (n = 40, 29 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 0600 | Nama Pria (Dispensasi) | 23 | 40/0/0/0/0 | 40/0/0/0/0 | - -> ada | - -> - | sipp:otomatis posita:otomatis |
| 0606 | Nama Wanita (Dispensasi) | 23 | 40/0/0/0/0 | 40/0/0/0/0 | - -> ada | - -> - | sipp:otomatis posita:otomatis |
| 1551 | Nama Ayah Calon Suami/Istri DK | 20 | 0/40/0/0/0 | 0/40/0/0/0 | - -> ada | - -> - | posita:saran |
| 1552 | Nama Ayah Calon Suami/Istri DK | 20 | 0/0/0/0/40 | 0/0/0/0/40 | - -> ada | - -> - | - |
| 2029 | Status Anak Pria (DK) | 20 | 0/34/0/0/6 | 0/34/0/0/6 | - -> ada | - -> ada | sipp:saran |
| 2030 | Status Anak Wanita (DK) | 20 | 0/38/0/0/2 | 0/38/0/0/2 | - -> ada | - -> ada | sipp:saran |
| 6331 | Pekerjaan Calon Suami/Anak Para Pemohon DK / Pekerjaan Perwa | 20 | 0/25/0/0/15 | 0/25/0/0/15 | - -> ada | - -> ada | sipp:saran posita:saran |
| 9956 | Detektor klasifikasi bukti surat sesuai dengan jenis perkara | 20 | 0/0/0/40/0 | 0/0/0/40/0 | - -> ada | - -> - | - |
| 0601 | Umur Pria (dispensasi) | 20 | 35/0/0/0/5 | 35/0/0/0/5 | - -> ada | - -> - | sipp:otomatis posita:saran |
| 0607 | Umur Wanita (dispensasi) | 20 | 40/0/0/0/0 | 40/0/0/0/0 | - -> ada | - -> - | posita:otomatis sipp:otomatis |
| 1666 | lama pacaran (DK) | 18 | 0/40/0/0/0 | 0/40/0/0/0 | - -> ada | - -> ada | posita:otomatis |
| 0609 | Pendidikan Wanita (dispensasi) | 18 | 0/38/0/0/2 | 0/38/0/0/2 | - -> ada | - -> ada | sipp:saran |
| 0999 | Umur Kandungan Hamil DK Perempuan | 9 | 0/19/0/0/21 | 0/19/0/0/21 | - -> ada | - -> - | posita:saran |
| 8812 | Tanggal Ijazah | 6 | 0/0/0/0/40 | 0/0/0/0/40 | - -> ada | - -> - | - |
| 0610 | Pekerjaan Wanita (dispensasi) | 4 | 0/31/0/0/9 | 0/31/0/0/9 | - -> ada | - -> ada | sipp:saran |
| 0997 | UPT Puskesmas DK | 3 | 0/2/0/0/38 | 0/2/0/0/38 | - -> ada | - -> - | posita:saran |

### 371/16 - Penetapan ahli waris (P3HP) (n = 40, 22 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 1025 | Nama Almarhum / Almarhumah | 14 | 0/39/1/0/0 | 0/39/1/0/0 | - -> - | - -> - | posita:saran |
| 1246 | Tanggal meninggalnya #2026# | 11 | 0/39/1/0/0 | 0/39/1/0/0 | - -> - | - -> - | posita:saran |
| 1247 | Sebab meninggalnya #2026# | 11 | 0/36/4/0/0 | 0/36/4/0/0 | - -> - | - -> - | posita:saran |
| 1509 | Tempat Meninggal Dunia | 11 | 0/4/36/0/0 | 0/4/36/0/0 | - -> - | - -> - | - |
| 8614 | Harta peninggalan pewaris | 11 | 0/33/0/0/7 | 0/33/0/0/7 | - -> ada | - -> - | posita:saran |
| 8132 | Alat Bukti PAW | 8 | 0/0/0/0/40 | 0/0/0/0/40 | - -> ada | - -> - | - |
| 9134 | Petunjuk perbaikan permohonan (bila majelis memberi petunjuk | 8 | 0/0/0/0/0 | 0/0/0/0/0 | ada -> ada | - -> - | - |
| 8616 | Pengakuan Penggugat/Pemohon atas cacat permohonan | 2 | 0/0/0/0/40 | 0/0/40/0/0 | - -> ada | - -> - | - |
| 8617 | Uraian cacat formil permohonan (no obscuur) | 2 | 0/0/0/0/40 | 0/0/40/0/0 | - -> ada | - -> - | - |
| 9700 | Pencairan dana | 2 | 0/11/0/0/29 | 0/11/0/0/29 | - -> ada | - -> - | - |
| 9701 | AHLI WARIS - PASANGAN PEWARIS YANG MASIH HIDUP (isian | 2 | 0/8/0/0/32 | 0/8/0/0/32 | - -> ada | - -> - | posita:saran |
| 9702 | AHLI WARIS - ANAK KANDUNG PEWARIS (isian | 2 | 0/26/0/0/14 | 0/26/0/0/14 | - -> ada | - -> - | posita:saran |
| 9703 | AHLI WARIS - AYAH KANDUNG PEWARIS YANG MASIH HIDUP (isian | 2 | 0/0/0/0/40 | 0/0/0/0/40 | - -> ada | - -> - | - |
| 9704 | AHLI WARIS - IBU KANDUNG PEWARIS YANG MASIH HIDUP (isian | 2 | 0/1/0/0/39 | 0/1/0/0/39 | - -> ada | - -> - | - |
| 9718 | AHLI WARIS - SAUDARA KANDUNG ATAU SEAYAH PEWARIS (isian | 2 | 0/11/0/0/29 | 0/11/0/0/29 | - -> ada | - -> - | - |
| 8608 | Nama ahli waris | 1 | 0/28/0/0/12 | 0/28/0/0/12 | - -> ada | - -> - | posita:saran |
| 8610 | Nama suami/istri pewaris | 1 | 0/23/0/0/17 | 0/23/0/0/17 | - -> ada | - -> - | - |
| 8613 | Kematian suami/istri pewaris | 1 | 0/6/0/0/34 | 0/6/0/0/34 | - -> ada | - -> - | - |
| 8706 | DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama | 1 | 0/0/0/0/40 | 0/0/0/0/40 | - -> ada | - -> - | - |

### 354/16 - Perwalian (n = 40, 18 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 1025 | Nama Almarhum / Almarhumah | 10 | 0/31/9/0/0 | 0/31/9/0/0 | - -> - | - -> - | posita:saran |
| 1230 | Tanggal meninggalnya suami | 10 | 0/31/0/0/9 | 0/31/0/0/9 | - -> - | - -> - | posita:saran |
| 5110 | Nama anak | 10 | 20/19/0/1/0 | 20/19/0/1/0 | - -> - | - -> - | sipp:terstruktur posita:saran |
| 8171 | Alasan Permohonan untuk | 10 | 0/29/0/0/11 | 0/29/0/0/11 | - -> ada | - -> ada | posita:saran |
| 0709 | ibu kandung/bapak kandung perkara Hadhanah | 10 | 0/20/20/0/0 | 0/20/20/0/0 | - -> - | - -> - | sipp:terstruktur posita:saran |
| 0712 | Bapak/Ibu yang meninggal dari anak yang di walikan Perwalian | 10 | 0/20/0/0/20 | 0/20/0/0/20 | - -> ada | - -> ada | posita:saran |
| 9134 | Petunjuk perbaikan permohonan (bila majelis memberi petunjuk | 8 | 0/0/0/0/0 | 0/0/0/0/0 | ada -> ada | - -> - | - |
| 8131 | Alat Bukti Perwalian Anak | 6 | 0/0/0/0/40 | 0/0/0/0/40 | - -> ada | - -> - | - |
| 6331 | Pekerjaan Calon Suami/Anak Para Pemohon DK / Pekerjaan Perwa | 2 | 0/40/0/0/0 | 0/40/0/0/0 | - -> ada | - -> ada | sipp:saran posita:saran |

### 360/15 - Itsbat nikah (pengesahan perkawinan) (n = 39, 99 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 5197 | Tgl Nikah | 22 | 37/0/2/0/0 | 37/0/2/0/0 | - -> - | - -> - | sipp:saran posita:otomatis |
| 5178 | KUA Kec. | 20 | 38/0/1/0/0 | 38/0/1/0/0 | - -> - | - -> - | posita:otomatis |
| 9955 | Bukti surat perceraian (otomatis) | 19 | 0/0/0/39/0 | 0/0/0/39/0 | - -> - | - -> - | - |
| 7084 | Penanda konvensi/rekonvensi (1 apabila ada) | 18 | 0/0/0/39/0 | 0/0/0/39/0 | - -> - | - -> - | - |
| 9881 | lisan atau tertulis (jawaban replik dan duplik) | 18 | 0/0/0/39/0 | 0/0/0/39/0 | - -> - | - -> - | - |
| 9911 | Alat bukti surat Tergugat/Termohon | 17 | 0/0/0/39/0 | 0/0/0/39/0 | ada -> ada | - -> - | - |
| 8436 | Kesimpulan Penggugat/Pemohon | 14 | 0/0/0/39/0 | 0/0/0/39/0 | ada -> ada | - -> - | - |
| 8437 | Kesimpulan Tergugat/Termohon | 13 | 0/0/0/39/0 | 0/0/0/39/0 | ada -> ada | - -> - | - |
| 1002 | Status Penggugat/Pemohon sblm nikah (IN) | 11 | 0/39/0/0/0 | 39/0/0/0/0 | - -> ada | - -> ada | posita:otomatis sipp:saran |
| 1003 | Status #2027# sblm nikah (IN) | 11 | 0/39/0/0/0 | 39/0/0/0/0 | - -> ada | - -> ada | posita:otomatis |
| 1046 | Status Wali Nikah | 11 | 33/0/6/0/0 | 33/0/6/0/0 | - -> - | - -> - | posita:otomatis |
| 8087 | Yang Menikahkan | 11 | 38/0/1/0/0 | 38/0/1/0/0 | - -> - | - -> - | posita:otomatis |
| 8433 | Alasan pencabutan perkara | 11 | 0/0/39/0/0 | 0/0/39/0/0 | ada -> ada | - -> - | sipp:saran |
| 1025 | Nama Almarhum / Almarhumah | 10 | 0/37/2/0/0 | 0/37/2/0/0 | - -> - | - -> - | posita:saran |
| 1268 | Upaya damai oleh keluarga | 8 | 0/0/39/0/0 | 0/0/39/0/0 | ada -> ada | ada -> ada | posita:saran |
| 7035 | Yang meninggalkan rumah bersama | 8 | 0/0/39/0/0 | 0/0/39/0/0 | ada -> ada | ada -> ada | posita:otomatis |
| 8503 | Alasan perceraian | 8 | 0/0/39/0/0 | 0/0/39/0/0 | ada -> ada | ada -> ada | posita:saran |
| 9944 | Lama pisah rumah | 8 | 0/0/39/0/0 | 0/0/39/0/0 | ada -> ada | - -> - | posita:otomatis |
| 0222 | Awal perselisihan | 8 | 0/0/39/0/0 | 0/0/39/0/0 | ada -> ada | ada -> ada | posita:otomatis |
| 0246 | Pisah rumah sejak | 8 | 0/0/39/0/0 | 0/0/39/0/0 | ada -> ada | ada -> ada | posita:otomatis |
| 0007 | Anak dari pernikahan ini | 7 | 38/0/0/1/0 | 38/0/0/1/0 | ada -> ada | - -> - | sipp:otomatis posita:otomatis |
| 1214 | Alat bukti surat Penggugat/Pemohon | 6 | 0/0/0/39/0 | 0/0/0/39/0 | ada -> ada | - -> - | - |
| 5227 | Rincian alasan cerai (sesuai gugatan) | 6 | 0/0/0/39/0 | 0/0/0/39/0 | ada -> ada | - -> - | posita:saran |
| 9958 | C3. Alat Bukti Isbat Nikah Terpadu | 6 | 0/0/0/39/0 | 0/0/0/39/0 | - -> ada | - -> - | - |
| 1006 | Tempat tinggal setelah menikah | 4 | 0/0/0/0/39 | 0/37/0/0/2 | ada -> ada | - -> - | posita:otomatis |
| 1267 | Masih berkomunikasi atau tidak | 4 | 0/0/39/0/0 | 0/0/39/0/0 | ada -> ada | ada -> ada | posita:saran |
| 2557 | (Saksi I) Berapa Kali Melihat dan Mendengar Pertengkaran | 4 | 0/0/39/0/0 | 0/0/39/0/0 | - -> - | - -> - | - |
| 2558 | (Saksi II) Berapa Kali Melihat dan Mendengar Pertengkaran | 4 | 0/0/39/0/0 | 0/0/39/0/0 | - -> - | - -> - | - |
| 5127 | Alasan-Alasan Cerai | 4 | 0/0/39/0/0 | 0/0/39/0/0 | - -> - | - -> - | posita:saran |
| 1246 | Tanggal meninggalnya #2026# | 3 | 0/34/5/0/0 | 0/34/5/0/0 | - -> - | - -> - | posita:saran |
| 1247 | Sebab meninggalnya #2026# | 3 | 0/11/28/0/0 | 0/11/28/0/0 | - -> - | - -> - | posita:saran |
| 1509 | Tempat Meninggal Dunia | 3 | 0/0/39/0/0 | 0/0/39/0/0 | - -> - | - -> - | - |
| 7211 | Umur Isbat P1 (Laki-Laki) | 3 | 38/1/0/0/0 | 38/1/0/0/0 | - -> - | - -> - | sipp:otomatis posita:otomatis |
| 7212 | Umur Isbat P2 (Perempuan) | 3 | 37/1/1/0/0 | 37/1/1/0/0 | - -> - | - -> - | sipp:otomatis posita:otomatis |
| 8712 | Nomor dan tanggal surat teguran panitera | 3 | 0/0/39/0/0 | 0/0/39/0/0 | ada -> ada | - -> - | - |
| 8713 | Batas waktu menambah panjar | 3 | 0/0/39/0/0 | 0/0/39/0/0 | ada -> ada | - -> - | - |
| 8714 | Nomor dan tanggal laporan panjar tidak ditambah | 3 | 0/0/39/0/0 | 0/0/39/0/0 | ada -> ada | - -> - | - |
| 8171 | Alasan Permohonan untuk | 2 | 0/29/0/0/10 | 0/29/0/0/10 | - -> ada | - -> ada | posita:saran |

### 364/15 - Kewarisan (n = 13, 58 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 9955 | Bukti surat perceraian (otomatis) | 13 | 0/0/0/13/0 | 0/0/0/13/0 | - -> - | - -> - | - |
| 7084 | Penanda konvensi/rekonvensi (1 apabila ada) | 12 | 0/0/0/13/0 | 0/0/0/13/0 | - -> - | - -> - | - |
| 8436 | Kesimpulan Penggugat/Pemohon | 12 | 0/0/0/13/0 | 0/0/0/13/0 | ada -> ada | - -> - | - |
| 9881 | lisan atau tertulis (jawaban replik dan duplik) | 12 | 0/0/0/13/0 | 0/0/0/13/0 | - -> - | - -> - | - |
| 1025 | Nama Almarhum / Almarhumah | 9 | 0/10/3/0/0 | 0/10/3/0/0 | - -> - | - -> - | posita:saran |
| 8437 | Kesimpulan Tergugat/Termohon | 9 | 0/0/0/13/0 | 0/0/0/13/0 | ada -> ada | - -> - | - |
| 8706 | DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama | 9 | 0/0/0/0/13 | 0/0/0/0/13 | - -> ada | - -> - | - |
| 9911 | Alat bukti surat Tergugat/Termohon | 8 | 0/0/0/13/0 | 0/0/0/13/0 | ada -> ada | - -> - | - |
| 1246 | Tanggal meninggalnya #2026# | 7 | 0/9/4/0/0 | 0/9/4/0/0 | - -> - | - -> - | posita:saran |
| 1509 | Tempat Meninggal Dunia | 7 | 0/2/11/0/0 | 0/2/11/0/0 | - -> - | - -> - | - |
| 8433 | Alasan pencabutan perkara | 7 | 0/2/11/0/0 | 0/2/11/0/0 | ada -> ada | - -> - | sipp:saran |
| 1247 | Sebab meninggalnya #2026# | 6 | 0/5/8/0/0 | 0/5/8/0/0 | - -> - | - -> - | posita:saran |
| 8717 | Kewarisan | 5 | 0/1/0/0/12 | 0/1/0/0/12 | - -> ada | - -> - | - |
| 8718 | Kewarisan | 5 | 0/13/0/0/0 | 0/13/0/0/0 | - -> ada | - -> - | - |
| 8719 | Kewarisan | 5 | 0/3/0/0/10 | 0/3/0/0/10 | - -> ada | - -> - | - |
| 8704 | Isi kesepakatan perdamaian | 2 | 0/2/0/0/11 | 0/2/0/0/11 | - -> ada | - -> - | sipp:saran |
| 9161 | SITA: JENIS SITA YANG DIMOHONKAN; contoh lain: sita marital | 1 | 0/7/0/0/6 | 0/7/0/0/6 | - -> ada | - -> ada | - |
| 9165 | Pemeriksaan setempat | 1 | 0/0/13/0/0 | 0/0/13/0/0 | - -> ada | - -> - | - |
| 9166 | Pemeriksaan setempat | 1 | 0/0/13/0/0 | 0/0/13/0/0 | - -> ada | - -> - | - |
| 9167 | Pemeriksaan setempat | 1 | 0/0/13/0/0 | 0/0/13/0/0 | - -> ada | - -> - | - |
| 9168 | Pemeriksaan setempat | 1 | 0/0/13/0/0 | 0/0/13/0/0 | - -> ada | - -> - | - |

### 358/16 - Asal usul anak (n = 8, 21 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 5105 | Alamat Tempat Menikah | 12 | 0/8/0/0/0 | 0/8/0/0/0 | - -> - | - -> - | posita:otomatis |
| 9134 | Petunjuk perbaikan permohonan (bila majelis memberi petunjuk | 7 | 0/0/0/0/0 | 0/0/0/0/0 | ada -> ada | - -> - | - |
| 9958 | C3. Alat Bukti Isbat Nikah Terpadu | 6 | 0/0/0/8/0 | 0/0/0/8/0 | - -> ada | - -> - | - |
| 1001 | Mas kawin | 5 | 0/8/0/0/0 | 0/8/0/0/0 | - -> - | - -> - | posita:otomatis |
| 1002 | Status Penggugat/Pemohon sblm nikah (IN) | 5 | 0/7/0/0/1 | 7/0/0/0/1 | - -> ada | - -> ada | posita:otomatis sipp:saran |
| 1003 | Status #2027# sblm nikah (IN) | 5 | 0/6/0/0/2 | 6/0/0/0/2 | - -> ada | - -> ada | posita:otomatis |
| 1046 | Status Wali Nikah | 5 | 7/0/1/0/0 | 7/0/1/0/0 | - -> - | - -> - | posita:otomatis |
| 7211 | Umur Isbat P1 (Laki-Laki) | 5 | 0/8/0/0/0 | 0/8/0/0/0 | - -> - | - -> - | sipp:otomatis posita:otomatis |
| 7212 | Umur Isbat P2 (Perempuan) | 5 | 0/6/2/0/0 | 0/6/2/0/0 | - -> - | - -> - | sipp:otomatis posita:otomatis |
| 8087 | Yang Menikahkan | 5 | 0/8/0/0/0 | 0/8/0/0/0 | - -> - | - -> - | posita:otomatis |
| 5178 | KUA Kec. | 3 | 7/0/1/0/0 | 7/0/1/0/0 | - -> - | - -> - | posita:otomatis |
| 8603 | Nama anak yang dimohonkan | 3 | 5/3/0/0/0 | 5/3/0/0/0 | - -> - | - -> - | sipp:terstruktur posita:saran |
| 0364 | Tgl. KTP Penggugat/Pemohon | 3 | 0/0/0/8/0 | 0/0/0/8/0 | - -> - | - -> - | - |
| 0366 | Tgl. KTP Penggugat/Pemohon II | 3 | 0/0/0/8/0 | 0/0/0/8/0 | - -> - | - -> - | - |
| 0378 | Bukti Surat IN | 3 | 0/0/0/8/0 | 0/0/0/8/0 | - -> ada | - -> - | - |
| 8605 | Pernikahan resmi/tercatat para pemohon (aua) | 2 | 0/8/0/0/0 | 0/8/0/0/0 | - -> ada | - -> - | posita:saran |
| 8607 | Fakta tambahan keterangan saksi (aua) | 2 | 0/0/0/0/8 | 0/0/0/0/8 | - -> ada | - -> - | - |
| 8706 | DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama | 1 | 0/0/0/0/8 | 0/0/0/0/8 | - -> ada | - -> - | - |
| 9709 | AUA - TEMPAT DAN TANGGAL LAHIR ANAK (isian | 1 | 0/6/0/2/0 | 0/6/0/2/0 | - -> ada | - -> - | sipp:saran posita:saran |
| 9710 | AUA - ALASAN ANAK BELUM MEMPUNYAI AKTA KELAHIRAN (isian | 1 | 0/0/0/0/8 | 0/0/0/0/8 | - -> ada | - -> - | - |

### 348/15 - Harta bersama (n = 8, 58 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 7084 | Penanda konvensi/rekonvensi (1 apabila ada) | 12 | 0/0/0/8/0 | 0/0/0/8/0 | - -> - | - -> - | - |
| 9881 | lisan atau tertulis (jawaban replik dan duplik) | 12 | 0/0/0/8/0 | 0/0/0/8/0 | - -> - | - -> - | - |
| 9955 | Bukti surat perceraian (otomatis) | 12 | 0/0/0/8/0 | 0/0/0/8/0 | - -> - | - -> - | - |
| 8436 | Kesimpulan Penggugat/Pemohon | 10 | 0/0/0/8/0 | 0/0/0/8/0 | ada -> ada | - -> - | - |
| 9911 | Alat bukti surat Tergugat/Termohon | 8 | 0/0/0/8/0 | 0/0/0/8/0 | ada -> ada | - -> - | - |
| 8437 | Kesimpulan Tergugat/Termohon | 7 | 0/0/0/8/0 | 0/0/0/8/0 | ada -> ada | - -> - | - |
| 8433 | Alasan pencabutan perkara | 6 | 0/1/7/0/0 | 0/1/7/0/0 | ada -> ada | - -> - | sipp:saran |
| 8730 | Harta bersama | 5 | 0/8/0/0/0 | 0/8/0/0/0 | - -> ada | - -> - | - |
| 1108 | Nomor duplikat surat nikah | 2 | 0/2/0/6/0 | 0/2/0/6/0 | - -> ada | - -> - | posita:saran |
| 5032 | Harta bersama/gono-gini | 2 | 0/8/0/0/0 | 0/8/0/0/0 | - -> ada | - -> - | - |
| 8704 | Isi kesepakatan perdamaian | 2 | 0/2/0/0/6 | 0/2/0/0/6 | - -> ada | - -> - | sipp:saran |
| 9282 | Harta bersama | 2 | 0/0/8/0/0 | 0/0/8/0/0 | - -> ada | - -> - | - |
| 9283 | Harta bersama rekonvensi | 2 | 0/0/0/8/0 | 0/0/0/8/0 | - -> ada | - -> - | - |
| 9951 | Bukti elektronik Penggugat/Pemohon | 2 | 0/0/0/8/0 | 0/0/0/8/0 | - -> ada | - -> - | - |
| 9952 | Bukti elektronik Tergugat/Termohon | 2 | 0/0/0/8/0 | 0/0/0/8/0 | - -> ada | - -> - | - |
| 8706 | DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama | 1 | 0/6/0/0/2 | 0/6/0/0/2 | - -> ada | - -> - | - |
| 9161 | SITA: JENIS SITA YANG DIMOHONKAN; contoh lain: sita marital | 1 | 0/5/0/0/3 | 0/5/0/0/3 | - -> ada | - -> ada | - |
| 9165 | Pemeriksaan setempat | 1 | 0/0/8/0/0 | 0/0/8/0/0 | - -> ada | - -> - | - |
| 9166 | Pemeriksaan setempat | 1 | 0/0/8/0/0 | 0/0/8/0/0 | - -> ada | - -> - | - |
| 9167 | Pemeriksaan setempat | 1 | 0/0/8/0/0 | 0/0/8/0/0 | - -> ada | - -> - | - |
| 9168 | Pemeriksaan setempat | 1 | 0/0/8/0/0 | 0/0/8/0/0 | - -> ada | - -> - | - |

### 369/16 - Lain-lain (pengangkatan anak, hak asuh) (n = 5, 27 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 8618 | TEMPAT DAN TANGGAL LAHIR ANAK (pengangkatan anak) | 9 | 0/0/5/0/0 | 0/0/5/0/0 | - -> ada | - -> - | - |
| 8619 | NAMA ORANG TUA KANDUNG ANAK (pengangkatan anak) | 9 | 0/4/0/0/1 | 0/4/0/0/1 | - -> ada | - -> - | - |
| 8622 | STATUS PERKAWINAN Penggugat/Pemohon (pengangkatan anak) | 9 | 0/4/0/0/1 | 0/4/0/0/1 | - -> ada | - -> ada | - |
| 8623 | Hubungan Penggugat/Pemohon dengan calon anak angkat | 9 | 0/0/0/0/5 | 0/0/0/0/5 | - -> ada | - -> ada | - |
| 9134 | Petunjuk perbaikan permohonan (bila majelis memberi petunjuk | 8 | 0/0/0/0/0 | 0/0/0/0/0 | ada -> ada | - -> - | - |
| 8621 | Alat bukti surat pengangkatan anak | 6 | 0/0/5/0/0 | 0/0/5/0/0 | - -> ada | - -> - | - |
| 8433 | Alasan pencabutan perkara | 5 | 0/0/5/0/0 | 0/0/5/0/0 | ada -> ada | - -> - | sipp:saran |
| 8620 | Keterangan orang tua kandung di persidangan | 5 | 0/0/5/0/0 | 0/0/5/0/0 | - -> ada | - -> - | - |
| 8706 | DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama | 1 | 0/0/0/0/5 | 0/0/0/0/5 | - -> ada | - -> - | - |

### 363/16 - Wali adhal (n = 3, 17 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 1014 | Eratnya Hubungan Calon | 9 | 0/3/0/0/0 | 0/3/0/0/0 | - -> ada | - -> ada | posita:saran |
| 1029 | Nama Calon Suami | 9 | 0/3/0/0/0 | 0/3/0/0/0 | - -> ada | - -> - | posita:saran |
| 1030 | Umur Calon/Suami | 9 | 0/3/0/0/0 | 0/3/0/0/0 | - -> ada | - -> - | posita:saran |
| 6087 | Alasan Wali Nikah Menolak | 9 | 0/3/0/0/0 | 0/3/0/0/0 | - -> ada | - -> - | posita:saran |
| 9135 | Alat bukti surat wali adhal | 6 | 0/0/0/0/3 | 0/0/0/0/3 | - -> ada | - -> - | - |
| 1002 | Status Penggugat/Pemohon sblm nikah (IN) | 3 | 0/3/0/0/0 | 0/3/0/0/0 | - -> ada | - -> ada | posita:otomatis sipp:saran |
| 6331 | Pekerjaan Calon Suami/Anak Para Pemohon DK / Pekerjaan Perwa | 3 | 0/3/0/0/0 | 0/3/0/0/0 | - -> ada | - -> ada | sipp:saran posita:saran |
| 9201 | Wali adhal | 3 | 0/1/0/0/2 | 0/1/0/0/2 | - -> ada | - -> - | posita:saran |
| 9203 | Wali adhal | 3 | 0/3/0/0/0 | 0/3/0/0/0 | - -> ada | - -> ada | posita:saran |
| 9204 | Wali adhal | 3 | 0/0/0/0/3 | 0/0/0/0/3 | - -> ada | - -> ada | - |
| 9206 | Wali adhal | 3 | 0/3/0/0/0 | 0/3/0/0/0 | - -> ada | - -> - | posita:saran |
| 0652 | No. Surat Penolakan KUA | 3 | 0/0/0/3/0 | 0/0/0/3/0 | - -> ada | - -> - | posita:saran |
| 0653 | Tgl. Surat Penolakan KUA | 3 | 0/0/0/3/0 | 0/0/0/3/0 | - -> - | - -> - | posita:saran |
| 9207 | Wali adhal | 1 | 0/0/0/0/3 | 0/0/3/0/0 | - -> ada | - -> - | - |
| 9208 | Wali adhal (tolak) | 1 | 0/0/0/0/3 | 0/0/3/0/0 | - -> ada | - -> - | - |

### 341/15 - Izin poligami (n = 2, 41 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 7084 | Penanda konvensi/rekonvensi (1 apabila ada) | 12 | 0/0/0/2/0 | 0/0/0/2/0 | - -> - | - -> - | - |
| 9955 | Bukti surat perceraian (otomatis) | 8 | 0/0/0/2/0 | 0/0/0/2/0 | - -> - | - -> - | - |
| 8723 | Izin poligami | 5 | 0/2/0/0/0 | 0/2/0/0/0 | - -> ada | - -> - | - |
| 8722 | Izin poligami | 4 | 0/2/0/0/0 | 0/2/0/0/0 | - -> ada | - -> - | - |
| 8433 | Alasan pencabutan perkara | 3 | 0/0/2/0/0 | 0/0/2/0/0 | ada -> ada | - -> - | sipp:saran |
| 8724 | Izin poligami | 3 | 0/2/0/0/0 | 0/2/0/0/0 | - -> ada | - -> - | - |
| 9911 | Alat bukti surat Tergugat/Termohon | 3 | 0/0/0/2/0 | 0/0/0/2/0 | ada -> ada | - -> - | - |
| 8725 | Izin poligami | 2 | 0/2/0/0/0 | 0/2/0/0/0 | - -> ada | - -> - | - |
| 8726 | Izin poligami | 2 | 0/0/2/0/0 | 0/0/2/0/0 | - -> ada | - -> - | - |
| 1152 | Alasan poligami | 1 | 0/2/0/0/0 | 0/2/0/0/0 | - -> ada | - -> - | - |
| 8720 | Izin poligami | 1 | 0/2/0/0/0 | 0/2/0/0/0 | - -> ada | - -> ada | - |
| 9170 | Izin poligami | 1 | 0/0/2/0/0 | 0/0/2/0/0 | - -> ada | - -> - | - |
| 9171 | Izin poligami | 1 | 0/0/2/0/0 | 0/0/2/0/0 | - -> ada | - -> - | - |

### 370/17 - Ekonomi syariah (n = 2, 18 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 9340 | Akad yang disengketakan (jenis akad, nomor, tanggal) | 5 | 0/2/0/0/0 | 0/2/0/0/0 | ada -> ada | - -> - | - |
| 8433 | Alasan pencabutan perkara | 4 | 0/0/2/0/0 | 0/0/2/0/0 | ada -> ada | - -> - | sipp:saran |
| 9955 | Bukti surat perceraian (otomatis) | 4 | 0/0/0/2/0 | 0/0/0/2/0 | - -> - | - -> - | - |
| 8436 | Kesimpulan Penggugat/Pemohon | 3 | 0/0/0/2/0 | 0/0/0/2/0 | ada -> ada | - -> - | - |
| 9341 | Jumlah kewajiban Tergugat/Termohon yang dikabulkan (rupiah,  | 3 | 0/2/0/0/0 | 0/2/0/0/0 | ada -> ada | - -> - | - |
| 9911 | Alat bukti surat Tergugat/Termohon | 3 | 0/0/0/2/0 | 0/0/0/2/0 | ada -> ada | - -> - | - |

### 365/15 - Wasiat (n = 1, 47 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 7084 | Penanda konvensi/rekonvensi (1 apabila ada) | 12 | 0/0/0/1/0 | 0/0/0/1/0 | - -> - | - -> - | - |
| 9488 | Alat bukti surat Penggugat/Pemohon (daftar bukti P.1 dst.; k | 10 | 0/0/0/1/0 | 0/0/0/1/0 | ada -> ada | - -> - | - |
| 1025 | Nama Almarhum / Almarhumah | 6 | 0/1/0/0/0 | 0/1/0/0/0 | - -> - | - -> - | posita:saran |
| 8436 | Kesimpulan Penggugat/Pemohon | 6 | 0/0/0/1/0 | 0/0/0/1/0 | ada -> ada | - -> - | - |
| 9475 | Pokok tuntutan wasiat (pilih satu huruf) | 6 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | ada -> ada | - |
| 9478 | Bentuk dan tanggal wasiat (mis. "secara tertulis tertanggal  | 6 | 0/1/0/0/0 | 0/1/0/0/0 | ada -> ada | - -> - | posita:saran |
| 9479 | Objek wasiat (benda atau manfaat yang diwasiatkan: objek, bu | 6 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 9480 | Penerima wasiat (nama atau sebutan; kosong = otomatis) | 6 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 9486 | Kedudukan Penggugat/Pemohon (mis. ahli waris dari pewasiat,  | 6 | 0/1/0/0/0 | 0/1/0/0/0 | ada -> ada | - -> - | posita:saran |
| 9487 | Kedudukan Tergugat/Termohon (mis. penerima wasiat, ahli wari | 6 | 0/1/0/0/0 | 0/1/0/0/0 | ada -> ada | - -> - | posita:saran |
| 9489 | Alat bukti surat Tergugat/Termohon (daftar bukti T.1 dst.; k | 6 | 0/0/0/1/0 | 0/0/0/1/0 | ada -> ada | - -> - | - |
| 9881 | lisan atau tertulis (jawaban replik dan duplik) | 6 | 0/0/0/1/0 | 0/0/0/1/0 | - -> - | - -> - | - |
| 1246 | Tanggal meninggalnya #2026# | 5 | 0/0/1/0/0 | 0/0/1/0/0 | - -> - | - -> - | posita:saran |
| 8433 | Alasan pencabutan perkara | 4 | 0/0/1/0/0 | 0/0/1/0/0 | ada -> ada | - -> - | sipp:saran |
| 8437 | Kesimpulan Tergugat/Termohon | 3 | 0/0/0/1/0 | 0/0/0/1/0 | ada -> ada | - -> - | - |
| 9482 | Fakta pokok tuntutan yang terbukti (uraian singkat dari bukt | 3 | 0/0/1/0/0 | 0/0/1/0/0 | ada -> ada | - -> - | - |
| 8704 | Isi kesepakatan perdamaian | 2 | 0/0/0/0/1 | 0/0/0/0/1 | - -> ada | - -> - | sipp:saran |

### 369/15 - Lain-lain (pengangkatan anak, hak asuh) (n = 1, 56 blangko)

| ruas | nama di ABT | pakai | sebelum o/r/m/e/k | sesudah o/r/m/e/k | label | pil | gerbang |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| 9955 | Bukti surat perceraian (otomatis) | 17 | 0/0/0/1/0 | 0/0/0/1/0 | - -> - | - -> - | - |
| 8603 | Nama anak yang dimohonkan | 14 | 0/1/0/0/0 | 0/1/0/0/0 | - -> - | - -> - | sipp:terstruktur posita:saran |
| 9303 | Identitas anak (nama, tempat dan tanggal lahir; satu anak sa | 14 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 8436 | Kesimpulan Penggugat/Pemohon | 13 | 0/0/0/1/0 | 0/0/0/1/0 | ada -> ada | - -> - | - |
| 9881 | lisan atau tertulis (jawaban replik dan duplik) | 13 | 0/0/0/1/0 | 0/0/0/1/0 | - -> - | - -> - | - |
| 7084 | Penanda konvensi/rekonvensi (1 apabila ada) | 12 | 0/0/0/1/0 | 0/0/0/1/0 | - -> - | - -> - | - |
| 9911 | Alat bukti surat Tergugat/Termohon | 11 | 0/0/0/1/0 | 0/0/0/1/0 | ada -> ada | - -> - | - |
| 8437 | Kesimpulan Tergugat/Termohon | 8 | 0/0/0/1/0 | 0/0/0/1/0 | ada -> ada | - -> - | - |
| 9305 | Keadaan pengasuhan anak saat ini (boleh dikosongkan, nanti m | 8 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 8433 | Alasan pencabutan perkara | 6 | 0/0/1/0/0 | 0/0/1/0/0 | ada -> ada | - -> - | sipp:saran |
| 5271 | Penghasilan Tergugat/Termohon Perbulan | 3 | 0/0/0/1/0 | 0/0/0/1/0 | - -> - | - -> - | - |
| 9310 | Pertimbangan penolakan hak asuh | 3 | 0/0/1/0/0 | 0/0/1/0/0 | ada -> ada | - -> - | - |
| 9740 | Nafkah anak ke depan: jumlah setiap bulan (rupiah, angka saj | 3 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 9741 | Kenaikan nafkah anak setiap tahun (persen, angka 10 sampai 2 | 3 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 9742 | Biaya pendidikan dan kesehatan anak (rincian; kosong = tidak | 3 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 9743 | Sita jaminan: objek yang dirinci (letak, luas, batas, sertif | 3 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 9744 | Dasar kemampuan Tergugat/Termohon dan standar biaya hidup mi | 3 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 9745 | Pemotongan langsung dari penghasilan Tergugat/Termohon: nama | 3 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 9746 | Nafkah lampau anak: jangka waktu (mis. sejak bulan ... sampa | 3 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 9747 | Nafkah lampau anak: jumlah (rupiah dan terbilang, mis. jumla | 3 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 9748 | Fakta pengasuhan dan kelalaian nafkah (berpisah sejak kapan, | 3 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 9749 | Kedudukan Penggugat/Pemohon bila bukan ibu atau ayah kandung | 3 | 0/0/0/0/1 | 0/0/0/0/1 | ada -> ada | - -> - | - |
| 8704 | Isi kesepakatan perdamaian | 2 | 0/0/0/0/1 | 0/0/0/0/1 | - -> ada | - -> - | sipp:saran |
| 8706 | DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama | 1 | 0/0/0/0/1 | 0/0/0/0/1 | - -> ada | - -> - | - |

## 3. Kamus per jenis (benih) - bunyi keluaran, pola, performa

Atas seluruh posita jenis itu sejak 2022-06 di `sipp_donggala`. `ringkas`/`lengkap` = jumlah perkara yang menghasilkan kalimat pokok keterangan saksi; `usulan/perkara` = variabel bernomor ABT yang terbaca per perkara; waktu murni CPU (tanpa kueri SIPP).

| jenis kamus | perkara | ringkas | lengkap | usulan/perkara | kunci fakta | ms/perkara |
| --- | ---: | --- | --- | --- | --- | --- |
| perwalian (354) | 49 | 0 -> **49** | 0 -> **49** | 2.53 -> 2.73 | 7 -> 9 | 0.388 -> 0.452 |
| itsbat-nikah (360) | 848 | 848 | 848 | 14.20 -> 14.24 | 20 -> 21 | 0.813 -> 0.8 |
| dispensasi-kawin (362) | 71 | 71 | 71 | 8.48 -> 8.48 | 11 -> 11 | 0.899 -> 0.866 |
| wali-adhol (363) | 4 | 0 -> **4** | 0 -> **4** | 1.75 -> 3.50 | 3 -> 4 | 0.217 -> 0.317 |
| kewarisan (364/365) | 16 | 0 -> **16** | 0 -> **16** | 0.38 -> 0.38 | 5 -> 5 | 0.665 -> 0.738 |
| penetapan-ahli-waris (371) | 53 | 53 | 53 | 1.77 -> 1.77 | 6 -> 6 | 0.336 -> 0.329 |
| harta-bersama (348) | 8 | 0 -> **8** | 0 -> **8** | 0.00 -> 0.00 | 3 -> 5 | 0.419 -> 0.473 |
| izin-poligami (341) | 2 | 0 -> **2** | 0 -> **2** | 0.00 -> 0.00 | 2 -> 3 | 0.149 -> 0.198 |
| asal-usul (358) | 8 | 0 -> **8** | 0 -> **8** | 14.25 -> 14.25 | 19 -> 19 | 0.961 -> 0.806 |
| ekonomi-syariah (370) | 2 | 0 -> **2** | 0 -> **2** | 0.00 -> 0.00 | 2 -> 2 | 0.388 -> 0.446 |

## 4. Ketepatan modul deteksi atas isian petugas (ABT lokal)

sama = nilai identik setelah huruf kecil dan buang tanda; mirip = salah satu memuat yang lain; beda = lain. Pembanding teks biasa MENGHUKUM sinonim (Perjaka/Jejaka); lihat `UKURAN-GERBANG-MAKNA-27OKT.json` untuk pembanding makna.

**Itsbat nikah (pengesahan perkawinan)** - 714 perkara ber-ABT; deteksi 0.78 -> 0.57 ms/perkara

| ruas | banding | sama | mirip | beda | hanya mesin | hanya petugas |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 5105 | 684 | 186 | 201 | 297 | 26 | 4 |
| 1002 | 678 | 101 | 252 | 325 | 34 | 2 |
| 1003 | 677 | 322 | 254 | 101 | 35 | 2 |
| 1046 | 638 | 412 | 130 | 96 | 28 | 42 |
| 0007 | 563 | 142 | 205 | 216 | 64 | 86 |
| 5178 | 278 | 247 | 13 | 18 | 384 | 0 |
| 7211 | 233 | 186 | 32 | 15 | 425 | 44 |
| 7212 | 233 | 183 | 31 | 19 | 425 | 44 |
| 1025 | 5 | 3 | 2 | 0 | 30 | 2 |

**Dispensasi kawin** - 55 perkara ber-ABT; deteksi 1.12 -> 0.99 ms/perkara

| ruas | banding | sama | mirip | beda | hanya mesin | hanya petugas |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0606 | 46 | 41 | 5 | 0 | 9 | 0 |
| 0600 | 38 | 33 | 3 | 2 | 17 | 0 |
| 0607 | 38 | 28 | 6 | 4 | 16 | 0 |
| 0601 | 12 | 10 | 0 | 2 | 7 | 15 |
| 1666 | 9 | 4 | 0 | 5 | 46 | 0 |
| 1551 | 8 | 2 | 4 | 2 | 47 | 0 |

**Penetapan ahli waris (P3HP)** - 36 perkara ber-ABT; deteksi 2.23 -> 2.45 ms/perkara

| ruas | banding | sama | mirip | beda | hanya mesin | hanya petugas |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1025 | 16 | 14 | 2 | 0 | 20 | 0 |
| 1247 | 13 | 12 | 1 | 0 | 20 | 2 |

**Perwalian** - 35 perkara ber-ABT; deteksi 2.64 -> 1.71 ms/perkara

| ruas | banding | sama | mirip | beda | hanya mesin | hanya petugas |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 8171 | 6 | 0 | 1 | 5 | 11 | 1 |
| 1025 | 5 | 2 | 3 | 0 | 21 | 0 |
| 0709 | 5 | 5 | 0 | 0 | 13 | 0 |
| 0712 | 5 | 5 | 0 | 0 | 13 | 0 |

