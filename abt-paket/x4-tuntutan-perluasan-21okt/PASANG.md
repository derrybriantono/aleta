# Paket ABT `abt-x4-tuntutan-perluasan-21okt` - tuntutan mengikuti posita/petitum untuk semua kelompok blangko Derry (21 Okt 2026)

**Status: teruji di ABT LAPTOP (lihat "Hasil uji"); PRASYARAT dan SELURUH 119 kueri baru/diubah dijalankan BACA SAJA di server (MariaDB 5.5) atas
5 perkara nyata: 0 galat. Server: BELUM dipasang - dipasang sesi utama SESUDAH x1, x2, x3 (sudah terpasang 21 Okt).**

Aturan pengguna: "kalau tidak ada permintaan mut'ah maka tidak ada pertimbangan mut'ah begitupun sama semua variabel/form yang tidak diminta di
posita dan petitum"; "ABT lama dan ABT by Derry harus sinkron dan sama, yang membedakan cuma tampilan". Paket x3 menangani cerai biasa; x4 sisanya.
Tanpa kata nama aplikasi di ABT (`modifier` = `admin`); semua teks ASCII; hanya blangko dan variabel Derry.

## Isi

| kelompok | variabel BARU | variabel DIUBAH | RTF ditambal |
|---|---|---|---|
| 1 Hak Bekas Istri (351) | 3401-3408 pemicu layar (nafkah iddah, maskan, kiswah, mut'ah, madliyah, mahar terhutang, biaya hadhanah, sita) - pola SAMA PERSIS dengan 3764 | 3760-3779 (20): 7 pola petitum + penjaga daftar pilihan bawaan isian PILIH 3741, 3743-3747, 3756 | - |
| 2 Varian cerai | 3410-3421: bagian akibat cerai yang belum tercetak di varian (susunan paket u2, pola x3) | 4110-4119, 4130-4134, 4138, 4139, 4140-4146, 4150 (25): penjaga daftar pilihan bawaan 4100-4105 dan 4109 | 22 berkas |
| 3 Kebendaan | 3440 pemicu utang bersama | 39 variabel 4788-4847: pola sita, utang, jaminan, batal berdiri sendiri | - |
| 4 Anak | 3430-3435 pemicu tuntutan tambahan (penyerahan anak, kenaikan, pendidikan/kesehatan, pemotongan, nafkah lampau anak, sita) | - | - |
| 5 Kelalaian kewajiban (345) | 3441-3448 pemicu (nafkah, madliyah, kiswah, tempat kediaman, biaya, pemotongan, sita, uang paksa) | - | - |

Jumlah: **35 variabel baru, 84 baris diubah, 22 blangko RTF ditambal.** Nomor baru bebas di server (21 Okt) dan tidak dipakai x1/x2/x3, w3a/w3b, x5
(w28: 9290-9293). Pemicu (34xx) TIDAK dicetak blangko mana pun - dibaca panel Blangko Derry (portal `susun.ts`) untuk menyembunyikan isian tuntutan
yang tidak diminta.

### Mengapa (temuan, diukur atas petitum + amar sungguhan: 5.877 perkara PA Donggala di server + 3.626 PA Bungku lokal)

- **Hak bekas istri 3764** ("Menimbang, bahwa ... tuntutan agar Tergugat dihukum memenuhi #3764#") menyala atas nama/alamat: nafkah iddah 28 perkara
  (Rosidah, Zubaidah, Hamidah, ...), maskan 26 (alamat KUA "tempat tinggal Pemohon"), mahar 11 (Maharani, Maharadja, Mahardika), mut'ah 2 (Mutahir),
  kiswah 3 ("biaya pakaian" anak), madliyah 1 (Pramadhika). Pola baru: 0 salah nyala atas kasus itu; 1 madliyah tambahan terbaca ("nafkah madiyah").
- **Kebendaan**: pemicu sita jaminan menyala atas 23 perkara karena nama (Rosita, Masita, Warsita, Nursita) dan kata "posita" (344/Pdt.G/2020
  harta bersama: putusan mencetak `[PERIKSA ... sita jaminan]` padahal tidak dimohon); "sita jaminan" dibaca sebagai tuntutan agunan ekonomi syariah
  (27); "Batalipu" = pembatalan akad (1). Pola baru: 0 kasus itu; seluruh 43 permohonan sita sungguhan tetap terbaca.
- **Varian cerai**: Mut'ah Iddah (8 berkas), CT [01a] ex officio, CG [01d]/[02c] kumulasi nafkah istri, folder 1d (6 putusan + 4 BAS putus
  verstek) tidak punya bagian hak asuh / nafkah anak / madliyah / harta bersama: bila dituntut, tidak tercetak. CG [01a] qabla dukhul punya amar 4138
  tetapi tanpa pertimbangan 4119 (dilewati paket u2).
- **Daftar pilihan bawaan**: jendela isian ABT lama mengisi kotak dengan `default_data` (5 pilihan berbaris) dan menyimpannya bila petugas menekan
  Simpan tanpa memilih. Kueri u2 lalu membaca "tidak dapat diterima" (pilihan ke-4) -> putusan mencetak "Menyatakan tuntutan mengenai hak asuh anak
  tidak dapat diterima" untuk tuntutan yang tidak diminta; 4109 berbaris -> "tidak disyaratkan". Hak bekas istri: waktu bayar 3756 berbaris tercetak
  dua-duanya. Renderer ABT sendiri TIDAK pernah mencetak `default_data` (diperiksa di `Abt_model::data_variabel_detil`: bawaan hanya mengisi kotak
  jendela; isian kosong tercetak "..."), dan tidak satu pun dari 1.759 RTF menulis #4100#-#4109# langsung.

### Tambalan RTF (`rtf-daftar-tambal.tsv`, jangkar tepat sekali, md5 sebelum/sesudah)

| berkas | jangkar -> pengganti |
|---|---|
| CT Mut'ah Iddah [01] x4, [01c] x4 | `#4117##8527#` -> `#4117##3410##8527#`; `#4139##8505#` -> `#4139##3411##8505#` |
| CT [01a] ex officio mut'ah iddah nafkah anak | `#4117##8527#` -> `#4117##3412##8527#`; `#8505#` -> `#3413##8505#` |
| CG [01d], [02c] kumulasi nafkah istri | `#8527#` -> `#3414##8527#`; `#8505#` -> `#3415##8505#` |
| CG [01a] qabla dukhul | `Menimbang bahwa karena perkara }` -> `#4119#Menimbang bahwa karena perkara }` |
| 1d [01] (daftar otomatis) / [01c], [02] (nomor tetap 4) | `#8527#` -> `#3416##8527#`; `#8505#` -> `#3417##8505#` / `4.\tab #8505#` -> `#3420#\tab #8505#` |
| 1d [01b] (daftar otomatis) / [01d], [02b] (nomor tetap 5) | `#8527#` -> `#3418##8527#`; `#8505#` -> `#3419##8505#` / `5.\tab #8505#` -> `#3421#\tab #8505#` |
| BAS putus verstek 1d [2] / [2b] (2 folder) | `#8505#` -> `#3417##8505#` / `#3419##8505#` |

Isi tetap varian (mut'ah/iddah ex officio, hak asuh/nafkah anak kumulasi, nafkah istri 9716/9717) tidak disentuh -> tidak ada yang tergandakan.
Tidak dikerjakan: CT [02] Rekonvensi (contoh tetap berisi jawaban-replik; tuntutan harta bersama rekonvensi belum tercetak; tidak ada jangkar
paragraf yang aman - lihat laporan).

## PRASYARAT yang diharapkan (server, baca saja)

`0|0|84|0|27|0` = A nomor baru berisi lain (0) | B nomor baru sudah persis paket (0) | C dari 84 baris yang diubah, yang masih isi LAMA (84) |
D yang sudah isi BARU (0) | E dari 27 variabel lama yang dirujuk, yang ada (27) | F baris diubah yang isinya bukan lama bukan baru (0).
Pasang ulang: `0|35|0|84|27|0`. **SUDAH dijalankan baca saja di server 21 Okt: `0|0|84|0|27|0`.**
RTF: praperiksa harus `RINGKAS COCOK=22 SUDAH=0 LEWAT=0` (pasang ulang: `COCOK=0 SUDAH=22`).

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/w26/abt-paket/x4-tuntutan-perluasan-21okt      # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-x4-20261021'
scp -r paket-satker/* aleta:/root/abt-x4-20261021/
ssh aleta 'cd /root/abt-x4-20261021 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-x4-20261021/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|84|0|27|0)`, `RTF RINGKAS COCOK=22 SUDAH=0 LEWAT=0`, `CADANGAN: ... (84 baris lama)`, `SEMUA COCOK`, sebelas baris
`uji perkara NNNN: 119 kueri jalan; ...`, `RINGKAS DITAMBAL=22 SUDAH=0 LEWAT=0`, `RTF RINGKAS COCOK=0 SUDAH=22 LEWAT=0`, `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-x4-20261021/pulih-satker.sh'` (RTF `RINGKAS PULIH=22 DILEWATI=0`, akhir `PULIH COCOK`). Gagal sesudah PASANG = pulih
otomatis. Tidak perlu memulai ulang apa pun (ABT membaca `abt_variabel` dan RTF setiap cetak). Portal: perubahan `susun.ts` ikut rilis berikutnya
(sebelum paket terpasang, pemicu 34xx tidak ada di katalog -> panel tidak menyembunyikan isian kelompok baru; aman dipasang dalam urutan mana pun).
Bila paket u2 dibangun/dipasang ulang, pasang x3 lalu x4 lagi (PRASYARAT menolak bila isi u2 berbeda).

## Membangun ulang

`python sumber/bangun_paket.py [<pohon RTF hasil untuk uji>]` (membaca `VAR_SERVER_HEX` = salinan HEX `abt_variabel` server 21 Okt sesudah x1-x3,
2.441 baris, dan `RTF_SERVER` = salinan pohon `derry_briantono` server 21 Okt, 1.759 RTF - keduanya di luar repo, `D:/Aplikasi/aleta/tmp/w26`).
Sumber: `sumber/pola_x4.py` (SATU sumber pola, juga dipakai alat ukur), `sumber/definisi_x4.py` (variabel; memakai penyusun paket u2 dan pola x3 tanpa
mengubahnya - 4110/4119/4138/4139/4140/4146/4150 hasil susun ulang = isi server persis), `sumber/rtf_def.py`, `sumber/skenario_x4.py` (render).

## Hasil uji (21 Okt 2026)

- **Server, baca saja**: PRASYARAT `0|0|84|0|27|0`; SELURUH 119 kueri baru/diubah (rujukan `#NNNN#` diganti X) atas perkara 7326, 9089 (CG),
  7522 (CT), 8706, 5404 (harta bersama): 0 galat (`hasil/uji-kueri-server.txt`). 5404 ("posita") pemicu sita kosong, 8706 (sita marital) berisi.
- **Pola di MariaDB 5.5 server = Python** (`alat/ukur_pola_server.py`): 36 pola lama/baru, jumlah perkara menyala sama persis (`hasil/ukur-pola-server.json`).
- **Ukur atas petitum + amar sungguhan** (`alat/ukur_pola.py`, `hasil/ukur-pola.json`; tiap kasus berubah dibaca satu per satu): semua kasus
  "lama menyala, baru tidak" = nama pihak / alamat / "posita" / "biaya pakaian" anak / "sita jaminan" (bukan agunan); tidak ada tuntutan sungguhan
  yang hilang. Pemicu anak dan kelalaian (baru): penyerahan anak 3 petitum (semuanya sungguhan, setelah "menyerahkan kepada penggugat nafkah ... anak"
  disingkirkan), kenaikan 6, nafkah lampau anak 3, sita 3.
- **ABT laptop** (`sumber/uji_lokal.sh`; basis `aps_badilag_x4u` = salinan persis `abt_variabel` server + salinan pohon RTF server; `hasil/uji-lokal-siklus.txt`):
  PRASYARAT `0|0|84|0|27|0` -> RTF `COCOK=22` -> cadangan 84 baris -> `SEMUA COCOK` -> 11 perkara x 119 kueri jalan -> `DITAMBAL=22` -> pasang ulang
  `0|35|0|84|27|0` (sidik jari sama) -> PULIH (`RTF PULIH=22`, `PULIH COCOK`): sidik jari variabel DAN pohon RTF kembali SAMA dengan server ->
  PRASYARAT lagi `0|0|84|0|27|0` -> pasang lagi `SEMUA COCOK`.
- **Renderer php56 ABT asli** (`alat/render_x4.py`, `sumber/skenario_x4.py`, `hasil/render-ringkasan.json`): 19 skenario, sebelum (RTF + variabel server)
  dan sesudah (RTF tambalan + paket), **19/19 lolos**: nomor amar urut tanpa lompatan, 0 butir kosong, 0 penanda tersisa.
  - Tanpa tuntutan (Mut'ah Iddah, CT ex officio, CG kumulasi nafkah istri, 1d [01] dan [02], qabla dukhul): teks sesudah **persis sama** dengan sebelum.
  - Dituntut, belum dipilih: `[PERIKSA: petitum menuntut ...]` hak asuh / nafkah anak / madliyah (Mut'ah Iddah), hak asuh (qabla dukhul).
  - Dituntut dan diputus: Mut'ah Iddah + hak asuh + nafkah anak + madliyah (amar 1-7), CT ex officio + hak asuh + madliyah (amar 1-9, sub-butir 4.1/4.2
    tetap), CG kumulasi nafkah istri + hak asuh (1-6), 1d [02] nomor tetap: nafkah anak + menolak selebihnya (1-6), 1d [01d] nomor tetap mulai 5: iddah
    (1-6), BAS putus verstek 1d: nafkah anak.
  - Daftar bawaan tersimpan: CG Format Lengkap dengan 4100-4105/4109 berisi daftar pilihan: sebelum 6 paragraf "Menyatakan tuntutan mengenai ... tidak dapat
    diterima" + 6 `[PERIKSA]`; sesudah tidak ada. Hak bekas istri dengan 3756/3741 berbaris: sebelum amar mencetak dua waktu bayar; sesudah tidak.
  - Hak bekas istri, petitum hanya mut'ah, nama Penggugat memuat "idah", alamat "bertempat tinggal": sesudah 3764 = "mut'ah" saja (sebelum menyebut
    nafkah iddah dan maskan juga).
  - Harta bersama 344/Pdt.G/2020 (petitum menyebut "posita"): sebelum `[PERIKSA ... sita jaminan]`, sesudah tidak; 305/Pdt.G/2025 (sita marital): sama-sama
    `[PERIKSA ... sita]` (benar).
  - Catatan: baris kepala penanda pada blangko gelombang 3 (baris 1, daftar semua isian) mencetak nilai mentah isian di ABT - di luar paket ini.
