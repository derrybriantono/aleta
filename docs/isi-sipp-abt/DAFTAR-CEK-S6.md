# Daftar cek isian otomatis jenis agen S6 (harta bersama, kewarisan, wasiat, hibah, wakaf, poligami, pembatalan/pencegahan, hak asuh/nafkah anak, Lain-Lain, ekonomi syariah)

Dibangun 2026-10-20 oleh `scripts/isi-sipp-abt/laporan-s6.cjs` dari `UKURAN-S6-SEBELUM.json` dan `UKURAN-S6-SESUDAH.json` (hasil `ukur-s6.cjs`). DAFTAR-CEK.json/.md (status 19 Okt) tidak diubah.

## Cara membaca

- **Isian** = isian popup "Perlu diisi" (data_teks, data_tanggal, tanya_jawab) yang dipakai blangko Derry bagian itu (kode unik).
- Angka dalam tabel: **sebelum → sesudah** pekerjaan S6.
- **otomatis** = pengisi memberi nilai pasti/cukup (ditulis sendiri hanya bila isian kosong dan saklar "Isi otomatis" menyala; tidak pernah menimpa isian petugas). **ragu** = saran (kotak samar, tombol Tab) dengan lencana "yakin: ragu - periksa", "dari posita gugatan" dan kalimat sumber. **manual** = tidak mungkin otomatis; lencana "diisi manual" dan alasan di ikon keterangan (ada yang `opsional` + `labelPengguna`). **belum** = celah: tidak ada pengisi dan tidak ada alasan. **dasar** = sudah ada pengisi lama yang membaca berkas e-Court, kuasa, KTP, bukti atau data ALETA - tidak dapat diukur ulang di laptop (data e-Court tidak ada di salinan lokal), dihitung apa adanya dari DAFTAR-CEK.json.
- **Kelas diukur**, bukan diklaim: otomatis/ragu/manual berarti pengisi BENAR-BENAR memberi hasil itu atas sekurang-kurangnya satu perkara nyata di salinan lokal SIPP (sipp_donggala, semua tahun) atau, bila jenis itu tidak punya perkara nyata (hibah, wakaf, mafqud), atas perkara contoh realistis (`scripts/isi-sipp-abt/fixture-s6.cjs`, ditandai).

## Sambungan, pembagian dengan agen lain, dan batas

- **Titik sambung (sempit)**: satu blok bertanda `S6 20 Okt` di akhir `dariSipp` (`aleta_bot/services/abtUsulanService.js`) memanggil `aleta_bot/services/isiOtomatisJenisS6.js`. `dariSipp` (sumber "sipp") SELALU diminta Blangko Derry untuk SEMUA kategori (putusan/penetapan, BAS tiap sidang, relaas, PTSP, sita), jadi satu sambungan menjangkau semuanya. Perkara di luar jenis S6 dijawab kosong sesudah SATU pembacaan kecil.
- **Berkas baru**: `aleta_bot/services/deteksi/isiS6.js` (pembaca posita/petitum murni), `aleta_bot/services/isiOtomatisJenisS6.js` (data terstruktur SIPP + tabel isian manual), `manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/petunjuk-s6.ts` (salinan portal tabel manual/opsional; dua baris di `route.ts`), skrip ukur `scripts/isi-sipp-abt/{ukur-s6,laporan-s6,bangun-petunjuk-s6,fixture-s6}.cjs`.
- **Bentuk data manual/opsional**: pengisi mengirim usulan `keyakinan: "tidak_ada_sumber"` + `catatan` (alasan, bahasa petugas) dan, di sisi portal, `manual`/`alasanManual`/`opsional`/`labelPengguna` pada isian susunan blangko (`petunjuk-s6.ts`) - bentuk yang sama dengan agen S3 (`isian-metadata.ts`) dan S5 (`petunjuk-s5.ts`). Lencana "diisi manual" di kartu adalah milik tampilan bersama (agen S3 `infoManual`, agen S5 `kepingKet`); pengisi otomatis yang menemukan nilai selalu menang.
- **Tumpang tindih yang disengaja**: beberapa kode (0663, 8433, 8706, 8712-8714, 9134) juga ada di tabel S3/S5; isinya konsisten (manual bila tak ada sumber). 8706 (dasar putusnya perkawinan) kini dapat TERISI dari perkara cerai terdahulu pasangan yang sama di SIPP (cukup bila akta cerainya sudah terbit), sehingga bagi harta bersama/hak asuh ia bukan lagi manual.
- **Relaas bantuan panggilan** (1154 nomor surat, 1232 tanggal, 5230 ongkos): datanya ada di tabel delegasi keluar SIPP; pengisinya dikerjakan agen S3 (semua jenis) dan TIDAK diduplikasi di sini - di tabel relaas di bawah ketiganya masih "belum" sampai cabang S3 digabung. Begitu pula 1081 (PHS baru ikrar talak) milik S3.
- **Daftar bukti e-Court** hibah/wakaf/mafqud (9804/9805/9810/9834/9835/9840/9873): `buktiEcourtService.js` kini mengisi juga kode-kode itu dari daftar bukti P.n/T.n di e-Court (ragu); daftar kode di ekstensi (`isi-sipp-bersama.js`, `abt.js`) dan cermin portal (`isi-sipp-format.ts`) disamakan. Bergantung berkas e-Court, jadi tidak terukur di laptop.
- **Keyakinan**: pasti/cukup hanya untuk salinan eksplisit atau data terstruktur SIPP (rekonvensi, perkara cerai terdahulu + akta cerai, akad bernomor dan bertanggal, akta ikrar wakaf/hibah, duplikat akta nikah, kesepakatan damai Y1). Semua bacaan bebas dari posita/petitum "ragu": belum ada isian petugas untuk jenis-jenis ini sebagai pembanding (gerbang terukur >= 95% dan n >= 10 tidak dapat dipenuhi), jadi hanya menjadi saran dengan kalimat sumber.
- **Batas**: jumlah perkara nyata sangat kecil (lihat tabel), sehingga "terukur" berarti pengisi BENAR-BENAR menghasilkan nilai atas perkara itu, bukan bahwa nilainya sudah dibandingkan dengan ketikan petugas. Hibah dan wakaf diukur atas fixture; ketepatannya baru dapat dinilai begitu perkara pertama muncul.

## Perkara nyata per jenis (salinan lokal)

| jenis SIPP | perkara nyata | perkara contoh (fixture) |
| --- | ---: | ---: |
| 341 Izin Poligami | 12 | 0 |
| 342 Pencegahan Perkawinan | 2 | 1 |
| 343 Penolakan Perkawinan | 1 | 0 |
| 344 Pembatalan Perkawinan | 1 | 1 |
| 348 Harta Bersama | 13 | 0 |
| 364 Kewarisan | 23 | 0 |
| 365 Wasiat | 1 | 1 |
| 366 Hibah | 0 | 2 |
| 367 Wakaf | 0 | 3 |
| 369 Lain-Lain | 19 | 2 |
| 370 Ekonomi Syariah | 2 | 2 |

Jumlah perkara nyata sangat kecil kecuali kewarisan (23), Lain-Lain (19), harta bersama (13) dan poligami (12): urutan prioritas pekerjaan mengikuti jumlah itu, lalu keluasan blangko. Hibah (366) dan wakaf (367) tidak punya satu pun perkara di SIPP PA Donggala; pengisinya diuji atas perkara contoh.

## Per jenis dan kategori blangko

### Harta bersama

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 47 | 7 → 9 | 12 → 12 | 1 → 8 | 7 → 0 | 9 → 9 | 11 → 9 |
| BAS (tiap sidang) | 40 | 6 → 7 | 13 → 13 | 0 → 5 | 5 → 0 | 10 → 10 | 6 → 5 |

Isian yang berubah kelasnya:

- 1108 Nomor duplikat surat nikah: dasar-ragu → otomatis (2 perkara nyata)
- 7084 Penanda konvensi/rekonvensi (1 apabila ada): dasar-ragu → otomatis (1 perkara nyata)
- 7178 Alasan panggilan dianggap tidak patut: belum → manual
- 8706 DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama: ragu → otomatis (8 perkara nyata)
- 8712 Nomor dan tanggal surat teguran panitera: belum → manual
- 8713 Batas waktu menambah panjar: belum → manual
- 8714 Nomor dan tanggal laporan panjar tidak ditambah: belum → manual
- 9165 Pemeriksaan setempat: belum → manual
- 9166 Pemeriksaan setempat: belum → manual
- 9167 Pemeriksaan setempat: belum → manual
- 9168 Pemeriksaan setempat: belum → manual
- 9282 Harta bersama: belum → manual
- 9283 Harta bersama rekonvensi: dasar-ragu → ragu (1 perkara nyata)
- 9682 Eksepsi kewenangan dikabulkan - fakta/alasan perkara di luar kewenangan: belum → manual
- 9684 Eksepsi kewenangan ditolak - fakta/alasan perkara termasuk kewenangan pengadilan agama: belum → manual
- 9685 Eksepsi kewenangan: belum → manual

### Kewarisan

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 40 | 6 → 6 | 13 → 13 | 1 → 8 | 7 → 0 | 8 → 8 | 5 → 5 |
| BAS (tiap sidang) | 44 | 6 → 7 | 18 → 18 | 0 → 5 | 5 → 0 | 9 → 9 | 6 → 5 |

Isian yang berubah kelasnya:

- 7084 Penanda konvensi/rekonvensi (1 apabila ada): dasar-ragu → otomatis (1 perkara nyata)
- 7178 Alasan panggilan dianggap tidak patut: belum → manual
- 8712 Nomor dan tanggal surat teguran panitera: belum → manual
- 8713 Batas waktu menambah panjar: belum → manual
- 8714 Nomor dan tanggal laporan panjar tidak ditambah: belum → manual
- 9165 Pemeriksaan setempat: belum → manual
- 9166 Pemeriksaan setempat: belum → manual
- 9167 Pemeriksaan setempat: belum → manual
- 9168 Pemeriksaan setempat: belum → manual
- 9680 Pencabutan ditolak - alasan tergugat/termohon tidak menyetujui pencabutan: belum → manual
- 9682 Eksepsi kewenangan dikabulkan - fakta/alasan perkara di luar kewenangan: belum → manual
- 9684 Eksepsi kewenangan ditolak - fakta/alasan perkara termasuk kewenangan pengadilan agama: belum → manual
- 9685 Eksepsi kewenangan: belum → manual

### Wasiat

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 38 | 2 → 2 | 11 → 16 | 1 → 7 | 11 → 0 | 6 → 6 | 7 → 7 |
| BAS (tiap sidang) | 36 | 2 → 2 | 14 → 17 | 0 → 1 | 4 → 0 | 8 → 8 | 8 → 8 |

Isian yang berubah kelasnya:

- 7178 Alasan panggilan dianggap tidak patut: belum → manual
- 8712 Nomor dan tanggal surat teguran panitera: belum → manual
- 8713 Batas waktu menambah panjar: belum → manual
- 8714 Nomor dan tanggal laporan panjar tidak ditambah: belum → manual
- 9475 Pokok tuntutan wasiat (pilih satu huruf): belum → ragu (1 contoh)
- 9478 Bentuk dan tanggal wasiat (mis. "secara tertulis tertanggal ... di hadapan 2 (dua) orang saksi" atau "dengan akta Notaris ... Nomor ..."): belum → ragu (1 perkara nyata, 1 contoh)
- 9479 Objek wasiat (benda atau manfaat yang diwasiatkan: objek, bukti hak, luas, letak, dan batas-batas): belum → ragu (1 contoh)
- 9482 Fakta pokok tuntutan yang terbukti (uraian singkat dari bukti dan saksi): belum → manual
- 9483 Pertimbangan mengapa dalil gugatan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak): belum → manual
- 9485 Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak (untuk putusan tidak dapat diterima karena kurang pihak): belum → manual
- 9486 Kedudukan Penggugat/Pemohon (mis. ahli waris dari pewasiat, penerima wasiat, anak angkat pewasiat): belum → ragu (1 perkara nyata, 1 contoh)
- 9487 Kedudukan Tergugat/Termohon (mis. penerima wasiat, ahli waris lain yang menguasai objek wasiat): belum → ragu (1 perkara nyata)

### Hibah

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 42 | 0 → 1 | 9 → 15 | 1 → 10 | 19 → 0 | 8 → 8 | 5 → 8 |
| BAS (tiap sidang) | 40 | 0 → 1 | 13 → 17 | 0 → 3 | 11 → 0 | 10 → 10 | 6 → 9 |

Isian yang berubah kelasnya:

- 7178 Alasan panggilan dianggap tidak patut: belum → manual
- 8712 Nomor dan tanggal surat teguran panitera: belum → manual
- 8713 Batas waktu menambah panjar: belum → manual
- 8714 Nomor dan tanggal laporan panjar tidak ditambah: belum → manual
- 9134 Bas permohonan: belum → manual
- 9790 Pokok tuntutan hibah (pilih satu huruf): belum → ragu (2 contoh)
- 9793 Penghibah (nama lengkap bin atau binti; bila telah meninggal tulis "almarhum" atau "almarhumah"): belum → ragu (2 contoh)
- 9794 Bentuk dan tanggal hibah (mis. "secara lisan pada tanggal ... di hadapan 2 (dua) orang saksi" atau "dengan akta hibah di hadapan PPAT ... Nomor ..."): belum → otomatis (2 contoh)
- 9795 Objek hibah (benda yang dihibahkan: bukti hak, luas, letak, dan batas-batas): belum → ragu (2 contoh)
- 9798 Fakta pokok tuntutan yang terbukti (uraian singkat dari bukti dan saksi): belum → manual
- 9799 Pertimbangan mengapa dalil gugatan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak): belum → manual
- 9801 Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak (untuk putusan tidak dapat diterima karena kurang pihak): belum → manual
- 9802 Kedudukan Penggugat/Pemohon (mis. penghibah, penerima hibah, ahli waris dari penghibah): belum → ragu (1 contoh)
- 9803 Kedudukan Tergugat/Termohon (mis. penerima hibah, ahli waris lain yang menguasai objek hibah): belum → ragu (1 contoh)
- 9804 Alat bukti surat Penggugat/Pemohon (daftar bukti P.1 dst.; kosong = tanpa daftar): belum → dasar-ragu
- 9805 Alat bukti surat Tergugat/Termohon (daftar bukti T.1 dst.; kosong = tanpa daftar): belum → dasar-ragu
- 9806 Kedudukan Pemohon hibah (mis. penghibah, penerima hibah, ahli waris penghibah): belum → ragu (1 contoh)
- 9807 Fakta yang terbukti (uraian singkat dari bukti dan saksi: hibah, syarat penghibah, objek milik penghibah): belum → manual
- 9808 Pertimbangan mengapa dalil permohonan tidak terbukti atau tidak beralasan hukum (untuk penetapan ditolak): belum → manual
- 9809 Sebab permohonan tidak dapat diterima (mis. objek hibah dipersengketakan pihak lain): belum → manual
- 9810 Alat bukti surat Pemohon (daftar bukti P.1 dst.; kosong = tanpa daftar): belum → dasar-ragu

### Wakaf

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 44 | 0 → 1 | 8 → 17 | 1 → 10 | 22 → 0 | 8 → 8 | 5 → 8 |
| BAS (tiap sidang) | 42 | 0 → 1 | 12 → 19 | 0 → 3 | 14 → 0 | 10 → 10 | 6 → 9 |

Isian yang berubah kelasnya:

- 7178 Alasan panggilan dianggap tidak patut: belum → manual
- 8712 Nomor dan tanggal surat teguran panitera: belum → manual
- 8713 Batas waktu menambah panjar: belum → manual
- 8714 Nomor dan tanggal laporan panjar tidak ditambah: belum → manual
- 9134 Bas permohonan: belum → manual
- 9820 Pokok tuntutan wakaf (pilih satu huruf): belum → ragu (3 contoh)
- 9823 Wakif (nama lengkap bin atau binti; bila telah meninggal tulis "almarhum" atau "almarhumah"): belum → ragu (3 contoh)
- 9824 Nazhir (nama perseorangan, organisasi, atau badan hukum Nazhir): belum → ragu (1 contoh)
- 9825 Bentuk dan tanggal ikrar wakaf (mis. "dengan Akta Ikrar Wakaf Nomor ... tanggal ... di hadapan PPAIW ..." atau "dengan ikrar lisan pada tanggal ... di hadapan 2 (dua) orang saksi"): belum → otomatis (2 contoh)
- 9826 Harta benda wakaf (bukti hak, luas, letak, dan batas-batas): belum → ragu (3 contoh)
- 9827 Peruntukan wakaf (mis. sarana ibadah, sarana pendidikan, pemakaman): belum → ragu (3 contoh)
- 9828 Fakta pokok tuntutan yang terbukti (uraian singkat dari bukti dan saksi): belum → manual
- 9829 Pertimbangan mengapa dalil gugatan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak): belum → manual
- 9831 Pihak yang berkepentingan tetapi tidak ditarik sebagai pihak (untuk putusan tidak dapat diterima karena kurang pihak): belum → manual
- 9832 Kedudukan Penggugat/Pemohon (mis. Nazhir, ahli waris dari Wakif, penerima wasiat wakaf): belum → ragu (1 contoh)
- 9833 Kedudukan Tergugat/Termohon (mis. ahli waris Wakif yang menguasai objek wakaf, pihak yang membeli objek wakaf): belum → ragu (1 contoh)
- 9834 Alat bukti surat Penggugat/Pemohon (daftar bukti P.1 dst.; mis. Akta Ikrar Wakaf, sertifikat wakaf; kosong = tanpa daftar): belum → dasar-ragu
- 9835 Alat bukti surat Tergugat/Termohon (daftar bukti T.1 dst.; kosong = tanpa daftar): belum → dasar-ragu
- 9836 Kedudukan Pemohon wakaf (mis. Nazhir, ahli waris Wakif, penerima wasiat wakaf): belum → ragu (1 contoh)
- 9837 Fakta yang terbukti (wajib: ikrar sebelum 15 Desember 2006, belum terdaftar, dan siapa yang menguasai): belum → manual
- 9838 Pertimbangan mengapa dalil permohonan tidak terbukti atau tidak beralasan hukum (untuk penetapan ditolak): belum → manual
- 9839 Sebab permohonan tidak dapat diterima (mis. objek wakaf dipersengketakan pihak lain): belum → manual
- 9840 Alat bukti surat Pemohon (daftar bukti P.1 dst.; kosong = tanpa daftar): belum → dasar-ragu
- 9841 Pihak yang menguasai harta benda wakaf (mis. ahli waris Wakif, Nazhir): belum → ragu (2 contoh)

### Izin poligami

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 27 | 2 → 2 | 9 → 9 | 1 → 4 | 3 → 0 | 9 → 9 | 3 → 3 |
| BAS (tiap sidang) | 34 | 2 → 2 | 13 → 13 | 0 → 2 | 2 → 0 | 11 → 11 | 6 → 6 |

Isian yang berubah kelasnya:

- 7178 Alasan panggilan dianggap tidak patut: belum → manual
- 8712 Nomor dan tanggal surat teguran panitera: belum → manual
- 8713 Batas waktu menambah panjar: belum → manual
- 8714 Nomor dan tanggal laporan panjar tidak ditambah: belum → manual
- 9171 Izin poligami: belum → manual

### Pembatalan perkawinan

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 31 | 0 → 0 | 9 → 10 | 1 → 6 | 6 → 0 | 10 → 10 | 5 → 5 |
| BAS (tiap sidang) | 30 | 0 → 0 | 12 → 12 | 0 → 1 | 1 → 0 | 11 → 11 | 6 → 6 |

Isian yang berubah kelasnya:

- 7178 Alasan panggilan dianggap tidak patut: belum → manual
- 8712 Nomor dan tanggal surat teguran panitera: belum → manual
- 8713 Batas waktu menambah panjar: belum → manual
- 8714 Nomor dan tanggal laporan panjar tidak ditambah: belum → manual
- 9320 Alasan pembatalan perkawinan: belum → ragu (1 contoh)
- 9329 Fakta alasan pembatalan yang terbukti di persidangan: belum → manual
- 9330 Pertimbangan penolakan pembatalan perkawinan: belum → manual

### Pencegahan perkawinan

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 23 | 0 → 0 | 4 → 8 | 0 → 7 | 11 → 0 | 6 → 6 | 2 → 2 |
| BAS (tiap sidang) | 17 | 0 → 0 | 4 → 8 | 0 → 2 | 6 → 0 | 6 → 6 | 1 → 1 |

Isian yang berubah kelasnya:

- 8712 Nomor dan tanggal surat teguran panitera: belum → manual
- 8713 Batas waktu menambah panjar: belum → manual
- 8714 Nomor dan tanggal laporan panjar tidak ditambah: belum → manual
- 9460 Nama calon istri (nama lengkap binti ...; nama calon suami diisi di kolom nama calon suami): belum → ragu (1 perkara nyata, 1 contoh)
- 9461 Wilayah KUA tempat perkawinan akan dilangsungkan (tulis "Kecamatan ..., Kabupaten ..."): belum → ragu (1 perkara nyata, 1 contoh)
- 9462 Kedudukan Penggugat/Pemohon terhadap calon mempelai (mis. ayah kandung calon istri, wali nikah, istri sah calon suami, Pegawai Pencatat Nikah KUA ...): belum → ragu (1 perkara nyata, 1 contoh)
- 9463 Alasan pencegahan perkawinan (pilih satu huruf): belum → ragu (1 perkara nyata, 1 contoh)
- 9466 Fakta alasan pencegahan yang terbukti (uraian singkat dari bukti, saksi, dan keterangan calon mempelai): belum → manual
- 9467 Pertimbangan mengapa alasan pencegahan tidak terbukti atau tidak beralasan hukum (untuk putusan ditolak): belum → manual
- 9468 Pokok keterangan calon mempelai di persidangan (satu kalimat): belum → manual
- 9469 Waktu dan tempat perkawinan yang ternyata sudah dilangsungkan: belum → manual

### Hak asuh anak (hadhanah) - Lain-Lain 369

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 46 | 5 → 6 | 20 → 21 | 1 → 6 | 6 → 0 | 8 → 8 | 6 → 5 |
| BAS (tiap sidang) | 33 | 5 → 5 | 11 → 11 | 0 → 1 | 1 → 0 | 10 → 10 | 6 → 6 |

Isian yang berubah kelasnya:

- 5271 Penghasilan Tergugat/Termohon Perbulan: dasar-ragu → ragu (1 contoh)
- 7178 Alasan panggilan dianggap tidak patut: belum → manual
- 8706 DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama: ragu → otomatis (1 perkara nyata)
- 8712 Nomor dan tanggal surat teguran panitera: belum → manual
- 8713 Batas waktu menambah panjar: belum → manual
- 8714 Nomor dan tanggal laporan panjar tidak ditambah: belum → manual
- 9309 Mengapa pemegang hak asuh tidak dapat menjamin keselamatan anak: belum → manual
- 9310 Pertimbangan penolakan hak asuh: belum → manual
- 9748 Fakta pengasuhan dan kelalaian nafkah (berpisah sejak kapan, anak diasuh siapa, tidak diberi nafkah; kosong = kalimat bawaan): belum → ragu (4 perkara nyata, 1 contoh)

### Penguasaan anak - Lain-Lain 369

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 34 | 5 → 6 | 13 → 12 | 1 → 3 | 2 → 0 | 8 → 8 | 5 → 5 |
| BAS (tiap sidang) | 34 | 5 → 5 | 12 → 12 | 0 → 1 | 1 → 0 | 10 → 10 | 6 → 6 |

Isian yang berubah kelasnya:

- 7178 Alasan panggilan dianggap tidak patut: belum → manual
- 8706 DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama: ragu → otomatis (1 perkara nyata)
- 9309 Mengapa pemegang hak asuh tidak dapat menjamin keselamatan anak: belum → manual
- 9310 Pertimbangan penolakan hak asuh: belum → manual

### Nafkah anak - Lain-Lain 369

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 42 | 5 → 6 | 17 → 18 | 1 → 5 | 5 → 0 | 8 → 8 | 6 → 5 |
| BAS (tiap sidang) | 44 | 5 → 5 | 20 → 21 | 0 → 2 | 3 → 0 | 10 → 10 | 6 → 6 |

Isian yang berubah kelasnya:

- 5271 Penghasilan Tergugat/Termohon Perbulan: dasar-ragu → ragu (1 contoh)
- 7178 Alasan panggilan dianggap tidak patut: belum → manual
- 8706 DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama: ragu → otomatis (1 perkara nyata)
- 8712 Nomor dan tanggal surat teguran panitera: belum → manual
- 8713 Batas waktu menambah panjar: belum → manual
- 8714 Nomor dan tanggal laporan panjar tidak ditambah: belum → manual
- 9748 Fakta pengasuhan dan kelalaian nafkah (berpisah sejak kapan, anak diasuh siapa, tidak diberi nafkah; kosong = kalimat bawaan): belum → ragu (4 perkara nyata, 1 contoh)
- 9750 Alasan petitum ditolak (untuk putusan dikabulkan sebagian atau ditolak; kosong = kalimat bawaan): belum → manual

### Pengangkatan anak - Lain-Lain 369

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 24 | 3 → 4 | 10 → 9 | 1 → 4 | 3 → 0 | 5 → 5 | 2 → 2 |
| BAS (tiap sidang) | 16 | 2 → 2 | 9 → 9 | 0 → 1 | 1 → 0 | 4 → 4 | 0 → 0 |

Isian yang berubah kelasnya:

- 8706 DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khusus Harta Bersama: ragu → otomatis (1 perkara nyata)
- 8712 Nomor dan tanggal surat teguran panitera: belum → manual
- 8713 Batas waktu menambah panjar: belum → manual
- 8714 Nomor dan tanggal laporan panjar tidak ditambah: belum → manual
- 9134 Bas permohonan: belum → manual

### Permohonan umum - Lain-Lain 369

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 8 | 2 → 2 | 1 → 1 | 0 → 0 | 0 → 0 | 4 → 4 | 1 → 1 |
| BAS (tiap sidang) | 7 | 2 → 2 | 1 → 1 | 0 → 0 | 0 → 0 | 4 → 4 | 0 → 0 |

### Mafqud - Lain-Lain 369

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 22 | 2 → 2 | 3 → 9 | 0 → 5 | 12 → 0 | 4 → 4 | 1 → 2 |
| BAS (tiap sidang) | 20 | 2 → 2 | 3 → 9 | 0 → 4 | 11 → 0 | 4 → 4 | 0 → 1 |

Isian yang berubah kelasnya:

- 9134 Bas permohonan: belum → manual
- 9860 Nama orang yang hilang (nama lengkap bin atau binti): belum → ragu (1 contoh)
- 9861 Kedudukan Pemohon terhadap orang yang hilang (mis. istri, suami, anak, ahli waris): belum → ragu (1 contoh)
- 9862 Tempat tinggal dan waktu terakhir orang itu diketahui (kapan pergi, ke mana, kabar terakhir): belum → ragu (1 contoh)
- 9863 Upaya pencarian yang telah dilakukan (satu kalimat): belum → ragu (1 contoh)
- 9864 Lama orang yang hilang tidak ada kabar (mis. 5 (lima) tahun, dihitung sampai hari penetapan): belum → ragu (1 contoh)
- 9865 Kepentingan Pemohon (pilih satu huruf): belum → ragu (1 contoh)
- 9868 Cara dan jangka waktu pengumuman (mis. papan pengumuman 14 hari; bila ada media massa tulis juga): belum → manual
- 9869 Hasil pengumuman (apakah ada yang memberi kabar atau melapor sejak pengumuman): belum → manual
- 9870 Fakta yang terbukti (uraian singkat dari bukti dan saksi: kepergian, tidak ada kabar, pencarian): belum → manual
- 9871 Pertimbangan mengapa dalil permohonan tidak terbukti atau tidak beralasan hukum (untuk penetapan ditolak): belum → manual
- 9872 Sebab permohonan tidak dapat diterima (mis. Pemohon tidak berkepentingan, tempat tinggal terakhir di luar wilayah): belum → manual
- 9873 Alat bukti surat Pemohon (daftar bukti P.1 dst.; mis. surat keterangan hilang dari kepolisian atau desa; kosong = tanpa daftar): belum → dasar-ragu

### Ekonomi syariah

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 41 | 0 → 3 | 10 → 14 | 1 → 5 | 11 → 0 | 10 → 10 | 9 → 9 |
| BAS (tiap sidang) | 40 | 0 → 3 | 14 → 16 | 0 → 1 | 6 → 0 | 12 → 12 | 8 → 8 |

Isian yang berubah kelasnya:

- 7178 Alasan panggilan dianggap tidak patut: belum → manual
- 8712 Nomor dan tanggal surat teguran panitera: belum → manual
- 8713 Batas waktu menambah panjar: belum → manual
- 8714 Nomor dan tanggal laporan panjar tidak ditambah: belum → manual
- 9340 Akad yang disengketakan (jenis akad, nomor, tanggal): belum → otomatis (2 perkara nyata, 2 contoh)
- 9341 Jumlah kewajiban Tergugat/Termohon yang dikabulkan (rupiah, angka saja): belum → ragu (2 perkara nyata, 2 contoh)
- 9345 Fakta wanprestasi (sejak kapan tidak membayar, somasi, sisa kewajiban): belum → ragu (2 perkara nyata, 2 contoh)
- 9346 Pertimbangan penolakan gugatan: belum → manual
- 9352 Isi kesepakatan perdamaian di hadapan hakim (pasal demi pasal): belum → otomatis (1 contoh)
- 9353 Tanggal kesepakatan perdamaian: belum → otomatis (1 contoh)
- 9354 Pihak yang menanggung biaya perkara menurut kesepakatan: belum → ragu (1 contoh)
- 9490 Klausula arbitrase dalam akad (pasal akad dan lembaga arbitrase yang dipilih): belum → ragu (1 contoh)

### Lintas jenis: relaas, PTSP (mediator, PMH/PPP/PJS/PHS) dan sita

Folder 97/98/99 dipakai semua jenis; bukti diambil dari gabungan semua perkara S6.

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Relaas (lintas jenis) | 16 | 5 → 5 | 4 → 5 | 0 → 0 | 4 → 3 | 3 → 3 | 0 → 0 |
| PTSP (lintas jenis, termasuk mediator) | 11 | 3 → 3 | 2 → 2 | 0 → 0 | 1 → 1 | 5 → 5 | 0 → 0 |
| Sita (lintas jenis) | 11 | 3 → 3 | 2 → 2 | 0 → 0 | 0 → 0 | 5 → 5 | 1 → 1 |

## Ringkasan per kategori (gabungan semua jenis S6)

| bagian | isian | otomatis | ragu | manual | belum | dasar e-Court/ekstensi (otomatis) | dasar (ragu) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Putusan/penetapan | 509 | 39 → 50 | 149 → 184 | 12 → 88 | 125 → 0 | 111 → 111 | 73 → 76 |
| BAS (tiap sidang) | 477 | 37 → 44 | 169 → 196 | 0 → 32 | 71 → 0 | 129 → 129 | 71 → 76 |
| Relaas | 16 | 5 → 5 | 4 → 5 | 0 → 0 | 4 → 3 | 3 → 3 | 0 → 0 |
| PTSP (termasuk mediator) | 11 | 3 → 3 | 2 → 2 | 0 → 0 | 1 → 1 | 5 → 5 | 0 → 0 |
| Sita | 11 | 3 → 3 | 2 → 2 | 0 → 0 | 0 → 0 | 5 → 5 | 1 → 1 |

(Jumlah per kategori menjumlah isian per keluarga blangko; satu isian yang dipakai beberapa jenis dihitung per jenis.)

## Terukur atas perkara nyata (salinan lokal sipp_donggala)

Untuk jenis yang punya perkara nyata: berapa perkara yang mendapat nilai per kode (otomatis = pasti/cukup; ragu = saran). Hanya kode yang BERUBAH dibanding sebelum S6.

### 341 Izin Poligami (12 perkara nyata)

- (tidak ada kode yang terisi lebih banyak atas perkara nyata; perubahan terbatas pada isian yang memang manual atau contoh)

### 342 Pencegahan Perkawinan (2 perkara nyata)

- 1029 Nama Calon Suami: otomatis 0→0, ragu 0→1 dari 2
- 9460 Nama calon istri (nama lengkap binti ...; : otomatis 0→0, ragu 0→1 dari 2
- 9461 Wilayah KUA tempat perkawinan akan dilangs: otomatis 0→0, ragu 0→1 dari 2
- 9462 Kedudukan Penggugat/Pemohon terhadap calon: otomatis 0→0, ragu 0→1 dari 2
- 9463 Alasan pencegahan perkawinan (pilih satu h: otomatis 0→0, ragu 0→1 dari 2

### 343 Penolakan Perkawinan (1 perkara nyata)

- (tidak ada kode yang terisi lebih banyak atas perkara nyata; perubahan terbatas pada isian yang memang manual atau contoh)

### 344 Pembatalan Perkawinan (1 perkara nyata)

- (tidak ada kode yang terisi lebih banyak atas perkara nyata; perubahan terbatas pada isian yang memang manual atau contoh)

### 348 Harta Bersama (13 perkara nyata)

- 1108 Nomor duplikat surat nikah: otomatis 0→2, ragu 0→0 dari 13
- 7084 Penanda konvensi/rekonvensi (1 apabila ada: otomatis 0→1, ragu 0→0 dari 13
- 8433 Alasan pencabutan perkara: otomatis 1→1, ragu 0→0 dari 13
- 8706 DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khu: otomatis 0→2, ragu 7→6 dari 13
- 9283 Harta bersama rekonvensi: otomatis 0→0, ragu 0→1 dari 13

### 364 Kewarisan (23 perkara nyata)

- 7084 Penanda konvensi/rekonvensi (1 apabila ada: otomatis 0→1, ragu 0→0 dari 23
- 8433 Alasan pencabutan perkara: otomatis 2→2, ragu 0→0 dari 23

### 365 Wasiat (1 perkara nyata)

- 9478 Bentuk dan tanggal wasiat (mis. "secara te: otomatis 0→0, ragu 0→1 dari 1
- 9486 Kedudukan Penggugat/Pemohon (mis. ahli war: otomatis 0→0, ragu 0→1 dari 1
- 9487 Kedudukan Tergugat/Termohon (mis. penerima: otomatis 0→0, ragu 0→1 dari 1

### 369 Lain-Lain (19 perkara nyata)

- 6071 Nafkah Anak: otomatis 0→0, ragu 0→1 dari 19
- 8706 DASAR PUTUSNYA PERKAWINAN PARA PIHAK - khu: otomatis 0→1, ragu 0→0 dari 19
- 9748 Fakta pengasuhan dan kelalaian nafkah (ber: otomatis 0→0, ragu 0→4 dari 19

### 370 Ekonomi Syariah (2 perkara nyata)

- 9340 Akad yang disengketakan (jenis akad, nomor: otomatis 0→1, ragu 0→1 dari 2
- 9341 Jumlah kewajiban Tergugat/Termohon yang di: otomatis 0→0, ragu 0→2 dari 2
- 9345 Fakta wanprestasi (sejak kapan tidak memba: otomatis 0→0, ragu 0→2 dari 2

## Isian yang memang manual (alasan dan opsional)

Daftar lengkap di kode: `aleta_bot/services/isiOtomatisJenisS6.js` (`MANUAL`). Ringkas per sebab:

- **penilaian/pertimbangan hakim** (32): 7178 Alasan panggilan dianggap tidak patut; 9120 Panggilan ulang karena kuasa insidentil tidak sah; 9123 Sebab kuasa insidentil tidak sah (huruf a sampai d; 9125 Keadaan kuasa insidentil tidak sah; 9309 Mengapa pemegang hak asuh tidak dapat menjamin kes; 9310 Pertimbangan penolakan hak asuh; 9329 Fakta alasan pembatalan yang terbukti di persidang; 9330 Pertimbangan penolakan pembatalan perkawinan; 9346 Pertimbangan penolakan gugatan; 9466 Fakta alasan pencegahan yang terbukti (uraian sing; 9467 Pertimbangan mengapa alasan pencegahan tidak terbu; 9482 Fakta pokok tuntutan yang terbukti (uraian singkat; 9483 Pertimbangan mengapa dalil gugatan tidak terbukti ; 9485 Pihak yang berkepentingan tetapi tidak ditarik seb; 9682 Eksepsi kewenangan dikabulkan - fakta/alasan perka; 9684 Eksepsi kewenangan ditolak - fakta/alasan perkara ; 9750 Alasan petitum ditolak (untuk putusan dikabulkan s; 9798 Fakta pokok tuntutan yang terbukti (uraian singkat; 9799 Pertimbangan mengapa dalil gugatan tidak terbukti ; 9801 Pihak yang berkepentingan tetapi tidak ditarik seb; 9807 Fakta yang terbukti (uraian singkat dari bukti dan; 9808 Pertimbangan mengapa dalil permohonan tidak terbuk; 9809 Sebab permohonan tidak dapat diterima (mis. objek ; 9828 Fakta pokok tuntutan yang terbukti (uraian singkat; 9829 Pertimbangan mengapa dalil gugatan tidak terbukti ; 9831 Pihak yang berkepentingan tetapi tidak ditarik seb; 9837 Fakta yang terbukti (wajib: ikrar sebelum 15 Desem; 9838 Pertimbangan mengapa dalil permohonan tidak terbuk; 9839 Sebab permohonan tidak dapat diterima (mis. objek ; 9870 Fakta yang terbukti (uraian singkat dari bukti dan; 9871 Pertimbangan mengapa dalil permohonan tidak terbuk; 9872 Sebab permohonan tidak dapat diterima (mis. Pemoho.
- **fakta/keterangan di persidangan** (11): 8433 Alasan pencabutan perkara; 8620 Keterangan orang tua kandung di persidangan; 9165 Pemeriksaan setempat; 9166 Pemeriksaan setempat; 9167 Pemeriksaan setempat; 9168 Pemeriksaan setempat; 9171 Izin poligami; 9468 Pokok keterangan calon mempelai di persidangan (sa; 9469 Waktu dan tempat perkawinan yang ternyata sudah di; 9680 Pencabutan ditolak - alasan tergugat/termohon tida; 9685 Eksepsi kewenangan.
- **surat/izin yang tidak tercatat terstruktur di SIPP** (6): 8894 Nama penerima kuasa insidentil; 8895 Hubungan penerima kuasa dengan Penggugat/Pemohon; 8896 Nomor izin Ketua Pengadilan; 0182 Tanggal izin kuasa insidentil; 0183 0183; 0663 Tanggal penetapan prodeo.
- **opsional (boleh kosong)** (10): 8712 Nomor dan tanggal surat teguran panitera; 8713 Batas waktu menambah panjar; 8714 Nomor dan tanggal laporan panjar tidak ditambah; 8726 Izin poligami; 9134 Bas permohonan; 9170 Izin poligami; 9282 Harta bersama; 9868 Cara dan jangka waktu pengumuman (mis. papan pengu; 9869 Hasil pengumuman (apakah ada yang memberi kabar at; 9875 Tanggal berlaku mati secara hukum (opsional; koson.
- **bacaan utama berkas e-Court** (8): 8436 Kesimpulan Penggugat/Pemohon; 8437 Kesimpulan Tergugat/Termohon; 8618 TEMPAT DAN TANGGAL LAHIR ANAK (pengangkatan anak); 8621 Alat bukti surat pengangkatan anak; 9355 Pokok jawaban Tergugat/Termohon (satu kalimat); 9491 Pokok eksepsi Tergugat/Termohon (satu kalimat); 9681 EKSEPSI KEWENANGAN - ISI EKSEPSI TERGUGAT/TERMOHON; 9881 lisan atau tertulis (jawaban replik dan duplik).

## Menjalankan ulang

```
node scripts/isi-sipp-abt/ukur-s6.cjs docs/isi-sipp-abt/UKURAN-S6-SEBELUM.json --tanpa-s6
node scripts/isi-sipp-abt/ukur-s6.cjs docs/isi-sipp-abt/UKURAN-S6-SESUDAH.json
node scripts/isi-sipp-abt/laporan-s6.cjs
```

Butuh MySQL lokal berisi `sipp_donggala` (XAMPP D:). Hanya SELECT.
