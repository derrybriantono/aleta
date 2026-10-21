# Paket ABT `abt-x10-audit-ringan-21okt` - perbaikan temuan RINGAN audit variabel ABT 21 Okt 2026 (agen X10)

**Status: teruji di ABT LAPTOP (PRASYARAT, pasang, PERIKSA, pasang ulang, pulih, pasang lagi), di renderer php56 ABT asli (205 perkara + 27 cetakan blangko RTF asli), atas perkara lokal, dan BACA SAJA di server (MariaDB 5.5). Server: BELUM dipasang - dipasang sesi utama.**
Bahan: `D:/Aplikasi/aleta/tmp/audit-variabel-abt-21okt.json` (temuan R1-R11, I1-I2). Keadaan dasar = salinan `abt_variabel` server 21 Okt malam, sesudah paket x1-x7 (**2.480 baris**, diambil baca-saja).
Hanya tabel `abt_variabel` yang disentuh: **26 baris diubah** (hanya kolom `sql_query`/`default_data`), **tidak ada variabel baru** (rentang 3550-3599 tidak dipakai). Tidak ada blangko (RTF), folder, menu, atau isian per perkara yang diubah. Tiap baris diubah dijaga **sidik jari seluruh barisnya** (nama, tipe, tabel, kolom, urutan, referensi, md5 kueri, md5 bawaan): bila ada yang menyunting baris itu sesudah salinan, paket berhenti dan tidak mengubah apa pun. Teks semua ASCII, tanpa kata "Aleta".

## Isi per butir (26 baris)

| butir | variabel | perubahan | aturan / alasan |
|---|---|---|---|
| **R3** | `0143` Total Biaya Perkara (842 blangko, 648 Derry) | baris `0#0243#` dibuang | `#0243#` tidak ada; "0#0243#" selalu dihitung 0 sehingga **angka total TIDAK berubah** (diuji: 205 perkara persis sama). Sita jaminan kini seluruhnya di `#0242#` (paket 14 Okt). Rujukan mati dibuang agar nomor 0243 kelak tidak menyusup ke total. Komponen total lain (pendaftaran, proses, panggilan, PNBP panggilan, sumpah, penerjemah, redaksi, meterai, PNBP cabut, sita, pemeriksaan setempat) cocok dengan jenis biaya SIPP dan tidak diubah. |
| **R4** | `0018`, `6031` nama jurusita; `0213` alasan penggantian jurusita; `0212` alasan penggantian PP | `order by ... limit 1` | hasil pasti walau ada dua baris aktif urutan 1. Jurusita: `order by id` (= baris pertama alami; diuji 10.201 perkara, 0 beda); `0212`: baris PP yang sama dengan `#0015#` (aktif urutan 1, penunjukan terbaru). |
| **R5** | `1076`, `1077` Tgl Relaas | `join v_pihak_perkara` -> `join perkara_pihak1` / `perkara_pihak2` | `v_pihak_perkara` = UNION `perkara_pihak1`+`perkara_pihak2` (cek `SHOW CREATE VIEW`), jadi hasil sama; tanpa UNION lebih cepat. Lokal 300 perkara relaas: 1076 17-52 dtk -> 6 dtk, 1077 61-80 dtk -> 4-8 dtk; hasil sama pada 300/300 perkara. |
| **R6** | `6144` `6145` `6146` `6147` `6148` `6151` Saksi 4 P; `0357` Tgl. Lahir Saksi 1 T | `limit 3,2` -> `limit 3,1`; `0357` + `order by a.urutan` | gaya kueri (dua baris, ABT memakai yang pertama = hasil sama); `0357` kini berurutan seperti `0356`/`0358`. Tidak ada perubahan hasil. |
| **R7** | `7178`, `0228` bawaan teks; `0317`, `0328` kueri | ejaan baku | "diluar" -> "di luar", "ditempat" -> "di tempat" (`7178`, `0228`); "Undang-undang Nomor 1 tahun 1974" -> "Undang-Undang Nomor 1 Tahun 1974" (`0317`/`0328`, tercetak di putusan Itsbat Nikah; rujukan Pasal 7 ayat (3) KHI tidak diubah). |
| **R8** | `1149`, `3333` bawaan popup | netral | `1149` memuat nama pejabat satker -> `........`; `3333` memuat KUA Banawa/Biromaru -> `Kecamatan ..., Kabupaten ...` (blangko universal per satker). Hanya mengisi popup. |
| **R2** | `8146`/`8147` (PEMOHON/PENGGUGAT, TERMOHON/TERGUGAT), `7713` | samakan logika | `8146`/`8147` kini memperlakukan Izin Poligami (jenis 341) sebagai PEMOHON/TERMOHON seperti `0046`/`0047` (12 perkara lokal berubah dari PENGGUGAT ke PEMOHON, mis. 252/Pdt.G/2024; 9 blangko memakainya); `7713` mengecualikan "Duplik Rekonvensi" seperti `7113` (0 blangko). |
| **R11** | `6150` | `saksi_pihak_ke=4 and urutan=1` -> `saksi_pihak_ke=1 ... order by urutan limit 3,1` | sama dengan `8923` (hubungan saksi keempat Penggugat/Pemohon); dulu selalu kosong. 0 blangko. |
| **R11** | `7123`, `7124` Hari Perbaikan | agenda `%perbaikan%` (bukan `%replik%`/`%kesimpulan%`), kurung pada `AND/OR` | kueri lama mencari agenda yang salah dan `OR '%...%'` sebagai operand. **0 blangko memakai keduanya**; hasil berubah pada perkara yang punya agenda replik/kesimpulan. Bila ternyata dipakai petugas sebagai tanggal replik, kembalikan dengan pulih atau sunting dua baris itu. |

## PRASYARAT yang diharapkan (server, baca saja, 21 Okt 2026 malam)

`0|0|26|0|14|0` = A nomor baru berisi lain (0) | B nomor baru yang sudah persis paket (0) | C dari 26 baris yang akan diubah, yang masih isi LAMA (26) | D yang sudah isi BARU (0) | E dari 14 variabel lama yang dirujuk (`0026 0047 0242 0244 0279 0281 0312 1358 5223 6032 6060-6063`), yang ada (14) | F baris diubah yang isinya bukan lama bukan baru (0).
Pasang ulang: `0|0|0|26|14|0`. Angka lain = berhenti, tidak ada yang diubah.
Ini SUDAH dijalankan baca saja di server (SELECT atas `aps_badilag.abt_variabel`, 21 Okt malam) dan hasilnya `0|0|26|0|14|0`.

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/w40/abt-paket/x10-audit-ringan-21okt     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-x10-20261021'
scp -r paket-satker/* aleta:/root/abt-x10-20261021/
ssh aleta 'cd /root/abt-x10-20261021 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-x10-20261021/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|26|0|14|0)`, `CADANGAN: ... (26 baris lama)`, `SEMUA COCOK`, sembilan baris `uji perkara NNNN: 19 kueri jalan; berisi: ...`, `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-x10-20261021/pulih-satker.sh'` (baris terakhir `PULIH COCOK`).
Gagal sesudah PASANG (PERIKSA/uji tidak cocok) = pulih otomatis. Tidak perlu memulai ulang apa pun (ABT membaca `abt_variabel` setiap cetak); tidak ada perubahan berkas di server. Cadangan `cadangan/abt_variabel-sebelum.sql` memuat 26 baris lama (kueri/bawaan, tanpa data pribadi); pasang ulang tidak menimpanya.

## Hasil uji (21 Okt 2026)

**Siklus ABT laptop** (MariaDB 10.4, DB `aps_badilag_x10` = salinan PERSIS `abt_variabel` server malam ini, 2.480 baris; sidik jari seluruh baris dibandingkan): PRASYARAT `0|0|26|0|14|0` -> pasang -> PERIKSA `SEMUA COCOK` -> pasang ulang (`0|0|0|26|14|0`, sidik jari sama) -> **pulih `PULIH COCOK`, sidik jari seluruh tabel kembali SAMA (2.480 baris, termasuk `modified`)** -> PRASYARAT lagi -> pasang lagi `SEMUA COCOK`. Jalankan ulang: `bash sumber/uji_lokal.sh semua`.

**Sebelum vs sesudah atas perkara lokal** (`sipp_donggala`, baris pertama hasil pernyataan mentah seperti ABT; `alat/banding_sql10.py`):

| variabel | perkara diuji | berbeda | catatan |
|---|---|---|---|
| `0018` `6031` `0212` `0213` | 10.201 (punya jurusita/PP) | **0** | murni kepastian urutan |
| `6144`-`6148`, `6151` | 117 (>= 3 saksi Pemohon) | **0** | baris pertama sama (`limit 3,2` -> `3,1`) |
| `0357` | 129 (punya saksi Tergugat) | **0** | |
| `1076` `1077` | 300 acak (punya relaas) | **0** | 6 / 4-8 dtk vs 17-80 dtk per 300 perkara |
| `8146` `8147` | 10.216 | 12 | semuanya Izin Poligami: PENGGUGAT/TERGUGAT -> PEMOHON/TERMOHON |
| `6150` | 117 | 53 | tak ada baris -> hubungan saksi keempat (21 berisi, 32 kosong) |
| `7713` | 3.878 (punya kalender) | 1 | perkara 9868: duplik rekonvensi tidak lagi terpilih |
| `7123` `7124` | 3.878 | 133 / 149 | variabel tanpa blangko; agenda replik/kesimpulan -> agenda perbaikan |

**Renderer php56 ABT asli, 205 perkara** (23 contoh audit + 70 acak + kasus khusus PP ganda, jurusita campur, saksi tidak runtut, kalender ganda, tanpa jadwal, dll.; 34 variabel dicetak SEBELUM dan SESUDAH; `alat/render_banding.py`): 0 galat. Berubah hanya: `0317`/`0328` (205/205: "tahun" -> "Tahun", "Undang-undang" -> "Undang-Undang"), `6150` (2), `7123` (20), `7124` (16), `8146`/`8147` (1: perkara 252/2024 Izin Poligami). **Tidak berubah pada semua 205 perkara**: `0143` (total biaya), `0018`, `6031`, `0212`, `0213`, `0357`, `1076`, `1077`, `6144`-`6148`, `6151`, `7713`, `8544`/`8545`, `1241`-`1252`, `6149`, `8129`, `8155`.
**Cetakan blangko RTF asli, 27 cetakan** (10 blangko: Derry BAS Itsbat Nikah Kabul dan Syahadah, BAS 6 (4 Saksi), Gugur, Alamat Tidak Jelas, Sampul Berkas A, Penetapan IN 2P, Penunjukan JS/JSP dan PP, BAS Pemeriksaan Setempat; `alat/render_rtf.py`): 25 persis sama, 2 berubah (Penetapan IN 2P: "tahun 1974" -> "Tahun 1974"), 0 galat, jumlah "..." tidak pernah naik.
**Konfirmasi di server, baca saja (MariaDB 5.5)** (`alat/uji_server.py`; 9 perkara nyata): kueri LAMA dan BARU 19 variabel dijalankan di server: berbeda hanya `7123` (273/Pdt.G/2026), `8146`/`8147` (252/Pdt.G/2024: PENGGUGAT -> PEMOHON) dan `212` (341/Pdt.G/2026: '' -> NULL, tercetak sama-sama kosong); semua 19 baris `uji-kueri.tsv` jalan tanpa galat atas 9 perkara.
**Vitest/tsc:** `src/test/paket-abt-x10-audit-ringan-21okt.test.ts` (4 uji, hijau): MD5SUMS utuh, hanya 26 UPDATE (tanpa INSERT/DELETE/DDL, tanpa `data_type`/`nama`), ASCII tanpa kata merek, tiap perbaikan terbaca di PASANG. `npx tsc --noEmit`: bersih (kode 0).

## Yang TIDAK dikerjakan (dengan alasan)

1. **R1 duplikat persis (12 pasangan: 0008/9881, 0009/5271, 0017/7001, 0018/6031, 0025/1216, 0045/8175, 0150/2110, 0668/4004, 5100/6034, 5101/6032, 5135/5368, 8008/8010)**: menjadikan salah satunya rujukan `#NNNN#` memasukkan teks hasil ke dalam kueri lain (kutip/baris baru dapat merusak SQL) dan mengubah baris terkunci bawaan; nilai kini identik. Yang berisiko menyimpang diperbaiki berpasangan di paket ini/x2 (`0018`/`6031`, `6032`/`5101`). Nama variabel TIDAK diubah (portal membaca `abt_variabel`, mis. kamus variabel; menandai "usang" di nama berisiko).
2. **R2 sisanya**: `0667` vs `0690` (Majelis Hakim/Hakim) diukur identik pada semua perkara lokal (jabatan 1,2,3), tidak diubah; `5100`/`6034` "PANITERA SIDANG" (diubah 9 Okt 2026 oleh pengguna) dan `6033` dibiarkan.
3. **R9** (29 variabel hilang di `putusan_penetapan/test saja` dan `Fikrianto`) dan **R10** (penanda `##6032,##0102##` di `_formulir_kepaniteraan/A.5 Relaas Panggilan/A.5.v ...rtf`): bukan blangko Derry (folder uji/pribadi/formulir lama); tidak menyunting RTF.
4. **Dua BAS "P (Kuasa)"** (`berita_acara_sidang/1 BAS Pertama Standar/01-b ... PKuasanya` dan `01-c ... Tunda Panggil T`, masing-masing dua salinan nama `&`/`_`): "surat kuasa khusus tanggal #0207# ... nomor #0197# tanggal #0184#". Bukan blangko Derry, dan tidak dapat diperbaiki dari variabel (`#0184#` dipakai 200 blangko lain sebagai tanggal surat kuasa; `#0207#` sudah = `#0184#` sejak x2). Perbaikan RTF = satu penanda per berkas: `#0184#` kedua -> `#0111#` (tanggal register SIPP, seperti BAS saudaranya 01-a/08-b/08-c). **`alat/usulan_rtf_pkuasa.py` sudah siap (hanya melapor tanpa `--tulis`, membuat `.bak-x10`), TIDAK dijalankan** - menunggu persetujuan pengguna untuk menyunting blangko non-Derry.
5. **I1** (48 variabel bersyarat kosong) dan **I2** (456 variabel yatim): informasi, tidak perlu tindakan.
6. **`v_pihak_perkara` di tempat lain**: hanya `1076`/`1077` memakainya di antara variabel yang diaudit; sisanya tidak diubah.
