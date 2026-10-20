# Daftar cek isian otomatis - jenis S5 (dispensasi kawin, perwalian, asal usul anak, wali adhal, penetapan ahli waris / P3HP)

Dibangun 20 Okt 2026 oleh agen S5 (butir 10). Berkas ini TIDAK mengubah `DAFTAR-CEK.json` / `DAFTAR-CEK.md` (status 19 Okt) - ia memuat status NYATA jenis S5 sesudah pekerjaan ini, diukur atas data sungguhan (baca saja).

## Cara membaca

- Sel ukur = (perkara x isian "Perlu diisi" dari blangko Derry jenis itu pada kategori itu). Isian bersyarat keadaan (kuasa, prodeo) hanya dihitung pada perkara yang keadaannya berlaku; tanya-jawab saksi (`tj:`) tidak dihitung (milik agen saksi).
- **otomatis** = ada nilai pasti/cukup: terisi sendiri bila saklar "Isi otomatis" menyala dan isiannya kosong; tidak pernah menimpa isian petugas. **ragu** = ada nilai tetapi hanya saran ("yakin: ragu - periksa" + keterangan di ikon i). **ecourt** = hanya bisa dari berkas e-Court (OCR/gugatan/jawab-menjawab/bukti/KTP): tidak terukur lokal. **manual** = tidak mungkin otomatis, ditandai "diisi manual" + alasan. **opsional** = isian tambahan (bila ada), keluar dari "Perlu diisi". **kosong** = celah yang belum tertutup. **syarat tidak berlaku** = isian varian blangko lain untuk perkara itu (mis. 0709 hanya pada perwalian oleh ibu/bapak kandung) - tidak dihitung kosong, dilaporkan terpisah.
- Rantai yang diukur meniru panel (blangko-derry-isian.js -> isiDariSipp): `dariSipp` + `posita-lain` (dariPositaLain -> tambahUsulanJenis -> sambunganPwh -> lengkapiPositaLain -> lengkapiUsulanDk -> blangkoDerry.lengkapiJenis) lalu keputusan `AletaIsiSipp.putuskan` dari `isi-sipp-bersama.js` (yang dipakai ekstensi). "Sebelum" = tag rilis 1.205.17 (70e06f07), "sesudah" = cabang `fitur/isi-otomatis-s5`; ukuran, data, dan skrip yang sama.
- Data: salinan lokal `sipp_donggala` (perkara terdaftar sampai 9 Okt 2026; produksi terbaca sama skemanya, 46 perkara jenis S5 terdaftar 2026 sampai 20 Okt) dan isian manusia di `aps_badilag.abt_data_teks` untuk validasi ketepatan.

## Ukuran sebelum -> sesudah, perkara terdaftar 2025-2026

Perkara diukur: Perwalian 23, Asal Usul Anak 7, Dispensasi Kawin 26, Wali Adhal 1, Penetapan Ahli Waris (P3HP) 29.

### Semua jenis S5, per kategori blangko

| Kategori | sel sebelum | sebelum: otomatis / ragu / kosong | sel sesudah | sesudah: otomatis / ragu | manual | opsional | e-Court / kosong |
| --- | ---: | --- | ---: | --- | ---: | ---: | --- |
| Putusan / penetapan | 2009 | 15,4% / 10,0% / 69,6% | 1890 | 26,9% / 16,7% | 28,6% | 13,7% | 5,0% / 9,3% |
| BAS tiap sidang | 1075 | 26,0% / 12,2% / 53,4% | 1048 | 40,5% / 16,9% | 23,9% | 5,6% | 7,9% / 5,2% |
| Relaas | 298 | 4,4% / 0,0% / 86,6% | 298 | 4,4% / 0,0% | 86,6% | 0,0% | 9,1% / 0,0% |
| PTSP | 56 | 23,2% / 0,0% / 0,0% | 56 | 23,2% / 0,0% | 0,0% | 0,0% | 76,8% / 0,0% |

Sel "syarat tidak berlaku" (dikeluarkan dari penyebut): BAS tiap sidang 27, Putusan / penetapan 119.

### Per jenis dan kategori (persen sel)

| Jenis | Kategori | perkara | sebelum otomatis | sebelum ragu | sebelum kosong | sesudah otomatis | sesudah ragu | manual | opsional | e-Court | kosong |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Perwalian | Putusan / penetapan | 23 | 23,9% | 16,6% | 51,1% | 25,3% | 24,0% | 12,8% | 19,2% | 8,9% | 9,7% |
| Perwalian | BAS tiap sidang | 23 | 34,7% | 14,6% | 46,6% | 37,3% | 15,7% | 22,5% | 11,3% | 4,4% | 8,8% |
| Perwalian | Relaas | 23 | 5,1% | 0,0% | 87,3% | 5,1% | 0,0% | 87,3% | 0,0% | 7,6% | 0,0% |
| Perwalian | PTSP | 23 | 28,6% | 0,0% | 0,0% | 28,6% | 0,0% | 0,0% | 0,0% | 71,4% | 0,0% |
| Asal Usul Anak | Putusan / penetapan | 7 | 8,1% | 5,0% | 78,3% | 34,0% | 26,3% | 17,9% | 13,5% | 4,5% | 3,8% |
| Asal Usul Anak | BAS tiap sidang | 7 | 5,3% | 5,3% | 68,4% | 43,6% | 24,8% | 5,3% | 5,3% | 15,8% | 5,3% |
| Asal Usul Anak | Relaas | 7 | 0,0% | 0,0% | 100,0% | 0,0% | 0,0% | 100,0% | 0,0% | 0,0% | 0,0% |
| Dispensasi Kawin | Putusan / penetapan | 26 | 19,2% | 12,4% | 63,8% | 38,1% | 21,5% | 16,4% | 14,2% | 4,7% | 4,9% |
| Dispensasi Kawin | BAS tiap sidang | 26 | 28,2% | 17,7% | 47,4% | 48,4% | 25,1% | 13,8% | 0,0% | 6,9% | 5,8% |
| Dispensasi Kawin | Relaas | 26 | 0,0% | 0,0% | 100,0% | 0,0% | 0,0% | 100,0% | 0,0% | 0,0% | 0,0% |
| Wali Adhal | Putusan / penetapan | 1 | 10,5% | 21,1% | 57,9% | 16,7% | 27,8% | 27,8% | 16,7% | 11,1% | 0,0% |
| Wali Adhal | BAS tiap sidang | 1 | 42,9% | 28,6% | 28,6% | 42,9% | 28,6% | 28,6% | 0,0% | 0,0% | 0,0% |
| Wali Adhal | Relaas | 1 | 0,0% | 0,0% | 100,0% | 0,0% | 0,0% | 100,0% | 0,0% | 0,0% | 0,0% |
| Penetapan Ahli Waris (P3HP) | Putusan / penetapan | 29 | 10,6% | 6,2% | 80,2% | 18,8% | 8,0% | 45,9% | 10,8% | 3,3% | 13,2% |
| Penetapan Ahli Waris (P3HP) | BAS tiap sidang | 29 | 25,8% | 6,4% | 59,5% | 31,9% | 4,6% | 43,9% | 8,9% | 8,3% | 2,5% |
| Penetapan Ahli Waris (P3HP) | Relaas | 29 | 7,7% | 0,0% | 74,4% | 7,7% | 0,0% | 74,4% | 0,0% | 17,9% | 0,0% |
| Penetapan Ahli Waris (P3HP) | PTSP | 29 | 21,4% | 0,0% | 0,0% | 21,4% | 0,0% | 0,0% | 0,0% | 78,6% | 0,0% |

## Ukuran sebelum -> sesudah, perkara terdaftar 2022-2026 (n lebih besar)

Perkara diukur: Perwalian 62, Asal Usul Anak 8, Dispensasi Kawin 78, Wali Adhal 6, Penetapan Ahli Waris (P3HP) 54.

### Semua jenis S5, per kategori blangko

| Kategori | sel sebelum | sebelum: otomatis / ragu / kosong | sel sesudah | sesudah: otomatis / ragu | manual | opsional | e-Court / kosong |
| --- | ---: | --- | ---: | --- | ---: | ---: | --- |
| Putusan / penetapan | 4722 | 15,8% / 10,9% / 67,4% | 4466 | 26,3% / 17,1% | 25,5% | 14,0% | 6,1% / 11,1% |
| BAS tiap sidang | 2612 | 25,8% / 13,3% / 52,4% | 2532 | 38,4% / 17,4% | 22,2% | 4,9% | 8,5% / 8,6% |
| Relaas | 749 | 5,2% / 0,0% / 83,3% | 749 | 5,2% / 0,0% | 83,3% | 0,0% | 11,5% / 0,0% |
| PTSP | 175 | 22,3% / 0,0% / 0,0% | 175 | 22,3% / 0,0% | 0,0% | 0,0% | 77,7% / 0,0% |

Sel "syarat tidak berlaku" (dikeluarkan dari penyebut): BAS tiap sidang 80, Putusan / penetapan 256.

### Per jenis dan kategori (persen sel)

| Jenis | Kategori | perkara | sebelum otomatis | sebelum ragu | sebelum kosong | sesudah otomatis | sesudah ragu | manual | opsional | e-Court | kosong |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Perwalian | Putusan / penetapan | 62 | 18,3% | 14,3% | 59,1% | 19,2% | 21,3% | 12,7% | 19,1% | 8,7% | 19,1% |
| Perwalian | BAS tiap sidang | 62 | 23,6% | 10,7% | 61,7% | 25,2% | 11,4% | 22,5% | 11,3% | 4,2% | 25,4% |
| Perwalian | Relaas | 62 | 3,8% | 0,0% | 88,2% | 3,8% | 0,0% | 88,2% | 0,0% | 8,1% | 0,0% |
| Perwalian | PTSP | 62 | 22,9% | 0,0% | 0,0% | 22,9% | 0,0% | 0,0% | 0,0% | 77,1% | 0,0% |
| Asal Usul Anak | Putusan / penetapan | 8 | 8,2% | 4,9% | 78,3% | 34,6% | 26,3% | 17,9% | 13,4% | 4,5% | 3,4% |
| Asal Usul Anak | BAS tiap sidang | 8 | 5,3% | 5,3% | 68,4% | 44,1% | 25,0% | 5,3% | 5,3% | 15,8% | 4,6% |
| Asal Usul Anak | Relaas | 8 | 0,0% | 0,0% | 100,0% | 0,0% | 0,0% | 100,0% | 0,0% | 0,0% | 0,0% |
| Dispensasi Kawin | Putusan / penetapan | 78 | 19,6% | 13,4% | 61,9% | 38,1% | 22,2% | 16,1% | 14,3% | 5,4% | 3,9% |
| Dispensasi Kawin | BAS tiap sidang | 78 | 28,6% | 18,9% | 45,1% | 48,3% | 26,2% | 13,8% | 0,0% | 7,7% | 4,0% |
| Dispensasi Kawin | Relaas | 78 | 0,8% | 0,0% | 95,9% | 0,8% | 0,0% | 95,9% | 0,0% | 3,3% | 0,0% |
| Dispensasi Kawin | PTSP | 78 | 14,3% | 0,0% | 0,0% | 14,3% | 0,0% | 0,0% | 0,0% | 85,7% | 0,0% |
| Wali Adhal | Putusan / penetapan | 6 | 10,5% | 21,9% | 57,0% | 14,5% | 28,2% | 26,4% | 16,4% | 10,9% | 3,6% |
| Wali Adhal | BAS tiap sidang | 6 | 40,5% | 28,6% | 31,0% | 40,5% | 28,6% | 28,6% | 0,0% | 0,0% | 2,4% |
| Wali Adhal | Relaas | 6 | 0,0% | 0,0% | 100,0% | 0,0% | 0,0% | 100,0% | 0,0% | 0,0% | 0,0% |
| Penetapan Ahli Waris (P3HP) | Putusan / penetapan | 54 | 11,5% | 6,0% | 77,7% | 18,2% | 7,2% | 44,1% | 10,4% | 5,1% | 15,1% |
| Penetapan Ahli Waris (P3HP) | BAS tiap sidang | 54 | 26,4% | 6,5% | 54,9% | 30,9% | 4,5% | 40,4% | 8,3% | 12,2% | 3,7% |
| Penetapan Ahli Waris (P3HP) | Relaas | 54 | 11,5% | 0,0% | 64,3% | 11,5% | 0,0% | 64,3% | 0,0% | 24,2% | 0,0% |
| Penetapan Ahli Waris (P3HP) | PTSP | 54 | 23,0% | 0,0% | 0,0% | 23,0% | 0,0% | 0,0% | 0,0% | 77,0% | 0,0% |

## Status tiap isian (perkara 2025-2026, semua kategori dijumlah)

Kolom "sebelum" dan "sesudah" = jumlah sel otomatis/ragu/manual-opsional-syarat/kosong. Isian yang terisi pada sebagian perkara saja tampil dengan angka campuran.

### Perwalian

| isian | nama | sebelum (oto/ragu/e-Court/kosong) | sesudah (oto/ragu/e-Court/manual+opsional/syarat/kosong) |
| --- | --- | --- | --- |
| 0007 | Anak dari pernikahan ini | 0/0/23/0 | 0/0/23/0/0/0 |
| 0132 | Tanggal register surat kuasa Penggugat/Pemohon di kepaniteraan | 8/0/0/0 | 8/0/0/0/0/0 |
| 0184 | Tanggal surat kuasa Penggugat/Pemohon | 0/0/8/0 | 0/0/8/0/0/0 |
| 0709 | ibu kandung/bapak kandung perkara Hadhanah | 26/0/0/20 | 26/0/0/0/14/6 |
| 0712 | Bapak/Ibu yang meninggal dari anak yang di walikan Perwalian | 26/0/0/20 | 26/0/0/0/14/6 |
| 1025 | Nama Almarhum / Almarhumah | 26/14/0/6 | 26/14/0/0/0/6 |
| 1154 | Nomor surat permintaan bantuan panggilan | 0/0/0/23 | 0/0/0/23/0/0 |
| 1230 | Tanggal meninggalnya suami | 26/14/0/6 | 26/14/0/0/2/4 |
| 1232 | Tanggal surat | 0/0/0/23 | 0/0/0/23/0/0 |
| 5105 | Alamat Tempat Menikah | 0/14/0/9 | 0/14/0/0/2/7 |
| 5110 | Nama anak | 40/4/2/0 | 40/4/2/0/0/0 |
| 5178 | KUA Kec. | 0/13/0/10 | 0/13/0/0/2/8 |
| 5197 | Tgl Nikah | 15/4/0/4 | 15/4/0/0/2/2 |
| 5230 | Ongkos panggilan permintaan bantuan | 0/0/0/23 | 0/0/0/23/0/0 |
| 6331 | Pekerjaan Calon Suami/Anak Para Pemohon DK / Pekerjaan Perwalian Orang | 0/0/0/23 | 0/23/0/0/0/0 |
| 8131 | Alat Bukti Perwalian Anak | 0/0/0/46 | 0/0/0/46/0/0 |
| 8171 | Alasan Permohonan untuk | 0/32/0/14 | 0/32/0/0/0/14 |
| 8433 | Alasan pencabutan perkara | 0/0/0/46 | 0/0/0/46/0/0 |
| 8537 | Nama advokat Penggugat/Pemohon | 0/0/8/0 | 0/0/8/0/0/0 |
| 8538 | Alamat kantor advokat Penggugat/Pemohon | 0/0/8/0 | 0/0/8/0/0/0 |
| 8539 | Nomor register surat kuasa Penggugat/Pemohon | 8/0/0/0 | 8/0/0/0/0/0 |
| 8548 | Alamat Putusan Penggugat/Pemohon | 0/0/6/0 | 0/0/6/0/0/0 |
| 8549 | Alamat Putusan Tergugat/Termohon | 0/0/2/0 | 0/0/2/0/0/0 |
| 8712 | Nomor dan tanggal surat teguran panitera | 0/0/0/23 | 0/0/0/23/0/0 |
| 8713 | Batas waktu menambah panjar | 0/0/0/23 | 0/0/0/23/0/0 |
| 8714 | Nomor dan tanggal laporan panjar tidak ditambah | 0/0/0/23 | 0/0/0/23/0/0 |
| 9134 | Bas permohonan | 0/0/0/23 | 0/0/0/23/0/0 |

### Asal Usul Anak

| isian | nama | sebelum (oto/ragu/e-Court/kosong) | sesudah (oto/ragu/e-Court/manual+opsional/syarat/kosong) |
| --- | --- | --- | --- |
| 0007 | Anak dari pernikahan ini | 0/0/7/0 | 7/0/0/0/0/0 |
| 0364 | Tgl. KTP Penggugat/Pemohon | 0/0/7/0 | 0/0/7/0/0/0 |
| 0366 | Tgl. KTP Penggugat/Pemohon II | 0/0/7/0 | 0/0/7/0/0/0 |
| 0378 | Bukti Surat IN | 0/0/7/0 | 0/0/7/0/0/0 |
| 0650 | Saksi Nikah 1 | 0/0/0/14 | 14/0/0/0/0/0 |
| 0651 | Saksi Nikah 2 | 0/0/0/14 | 14/0/0/0/0/0 |
| 1001 | Mas kawin | 0/0/0/14 | 0/14/0/0/0/0 |
| 1002 | Status Penggugat/Pemohon sblm nikah (IN) | 0/0/0/14 | 12/0/0/0/0/2 |
| 1003 | Status #2027# sblm nikah (IN) | 0/0/0/14 | 10/0/0/0/0/4 |
| 1046 | Status Wali Nikah | 0/0/0/14 | 12/0/0/0/0/2 |
| 1154 | Nomor surat permintaan bantuan panggilan | 0/0/0/7 | 0/0/0/7/0/0 |
| 1217 | Nama Wali Nikah | 0/0/0/14 | 14/0/0/0/0/0 |
| 1232 | Tanggal surat | 0/0/0/7 | 0/0/0/7/0/0 |
| 5105 | Alamat Tempat Menikah | 0/0/0/14 | 0/14/0/0/0/0 |
| 5178 | KUA Kec. | 0/7/0/0 | 6/0/0/0/0/1 |
| 5197 | Tgl Nikah | 14/0/0/0 | 14/0/0/0/0/0 |
| 5230 | Ongkos panggilan permintaan bantuan | 0/0/0/7 | 0/0/0/7/0/0 |
| 7211 | Umur Isbat P1 (Laki-Laki) | 0/0/0/14 | 0/14/0/0/0/0 |
| 7212 | Umur Isbat P2 (Perempuan) | 0/0/0/14 | 0/10/0/0/0/4 |
| 8087 | Yang Menikahkan | 0/0/0/14 | 0/14/0/0/0/0 |
| 8433 | Alasan pencabutan perkara | 0/0/0/14 | 0/0/0/14/0/0 |
| 8603 | Nama anak yang dimohonkan | 6/1/0/0 | 7/0/0/0/0/0 |
| 8605 | Pernikahan resmi/tercatat para pemohon (aua) | 0/7/0/0 | 0/7/0/0/0/0 |
| 8607 | Fakta tambahan keterangan saksi (aua) | 0/0/0/7 | 0/0/0/7/0/0 |
| 8706 | DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama | 0/0/0/7 | 0/0/0/7/0/0 |
| 8712 | Nomor dan tanggal surat teguran panitera | 0/0/0/7 | 0/0/0/7/0/0 |
| 8713 | Batas waktu menambah panjar | 0/0/0/7 | 0/0/0/7/0/0 |
| 8714 | Nomor dan tanggal laporan panjar tidak ditambah | 0/0/0/7 | 0/0/0/7/0/0 |
| 9134 | Bas permohonan | 0/0/0/7 | 0/0/0/7/0/0 |
| 9709 | AUA - TEMPAT DAN TANGGAL LAHIR ANAK (isian | 0/0/7/0 | 1/1/0/0/5/0 |
| 9710 | AUA - ALASAN ANAK BELUM MEMPUNYAI AKTA KELAHIRAN (isian | 0/0/0/7 | 0/0/0/7/0/0 |
| 9958 | C3. Alat Bukti Isbat Nikah Terpadu | 0/0/7/0 | 0/0/7/0/0/0 |

### Dispensasi Kawin

| isian | nama | sebelum (oto/ragu/e-Court/kosong) | sesudah (oto/ragu/e-Court/manual+opsional/syarat/kosong) |
| --- | --- | --- | --- |
| 0349 | Tgl. Lahir Wanita (Dispensasi) | 0/1/0/25 | 26/0/0/0/0/0 |
| 0600 | Nama Pria (Dispensasi) | 50/2/0/0 | 52/0/0/0/0/0 |
| 0601 | Umur Pria (dispensasi) | 18/0/0/34 | 42/0/0/0/0/10 |
| 0606 | Nama Wanita (Dispensasi) | 50/2/0/0 | 52/0/0/0/0/0 |
| 0607 | Umur Wanita (dispensasi) | 50/2/0/0 | 52/0/0/0/0/0 |
| 0609 | Pendidikan Wanita (dispensasi) | 0/0/0/52 | 52/0/0/0/0/0 |
| 0610 | Pekerjaan Wanita (dispensasi) | 0/0/0/26 | 0/21/0/0/0/5 |
| 0997 | UPT Puskesmas DK | 0/1/0/25 | 0/1/0/13/12/0 |
| 0999 | Umur Kandungan Hamil DK Perempuan | 0/28/0/24 | 0/28/0/0/24/0 |
| 1154 | Nomor surat permintaan bantuan panggilan | 0/0/0/26 | 0/0/0/26/0/0 |
| 1232 | Tanggal surat | 0/0/0/26 | 0/0/0/26/0/0 |
| 1551 | Nama Ayah Calon Suami/Istri DK | 0/52/0/0 | 0/52/0/0/0/0 |
| 1552 | Nama Ayah Calon Suami/Istri DK | 0/0/0/52 | 0/0/0/52/0/0 |
| 1666 | lama pacaran (DK) | 0/52/0/0 | 0/52/0/0/0/0 |
| 2029 | Status Anak Pria (DK) | 0/0/0/52 | 16/24/0/0/0/12 |
| 2030 | Status Anak Wanita (DK) | 0/0/0/52 | 48/0/0/0/0/4 |
| 5178 | KUA Kec. | 52/0/0/0 | 52/0/0/0/0/0 |
| 5230 | Ongkos panggilan permintaan bantuan | 0/0/0/26 | 0/0/0/26/0/0 |
| 6331 | Pekerjaan Calon Suami/Anak Para Pemohon DK / Pekerjaan Perwalian Orang | 0/0/0/52 | 0/34/0/0/0/18 |
| 8433 | Alasan pencabutan perkara | 0/0/0/26 | 0/0/0/26/0/0 |
| 8712 | Nomor dan tanggal surat teguran panitera | 0/0/0/26 | 0/0/0/26/0/0 |
| 8713 | Batas waktu menambah panjar | 0/0/0/26 | 0/0/0/26/0/0 |
| 8714 | Nomor dan tanggal laporan panjar tidak ditambah | 0/0/0/26 | 0/0/0/26/0/0 |
| 8812 | Tanggal Ijazah | 0/0/0/26 | 0/0/0/26/0/0 |
| 9771 | Alasan yang dikemukakan Penggugat/Pemohon untuk mendesaknya perkawinan | 0/0/0/26 | 0/1/0/25/0/0 |
| 9956 | Detektor klasifikasi bukti surat sesuai dengan jenis perkara | 0/0/52/0 | 0/0/52/0/0/0 |

### Wali Adhal

| isian | nama | sebelum (oto/ragu/e-Court/kosong) | sesudah (oto/ragu/e-Court/manual+opsional/syarat/kosong) |
| --- | --- | --- | --- |
| 0652 | No. Surat Penolakan KUA | 0/0/1/0 | 0/0/1/0/0/0 |
| 0653 | Tgl. Surat Penolakan KUA | 0/0/1/0 | 0/0/1/0/0/0 |
| 1002 | Status Penggugat/Pemohon sblm nikah (IN) | 0/0/0/1 | 1/0/0/0/0/0 |
| 1014 | Eratnya Hubungan Calon | 0/2/0/0 | 0/2/0/0/0/0 |
| 1029 | Nama Calon Suami | 2/0/0/0 | 2/0/0/0/0/0 |
| 1030 | Umur Calon/Suami | 2/0/0/0 | 2/0/0/0/0/0 |
| 1046 | Status Wali Nikah | 1/0/0/0 | 1/0/0/0/0/0 |
| 1154 | Nomor surat permintaan bantuan panggilan | 0/0/0/1 | 0/0/0/1/0/0 |
| 1232 | Tanggal surat | 0/0/0/1 | 0/0/0/1/0/0 |
| 5230 | Ongkos panggilan permintaan bantuan | 0/0/0/1 | 0/0/0/1/0/0 |
| 6087 | Alasan Wali Nikah Menolak | 0/2/0/0 | 0/2/0/0/0/0 |
| 6331 | Pekerjaan Calon Suami/Anak Para Pemohon DK / Pekerjaan Perwalian Orang | 0/0/0/1 | 0/1/0/0/0/0 |
| 8433 | Alasan pencabutan perkara | 0/0/0/2 | 0/0/0/2/0/0 |
| 8712 | Nomor dan tanggal surat teguran panitera | 0/0/0/1 | 0/0/0/1/0/0 |
| 8713 | Batas waktu menambah panjar | 0/0/0/1 | 0/0/0/1/0/0 |
| 8714 | Nomor dan tanggal laporan panjar tidak ditambah | 0/0/0/1 | 0/0/0/1/0/0 |
| 9135 | Alat bukti surat wali adhal | 0/0/0/2 | 0/0/0/2/0/0 |
| 9201 | Wali adhal | 0/0/0/1 | 0/0/0/0/1/0 |
| 9203 | Wali adhal | 0/1/0/0 | 0/1/0/0/0/0 |
| 9204 | Wali adhal | 0/0/0/1 | 0/0/0/1/0/0 |
| 9206 | Wali adhal | 0/1/0/0 | 0/1/0/0/0/0 |
| 9207 | Wali adhal | 0/0/0/1 | 0/0/0/1/0/0 |
| 9208 | Wali adhal (tolak) | 0/0/0/1 | 0/0/0/1/0/0 |

### Penetapan Ahli Waris (P3HP)

| isian | nama | sebelum (oto/ragu/e-Court/kosong) | sesudah (oto/ragu/e-Court/manual+opsional/syarat/kosong) |
| --- | --- | --- | --- |
| 0132 | Tanggal register surat kuasa Penggugat/Pemohon di kepaniteraan | 16/0/8/0 | 16/0/8/0/0/0 |
| 0184 | Tanggal surat kuasa Penggugat/Pemohon | 0/0/24/0 | 0/0/24/0/0/0 |
| 1025 | Nama Almarhum / Almarhumah | 44/12/0/2 | 44/12/0/0/0/2 |
| 1154 | Nomor surat permintaan bantuan panggilan | 0/0/0/29 | 0/0/0/29/0/0 |
| 1232 | Tanggal surat | 0/0/0/29 | 0/0/0/29/0/0 |
| 1246 | Tanggal meninggalnya #2026# | 54/2/0/2 | 54/2/0/0/0/2 |
| 1247 | Sebab meninggalnya #2026# | 52/0/0/6 | 52/0/0/0/0/6 |
| 1509 | Tempat Meninggal Dunia | 0/4/0/54 | 0/4/0/54/0/0 |
| 5197 | Tgl Nikah | 9/8/0/12 | 9/8/0/0/4/8 |
| 5230 | Ongkos panggilan permintaan bantuan | 0/0/0/29 | 0/0/0/29/0/0 |
| 8132 | Alat Bukti PAW | 0/0/0/58 | 0/0/0/58/0/0 |
| 8433 | Alasan pencabutan perkara | 0/0/0/58 | 0/0/0/58/0/0 |
| 8537 | Nama advokat Penggugat/Pemohon | 0/0/24/0 | 0/0/24/0/0/0 |
| 8538 | Alamat kantor advokat Penggugat/Pemohon | 0/0/24/0 | 0/0/24/0/0/0 |
| 8539 | Nomor register surat kuasa Penggugat/Pemohon | 20/0/4/0 | 20/0/4/0/0/0 |
| 8548 | Alamat Putusan Penggugat/Pemohon | 0/0/18/0 | 0/0/18/0/0/0 |
| 8549 | Alamat Putusan Tergugat/Termohon | 0/0/6/0 | 0/0/6/0/0/0 |
| 8608 | Nama ahli waris | 0/9/0/20 | 9/10/0/0/5/5 |
| 8610 | Nama suami/istri pewaris | 0/12/0/17 | 0/16/0/0/4/9 |
| 8613 | Kematian suami/istri pewaris | 0/4/0/25 | 0/4/0/25/0/0 |
| 8614 | Harta peninggalan pewaris | 0/24/0/34 | 40/12/0/0/0/6 |
| 8616 | Pengakuan Penggugat/Pemohon atas cacat permohonan | 0/0/0/58 | 0/0/0/58/0/0 |
| 8617 | Uraian cacat formil permohonan (no obscuur) | 0/0/0/58 | 0/0/0/58/0/0 |
| 8706 | DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama | 0/0/0/29 | 0/0/0/29/0/0 |
| 8712 | Nomor dan tanggal surat teguran panitera | 0/0/0/29 | 0/0/0/29/0/0 |
| 8713 | Batas waktu menambah panjar | 0/0/0/29 | 0/0/0/29/0/0 |
| 8714 | Nomor dan tanggal laporan panjar tidak ditambah | 0/0/0/29 | 0/0/0/29/0/0 |
| 9134 | Bas permohonan | 0/0/0/29 | 0/0/0/29/0/0 |
| 9700 | Pencairan dana | 0/0/0/29 | 11/0/0/0/7/11 |
| 9701 | AHLI WARIS - PASANGAN PEWARIS YANG MASIH HIDUP (isian | 0/0/0/29 | 2/1/0/0/10/16 |
| 9702 | AHLI WARIS - ANAK KANDUNG PEWARIS (isian | 0/0/0/29 | 9/9/0/0/5/6 |
| 9703 | AHLI WARIS - AYAH KANDUNG PEWARIS YANG MASIH HIDUP (isian | 0/0/0/29 | 0/0/0/0/13/16 |
| 9704 | AHLI WARIS - IBU KANDUNG PEWARIS YANG MASIH HIDUP (isian | 0/0/0/29 | 1/0/0/0/13/15 |
| 9718 | AHLI WARIS - SAUDARA KANDUNG ATAU SEAYAH PEWARIS (isian | 0/0/0/29 | 7/2/0/0/7/13 |
| 9762 | Ahli waris pengganti: satu anak Pewaris yang meninggal lebih dahulu (s | 0/0/0/29 | 0/0/0/29/0/0 |
| 9763 | Cucu Pewaris, anak dari ahli waris pengganti (nama lengkap dengan bin  | 0/0/0/29 | 0/0/0/29/0/0 |
| 9764 | Kakek, ayah dari ayah Pewaris (nama lengkap dengan bin; kosong = tidak | 0/0/0/29 | 0/0/0/29/0/0 |
| 9765 | Nenek dari pihak ibu Pewaris (nama lengkap dengan binti; kosong = tida | 0/0/0/29 | 0/0/0/29/0/0 |
| 9766 | Nenek dari pihak ayah Pewaris (nama lengkap dengan binti; kosong = tid | 0/0/0/29 | 0/0/0/29/0/0 |
| 9767 | Saudara seibu Pewaris (nama lengkap dengan bin atau binti; beberapa na | 0/0/0/29 | 0/0/0/29/0/0 |

## Pengisi baru - sumber, keyakinan, dan ketepatan

Kode: `aleta_bot/services/isiOtomatisJenisS5.js` + `aleta_bot/services/isiOtomatisS5/{dk,asalUsul,perwalian,waliAdhal,ahliWaris,metadata,bantu}.js`. Sambungan SEMPIT di `abtUsulanService.dariSipp` (satu blok try/catch sesudah blok Z1; usulan yang lebih yakin menggantikan yang lebih lemah dengan kode sama). Hanya SELECT. Semua usulan bertanda `jagaIsianLama` dan membawa catatan untuk ikon i.

Ketepatan = cocok menurut pembanding MAKNA (nama: inti sama; umur: angka; tanggal: sama; pendidikan/pekerjaan/status: kelas sinonim SD = Sekolah Dasar, bujang = jejaka = perjaka) atas isian petugas ABT SEBELUM 1 Sep 2026 (`scripts/isi-sipp-abt/validasi-s5-20okt.cjs`, semua tahun yang punya isian). n kecil disebut apa adanya.

| jenis | isian | sumber | keyakinan | ketepatan atas isian petugas |
| --- | --- | --- | --- | --- |
| DK | 0600 / 0606 nama calon pria / wanita | `perkara_mempelai_dk` (bin/binti menurut SIPP), pembanding posita | pasti bila sama dengan posita, cukup bila hanya SIPP, tanpa usulan bila berbeda orang | 32/32 dan 40/40 |
| DK | 0601 / 0607 umur | tanggal lahir SIPP pada tanggal pendaftaran | pasti bila sama dengan posita, cukup bila hanya SIPP | 17/19 (89%) dan 31/32 (97%); selisihnya salah catat tanggal lahir di SIPP |
| DK | 0349 tanggal lahir calon wanita | `perkara_mempelai_dk.tanggal_lahir` | cukup (pasti bila sama dengan posita) | tidak ada pembanding (isian tanggal belum punya riwayat petugas) |
| DK | 0609 pendidikan calon wanita | kode pendidikan SIPP (SD, SLTP, SLTA ...) | cukup | 30/35 (86%); sisanya salah catat di SIPP |
| DK | 0610 pekerjaan calon wanita | kode pekerjaan SIPP (belum bekerja, pelajar, mengurus rumah tangga) | ragu | 17/25 (68%): petugas bervariasi menulis "belum ada", "tidak ada", "pelajar" |
| DK | 2029 / 2030 status calon | umur < 19 tahun dan posita tidak menyebut janda/duda/cerai -> bujang / gadis | cukup (calon dewasa: ragu) | 12/14 dan 8/8 (kelas sinonim) |
| DK | 6331 pekerjaan calon pria (+ penghasilan) | pekerjaan + `nominal_penghasilan` SIPP, terbilang | ragu | 1/9: petugas menulis pekerjaan sesungguhnya dari sidang |
| DK | 9771 alasan mendesak | kalimat posita "agar terhindar dari ..." | ragu | belum ada pembanding |
| AUA | 5197 5105 5178 1217 1046 8087 0650 0651 1001 1002 1003 7211 7212 0007 (fakta nikah) | pengurai itsbat atas posita (templat AUA sama dengan itsbat); keyakinan dipinjam dari ukuran itsbat nikah (n 230-670) | cukup bila >= 90% pada itsbat (1002 1003 1046 1217 5178 0007 0650 0651), selainnya ragu | pada AUA sendiri: 1-4 pembanding per kode, 17 dari 19 cocok; 5105 0/2 (dipakai petugas sebagai tempat lahir anak ATAU tempat nikah) -> ragu |
| AUA | 8603 nama anak | `perkara_anak_pihak` (pembanding petitum) | pasti bila sama petitum, cukup bila hanya SIPP | belum ada pembanding (isian baru) |
| AUA | 9709 tempat dan tanggal lahir anak | `perkara_anak_pihak` | cukup (satu anak), ragu (beberapa anak) | belum ada pembanding |
| AUA | 9710 alasan belum punya akta | kalimat posita "belum memiliki akta kelahiran karena ..." | ragu | belum ada pembanding |
| PW | 6331 pekerjaan Pemohon | `pihak.pekerjaan` Pemohon | ragu (penghasilan tidak ada di SIPP) | petugas selalu menambah kalimat penghasilan |
| PW | 5110 nama anak | `perkara_anak_pihak` bila petitum tak menyebut | cukup | 3/3 (bacaan petitum yang sudah ada) |
| WA | 1002 status Pemohon | `pihak.status_kawin` (2 gadis, 3/4 janda; kode 1 = bawaan SIPP, tanpa usulan) | cukup | 3/3 |
| WA | 6331 pekerjaan calon suami | kalimat identitas calon suami di posita | ragu | belum ada pembanding |
| PAW | 9701 9702 9703 9704 9718 8608 susunan ahli waris | daftar ahli waris petitum (atau Pemohon SIPP), keterangan hubungan dalam kurung, pola nama (anak = bin/binti nama pewaris, atau nama suami bila pewaris perempuan; saudara = nama ayah pewaris), jumlah dan golongan di posita ("meninggalkan Isteri, tiga orang anak") | cukup hanya bila SEMUA ahli waris tergolong dan jumlah anak sama dengan posita; selainnya ragu; daftar yang tak terpecah tidak diusulkan | atas AMAR putusan 3 perkara berhubungan tertulis: 9 dari 11 ahli waris benar, 0 salah, 2 tidak terbaca; isian baru, belum ada isian petugas |
| PAW | 8610 pasangan pewaris | kalimat posita "menikah dengan ..." (wajib bernama bin/binti) | ragu | belum ada pembanding |
| PAW | 8614 harta peninggalan | kalimat posita "(dan juga) meninggalkan ..." | cukup (ragu bila > 260 huruf) | belum ada pembanding |
| PAW | 9700 pencairan dana | kalimat petitum "pencairan Dana ..." (kata ganda "Dana Dana" diringkas) | cukup | belum ada pembanding |

Isian yang BERGANTUNG varian blangko dicatat sebagai "syarat tidak berlaku" (bukan kosong) bila posita memang tidak memuat keadaannya: 0709/0712/1230 (perwalian oleh ibu/bapak kandung), 0997/0999 (dispensasi karena hamil), 9709 (anak belum punya akta), 5105/5178/5197 (posita tidak menceritakan pernikahan), 9201 (wali ayah kandung), 9700 (tujuan bukan dana), 8610 (tanpa pernikahan), dan susunan ahli waris yang daftarnya terbaca penuh tetapi golongan itu memang tidak ada (9701 9702 9703 9704 9718 8608 - "kosong bila tidak ada" sudah benar).

## Diisi manual (dengan alasan) dan opsional

Tampil sebagai "diisi manual" di kartu dan alasannya di ikon i (hanya selama belum ada nilai maupun saran). Daftar lengkap + alasan: `aleta_bot/services/isiOtomatisS5/metadata.js` (salinan portal: `manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/petunjuk-s5.ts`, dibangun `scripts/isi-sipp-abt/bangun-petunjuk-s5.cjs`, dijaga uji).

- penilaian hakim / pemeriksaan sidang: 8616 8617 9207 9208 8607 8706 9762-9767 8433 8131 8132 9135 8613 9204 1509 0997 1551 1552 9710 9771;
- data tidak ada di SIPP/e-Court terstruktur: 0663 (tanggal penetapan prodeo), 8812 (tanggal ijazah), 1154 / 1232 / 5230 (nomor, tanggal, ongkos permintaan bantuan panggilan - delegasi tidak tercatat terstruktur di SIPP);
- opsional (bukan "Perlu diisi"; `opsional: true` + `labelPengguna`): 9134 "Petunjuk perbaikan permohonan dari majelis (bila ada)", 8712 / 8713 / 8714 (surat teguran dan laporan panjar, "bila ada").

## Yang masih kosong sesudah pekerjaan ini (sisa celah, 2025-2026)

Sebab terbanyak: daftar ahli waris petitum yang tak dapat dipecah (nama bertumpuk, silsilah banyak istri) pada sebagian P3HP; 6331 DK tanpa kode pekerjaan calon pria di SIPP; 8171 perwalian tanpa kalimat keperluan; 2029 calon pria dewasa yang posita-nya tidak bicara status; tanggal nikah pewaris yang tak tertulis. Semuanya tetap diisi petugas; tidak ada yang ditebak.

## Perubahan variabel ABT

Tidak ada. Semua penyelesaian di sisi bot dan ekstensi/portal; tidak ada paket ABT untuk dipasang.

## Mengulang pengukuran

```
node scripts/isi-sipp-abt/ukur-isi-s5-20okt.cjs --dari 2025-01-01 --keluar hasil.json --rinci       # sesudah (repo ini)
node scripts/isi-sipp-abt/ukur-isi-s5-20okt.cjs --akar <salinan tag rilis-1.205.17> --dari 2025-01-01   # sebelum
node scripts/isi-sipp-abt/validasi-s5-20okt.cjs --dari 2015-01-01 --salah       # ketepatan pengisi S5 atas isian petugas
node scripts/isi-sipp-abt/validasi-rantai-s5-20okt.cjs --salah                  # ketepatan SELURUH rantai atas isian petugas
node scripts/isi-sipp-abt/validasi-ahli-waris-s5.cjs --salah                    # golongan ahli waris atas amar putusan
node scripts/isi-sipp-abt/lihat-perkara-s5.cjs "223/Pdt.P/2026/PA.Dgl"          # usulan satu perkara
```

Syarat: MySQL lokal berisi `sipp_donggala` dan `aps_badilag` (atau ubah host lewat `ALETA_BOT_DB_SIPP_HOST`). Hanya SELECT.

## Batas ukuran yang jujur

- Jenis S5 jarang di PA Donggala: 2025-2026 hanya P3HP 29, dispensasi kawin 26, perwalian 23, asal usul anak 7, wali adhal 1 perkara. Ketepatan per kode pada asal usul dan wali adhal bertumpu pada n 1-4; keyakinan keduanya dipinjam dari ukuran itsbat nikah / dasar yang sama dan disebut begitu pada keterangan.
- Isian yang hanya bisa dari berkas e-Court (KTP, kuasa, OCR lampiran, bukti, jawab-menjawab) tidak terukur lokal; dihitung "e-Court" menurut kurasi (`pengisi-kurasi.cjs`).
- "Manual" dan "syarat tidak berlaku" adalah klasifikasi di `metadata.js` yang dapat diperiksa dan dibantah; angka sebelum/sesudah dengan klasifikasi itu tertulis di atas, dan sel yang tersisa "kosong" dipisahkan supaya tidak tertutup klasifikasi.
- Tanya-jawab saksi (`tj:`) tidak dihitung di sini.
