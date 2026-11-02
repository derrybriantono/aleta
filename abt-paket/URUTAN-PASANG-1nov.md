# URUTAN PASANG paket ABT 29 Okt - 2 Nov 2026 (33 paket; diuji rantai penuh dari dump 28 Okt; MENGGANTIKAN URUTAN-PASANG-31okt.md)

Nomor "KE-n" di komentar dan PASANG.md paket lama mengikuti urutan 24 paket yang lama; yang berlaku adalah nomor di berkas ini
(pembuktian-urut-1nov disisipkan sebagai ke-22, sehingga jawab-replik, butir-rata, bukti-pisah menjadi ke-23, ke-24, ke-25, teks-pihak ke-26).

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
- Hasil terbaru: `uji-rantai-31okt/hasil-rantai-31.txt` - 31 paket SELESAI (`identitas-pihak-1nov/sumber/rantai177.sh`), `RANTAI-KELUAR 0` pada tahap 2; tahap 1 berhenti di paket ke-31 karena fungsi dasar dump laptop menunjuk basis `sipp` (PA Bungku) - KHUSUS LAPTOP diarahkan ke salinan SIPP uji, di server tidak perlu (lihat `identitas-pihak-1nov/PASANG.md`).
- Hasil sebelumnya: `uji-rantai-31okt/hasil-rantai-30.txt` - 30 paket SELESAI berurutan dari salinan baru (1 Nov 23.21-23.42, `perbaikan-1nov/sumber/rantai174.sh`: basis `aps_badilag_rantai174`, pohon `/d/r174c`, paket dari `git archive HEAD`, `md5sum -c MD5SUMS.txt` di semua paket cocok), `RANTAI-KELUAR 0`; sidik pohon sesudah 30 paket = uji lokal paket ke-30 (`9931cdd9...`), sidik seluruh tabel variabel = uji lokal (`9087068d...`).
- Hasil sebelumnya: `uji-rantai-31okt/hasil-rantai-29.txt` - 29 paket SELESAI berurutan dari salinan baru (1 Nov 20.55-21.11, `tanya-jawab-format-1nov/sumber/rantai164.sh`: basis `aps_badilag_rantai164`, pohon `/d/r164c`, paket dari `git archive HEAD`, `md5sum -c MD5SUMS.txt` di semua paket cocok), `RANTAI-KELUAR 0`.
- Hasil sebelumnya: `uji-rantai-31okt/hasil-rantai-28.txt` - 28 paket SELESAI berurutan dari salinan baru (1 Nov 17.44-17.58, `bas-lanjutan-1nov/sumber/rantai163.sh`: basis `aps_badilag_rantai163`, pohon `/d/r163`), `RANTAI-KELUAR 0`.
- Hasil sebelumnya: `uji-rantai-31okt/hasil-rantai-26.txt` - 26 paket SELESAI berurutan dari salinan baru (1 Nov 13.58-14.20, `rantai155.sh`: basis `aps_badilag_rantai155f`, pohon `/d/r155f`,
  paket dari `git archive HEAD`, `md5sum -c MD5SUMS.txt` di semua paket cocok), `RANTAI-KELUAR 0`. Paket 26 sendiri: `teks-pihak-1nov/hasil/uji-lokal.txt` (pasang ulang tidak mengubah
  apa pun; pulih = variabel, SEMUA fungsi, dan seluruh pohon RTF sama persis dengan keadaan sesudah 25 paket; pasang lagi = pasang pertama; dua penjaga menolak tanpa mengubah apa pun).
  Penyisipan `pembuktian-urut-1nov` di tengah TIDAK mengubah md5 dasar paket 23-26 (rantai lolos tanpa membangun ulang PRASYARAT mana pun).
- Hasil lama: `uji-rantai-31okt/hasil-rantai.txt` (21 paket SELESAI, 31 Okt 07.36-07.46, salinan baru `aps_badilag_rantai2` + `/d/r2`); dulu 18 paket (03.08-03.14), `uji-rantai-31okt/hasil-pulih3.txt` (pulih terbalik 3 paket
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

### 22. `pembuktian-urut-1nov` (cabang agenda-selingkuh w153, commit setelah 08b72508; keputusan 52) - SESUDAH `tanggal-agenda-31okt`
```
cd pembuktian-urut-1nov/paket-satker && bash pasang-satker.sh
```
Tanggal/hari pembuktian menurut URUTAN tahap pembuktian (variabel 2111/7119 dan 2112/7121 saja; tanpa variabel baru, tanpa fungsi, tanpa blangko);
lihat `pembuktian-urut-1nov/PASANG.md`. PRASYARAT memeriksa keempat variabel itu persis hasil `tanggal-agenda-31okt`; tidak ada paket lain yang menyentuh
2111/7119/2112/7121, jadi md5 dasar paket 23-26 TIDAK berubah oleh paket ini (diuji rantai 26 paket). Keluaran benar:
```
PRASYARAT COCOK (4|0)
CADANGAN: ... (2111,7119,2112,7121)
PERIKSA: SEMUA COCOK
PRASYARAT SESUDAH: 0|4
SELESAI - paket abt-pembuktian-urut-1nov terpasang. Pulih: ...
```

### 23. `jawab-replik-31okt` (cabang jawab-replik w148)
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

### 24. `butir-rata-31okt` (cabang jawab-replik w148)
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

### 25. `bukti-pisah-1nov` (cabang bukti-pisah-abt w152)
```
cd bukti-pisah-1nov/paket-satker && bash pasang-satker.sh
```
Bukti surat dan bukti elektronik dicetak TERPISAH di 201 BAS pembuktian dan 270 daftar bukti putusan (395 blangko; 2 putusan Harta Bersama yang sudah
punya sub-bab "B. Bukti Elektronik:" sendiri dibiarkan): fungsi baru isian_bukti_baris / isian_bukti_sumber / isian_bukti_rtf, variabel baru 12040-12076
(turunan isian bukti yang sudah ada, tanpa isian baru), lihat `bukti-pisah-1nov/PASANG.md`. md5 dasar = keadaan sesudah ke-23 paket di atas.
Keluaran benar:
```
PRASYARAT COCOK (0|0|0|3|0)
SIAP=395
BERKAS SIAP
SEMUA COCOK
UJI: 20 contoh fungsi sama dengan laptop
UJI: 37 kueri berjalan (perkara <id>)
TAMBAL=395
BERKAS COCOK
SELESAI - paket abt-bukti-pisah-1nov terpasang. ...
```
Uji rantai 24 paket 1 Nov 11.19-11.27 (`uji-rantai-31okt/hasil-rantai-24.txt`): semua SELESAI, `RANTAI-KELUAR 0`; pulih/pasang ulang/pasang lagi lolos
(`bukti-pisah-1nov/hasil/uji-lokal.txt`).

### 26. `teks-pihak-1nov` (cabang paket-25 w155; keputusan 55)
```
cd teks-pihak-1nov/paket-satker && bash pasang-satker.sh
```
Teks para pihak disalin apa adanya; yang dirangkai di tengah kalimat diturunkan huruf pertamanya SAAT CETAK (fungsi baru `isian_awal_kecil`,
`isian_rtf_kalimat_kecil`; variabel 9255/9256/11313 diganti, 12102-12105 baru); kesimpulan tertulis UTUH di 102 blangko (12100/12101); `isian_rtf_penanda`
mengenali "1 ." / "1 )" (diganti dengan penjaga md5 LAMA); Asal Usul Anak tanpa sub-bab dan "telah cukup dengan bukti suratnya" di BAS pembuktian
bersyarat (12106-12109); 313 blangko ditambal. Lihat `teks-pihak-1nov/PASANG.md`. md5 dasar = keadaan sesudah ke-25 paket di atas.
Keluaran benar:
```
PRASYARAT COCOK (3|0|0|0|1|0|0|0|4)
SIAP=313
BERKAS SIAP
SEMUA COCOK
UJI: 29 contoh fungsi sama dengan laptop
UJI: 13 kueri berjalan (perkara <id>)
TAMBAL=313
BERKAS COCOK
SELESAI - paket abt-teks-pihak-1nov terpasang. ...
```

### 27. `bas-halaman-1nov` (cabang bas-halaman-runut w159; keputusan 71) - PALING AKHIR
```
cd bas-halaman-1nov/paket-satker && bash pasang-satker.sh
```
Nomor halaman di kaki halaman BAS Derry: 609 blangko BAS yang kaki halamannya belum bernomor diberi field PAGE rata kanan bawah (585 kaki yang ada
diisi, 24 blangko tanpa kaki diberi kaki); 510 BAS yang sudah bernomor tidak disentuh. Hanya berkas RTF (tanpa variabel/menu/data). Nomor halaman
AWAL tiap BAS diatur portal saat cetak/unduh/unggah (halaman runut). Lihat `bas-halaman-1nov/PASANG.md`. md5 dasar = keadaan sesudah ke-26 paket.
Keluaran benar:
```
SIAP=609
BERKAS SIAP
PRASYARAT COCOK (SIAP=609)
TAMBAL=609
BERKAS COCOK
SELESAI - paket abt-bas-halaman-1nov terpasang. ...
```

### 28. `bas-lanjutan-1nov` (cabang bas-lanjutan-ringkas w163; keputusan 82) - PALING AKHIR
```
cd bas-lanjutan-1nov/paket-satker && bash pasang-satker.sh
```
Kalimat "Sidang ini merupakan lanjutan dari sidang tanggal ...; pada sidang tersebut ... hadir ...; kemudian sidang ditunda ..." (variabel 8562, dipakai di
blangko BAS sebagai "#5404# #8562#") dibuang dari 676 blangko BAS Derry (semua jenis perkara, semua sidang lanjutan); tinggal "Susunan majelis yang
bersidang sama dengan sidang yang lalu;" dan paragraf itu diberi inden baris pertama yang sama dengan paragraf BAS lain (bukan inden gantung).
Variabel 8562 TIDAK diubah; hanya pemakaiannya di BAS dihapus. Hanya berkas RTF (tanpa variabel/menu/data). Lihat `bas-lanjutan-1nov/PASANG.md`.
md5 dasar = keadaan sesudah ke-27 paket.
Keluaran benar:
```
BERKAS SIAP
PRASYARAT COCOK (SIAP=676)
TAMBAL=676
BERKAS COCOK
SELESAI - paket abt-bas-lanjutan-1nov terpasang. ...
```

### 29. `tanya-jawab-format-1nov` (cabang tanya-jawab-format w164; keputusan 85, 86, 89-B1) - PALING AKHIR
```
cd tanya-jawab-format-1nov/paket-satker && bash pasang-satker.sh
```
SEMUA tanya jawab tertulis tangan (tabel dua kolom: majelis/pihak bertanya kepada pihak/saksi) di 586 blangko BAS/putusan Derry (aktif dan arsip, tanpa `terhapus`) dibentuk persis keluaran ABT
(`kolom_kode_A4`): pertanyaan kiri, jawaban kanan di bawahnya diawali "- ", lebar 4250/8500 seragam, tanpa garis/indentasi/baris kosong (1.475 tabel). 98 BAS yang menulis
"Susunan majelis yang bersidang sama dengan sidang yang lalu;" sebagai teks biasa memakai `#5404#`. BAS ALUR 05 [3a] (CG, CT, arsip): bagian Tergugat memakai sebutan `#0047#`.
Variabel `#5404#` diganti kueri baru (membandingkan susunan majelis/PP sidang ini dengan sidang sebelumnya dari SIPP; kalimat pergantian lengkap; 3 penanda angka, tiap SEKALI): hanya
variabel ini yang diubah, tanpa variabel/menu/data baru. Lihat `tanya-jawab-format-1nov/PASANG.md`. md5 dasar = keadaan sesudah ke-28 paket.
Keluaran benar:
```
PRASYARAT COCOK (1|0|3)
BERKAS SIAP
SEMUA COCOK
UJI contoh 1: ... ; UJI contoh 2: ...
TAMBAL=586
BERKAS COCOK
SELESAI - paket abt-tanya-jawab-format-1nov terpasang. ...
```

### 30. `perbaikan-1nov` (cabang paket-30 w174; keputusan 89-B2/73 dan 92) - PALING AKHIR
```
cd perbaikan-1nov/paket-satker && bash pasang-satker.sh
```
A. Variabel tanggal/hari pembuktian #0046# (2111/7119) dan #0047# (2112/7121) memakai aturan TUNDAAN juga (kembaran SQL dari bot ddf15a3a): tahap pembuktian ditentukan DULU dari
alasan ditunda sidang sebelumnya ("pembuktian Tergugat" -> Tergugat; "pembuktian lanjutan Penggugat"/"saksi Penggugat" -> Penggugat; tanpa sebutan pihak -> aturan tahap keputusan 52).
Kueri = keluaran bot untuk 10.237/10.237 perkara (2112) dan 10.107/10.107 (2111) di SIPP 28 Okt; 37+6 perkara 2111 dan 13+1 perkara 2112 berubah/terisi baru. Cabang Court Calendar tidak diubah.
B. 5 perbaikan dasar hukum di 14 blangko (spesifikasi keputusan 92): KHI Pasal 7 ayat (4) tanpa "huruf a" (7 Itsbat Nikah Kontensius), KHI Pasal 58 ayat (1) "huruf b dan huruf c" -> "huruf b" (Izin Poligami [01b]),
Pasal 35 UU 1/1974 ayat (2) dengan bunyi naskah (Harta Bersama [01] E-Court), bunyi Pasal 7 ayat (1) UU 16/2019 (Itsbat Nikah [99]), "Pasal 1 Ayat 1" -> "Pasal 1 angka 1" UU 35/2014 (4 Dispensasi Kawin). Kata saja yang diganti.
Tanpa variabel/menu/fungsi baru. Lihat `perbaikan-1nov/PASANG.md`. md5 dasar = keadaan sesudah ke-29 paket.
Keluaran benar:
```
PRASYARAT COCOK (4|0)
BERKAS SIAP
CADANGAN: ... (baris variabel: 4)
SEMUA COCOK
UJI contoh 1: ... ; UJI contoh 2: ...
TAMBAL=14
BERKAS COCOK
SELESAI - paket abt-perbaikan-1nov terpasang. ...
```

### 31. `identitas-pihak-1nov` (cabang identitas-pihak w177, di atas paket-30; keputusan 101, 102, 112 dan 134) - SESUDAH ke-30
```
cd identitas-pihak-1nov/paket-satker && bash pasang-satker.sh
```
Format identitas pihak di putusan/penetapan = blangko acuan "[01] [Kabul Verstek] Cerai (Format Lengkap)" (folder 1 Perceraian CG): nama dan sebutan tebal, baris pertama menjorok 1,25 cm, baris lanjutan
menjorok gantung 4,5 cm, rata kanan-kiri, TANPA umur (REVISI 2 Nov, keputusan 112 Derry: "umur tidak perlu dalam putusan"; "(N tahun)" dibuang dari kedua fungsi, jadi juga di penetapan dan BAS), urutan agama-pendidikan-pekerjaan, kalimat kuasa "... Surat Kuasa Khusus tanggal ... yang telah didaftarkan ...".
A. Variabel 7047/7048 (identitas Penggugat-Pemohon / Tergugat-Termohon) dipangkas dari ~45 penanda dan 5 cabang menjadi SATU panggilan fungsi `isian_rtf_pihak_identitas` (2 penanda: sebutan dan kalimat kuasa);
fungsi itu diganti (urutan, kuasa, kalimat kuasa panjang tidak terpotong; tanpa umur) dan `isian_rtf_pihak_tambahan` (Turut Tergugat/intervensi) diselaraskan.
B. Blangko RTF (daftar-tambal.tsv + tambal.tsv, 611 berkas): paragraf identitas disamakan inden acuan; identitas tertulis tangan di BAS ALUR dan dispensasi kawin diganti `#7047#`/`#7048#`; sisa tulisan umur di 2 berkas `[99] BAS LAINNYA` (folder BAS lama) dibuang (revisi 2 Nov); umur pihak di satu relaas (`98 Relaas/[JS] 6.2 ... Pemberitahuan Putusan Verstek T`) dibuang (keputusan 134).
Lihat `identitas-pihak-1nov/PASANG.md`. md5 dasar = keadaan sesudah ke-30 paket.
Keluaran benar:
```
PRASYARAT COCOK (2|0|2|0|0|6)
BERKAS SIAP
CADANGAN: ... (2 baris lama)
FUNGSI: 2 diganti (isian_rtf_pihak_identitas, isian_rtf_pihak_tambahan)
SEMUA COCOK
UJI identitas sisi 1 ...; UJI identitas sisi 2 ...; UJI Turut Tergugat ...; uji kueri baru ...
TAMBAL=611
BERKAS COCOK
SELESAI - paket abt-identitas-pihak-1nov terpasang. ...
```

### 32. `kaidah-fikih-2nov` (cabang kaidah-fikih w180, di atas paket-31; keputusan 104, 110 dan 120) - SESUDAH ke-31, SEBELUM ke-33
```
cd kaidah-fikih-2nov/paket-satker && bash pasang-satker.sh
```
HANYA berkas RTF (tanpa variabel/menu/fungsi). A. Kaidah fikih / dalil syar'i yang lazim (bukti kelaziman: blangko Derry lain, putusan SIPP PA Donggala, blangko ABT PA Donggala)
ditambahkan sebagai paragraf baru ke 84 blangko putusan/penetapan akhir yang belum memuatnya (Al Muhadzdzab untuk tolak tidak terbukti, An-Nisa 128 + hadits ash-shulhu untuk akta
perdamaian, hadits hadhanah, An-Nisa 7/19/32, al Hawi al Kabir, al-walad lil firasy, I'anatuth Thalibin, An-Nisa 3, tasharruful imam, al-Ahzab 5). B. Izin Poligami [01b]: syarat adil
dikutip Pasal 58 ayat (1) huruf b KHI jo. Pasal 5 ayat (1) huruf c UU 1/1974 (keputusan 120). Pasal 119 ayat (2) KHI tidak disentuh. 67 blangko tanpa kaidah lazim berbukti -> "perlu Derry".
Lihat `kaidah-fikih-2nov/PASANG.md`. md5 dasar = keadaan sesudah ke-31 paket (revisi paket 31 b16c216f tidak mengubah RTF).
Uji rantai: `uji-rantai-31okt/hasil-rantai-32.txt` - 32 paket SELESAI berurutan dari salinan baru (2 Nov 10.19-10.35, `kaidah-fikih-2nov/sumber/rantai180.sh`, paket 31 = revisi umur-bas-halaman 9645d496), `RANTAI-KELUAR 0`.
Keluaran benar:
```
SIAP=85
BERKAS SIAP
TAMBAL=85
BERKAS COCOK
SELESAI - paket abt-kaidah-fikih-2nov terpasang (85 blangko). ...
```

### 33. `bas-halaman-semua-2nov` (cabang umur-bas-halaman w181; keputusan 113) - PALING AKHIR (sesudah ke-31 dan ke-32 kaidah-fikih-2nov)
```
cd bas-halaman-semua-2nov/paket-satker && bash pasang-satker.sh
```
SEMUA blangko BAS bernomor halaman. Paket ke-27 melewati berkas yang SATU kakinya sudah ber-PAGE dan hanya memeriksa folder berakhiran " - BAS"; audit per BAGIAN atas 1.216 BAS (kelompok BAS ekstensi, kecuali
98b/98c) menemukan 144 berkas "sebagian" (bagian pertama BAS Mediasi/Replik tanpa kaki) dan 36 berkas "tanpa" (folder BAS lama `ALUR 03-08`, `- BAS CONTRA PERCERAIAN -`): **180 berkas** ditambal
(field PAGE rata kanan di kaki yang ada, atau kaki baru di bagian tanpa kaki; bentuk sama dengan paket ke-27). Tanpa variabel/menu/data; tanpa nomor variabel baru. Portal tidak berubah (nomor awal runut sudah generik).
Lihat `bas-halaman-semua-2nov/PASANG.md`. md5 dasar = keadaan sesudah ke-31 paket (ke-32 hanya menyentuh blangko putusan).
Keluaran benar:
```
BERKAS SIAP
PRASYARAT COCOK (SIAP=180)
TAMBAL=180
BERKAS COCOK
SELESAI - paket abt-bas-halaman-semua-2nov terpasang. ...
```

