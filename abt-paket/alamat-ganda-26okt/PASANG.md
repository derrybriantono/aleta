# Paket ABT `abt-alamat-ganda-26okt` - alamat pihak tanpa ekor wilayah ganda (agen W82, 26 Okt 2026)

**Status: teruji di ABT LAPTOP (PRASYARAT, pasang, PERIKSA, pasang ulang, pulih = keadaan awal persis, pasang lagi), dirender dengan renderer php56 ABT asli sebelum/sesudah, dan dikonfirmasi BACA SAJA terhadap server (PRASYARAT = `0|0|15|0|0|91|0|2|0`; 116 dari 116 berkas RTF md5-nya sama dengan yang diperiksa). Server: BELUM dipasang - dipasang sesi utama.**
Laporan Derry 26 Okt: putusan 620/Pdt.G/2026/PA.Dgl mencetak identitas Penggugat dengan alamat ganda; Tergugat (di luar wilayah) tidak.

## Sebab

Bukan kueri ABT yang menggandakan. Yang ganda adalah **isi kolom `perkara_pihak1.alamat` di SIPP itu sendiri**: pendaftaran e-Court menempelkan di ujung alamat yang diketik nama desa, kecamatan, kabupaten, dan provinsi RESMI (dari kode wilayah) TANPA sebutan tingkatan:

```
Kelurahan Ganti, Kecamatan Banawa , Kabupaten Donggala, Provinsi Sulawesi Tengah, Ganti, Banawa, Kabupaten Donggala, Sulawesi Tengah
```

Pada data SIPP server (perkara 2025-2026, 4.003 alamat Pemohon/Penggugat, Termohon/Tergugat, Turut Tergugat) **1.301 alamat (32%) berekor sistem**: 895 di antaranya tercetak ganda, 406 hanya berupa nama tanpa sebutan. Tergugat luar wilayah yang diketik sendiri tidak punya ekor sistem.

Penghapus lama (`rapikanAlamat` portal, perbaikan 5 Okt butir 26) sebenarnya sudah mengenali contoh ini, tetapi hasilnya hanya sampai ke blangko lewat isian **8548/8549 "Alamat Putusan"** milik pihak URUTAN 1 dan hanya bila petugas menerima usulan. Kueri ABT 7047/7048 memakai isian itu bila terisi, **selain itu `#0101#`/`#0105#` mentah** - persis yang tercetak di putusan 620. Pihak urutan 2-4 (`#1036#`, `#3119#`, ...), Pemohon V ke atas, Turut Tergugat, relaas, BAS, kewenangan relatif, dan 116 blangko yang menyebut `#0101#`/`#0105#`/`#1036#` langsung tidak pernah lewat perapi. Selain itu pembanding lama gagal pada ejaan desa yang beda dari nama resmi ("Kota Pulu" / "Kotapulu"), kabupaten salah ketik satu huruf, dan ekor yang tercampur surel.

## Aturan (satu aturan, tiga kembaran)

Empat potongan terakhir alamat `desa, kecamatan, Kabupaten/Kota X, provinsi` (desa dan kecamatan tanpa sebutan, provinsi tanpa sebutan dan salah satu provinsi Indonesia) = **ekor sistem**. Untuk tiap tingkatan: sudah disebut di bagian depan (di mana saja pada teksnya, atau nama polos yang sama) -> dibuang dari ekor; belum disebut -> dipertahankan dan diberi sebutannya ("Desa/Kelurahan X", "Kecamatan Y", "Provinsi Z"). Kabupaten/provinsi di ekor yang BERBEDA dari yang diketik (kecuali salah ketik satu huruf / saling memuat) = bentrok: alamat dibiarkan, kedua nama terlihat. Desa atau Kelurahan dibaca dari kode wilayah resmi (`ref_kelurahan_new`, digit ke-10 kode: 1 = kelurahan). Spasi sebelum koma, koma ganda, titik ujung dirapikan; potongan bersebutan yang kembar berurutan ("Provinsi X, Provinsi X") dibuang; "Domisili elektronik : surel" tetap apa adanya dan ekor sistem SESUDAH surel ikut diperiksa. Nama jalan yang sama dengan nama kecamatan ("Jalan Banawa") bukan sebutan kecamatan (pembanding per potongan, bukan per kata).

| kembaran | berkas | catatan |
|---|---|---|
| portal | `manajemen_surat/src/lib/alamat-pihak.ts` (`rapikanAlamat`) | juga membuang petunjuk arah dalam kurung dan memberi sebutan pada potongan lain; daftar kelurahan Sulawesi Tengah di `src/lib/kelurahan-sulteng.ts` |
| bot | `aleta_bot/services/alamatPihakRapi.js` | aturan ekor ganda saja ("dasar"); dipakai `isiJawabanSaksiFakta`, `abtUsulanService` (tempat tinggal sekarang), `promptPutusanService` (alamat pihak di prompt putusan) |
| SQL ABT | fungsi `isian_rtf_alamat` (+ pembantu) di `aps_badilag` | himpunan aturan yang sama dengan bot; MariaDB 5.5 |

Korpus bersama 27 kasus (`manajemen_surat/src/test/fixtures/alamat-ganda-26okt.json`, alamat rekaan): bot = SQL = "dasar" pada semua kasus; portal = dasar + tambahan (3 kasus berbeda). Uji vitest `alamat-ganda-26okt.test.ts` menjaga portal/bot; `alat/uji_korpus_sql.py <basis>` menjaga SQL.

## Isi paket

- **10 fungsi baru** (`isian_rtf_alamat`, `_rapi`, `_padat`, `_kunci`, `_tingkat`, `_sah`, `_provinsi`, `_mirip`, `_ekor`, `_inti`; komentar berawalan `AG:`). Hanya MEMBACA `ref_kelurahan_new`, `ref_kecamatan_new`, `ref_kabupaten_new`.
- **3 variabel baru** (jatah 3517-3519; 3507-3516 sudah x9): `3517` = alamat Pemohon/Penggugat I dirapikan, `3518` = Termohon/Tergugat I, `3519` = Pemohon/Penggugat II. Dipakai sebagai pengganti `#0101#`, `#0105#`, `#1036#` di blangko RTF.
- **15 baris variabel diubah** (tiap `#0101#`/`#1036#`/... di dalam literal dibungkus `aps_badilag.isian_rtf_alamat("#0101#")`; bagian lain kueri tidak disentuh, jumlah penanda dijaga pembangun): `7047` dan `7048` (identitas Pemohon/Penggugat dan Termohon/Tergugat I-IV), `7108`/`7109` (identitas pihak relaas), `9230`/`9231` (relaas: identitas yang dipanggil), `8890` (kewenangan relatif gaya relaas), `8700` (pertimbangan kewenangan relatif), `9292`/`9293` (alamat dengan kode pos), `9349`/`9350` (ekonomi syariah, kedudukan badan hukum), `10126` (alamat pihak ketiga), `3943`/`3944` (eksekusi). Hanya baris berpengubah `admin` (milik pekerjaan Derry); baris bawaan ABT (`0101`, `0105`, `1036`, ...) TIDAK diubah.
- **2 fungsi x9 dibungkus alamatnya** (`isian_rtf_pihak_utama` Pemohon V+/Tergugat VI+, `isian_rtf_pihak_tambahan` Turut Tergugat dan pihak intervensi): `DROP` + `CREATE` ulang (definisi lama dicadangkan di `-FUNGSI-X9-LAMA.sql`; selisih beberapa milidetik saat fungsi dibuat ulang).
- **116 blangko RTF `derry_briantono`** (226 penanda): `#0101#` -> `#3517#`, `#0105#` -> `#3518#`, `#1036#` -> `#3519#`, memakai `tambal-rtf.pl` (penjaga md5 per berkas, cadangan utuh, pulih). Blangko non-Derry TIDAK disentuh.
- Yang TIDAK diubah: alamat di SIPP (juru sita/PBT tetap memakai alamat SIPP apa adanya), isian per perkara, menu, alamat kuasa/saksi (diukur: 0 dari 438 alamat kuasa berekor sistem), variabel yang membaca nama desa/kecamatan dari teks alamat (`5214`-`5222`, `2224`, `0210`) karena keluarannya sudah benar atas alamat mentah.

## PRASYARAT yang diharapkan (server, baca saja, 26 Okt 2026)

`0|0|15|0|0|91|0|2|0` = A nomor baru berisi lain (0) | B nomor baru yang sudah persis paket (0) | C dari 15 baris yang diubah, yang masih isi LAMA (15) | D yang sudah BARU (0) | E fungsi baru yang sudah ada (0) | F dari 91 variabel lama yang dirujuk, yang ada (91) | G baris diubah yang bukan lama bukan baru (0) | H fungsi x9 yang masih definisi LAMA (2) | I yang sudah BARU (0). Pasang ulang: `0|3|0|15|10|91|0|0|2`. Angka lain = berhenti, tidak ada yang diubah. **SUDAH dijalankan baca saja di server: `0|0|15|0|0|91|0|2|0`**; md5 116 berkas RTF di server sama dengan `rtf-daftar-tambal.tsv`.
Bila sesi lain mengubah salah satu dari 15 baris, dua fungsi x9, atau salah satu blangko sebelum paket ini dipasang, PRASYARAT/praperiksa berhenti (C/G/H atau LEWAT) dan paket harus dibangun ulang (`python sumber/bangun_paket.py` butuh HEX `abt_variabel`, HEX `routine_definition` dua fungsi x9, dan salinan folder `derry_briantono` dari server, di luar repo).

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/w82/abt-paket/alamat-ganda-26okt     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-alamat-20261026'
scp -r paket-satker/* aleta:/root/abt-alamat-20261026/
ssh aleta 'cd /root/abt-alamat-20261026 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-alamat-20261026/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|15|0|0|91|0|2|0)`, `PRAPERIKSA RTF: RINGKAS COCOK=116 SUDAH=0 LEWAT=0`, `CADANGAN: ... (15 baris lama)`, `FUNGSI: 10 dibuat`, `SEMUA COCOK`, `UJI alamat 2026 (...)` (kolom "jadi kosong padahal ada" harus 0), 12 baris `uji perkara NNNN: fungsi x9 jalan`, `RINGKAS DITAMBAL=116 SUDAH=0 LEWAT=0`, `RINGKAS COCOK=0 SUDAH=116 LEWAT=0`, `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-alamat-20261026/pulih-satker.sh'` (baris terakhir `PULIH COCOK`). Urutan pulih: RTF, variabel (baris diubah dikembalikan dari cadangan, nomor baru dihapus), dua fungsi x9 dikembalikan, fungsi `AG:` dihapus. Gagal sesudah FUNGSI/PASANG/PERIKSA/UJI/tambal = pulih otomatis. Tidak perlu memulai ulang apa pun (ABT membaca `abt_variabel`, fungsi, dan RTF setiap cetak). Urutan dengan paket lain: bebas selama x1-x11 sudah terpasang (paket ini membaca keadaan x9 dan x1-x11 apa adanya).

## Hasil uji (26 Okt 2026)

Laptop (MariaDB 10.4 XAMPP; fungsi ditulis untuk 5.5 tanpa fungsi 10.x - satu-satunya yang tidak bisa diuji di sini adalah mesin 5.5 itu sendiri, jadi PRASYARAT/PERIKSA/UJI di pasang-satker.sh yang menjalankan fungsi atas 1.200+ alamat nyata di server adalah jaring pengamannya, dengan pulih otomatis):

- `sumber/uji_lokal.sh`: PRASYARAT `0|0|15|0|0|91|0|2|0`; pasang -> `SEMUA COCOK`; pasang ulang (PRASYARAT `0|3|0|15|10|91|0|0|2`, RTF SUDAH=116, idempoten); **pulih -> snapshot variabel (jumlah+md5 isi), fungsi (jumlah+md5 definisi), dan md5 seluruh 1.759 berkas RTF PERSIS sama dengan keadaan awal**; PRASYARAT kembali `0|0|15|0|0|91|0|2|0`; pasang lagi `SEMUA COCOK`.
- Render sebelum (basis = keadaan server, RTF asli) / sesudah (paket terpasang, RTF ditambal) dengan renderer php56 ABT asli atas 9 perkara nyata di salinan SIPP laptop (`alat/render_uji.py`; 114 cetakan: 20 variabel x beberapa perkara + 14 blangko RTF utuh: BAS cerai talak, BAS dispensasi kawin, relaas/amplop): 43 cetakan persis sama, 71 berbeda, dan SEMUA selisih berupa (a) ekor wilayah ganda yang hilang, (b) sebutan Desa/Kelurahan, Kecamatan, Provinsi yang ditambahkan pada alamat yang hanya berekor sistem, (c) spasi/koma yang dirapikan ("Banawa ," -> "Banawa,", "RW,001," -> "RW, 001,"). Satu galat ditemukan dan DIPERBAIKI: `3943`/`3944` (eksekusi) gagal "Illegal mix of collations" karena hasil fungsi latin1 bertemu teks utf8; kini dibungkus `CONVERT(... USING utf8)` dan dirender ulang benar. Putusan 620: `#7047#` sebelum `... tempat kediaman di Kelurahan Ganti, Kecamatan Banawa , Kabupaten Donggala, Provinsi Sulawesi Tengah, Ganti, Banawa, Kabupaten Donggala, Sulawesi Tengah, sebagai Penggugat;` sesudah `... tempat kediaman di Kelurahan Ganti, Kecamatan Banawa, Kabupaten Donggala, Provinsi Sulawesi Tengah, sebagai Penggugat;`. Berkas hasil memuat data pribadi, di luar repo (`D:/Aplikasi/aleta/tmp/w82/out`).
- `alat/ukur_server.js` atas 4.003 alamat server (baca saja, SELECT ringan ke `perkara_pihak1/2/4` perkara 2025-2026): Pemohon/Penggugat 2.511 (berekor sistem 921, ganda dibuang 640), Termohon/Tergugat 1.468 (369, ganda 249), Turut Tergugat 24 (11, ganda 6). Total 1.301 berekor sistem = 895 ganda + 406 hanya diberi sebutan; 1 bentrok kabupaten dibiarkan; tidak ada alamat yang menjadi kosong. Alamat kuasa hukum 438: 0 berekor sistem (tidak perlu diubah).

## Batas yang disengaja

- Alamat tanpa ekor sistem (diketik penuh oleh petugas) hanya dirapikan spasi/komanya; tidak diberi sebutan di SQL/bot (portal tetap memberi).
- Bentuk ekor yang menyimpang (potongan kecamatan bersebutan di ekor, desa+kecamatan digabung tanpa koma) tidak dikenali oleh SQL/bot; portal masih menangkap sebagian lewat aturan "ekor dobel" lama. Pada data 2025-2026 sisanya sekitar 7 dari 4.003 (termasuk alamat yang terpotong di 500 huruf kolom SIPP dan pengetikan ganda manual).
- 6 dari 4.003 alamat menempatkan desa yang dipertahankan SESUDAH kabupaten ("..., Kecamatan X, Kabupaten Y, Desa Z, Provinsi P") karena unsur yang belum disebut ditambahkan di ujung depan-ekor; isinya benar, urutannya kurang rapi.
- Satu alamat dari 4.003 bentrok kabupaten (diketik Donggala, ekor Sigi): dibiarkan utuh.
