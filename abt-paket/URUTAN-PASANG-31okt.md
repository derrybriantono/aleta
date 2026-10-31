# URUTAN PASANG paket ABT 29-31 Okt 2026 (23 paket; diuji rantai penuh dari dump 28 Okt pada 31 Okt 07.36-07.46)

Semua paket dipasang di SERVER sebagai root, dari folder `paket-satker` masing-masing, BERURUTAN persis seperti di bawah
(`cd <paket>/paket-satker && bash pasang-satker.sh`). Setiap paket harus berakhir "SELESAI" (dan PERIKSA "SEMUA COCOK" /
"COCOK" bila ada). Paket yang berhenti di PRASYARAT/praperiksa TIDAK mengubah apa pun - jangan dipaksa; laporkan keluarannya.

## Cara uji (mengulang di laptop: `uji-rantai-31okt/`)
- Salinan baru yang meniru server: basis `aps_badilag_rantai` = dump server 28 Okt 15.44 (`aps_badilag_2810`, routine+trigger,
  tanpa ubahan) dan pohon `_blangko_abt/derry_briantono` = salinan server 28 Okt (`bas29/dasar2`).
- Paket diambil dari `git archive HEAD abt-paket` (isi repo apa adanya, seolah di-scp); `md5sum -c MD5SUMS.txt` di SEMUA
  paket-satker cocok dari arsip itu.
- Satu langkah KHUSUS LAPTOP sebelum hir-rbg-30okt, tinjau-31okt, bukti-8529-31okt, tanggal-agenda-31okt: skrip pasang menulis nama basis salinan (`aps_badilag_rantai.`) ke kueri yang
  ditulisnya (di server namanya memang `aps_badilag.`); karena hir-rbg memeriksa md5 kueri mentah, teks salinan dikembalikan ke
  bentuk server (9 variabel). Di SERVER langkah ini TIDAK ada.
- Hasil: `uji-rantai-31okt/hasil-rantai.txt` (21 paket SELESAI, 31 Okt 07.36-07.46, salinan baru `aps_badilag_rantai2` + `/d/r2`); dulu 18 paket (03.08-03.14), `uji-rantai-31okt/hasil-pulih3.txt` (pulih terbalik 3 paket
  terakhir: semua "PULIH COCOK", lalu pasang lagi -> sidik seluruh variabel dan seluruh pohon RTF SAMA PERSIS dengan sebelum pulih).

## Perbaikan 31 Okt yang membuat rantai lolos
- `.gitattributes`: `abt-paket/**/paket-satker/** -text` - berkas paket disimpan git byte demi byte. Sebelumnya PRASYARAT
  bas-tanya-jawab-29okt di-md5 ber-CRLF tetapi disimpan git ber-LF -> `md5sum -c` di server gagal.
- `bukti-nomor-30okt` dibangun ulang di atas pohon sesudah prodeo -> bas-tanya-jawab -> bas-itsbat-varian (397 berkas; dulu 399
  dan 14 berkas mengharapkan RTF prodeo lama, 2 varian itsbat sudah dipindah ke terhapus).
- `hir-rbg-30okt` (+ `titik-koma-teks-30okt`, isinya tetap sama) dibangun ulang di atas keadaan sesudah sela-ps-30okt: md5 dasar
  8528/8529 kini sesudah alasan-belum-dipilih dan murtad-8529 (dulu sebelum keduanya -> PRASYARAT 38 dari 40).
- Paket dari cabang lain dibawa APA ADANYA: prodeo, agama-belum-diubah, murtad-8529, relaas-penetapan, sampul-rapi, sela-ps
  (gabung-56); titik-koma-teks (g6-perluasan); variabel-sehat, identitas-kosong (variabel-sehat e804fda5).

## Pulih
Terbalik dari urutan pasang (`bash pulih-satker.sh` di folder paket yang sama, mulai dari yang terakhir). Catatan: pemicu
abt_keterangan_saksi milik ket-saksi-baris diperluas titik-koma-data - pulihkan titik-koma-data SEBELUM ket-saksi-baris.

## Urutan dan keluaran yang benar

### 1. `prodeo-panggilan-29okt`
```
cd prodeo-panggilan-29okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (0|0|7|0|1)
SIAP_TIMPA=856
TIMPA=856
COCOK=856
SELESAI - paket abt-prodeo-panggilan-29okt terpasang. Cadangan: prodeo-panggilan-29okt/paket-satker/cadangan. Pulih: bash prodeo-panggilan-29okt/paket-satker/pulih-satker.sh
```

### 2. `bas-tanya-jawab-29okt`
```
cd bas-tanya-jawab-29okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (17|5|4|1|1)
PRAPERIKSA RTF: RINGKAS COCOK=94 SUDAH=0 LEWAT=0
RINGKAS DITAMBAL=94 SUDAH=0 LEWAT=0
PERIKSA RTF: RINGKAS COCOK=0 SUDAH=94 LEWAT=0
SELESAI (94 berkas; cadangan berkas lama: bas-tanya-jawab-29okt/paket-satker/cadangan/rtf-lama)
```

### 3. `bas-itsbat-varian-30okt`
```
cd bas-itsbat-varian-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRAPERIKSA: 2 berkas | belum 2 | sudah 0
DIPINDAH: 2 Itsbat Nikah - BAS/BAS ALUR 11 [1b] BAS 1 IN - Kabul (1x Sidang) - Tanya Jawab dari Katalog Saksi.rtf -> terhapus/2 Itsbat Nikah - BAS/BAS ALUR 11 [1b] BAS 1 IN - Kabul (1x Sidang) - Tanya Jawab dari Katalog Saksi.rtf
DIPINDAH: 2 Itsbat Nikah - BAS/BAS ALUR 11 [1c] BAS 1 IN - Kabul Syahadah Istifadhah (1x Sidang) - Tanya Jawab dari Katalog Saksi.rtf -> terhapus/2 Itsbat Nikah - BAS/BAS ALUR 11 [1c] BAS 1 IN - Kabul Syahadah Istifadhah (1x Sidang) - Tanya Jawab dari Katalog Saksi.rtf
SELESAI (2 berkas dipindah ke folder terhapus; pulih: pulih-satker.sh)
```

### 4. `bukti-nomor-30okt`
```
cd bukti-nomor-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (8|0|0|0|2715)
PRAPERIKSA RTF: RINGKAS COCOK=397 SUDAH=0 LEWAT=0
PERIKSA: SEMUA COCOK
RINGKAS DITAMBAL=397 SUDAH=0 LEWAT=0
PERIKSA RTF: RINGKAS COCOK=0 SUDAH=397 LEWAT=0
PRASYARAT SESUDAH: 8|8|8|1|2723 (harus 8|8|8|1|*)
SELESAI (397 berkas RTF; cadangan: bukti-nomor-30okt/paket-satker/cadangan)
```

### 5. `ket-saksi-kata-30okt`
```
cd ket-saksi-kata-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (1|0|1|0)
PERIKSA: SEMUA COCOK
PRASYARAT SESUDAH: 1|1|0|1 (harus 1|1|0|1)
SELESAI
```

### 6. `ket-saksi-baris-30okt`
```
cd ket-saksi-baris-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (0|0|0|9131): 9131 baris bertanda ganti baris
PERIKSA DATA (baris cadangan | hilang | jawaban beda huruf | pertanyaan beda huruf): 9131|0|0|0
PERIKSA: SEMUA COCOK
PRASYARAT SESUDAH: 1|2|0|0 (harus 1|2|0|0)
SELESAI
```

### 7. `titik-koma-30okt`
```
cd titik-koma-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (1|1|0|0|0)
PERIKSA: SEMUA COCOK
PRASYARAT SESUDAH: 0|0|1|1|1 (harus 0|0|1|1|1)
SELESAI
```

### 8. `titik-koma-data-30okt`
```
cd titik-koma-data-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (1|2|0|0|615): 615 jawaban akan dirapikan, pemicu diperluas
PERIKSA DATA (baris cadangan | hilang | bukan hasil rapi | beda huruf/angka | pertanyaan berubah): 615|0|0|0|0
PERIKSA: SEMUA COCOK
PRASYARAT SESUDAH: 1|0|2|0|0 (harus 1|0|2|0|0)
SELESAI
```

### 9. `alasan-belum-dipilih-30okt`
```
cd alasan-belum-dipilih-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (10|0)
PERIKSA: SEMUA COCOK
PRASYARAT SESUDAH: 0|10 (harus 0|10)
SELESAI
```

### 10. `agama-belum-diubah-30okt`
```
cd agama-belum-diubah-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (4|0)
PERIKSA: SEMUA COCOK
PRASYARAT SESUDAH: 0|4 (harus 0|4)
SELESAI
```

### 11. `murtad-8529-30okt`
```
cd murtad-8529-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (1|0)
PERIKSA: SEMUA COCOK
PRASYARAT SESUDAH: 0|1 (harus 0|1)
SELESAI
```

### 12. `relaas-penetapan-30okt`
```
cd relaas-penetapan-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (0|0|38|7)
SIAP_TIMPA=25
TIMPA=25
COCOK=25
SELESAI - paket abt-relaas-penetapan-30okt terpasang. Cadangan: relaas-penetapan-30okt/paket-satker/cadangan. Pulih: bash relaas-penetapan-30okt/paket-satker/pulih-satker.sh
```

### 13. `sampul-rapi-30okt`
```
cd sampul-rapi-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (0|0|106|0|163|0)
SIAP_TIMPA=21
TIMPA=21
COCOK=21
SELESAI - paket abt-sampul-rapi-30okt terpasang. Cadangan: sampul-rapi-30okt/paket-satker/cadangan. Pulih: bash sampul-rapi-30okt/paket-satker/pulih-satker.sh
```

### 14. `sela-ps-30okt`
```
cd sela-ps-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (0|0|111|0|0|2)
SIAP_TIMPA=2
BUAT=96 TIMPA=2
COCOK=98
SELESAI - paket abt-sela-ps-30okt terpasang. Cadangan: sela-ps-30okt/paket-satker/cadangan. Pulih: bash sela-ps-30okt/paket-satker/pulih-satker.sh
```

### 15. `hir-rbg-30okt`
```
cd hir-rbg-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (0|0|40|0|1)
TAMBAL=603
SELESAI - paket abt-hir-rbg-30okt terpasang. Cadangan: hir-rbg-30okt/paket-satker/cadangan. Pulih: bash hir-rbg-30okt/paket-satker/pulih-satker.sh
```

### 16. `titik-koma-teks-30okt`
```
cd titik-koma-teks-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
TAMBAL=292
SELESAI - paket abt-titik-koma-teks-30okt terpasang. Cadangan: titik-koma-teks-30okt/paket-satker/cadangan. Pulih: bash titik-koma-teks-30okt/paket-satker/pulih-satker.sh
```

### 17. `variabel-sehat-30okt`
```
cd variabel-sehat-30okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (3|0)
PERIKSA: SEMUA COCOK
PRASYARAT SESUDAH: 0|3 (harus 0|3)
SELESAI - paket abt-variabel-sehat-30okt terpasang. Pulih: bash variabel-sehat-30okt/paket-satker/pulih-satker.sh
```

### 18. `identitas-kosong-31okt`
```
cd identitas-kosong-31okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar (uji rantai 31 Okt 03.08-03.12, baris penentu):
```
PRASYARAT COCOK (11|0|0)
PERIKSA: SEMUA COCOK
PRASYARAT SESUDAH: 0|11|1 (harus 0|11|1)
SELESAI - paket abt-identitas-kosong-31okt terpasang. Pulih: bash identitas-kosong-31okt/paket-satker/pulih-satker.sh
```

### 19. `tinjau-31okt`
```
cd tinjau-31okt/paket-satker && bash pasang-satker.sh
```
Jawaban pengguna 31 Okt atas pertanyaan G6: banding Jawa-Madura UU 20/1947 (#11896#), Pasal 288 RBg = Pasal 1875 KUHPerdata (#11897#),
718 RBg = 390 HIR (#11898#), 144 ayat (1) RBg = 120 HIR (#11899#), tenggang verzet Pasal 153 ayat (2), RBg dibakukan, ";" di tengah
pertimbangan "...; bahwa ..." jadi butir "-" berinden gantung (98 blangko, 15 kueri). Keluaran benar (uji rantai 31 Okt 07.36-07.46):
```
PRASYARAT COCOK (0|0|16|0|2)
SIAP=99
SEMUA COCOK
UJI: satker <KodePN> provinsi '<provinsi>' -> hukum acara RBg
TAMBAL=99
BERKAS COCOK
SELESAI - paket abt-tinjau-31okt terpasang. Cadangan: tinjau-31okt/paket-satker/cadangan. Pulih: bash tinjau-31okt/paket-satker/pulih-satker.sh
```

### 20. `bukti-8529-31okt` (dari cabang tinjau-periksa w146, commit 3945d178, isi apa adanya)
```
cd bukti-8529-31okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar:
```
PRASYARAT COCOK (1|0)
PERIKSA: SEMUA COCOK
PRASYARAT SESUDAH: 0|1 (harus 0|1)
SELESAI
```

### 21. `tanggal-agenda-31okt` (dari cabang tinjau-deteksi w147, commit 08b72508, isi apa adanya)
```
cd tanggal-agenda-31okt/paket-satker && bash pasang-satker.sh
```
Keluaran benar:
```
PRASYARAT COCOK (14|0)
PERIKSA: SEMUA COCOK
PRASYARAT SESUDAH: 0|14 (harus 0|14)
SELESAI - paket abt-tanggal-agenda-31okt terpasang. Pulih: bash tanggal-agenda-31okt/paket-satker/pulih-satker.sh
```
Catatan: tinjau-31okt tidak menyentuh 8529 maupun 7111-7122/8438/2111/2112, jadi md5 dasar kedua paket terakhir (keadaan sesudah 18 paket)
tetap cocok sesudah tinjau-31okt - tidak perlu dibangun ulang (diuji rantai).

### 22. `jawab-replik-31okt` (cabang jawab-replik w148) - PALING AKHIR
```
cd jawab-replik-31okt/paket-satker && bash pasang-satker.sh
```
Naskah utuh jawab-menjawab (jawaban + gugatan rekonvensi, replik + jawaban rekonvensi, duplik + replik rekonvensi, duplik rekonvensi,
kesimpulan kedua pihak) di BAS sidang jawab-menjawab dan duduk perkara putusan kontradiktoir; lihat `jawab-replik-31okt/PASANG.md`.
Uji rantai 22 paket 31 Okt 13.59-14.13 (salinan baru dump 28 Okt + dasar2, paket dari `git archive HEAD`): semua SELESAI, md5 semua
paket cocok; keadaan akhir variabel dan seluruh pohon RTF SAMA PERSIS dengan pasang laptop w148 (`uji-rantai-31okt/hasil-rantai-22.txt`).
Keluaran benar:
```
PRASYARAT COCOK (0|0|6|0|4)
SIAP=274
BERKAS SIAP
SEMUA COCOK
UJI: 13 kueri berjalan (perkara <id>)
TAMBAL=274
BERKAS COCOK
SELESAI - paket abt-jawab-replik-31okt terpasang. ...
```

### 23. `butir-rata-31okt` (cabang jawab-replik w148) - PALING AKHIR
```
cd butir-rata-31okt/paket-satker && bash pasang-satker.sh
```
Keputusan pengguna 31 Okt: paragraf tanpa nomor sesudah butir bernomor ("Berdasarkan ... mohon:", "Atau apabila ...") rata kiri berinden
baris pertama; fungsi isian_rtf_butir + isian_rtf_judul diganti (tersyarat md5), lihat `butir-rata-31okt/PASANG.md` dan banding
`butir-rata-31okt/hasil/banding.txt`. Uji rantai 23 paket 31 Okt 16.55-17.10 (sesudah perbaikan tanda Z, TAMBAL=274) (`uji-rantai-31okt/hasil-rantai-23.txt`): semua SELESAI;
variabel (2.960, md5 GROUP_CONCAT penuh) dan seluruh pohon RTF sama persis dengan pasang laptop w148; fungsi sama kecuali 4 fungsi paket lama yang di laptop memuat nama
basis salinan (khusus laptop). Paket 22 ikut diperbarui (keputusan sesi utama: pengunggah BAS replik/duplik rekonvensi/kesimpulan, duplik
oleh Tergugat, spasi "secara elektronik" #0206#) - kini PRASYARAT `0|0|6|0|4`, `UJI: 13 kueri`.
Keluaran benar: `PRASYARAT COCOK (2|0)`, `PERIKSA: SEMUA COCOK`, `UJI: 14 contoh sama dengan laptop`, `SELESAI ...`.
