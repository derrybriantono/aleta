# Paket ABT `abt-pihak-urut-ecourt-27okt` - sebutan pihak banyak menurut PERINGKAT (perkara e-Court), Turut Tergugat di identitas, kaki putusan berangka romawi (agen W91, 27 Okt 2026)

**Status: teruji di ABT LAPTOP (PRASYARAT, pasang, PERIKSA, pasang ulang, pulih = keadaan awal persis, pasang lagi), dibandingkan sebelum/sesudah atas perkara nyata, dirender dengan renderer php56 ABT asli, dan dikonfirmasi BACA SAJA terhadap server (PRASYARAT = `0|0|10|0|0|97|0|4|0`; 382 dari 382 berkas RTF md5-nya sama dengan yang diperiksa). Server: BELUM dipasang - dipasang sesi utama.**
Laporan Derry 27 Okt: putusan/penetapan 656/Pdt.G/2026/PA.Dgl (Kewarisan, e-Court), blangko `[98] [Cabut] Kewarisan - P & T Hadir Sebelum Jawaban`.

## Sebab

Pendaftaran e-Court (diinput_oleh `eCourt`) menomori kolom `urutan` BERSAMBUNG lintas tabel, bukan mulai 1 per tabel. Perkara 656 (perkara_id 10225): `perkara_pihak1` urutan 1-25 (25 Penggugat), `perkara_pihak2` SATU baris (Tergugat Tunggal) berurutan **25**, `perkara_pihak4` (Turut Tergugat) berurutan **25 dan 26**. Seluruh kueri ABT yang menurunkan sebutan menyamakan *nilai urutan* dengan *nomor sebutan*:

| yang tercetak salah di 656 | sebab |
|---|---|
| Tergugat I-V berisi kosong (`, NIK , tempat dan tanggal lahir , , agama ...`), lalu Tergugat Tunggal sebagai "Tergugat XXV" | `7048` memilih cabang menurut `MAX(urutan)` = 25 (cabang >= 6), mencetak lima Tergugat pertama lewat variabel `urutan = 1..5` yang tidak ada, lalu fungsi x9 mencetak urutan >= 6 dengan angka romawi = nilai urutan |
| "Telah mendengar keterangan Penggugat dan **para** Tergugat" (padahal satu) | `7037`/`7036` memakai `MAX(urutan)` (25 -> "para") bukan jumlah pihak |
| Kaki: `Penggugat 11, Penggugat 12 ... Penggugat 25` | `7148`/`7149` menulis romawi hanya sampai X lalu `CONCAT(' ', urutan)` |
| Kaki: Turut Tergugat tidak disebut | `7152`/`8516` tidak mengenal pihak4 |
| Identitas: Turut Tergugat (Turut Tergugat Pertama, Turut Tergugat Kedua) tidak tercetak | blangko `[98]` (dan 207 blangko lain di keluarga Turut Tergugat, termasuk BAS) memang tidak memuat `#8710#`; fungsi x9 `isian_rtf_pihak_tambahan` sudah benar (penghitung baris sendiri) |

Perkara dengan urutan tidak rapat dari 1 di data SIPP server (27 Okt, MIN(urutan)=1, MAX=jumlah, tanpa kembar): Pemohon/Penggugat 9 dari 10.275 perkara, Termohon/Tergugat 12 dari 5.849, Turut Tergugat 6 dari 10 perkara (656, 273/2026, 26/2022, 142/2026, 602/2026, 687/2025 ...). Perkara lain (urutan mulai 1 dan rapat) tidak terpengaruh.

## Aturan

Nomor sebutan = **PERINGKAT** pihak dalam tabelnya (urut `urutan`, lalu `id`), bukan nilai kolom `urutan`. Bila urutan mulai 1 dan rapat peringkat = urutan, jadi keluaran **sama persis** dengan sebelumnya (dijaga dua cara: kueri lama utuh untuk perkara rapat, uji pembandingan di bawah). Satu pihak tidak diberi angka ("Tergugat", pola lama). Romawi untuk semua pihak (1-3999).

## Isi

**Fungsi (MariaDB 5.5, hanya membaca SIPP.perkara, perkara_pihak1-4, pihak, agama, tingkat_pendidikan; komentar berawalan `PU:`, tanpa kata merek):**

- Empat fungsi x9 DIGANTI (definisi lama dicadangkan di `...-FUNGSI-X9-LAMA.sql`, md5 dijaga PRASYARAT): `isian_rtf_pihak_utama`, `isian_rtf_pihak_nama` (nomor = penghitung baris, `p_dari` = peringkat awal), `isian_rtf_pihak_urutan` (jumlah pihak, bukan MAX(urutan)), `isian_rtf_pihak_tambahan` (urut urutan lalu id). Dipakai variabel 3507-3516 dan 8710/7054/7055 - ikut benar tanpa mengubah variabel itu.
- Lima fungsi BARU: `isian_rtf_pihak_jumlah(perkara, tabel)`; `isian_rtf_pihak_identitas(perkara, sisi, sebutan, kediaman, alamat1, kuasa)` (seluruh identitas sisi 1/2 menurut peringkat: satu pihak tanpa romawi, banyak pihak berromawi, alamat putusan 8548/8549 untuk pihak pertama, awalan "tempat kediaman di" dihilangkan untuk alamat ghaib seperti variabel 0124, kalimat kuasa "Dalam hal ini Tergugat I, ... dan Tergugat N memberikan kuasa ..."); `isian_rtf_pihak_nama_semua(perkara, sisi, sebutan)`; `isian_rtf_pihak_kaki(perkara, sisi)` (kaki putusan: "Penggugat I, ..., Penggugat XI, ..."); `isian_rtf_pihak_sebut(perkara, tabel)` ("Turut Tergugat I dan Turut Tergugat II").

**Empat variabel baru** (jatah 3500-3549; 3507-3519 sudah dipakai): `3520` sebutan Turut Tergugat/Termohon untuk kaki, `3521` sebutan pihak intervensi untuk kaki, `3522` kalimat kaki NO "di luar hadirnya ..." (lihat Kaki NO), `3523` salinan `8502` (kaki putusan majelis/tunggal) yang memanggil `3522` sebagai ganti `8516`.

**Sepuluh baris `abt_variabel` diubah** (isi lama dijaga md5 dan dicadangkan; PULIH mengembalikan):

| no | perubahan |
|---|---|
| `7047` `7048` | SATU cabang disisipkan di awal CASE: `WHEN COALESCE(p1.rapat, 0) = 0 THEN isian_rtf_pihak_identitas(...)` dan satu kolom `rapat` di subkueri (urutan mulai 1, rapat, tanpa kembar = 1). Cabang lama TIDAK disentuh |
| `7097` `7098` | idem dengan `isian_rtf_pihak_nama_semua` |
| `7036` `7037` | `MAX(pp1.urutan)` -> `COUNT(*)` ("para Tergugat" menurut jumlah pihak) |
| `7148` `7149` | pihak yang hadir di kaki: dari `isian_rtf_pihak_kaki` (romawi untuk semua; pola alur/jenis perkara sama) |
| `7152` | Tergugat (+ "beserta Kuasanya") + ` serta #3520#` (Turut Tergugat) |
| `8516` | kehadiran di kaki: pihak intervensi bila sidang terakhir dihadiri kode SIPP 7/8/9 (` serta #3521#`) |

**Kaki NO (tambahan pengguna 27 Okt)**: putusan/penetapan NO karena Penggugat/Pemohon hadir di sidang pertama lalu tidak hadir lagi (SEMA 1/2022), dan NO "P & T tidak hadir", tidak boleh memakai kehadiran yang tercatat di SIPP (perkara 591/Pdt.G/2026: sidang 1 = kode 2, sidang 2 = kode 4, sidang 3 = kode 2 -> dulu "serta dihadiri Penggugat"). Kini kaki berbunyi tetap `di luar hadirnya <pihak pertama> dan <pihak kedua>[ serta Turut Tergugat ...]` (`3522`): sebutan dari `7036`/`7037` sehingga jamak menurut jumlah pihak ("para Penggugat"), Pemohon/Termohon untuk CT dan permohonan, permohonan tanpa lawan hanya "di luar hadirnya para Pemohon", dan kalimat e-Court tetap. 38 blangko memanggil `#3523#` sebagai ganti `#8502#`: `1 Perceraian CG` [98] NO 4 dan 4a; `1a Perceraian CT` [98] NO 4 dan 4a; [99] NO "P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022)" di 10a, 1c (CG dan CT), 1d, 1e, 1f, 2a, 4a-4e, 5a, 6a-6e, 6g, 6h; [99]/[99a] NO "Pemohon Tidak Hadir Lagi (SEMA 1 2022)" di 2, 3, 3a, 5, 5b, 5c, 5d, 6, 7, 8, 8a, 9, 9a, 9b. NO jenis lain (cacat formil, kurang pihak, kabur, kewenangan, alamat T tidak diketahui kumulasi, kuasa insidentil tidak sah) tetap memakai kehadiran tercatat. Daftar lengkap: `rtf-tambal.tsv` (anchor `#8502#`).

Turut Tergugat dianggap bagian sisi Tergugat untuk kehadiran (SIPP hanya mencatat kode 1 semua pihak, 2 pihak pertama, 3 pihak kedua, 4 tidak ada; 7/8/9 = 2/3/1 + intervensi): "dihadiri oleh ... beserta Kuasanya dan Tergugat serta Turut Tergugat I dan Turut Tergugat II", dan pada "tanpa kehadiran ..." / "di luar hadirnya ..." Turut Tergugat ikut disebut.

**382 blangko RTF `derry_briantono`** (344 untuk Turut Tergugat/intervensi + 38 untuk kaki NO, sebagian berkas kena keduanya; `tambal-rtf.pl`, penjaga md5 per berkas, cadangan utuh, pulih): hanya keluarga yang sudah memakai Turut Tergugat di rancangan Derry (4a Harta Bersama, 4b Kewarisan, 4c Wasiat, 4d Hibah, 4e Wakaf, 5a Pembatalan Perkawinan, 1e/1f, 2a, 6a-6h kecuali 6f, 10a Ekonomi Syariah Biasa - putusan DAN BAS-nya): `#8710#` disisipkan sesudah `#7048#` (atau `#9350#` pada ekonomi syariah) di 285 tempat yang belum memuatnya, dan `#7054#` (pihak intervensi) sesudah tiap `#8710#` di 425 tempat. Keduanya mengeluarkan teks kosong bila perkara tidak punya Turut Tergugat/intervensi. Cerai, itsbat, dispensasi, izin kawin, perwalian dan seterusnya (tanpa Turut Tergugat di rancangan) TIDAK disentuh.

Berkas `paket-satker/`: `...-PRASYARAT.sql`, `...-FUNGSI.sql`, `...-FUNGSI-X9-LAMA.sql`, `...-PASANG.sql`, `...-PERIKSA.sql`, `...-PULIH.sql`, `pasang-satker.sh`, `pulih-satker.sh`, `tambal-rtf.pl`, `rtf-daftar-tambal.tsv`, `rtf-tambal.tsv`, `harap.txt`, `nomor-baru.txt`, `nomor-ubah.txt`, `nama-fungsi.txt`, `perkara-uji.txt`, `MD5SUMS.txt`. Dibangun ulang dengan `python sumber/bangun_paket.py` (butuh HEX `abt_variabel` server, HEX `routine_definition` empat fungsi x9, salinan folder `derry_briantono`; di luar repo). `sumber/templat-fungsi.sql` = definisi terbaca fungsi; `hasil/isi-paket.json` = ringkasan.

## PRASYARAT yang diharapkan (server, baca saja, 27 Okt 2026)

`0|0|10|0|0|97|0|4|0` = A nomor baru (4) berisi lain (0) | B nomor baru yang sudah persis paket (0) | C dari 10 baris yang diubah, yang masih isi LAMA (10) | D yang sudah BARU (0) | E fungsi baru yang sudah ada (0) | F dari 97 variabel lama yang dirujuk, yang ada (97) | G baris diubah yang bukan lama bukan baru (0) | H dari empat fungsi x9, yang masih definisi LAMA (4) | I yang sudah BARU (0). Pasang ulang: `0|4|0|10|5|97|0|0|4`. Angka lain = berhenti, tidak ada yang diubah.
**SUDAH dijalankan baca saja di server (stdin ke mysql, tanpa menulis): `0|0|10|0|0|97|0|4|0`**; md5 382 berkas RTF di server sama dengan `rtf-daftar-tambal.tsv` (382/382).
Bila sesi lain mengubah salah satu dari sepuluh baris, empat fungsi x9, atau salah satu blangko sebelum paket ini dipasang, PRASYARAT/praperiksa berhenti (C/G/H atau LEWAT) dan paket harus dibangun ulang. Keadaan dasar paket: x1-x11 + `alamat-ganda-26okt` TERPASANG (7047/7048 md5 `0deae543.../6882e0f3...`, fungsi x9 md5 sesudah pembungkusan alamat).

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/w91/abt-paket/pihak-urut-ecourt-27okt     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-pihak-urut-20261027'
scp -r paket-satker/* aleta:/root/abt-pihak-urut-20261027/
ssh aleta 'cd /root/abt-pihak-urut-20261027 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-pihak-urut-20261027/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|10|0|0|97|0|4|0)`, `PRAPERIKSA RTF: RINGKAS COCOK=382 SUDAH=0 LEWAT=0`, `CADANGAN: ... (10 baris lama)`, `FUNGSI: 9 dibuat`, `SEMUA COCOK`, `UJI kaki 2026 (perkara | kaki P kosong | kaki T kosong): N 0 0`, 14 baris `uji perkara NNNN`, `RINGKAS DITAMBAL=382 SUDAH=0 LEWAT=0`, `RINGKAS COCOK=0 SUDAH=382 LEWAT=0`, `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-pihak-urut-20261027/pulih-satker.sh'` (baris terakhir `PULIH COCOK`). Urutan pulih: RTF, variabel (baris diubah dikembalikan dari cadangan, nomor baru dihapus), empat fungsi x9 dikembalikan, lima fungsi baru dihapus. Gagal sesudah FUNGSI/PASANG/PERIKSA/UJI/tambal = pulih otomatis. Tidak perlu memulai ulang apa pun (ABT membaca `abt_variabel`, fungsi, dan RTF setiap cetak). Selisih beberapa milidetik saat empat fungsi x9 dibuat ulang (DROP + CREATE) - sama dengan paket sebelumnya. Urutan dengan paket lain: sesudah `alamat-ganda-26okt` dan `sampul-daftar-isi-26okt` (paket ini membaca keadaan terbarunya); paket ini tidak mengubah sampul/daftar isi.

## Hasil uji (27 Okt 2026)

- **Siklus ABT laptop** (`sumber/uji_lokal.sh semua`; DB `aps_badilag_pu3` = salinan PERSIS `abt_variabel` server, 2.673 baris, dari HEX baca-saja + fungsi x9 dan alamat-ganda terpasang + 1.780 blangko RTF Derry dari server): PRASYARAT `0|0|10|0|0|97|0|4|0` -> pasang (2.677 baris, 21 fungsi, 382 RTF ditambal) -> PERIKSA `SEMUA COCOK` -> UJI kaki 2026: 655 perkara, 0 kaki kosong -> pasang ulang (`0|4|0|10|5|97|0|0|4`, idempoten, sidik jari sama) -> **pulih `PULIH COCOK`: sidik jari variabel, fungsi dan seluruh RTF kembali PERSIS keadaan awal** -> pasang lagi `SEMUA COCOK`.
- **Sebelum/sesudah atas perkara nyata** (`alat/bandingkan.js`: meniru penyulihan `#NNNN#` ABT atas `sipp_donggala` lokal; basis sebelum `aps_badilag_pu0` = keadaan server, sesudah `aps_badilag_pu3` = paket; 22 variabel; 0 galat). Sampel 1.789 dari 10.217 perkara: SEMUA perkara istimewa (urutan tidak rapat, 3 pihak atau lebih per sisi, ber-Turut Tergugat, ber-intervensi; 101 perkara) + setiap perkara ke-6 sisanya. Hasil: 7047/7097 beda pada 9 perkara (tepat 9 perkara Pemohon/Penggugat tak rapat), 7048/7098 pada 12 (tepat 12 perkara Tergugat tak rapat), 7036 pada 3 dan 7037 pada 7 (tak rapat), 7148/7151 pada 13 (tak rapat atau > 10 Penggugat), 7149 pada 5, 7152 pada 12 (tak rapat, > 10, atau ber-Turut Tergugat), 8516 pada 20 (salah satu sebab itu); 8710, 7054, 7055: 0 beda. `alat/klasifikasi_beda.py`: **0 selisih tanpa sebab yang dirancang**; semua perkara yang urutannya rapat dan tak ber-Turut Tergugat keluarannya IDENTIK. Ringkasan: `hasil/bandingkan-sampel-ringkasan.json`. Populasi penuh (10.217) tidak dijalankan ulang (pembanding sekitar 1 perkara per detik di laptop ini); perkara di luar sampel adalah perkara rapat dengan paling banyak 2 pihak per sisi dan tanpa Turut Tergugat, yang tidak melewati cabang baru.
- **Renderer php56 ABT asli** (`alat/render_uji.py` + `alat/bandingkan_render.py`; basis lab `aps_badilag_purender` = tampilan ke ABT lokal dengan `abt_variabel` dan 44 fungsi dari server): 139 cetakan sebelum/sesudah atas perkara 656 (10225), 273/2026 (9729), 26/2022 (6326), 142/2026 (9528), 602/2026 (10155), 275/2020 (5326), serta kontrol rapat (620/2026 cerai, 653, 648, 635/2025 ber-Turut, 81/Pdt.P 32 Pemohon, 6463). 93 cetakan persis sama (semua variabel perkara rapat, blangko cerai utuh), 46 berbeda dan semuanya perkara tak rapat / > 10 pihak / ber-Turut Tergugat; 0 galat ABT. Kaki NO (butir tambahan): 21 cetakan tambahan atas 591/2026 (10143), 656, 273/2026, 217/Pdt.P/2026, 81/Pdt.P. Cuplikan di bawah. Berkas hasil memuat data perkara, di luar repo (`D:/Aplikasi/aleta/tmp/w91/out`).
- **Konfirmasi BACA SAJA di server** (`alat/konfirmasi_server.py`): PRASYARAT dijalankan lewat stdin (SELECT saja) = `0|0|10|0|0|97|0|4|0`; md5 382 dari 382 blangko RTF di server sama dengan `rtf-daftar-tambal.tsv`.

### Cuplikan render php56 perkara 656/Pdt.G/2026/PA.Dgl

| variabel | sebelum | sesudah |
|---|---|---|
| `#7048#` | `, NIK , tempat dan tanggal lahir , , agama , ... sebagai Tergugat I;` x5 (kosong) lalu Tergugat Tunggal ... `Tergugat XXV` | `Tergugat Tunggal, NIK , ... tempat kediaman di Desa (disamarkan), ... Provinsi Sulawesi Tengah, sebagai Tergugat;` |
| `#7098#` | `, sebagai Tergugat I; ... , sebagai Tergugat V; Tergugat Tunggal, sebagai Tergugat XXV;` | `Tergugat Tunggal, sebagai Tergugat;` |
| `#7037#` | `para Tergugat` | `Tergugat` |
| `#7149#` / `#7152#` | `Tergugat` / `Tergugat` | `Tergugat` / `Tergugat serta Turut Tergugat I dan Turut Tergugat II` |
| `#7148#` | `Penggugat I, ... Penggugat X, Penggugat 11, ... Penggugat 25` | `Penggugat I, ... Penggugat X, Penggugat XI, Penggugat XII, ... Penggugat XXV` |
| `#8516#` (kaki) | `serta dihadiri oleh Penggugat I, ... Penggugat X, Penggugat 11 ... Penggugat 25 beserta Kuasanya dan Tergugat, dan penetapan tersebut telah dikirim secara elektronik ...` | `serta dihadiri oleh Penggugat I, ... Penggugat XXV beserta Kuasanya dan Tergugat serta Turut Tergugat I dan Turut Tergugat II, dan penetapan tersebut telah dikirim secara elektronik ...` |
| blangko `[98] ... Kewarisan` | identitas Turut Tergugat tidak ada | Turut Tergugat Pertama dan Turut Tergugat Kedua tercetak sebagai Turut Tergugat I dan II sesudah Tergugat |

### Cuplikan kaki NO perkara 591/Pdt.G/2026/PA.Dgl (10143), blangko `[98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022)`

- sebelum: `... dibantu oleh Fikrianto, S.H. sebagai Panitera Sidang, serta dihadiri Penggugat, dan putusan tersebut telah dikirim secara elektronik melalui sistem informasi pengadilan pada hari itu juga.`
- sesudah: `... dibantu oleh Fikrianto, S.H. sebagai Panitera Sidang, di luar hadirnya Penggugat dan Tergugat, dan putusan tersebut telah dikirim secara elektronik melalui sistem informasi pengadilan pada hari itu juga.`
- Kewarisan 656 `[99] [NO] ... P Hadir Lalu 2x Tidak Hadir`: `di luar hadirnya para Penggugat dan Tergugat serta Turut Tergugat I dan Turut Tergugat II`; Kewarisan 273/2026: `di luar hadirnya para Penggugat dan para Tergugat serta Turut Tergugat I, ... dan Turut Tergugat VII`; permohonan 217/Pdt.P/2026 (`9b [99] NO`): `di luar hadirnya para Pemohon`. Kontrol `[98] NO 8 (cacat formil)`: kaki tetap kehadiran tercatat (tidak berubah).

## Sisi ALETA (bot + portal)

`ktpPihakService.js` (urutan pihak = peringkat per cabang, romawi penuh, dan cabang 3 = intervensi / 4 = Turut Tergugat - dulu terbalik), `pekerjaanPihakService.js` (urutan = peringkat), `berkasPerkaraService.js` (pihak ke-2 dan dua nama fokus menurut peringkat, bukan `urutan = 2`), `sebutanPihakService.js` + `sebutan-pihak.ts` (`urutanRomawi` sampai 3999, dulu angka Arab sesudah XX), `kasirJurnalService.js` (romawi penuh, dulu angka Arab sesudah X), `anonimisasi-putusan.ts` (`romawi` penuh). Ekstensi Chrome TIDAK diubah. Uji: `manajemen_surat/src/test/pihak-urut-ecourt-27okt.test.ts`.

## Catatan jujur

- Mesin MariaDB 5.5 server tidak dipakai di laptop (MariaDB 10.4); fungsi ditulis tanpa fitur 10.x. PRASYARAT/PERIKSA/UJI di `pasang-satker.sh` (jalan di server, pulih otomatis) adalah jaring pengamannya, seperti paket sebelumnya.
- Variabel bawaan ABT berpengubah NULL yang membaca "pihak ke-1" dengan `urutan = 1` (mis. `0020`, `0024`, `0337`, `0343`, `0347` untuk Tergugat; dipakai 62 blangko langsung, terutama BAS) TIDAK diubah (bukan milik Derry): untuk Tergugat berurutan bukan 1 (12 perkara) nilainya kosong bila blangko memakainya langsung. Jalur identitas 7048/7098 sudah menghindarinya. Variabel Derry berurutan literal lain (`3111`-`3131`, `5078`-`5107`, `8800`-`8811`, `9290`-`9293`, `9560`-`9562`) hanya dipakai dari cabang lama 7047/7048 atau membaca pihak ke-1; belum dirombak.
- Kartu "Pekerjaan terbaca" di ekstensi (`abt-panel-blangko.js`, `PK_ROMAWI` sampai V) tidak diubah; bot kini mengirim peringkat sehingga sebutannya benar, tetapi pihak ke-6 dan seterusnya tampil tanpa angka (kosmetik, hanya kartu pemeriksaan).
- `sipp-additional-query-sources.ts` baris sekitar 1595 menyebut `perkara_pihak4` sebagai "Pihak intervensi" (notifikasi); data server menunjukkan pihak4 = Turut Tergugat dan pihak3 = intervensi. Tidak diubah (di luar paket).
- Enumerasi kaki memakai bentuk lama "Penggugat I, Penggugat II, ..." (25 pihak = satu baris panjang); tidak diringkas menjadi rentang.

