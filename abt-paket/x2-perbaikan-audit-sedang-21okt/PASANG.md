# Paket ABT `abt-x2-perbaikan-audit-sedang-21okt` - perbaikan temuan SEDANG (S1-S10) audit variabel ABT 21 Okt 2026 (agen X2)

**Status: teruji di ABT LAPTOP (PRASYARAT, pasang, PERIKSA, pasang ulang, pulih, pasang lagi) dan di renderer php56 ABT asli atas 472 perkara + 39 cetakan blangko RTF asli; PRASYARAT dan semua kueri yang diubah/baru dijalankan BACA SAJA di server (MariaDB 5.5). Server: BELUM dipasang - dipasang sesi utama.**
Bahan: `D:/Aplikasi/aleta/tmp/audit-variabel-abt-21okt.json` (temuan S1-S10). Keadaan dasar = server pagi 21 Okt + paket x1 (`abt_variabel` 2.421 baris; x1 terpasang 09.03).
Hanya tabel `abt_variabel` yang disentuh: **19 variabel baru** dan **69 baris diubah** (hanya kolom `data_type`/`sql_query`/`default_data`). Tidak ada blangko (RTF), folder, menu, atau isian tersimpan per perkara yang diubah. Kolom `modifier` baris baru = `admin`, tanpa kata "Aleta"; teks semua ASCII. Tiap baris diubah dijaga **sidik jari seluruh barisnya** (nama, tipe, tabel, kolom, urutan, referensi, md5 kueri, md5 bawaan): bila ada yang menyunting baris itu sesudah x1, paket berhenti dan tidak mengubah apa pun.

## Isi per butir

| butir | variabel | yang diubah | aturan |
|---|---|---|---|
| **S1** | `0015` Nama PP | kueri: `+ IFNULL(panitera_nama,"")<>""`, `order by tanggal_penetapan desc, urutan, id limit 1` | satu PP: yang aktif, bernama, **paling baru ditunjuk**; bila sama tanggal, urutan terkecil (PP utama; SIPP menampilkan PP menurut `urutan`), lalu id. Dua PP aktif berbeda di SIPP terjadi bila penunjukan PP ikrar talak (tahapan 18/20) tidak menonaktifkan PP pemeriksa; yang tercetak kini PP terakhir ditunjuk (BAS ikrar memakai `#0015#`). |
| **S2** | `6032`, `5101` label Jurusita/Jurusita Pengganti | kueri: `where a.aktif="Y" and a.urutan=1 ... order by a.id limit 1` | sama dengan nama `#0018#`/`#6031#` (aktif, urutan 1; diuji: jurusita pilihan `order by a.id` = baris pertama alami `#0018#` pada 10.186/10.186 perkara). Jurusita yang sudah diganti (aktif `T`) tidak lagi menentukan label. |
| **S3** | `9003`, `7105`, `7106` | `#0050# = 1` -> `'#0050#' = '1'` dan `from dual where '#0050#' <> ''` | perkara tanpa jadwal sidang: dulu galat sintaks (`case when = 1`, seluruh blangko berhenti "ERROR Variabel"); kini tanpa baris = "..." (tanpa galat). Dengan jadwal: sama persis (sidang 1 = "Sidang Pertama", 2 dst = "Lanjutan"). |
| **S4** | `1241` `1242` `1251` `1252` `6149` hubungan saksi | `and urutan=N` -> `order by urutan limit N-1,1` | memilih saksi sama dengan variabel namanya (`1197`/`1203`/`6100`/`6106`/`6132`: `order by urutan limit k,1`). Hubungan kini selalu milik saksi yang sama dengan nama yang tercetak. |
| **S5** | 52 variabel `data_type` NULL yang dipakai blangko | `data_type` saja | `data_tanggal`: `0309` `0662` `1281` `8018` (dipakai sebagai tanggal); `data_teks`: 48 lainnya. Nama dan isi lain TIDAK diubah. Di server tidak ada isian tersimpan untuk 52 nomor ini (dicek `abt_data_teks`/`abt_data_tanggal`), jadi cetakan tidak berubah ("..." sampai petugas mengisi lewat popup); yang berubah: popup kini dapat diisi. |
| **S6** | `8544`, `8545` Tanggal/Hari Putusan | kueri ditulis ulang | tanggal putusan sungguhan (`perkara_putusan`) bila sudah ada; bila belum, agenda court calendar (musyawarah/putusan/penetapan) dengan **tanggal terakhir** (`order by rencana_tanggal desc, id desc`) = jadwal pengucapan, bukan musyawarah yang mendahuluinya. Tidak ada = kosong (seperti dulu). |
| **S7** | `5128` Alasan-Alasan | bawaan teks | `Pernggugat` -> `#0046#` (variabel sebutan Pemohon/Penggugat yang dipakai SEMUA baris lain teks itu: tercetak "Penggugat" pada gugatan, "Pemohon" pada permohonan), `kekerasan pisik` -> `kekerasan fisik`. Salah ketik lain di teks itu tidak ditemukan (pemeriksaan ejaan audit: hanya dua itu yang nyata). Bawaan hanya mengisi popup; 2 isian tersimpan di server TIDAK diubah. |
| **S8** | 19 variabel baru | lihat di bawah | variabel yang dirujuk BAS standar tetapi tidak ada (tercetak "..." tanpa jalan mengisi). |
| **S9** | `1335` (+ `1372` sejenis) | bawaan teks | `Kabupaten Majene` -> `Kabupaten .....` (pola `1339`). `1372` Penerbit Kartu Keluarga memuat sisa yang sama (5 blangko) - ikut diperbaiki, di luar daftar audit. |
| **S10** | `6271` Penghasilan #0047# Perbulan | `data_sql` -> `data_teks`, teks dipindah dari `sql_query` ke `default_data`, `sql_query` NULL | isi tetap sama dengan `5271`/`0009`; dulu galat bila dipakai (0 blangko memakainya). |

### S8 - variabel baru (19)

| no | tipe | isi |
|---|---|---|
| `8155` | `tanggal_hijriah`, referensi `0033` | tanggal Hijriah putusan sela = tanggal sidang, persis seperti `8184` ("pada hari #0032# tanggal #0033# Masehi bertepatan tanggal #8155# Hijriyah"; 3 blangko Tussenkomst/Voeging/Vrijwaring). |
| `0207` | `data_sql` | "surat kuasa khusus tanggal #0207#" di dua BAS "P (Kuasa)" = sama dengan `#0184#` (Tgl. Surat Kuasa; BAS saudaranya memakai `#0184#` di tempat itu). Kosong bila `0184` belum diisi. |
| `0074` | `data_sql` | hubungan saksi pertama Penggugat/Pemohon dengan pihak (BAS PA Donggala verstek: "ia adalah #0074# #0046#"; nama saksi itu `#1197#`) = isi `#1241#` (urutan pertama). |
| `5052` `6115` `6116` `8445` | `data_teks` | isian: jawaban Tergugat (Voeging/Vrijwaring), dua pertanyaan Ketua Majelis pada pemeriksaan setempat, tuntutan pihak ketiga. Tidak ada sumbernya di SIPP. |
| `8439`-`8444` | `data_teks`, bawaan `#10121#`-`#10126#` | identitas pihak ketiga (nama, umur, agama, pendidikan, pekerjaan, tempat tinggal): isian popup yang bawaannya terisi dari SIPP bila pihak ketiga sudah tercatat (pola sama dengan `9023`/`#10113#` paket x1). |
| `10121`-`10126` | `data_sql` | bacaan otomatis pihak ketiga pertama dari SIPP `perkara_pihak3` + `pihak` (`order by urutan, id limit 1`). Di server `perkara_pihak3` kosong (0 perkara): bawaan popup kosong sampai ada data. |

Nomor baru `0074`, `0207`, `5052`, `6115`, `6116`, `8155`, `8439`-`8445`, `10121`-`10126`: BEBAS di server (PRASYARAT A = 0) dan tidak diklaim paket lain yang dicek (`D:/aleta-dev/wt/*/abt-paket`, `kerja`, `cadangan-db`). Terpakai 10121-10126; sesi lain sebaiknya menghindari 10114-10149 sampai x2 terpasang.

Berkas `paket-satker/`: `...-PRASYARAT.sql`, `...-PASANG.sql`, `...-PERIKSA.sql`, `...-PULIH.sql`, `pasang-satker.sh`, `pulih-satker.sh`, `nomor-baru.txt`, `nomor-ubah.txt`, `perkara-uji.txt`, `uji-kueri.tsv`, `MD5SUMS.txt`. Dibangun ulang dengan `python sumber/bangun_paket.py` (butuh salinan HEX `abt_variabel` keadaan dasar di `VAR_BASE_HEX`, di luar repo; untuk memasang cukup `paket-satker/`). `sumber/variabel_def.py` = definisi terbaca; `hasil/isi-paket.json` = ringkasan isi lama/baru; `hasil/ringkasan-uji.json` = angka uji.

## PRASYARAT yang diharapkan (server, baca saja, 21 Okt 2026)

`0|0|69|0|9|0` = A nomor baru berisi lain (0) | B nomor baru yang sudah persis paket (0) | C dari 69 baris yang akan diubah, yang masih isi LAMA (69) | D yang sudah isi BARU (0) | E dari 9 variabel lama yang dirujuk (`0033` `0046` `0047` `0050` `0184` `7101`-`7104`), yang ada (9) | F baris diubah yang isinya bukan lama bukan baru (0).
Pasang ulang: `0|19|0|69|9|0`. Angka lain = berhenti, tidak ada yang diubah.
Ini SUDAH dijalankan baca saja di server (SELECT atas `aps_badilag.abt_variabel`, 21 Okt sesudah x1 terpasang) dan hasilnya `0|0|69|0|9|0`.

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/integrasi21/abt-paket/x2-perbaikan-audit-sedang-21okt     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-x2-20261021'
scp -r paket-satker/* aleta:/root/abt-x2-20261021/
ssh aleta 'cd /root/abt-x2-20261021 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-x2-20261021/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|69|0|9|0)`, `CADANGAN: ... (69 baris lama)`, `SEMUA COCOK`, sembilan baris `uji perkara NNNN: 23 kueri jalan; berisi: ...`, `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-x2-20261021/pulih-satker.sh'` (baris terakhir `PULIH COCOK`).
Gagal sesudah PASANG (PERIKSA/uji tidak cocok) = pulih otomatis. Tidak perlu memulai ulang apa pun (ABT membaca `abt_variabel` setiap cetak); tidak ada perubahan berkas di server.
Cadangan `cadangan/abt_variabel-sebelum.sql` memuat 69 baris lama (kueri/bawaan, tanpa data pribadi). Pasang ulang tidak menimpa cadangan itu. Pulih menyalin dulu isian tersimpan nomor baru (`abt_data_teks`/`abt_data_tanggal`; FK CASCADE ikut menghapus bila variabelnya dihapus) ke `cadangan/*-isian-sebelum-pulih.*.sql`.
Pulih mengembalikan `data_type` NULL pada 52 variabel S5; isian yang sudah diketik petugas sesudah pasang tetap ada di tabel isian tetapi tidak tercetak lagi.

## Hasil uji (21 Okt 2026)

**Siklus ABT laptop** (MariaDB 10.4, DB `aps_badilag_x2` = salinan PERSIS keadaan server+x1, 2.421 baris; sidik jari seluruh baris dibandingkan): PRASYARAT `0|0|69|0|9|0` -> pasang (19 tambah, 69 ubah; 2.440 baris) -> PERIKSA `SEMUA COCOK` -> pasang ulang (`0|19|0|69|9|0`, sidik jari sama) -> **pulih `PULIH COCOK` dan sidik jari seluruh tabel kembali SAMA dengan sebelum pasang (2.421 baris, termasuk `modified`)** -> PRASYARAT `0|0|69|0|9|0` lagi -> pasang lagi `SEMUA COCOK`. Pulih juga diuji dengan isian tersimpan yang sudah ada (FK CASCADE): isian nomor baru (`8439`, `5052`) disalin dulu ke `cadangan/abt_data_teks-isian-sebelum-pulih.*.sql` sebelum variabelnya dihapus, isian variabel S5 (`1038`, `0662`) tetap di tabel; sidik jari kembali sama dan pasang lagi `SEMUA COCOK`. Jalankan ulang: `bash sumber/uji_lokal.sh semua`.

**Perbandingan SEBELUM vs SESUDAH atas SEMUA 10.216 perkara lokal** (`sipp_donggala`; baris pertama hasil pernyataan mentah seperti ABT; `alat/banding_sql.py`) - tiap perbedaan dijelaskan:

| var | perkara sama | berbeda | rincian perbedaan (semuanya perbaikan) |
|---|---|---|---|
| `0015` | 10.208 | 8 | 8 perkara dengan 2 PP aktif berbeda (pemeriksa tahapan 10 + PP ikrar/lanjutan 18/20 yang tidak menonaktifkan): kini PP terakhir ditunjuk (3639, 6521, 7194, 7353, 7847, 7861, 8725, 9844). 277 perkara tanpa PP aktif tetap "...". 36 perkara PP ganda lain (orang sama / urutan 1-2 sama tanggal) tidak berubah. |
| `6032` `5101` | 10.202 | 14 | label sesuai jurusita yang tercetak namanya: 11 perkara "Jurusita Pengganti" -> "Jurusita", 3 perkara "Jurusita" -> "Jurusita Pengganti" (jurusita lama berjabatan lain sudah aktif `T`). Perkara tanpa perbedaan jabatan tidak berubah. |
| `1241` | 10.076 | 140 | 61 "..." -> hubungan saksi pertama yang benar; 79 "..." -> kosong (saksi ada, hubungan memang kosong di SIPP). |
| `1242` | 10.079 | 137 | 57 "..." -> isi, 5 kosong -> isi, **30 isi milik saksi lain -> isi saksi kedua yang sebenarnya**, 37 "..." -> kosong (hubungan memang kosong di SIPP); 8 sisanya: dulu tercetak hubungan saksi bernomor urutan 2 yang bukan saksi kedua (3 kosong -> "...", 3 isi -> "...", 2 isi -> kosong). |
| `1251` `1252` | 10.088 / 10.125 | 128 / 91 | "..." -> hubungan saksi Tergugat yang benar (49 / 38) atau kosong (79 / 52); 1 isi lain. |
| `6149` | 10.046 | 170 | **161 perkara tanpa saksi ketiga**: dulu ada baris (86 berisi, 75 kosong) karena ada saksi ber-urutan 3 yang sebenarnya saksi 1/2, padahal nama "Saksi 3" tercetak "..." -> kini "..." serasi dengan nama; 4 "..." -> isi, 4 "..." -> kosong, 1 isi milik saksi lain. |
| `8544` `8545` | 527 / 538 | 9.689 / 9.678 | 9.665 perkara sudah putus tanpa agenda court calendar: kosong -> tanggal/hari putusan sungguhan; **24 perkara agenda musyawarah/putusan ganda atau tanggal kalender berbeda dari putusan sungguhan** (19 + 5): tanggal musyawarah/rencana -> tanggal putusan (mis. 7883: 02 Juli -> 04 Juli 2024, Selasa -> Kamis). |
| `0018` `6031` `1197` `1203` `6100` `6106` `6132` (pembanding, tidak diubah) | 10.216 | 0 | |

Kecocokan hubungan saksi dengan nama (`alat/cek_s4.py`, 10.216 perkara): hubungan **LAMA** tidak cocok dengan saksi bernama di **61 / 94 (+6 tanpa saksi kedua) / 49 / 39 / 5 (+161 tanpa saksi ketiga)** perkara untuk `1241`/`1242`/`1251`/`1252`/`6149`; hubungan **BARU** tidak cocok di **0** perkara (nama juga 0). Kelompok saksi ber-urutan ganda (6 kelompok): baris terpilih sama dengan nama.

**Renderer php56 ABT asli, 472 perkara** (23 contoh audit + 260 acak + kasus khusus: PP ganda, jurusita campur, saksi tidak runtut 70, kalender ganda 19, tanpa jadwal 10; `alat/render_banding.py`): 90 variabel dicetak SEBELUM dan SESUDAH; 0 galat sesudah; yang berubah hanya `0015` (8), `6032`/`5101` (14), `1241` (38), `1242` (40), `1251` (45), `1252` (33), `6149` (40), `8544` (420), `8545` (409), `0074` (383, baru), `0207` (5, baru: `0184` terisi), `8155` (472, baru: Hijriah sama dengan `8184`). Semua 52 variabel S5 dan `5052` `6115` `6116` `8439`-`8445` `10121`-`10126` `1335` `1372` tetap "..." (sama sebelum/sesudah). Nilai renderer = nilai harness SQL pada semua perkara dan variabel yang diubah (selisih hanya spasi ganda yang dirapatkan renderer).
- `9003` (472 perkara): 462 sama; **10 perkara tanpa jadwal sidang: galat "ERROR Variabel #9003#" -> "..."**. Sidang ke-1/2/3 perkara 7883: "Sidang Pertama"/"Lanjutan"/"Lanjutan".
- `6271` (5 perkara): galat "ERROR Variabel #6271#" -> "..." (tanpa galat).
- `7105`/`7106` (62 perkara: 23 contoh, 29 acak, 10 tanpa jadwal; cetakan relaas penuh): 52 perkara ber-jadwal **persis sama** (teks relaas e-Court/surat tercatat/dll. tidak berubah); 10 perkara tanpa jadwal: galat "ERROR Variabel #7105#/#7106#" -> "...".

**Cetakan blangko RTF asli, 39 cetakan** (12 blangko x 2-7 perkara; `alat/render_rtf.py`): 16 persis sama, 23 berubah dan semuanya perbaikan yang dijelaskan: BAS Verstek PA Donggala (hubungan saksi `#0074#` "..." -> hubungan sebenarnya), BAS 1 Itsbat Nikah Derry (hubungan saksi 1 dan 2 bergeser benar), BAS 2 Court Calendar ("Pengucapan" musyawarah 02 Juli -> putusan 04 Juli 2024; Selasa -> Kamis; perkara 265/2020: 21 Okt -> 18 Nov 2020), relaas (nama jurusita dan "Jurusita"/"Jurusita Pengganti" kini serasi: 127/2021 dan 328/2022), sampul bundel A dan BAS 2 (nama PP pada perkara PP ganda: 144/2023 dan 341/2026), BAS Tussenkomst (tanggal Hijriah putusan sela terisi). Tidak ada cetakan yang menjadi galat; jumlah "..." turun atau tetap pada semua cetakan. Satu-satunya perubahan yang bukan "terisi": BAS Verstek 2 perkara 127/2021, "adalah ... Penggugat" -> "adalah  Penggugat" (saksi pertama ada tetapi hubungannya kosong di SIPP; dulu "..." hanya kebetulan karena urutan saksi tidak runtut, sama seperti ±6.000 perkara lain yang memang tercetak kosong). Pengangkatan Anak, Wali Adhal, BAS Pertama P Kuasa (S5/S8) tidak berubah ("..." sama).

**Konfirmasi di server, baca saja (MariaDB 5.5)** (`alat/uji_server.py`; 9 perkara nyata: 217/Pdt.P/2026, 273/Pdt.G/2026, 252/Pdt.G/2024, 265/Pdt.G/2020, 341/Pdt.G/2026, 292/Pdt.G/2018, 127/Pdt.G/2021, 328/Pdt.G/2022, 298/Pdt.G/2020): kueri LAMA dan BARU tiap variabel yang diubah (17 variabel) dijalankan di server dan dibandingkan dengan laptop: 294 dari 297 pasangan persis sama; 3 beda semuanya perkara 273/2026 (saksi Tergugat baru dicatat di server sesudah salinan laptop 9 Okt). Ke-23 kueri `uji-kueri.tsv` (termasuk variabel baru `0074` `10121`-`10126` dan sintaks `9003`/`7105`/`7106` dengan `#0050#` = 1 dan kosong) jalan tanpa galat di server atas 9 perkara. Contoh server: 341/Pdt.G/2026 `0015` "Sri Wahyuni, S.H." -> "Sri Susilowati, S.H." (dua PP aktif; 292/Pdt.G/2018 dengan PP urutan 1 dan 2 tidak berubah); 217/Pdt.P/2026 `1241` "(kosong)" -> "Keponakan Pemohon IV" dan `1242` "Keponakan Pemohon IV" -> "Keluarga di Pihak Laki - Laki." (saksi tidak runtut); 252/Pdt.G/2024 `8544` 2024-07-02 -> 2024-07-04; 127/Pdt.G/2021 `6032` "Jurusita Pengganti" -> "Jurusita"; 328/Pdt.G/2022 sebaliknya.
- Variabel `10121`-`10126` diuji dengan baris tiruan pihak ketiga di basis sementara `x2_uji_sipp` (`alat/uji_pihak3_sementara.sql`; sudah dihapus): urutan pertama terpilih (bukan yang diinput lebih dulu), tanpa `pihak_id` -> nama dan alamat tetap terbaca, tanpa data -> kosong.
- Portal/ekstensi: tidak ada perubahan; uji penuh tidak relevan (hanya paket SQL).

## Catatan keputusan dan yang TIDAK diperbaiki (dengan alasan)

1. **S1 mengubah 8 perkara (lokal) yang punya dua PP aktif berbeda**: dari PP pemeriksa (tahapan 10) ke PP terbaru (ikrar/lanjutan). Alasan: SIPP biasanya menonaktifkan PP pemeriksa saat PP ikrar ditunjuk, sehingga `aktif="Y"` yang tersisa adalah PP ikrar; 8 perkara ini hanya kebetulan tidak dinonaktifkan. Bila dikehendaki tetap PP pemeriksa, ganti `tanggal_penetapan desc` menjadi `id` pada `0015` (satu kata). 36 perkara PP ganda lain tidak berubah.
2. **S2** hanya memperbaiki label. `0018`/`6031` (nama) tidak diubah (bawaan terkunci, sudah konsisten: baris pertama alami = `order by a.id` pada 10.186 perkara).
3. **S4 `6150`** "Hbgn. Saksi 4 P dg. Pihak" memakai `saksi_pihak_ke=4` (selalu kosong) tetapi 0 blangko memakainya dan `8923` sudah benar - dibiarkan. Hubungan saksi yang kosong di SIPP (±6.000 perkara) tetap tercetak kosong seperti sebelumnya (bukan "...").
4. **S5, tiga variabel yang dipakai berbeda dari namanya** dipasang sebagai `data_teks` (menerima teks atau tanggal ketikan): `1162`/`1163` bernama "Kecamatan/Kabupaten tujuan surat pemb. mengambil AC" tetapi dipakai blangko Kwitansi PNBP AC sebagai "Tanggal:"; `8020` bernama "Tanggal PMH IT" tetapi dipakai Akta Perdamaian sebagai isi persetujuan. Tidak ada variabel S5 yang dilewati. 402 variabel `data_type` NULL lain tidak dipakai blangko (di luar S5) dan tidak disentuh.
5. **S6**: bila belum ada agenda sama sekali dan perkara belum putus, tetap kosong. Tanggal putusan sungguhan menggantikan tanggal rencana pada 5 perkara lokal yang jadwal kalendernya tidak diperbarui.
6. **S7**: "biasa berkumpul ketemu" di `5128` janggal ("hanya bisa berkumpul"?) tetapi bukan salah ketik yang pasti - tidak diubah.
7. **S8**: BAS Tussenkomst/Voeging/Vrijwaring memakai `#1356#`, `#5052#`, `#8439#`-`#8445#` untuk satu pihak ketiga; bila pihak ketiga lebih dari satu tetap satu orang (urutan pertama). `0207`/`#0184#` pada dua BAS "P (Kuasa)" tercetak tanggal surat kuasa yang sama dua kali (BAS saudaranya memakai `#0111#` untuk tanggal register); itu salah rujukan di RTF, bukan di variabel - perlu sunting RTF.
8. Tidak dikerjakan di paket ini: temuan RINGAN dan sisa SEDANG di luar S1-S10; pola ganda yang sama pada 19 variabel court calendar lain (audit: hanya 8544/8545 yang terukur ganda).
