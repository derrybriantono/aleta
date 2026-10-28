# Paket ABT `abt-alamat-putusan-28okt` - keterangan arah di dalam KURUNG pada alamat pihak dibuang di PUTUSAN, relaas tetap utuh (agen W111, 28 Okt 2026)

**Status: teruji di ABT LAPTOP (basis sendiri `aps_badilag_alamat`, bukan `aps_badilag`): PRASYARAT, pasang, PERIKSA, pasang ulang, pulih = keadaan awal persis, PRASYARAT sesudah pulih, pasang lagi; dua jalur gagal (prasyarat tak cocok berhenti tanpa mengubah apa pun, PERIKSA gagal memulihkan otomatis); dibandingkan lama/baru atas 394 perkara nyata; dirender dengan renderer php56 ABT asli. Server: BELUM dipasang - dipasang sesi utama.**
Bergantung pada paket `pihak-urut-ecourt-27okt` dan `pihak-urut-sisa-28okt` (keduanya sudah TERPASANG di server); bukan sebaliknya.

## Sebab

Alamat pihak di SIPP sering memuat petunjuk menemukan rumah di dalam kurung, ditulis petugas pendaftaran untuk juru sita: perkara 630/Pdt.G/2026/PA.Dgl, Tergugat: "tempat kediaman di Jalan Poros Palu-Bangga (rumah sesudah Jembatan / Kios ...), Desa Poi, ...". Itu tercetak apa adanya di putusan. Di relaas ia berguna dan tetap harus ada.

Ukuran di salinan SIPP laptop (`sipp_donggala`, hanya dibaca): kurung ada pada **244 dari 14.430** alamat Pemohon/Penggugat dan **1.045 dari 5.949** alamat Termohon/Tergugat (17,6%), 0 dari 30 Turut Tergugat. Jumlah pasang kurung seimbang 1.276; bentuknya hampir semua petunjuk ("rumah ...", "depan/samping/belakang/sekitar/dekat ...", "lorong ...", "kios/toko/bengkel/mesjid ..."). **Bukan semua kurung petunjuk:** "(GAIB)" pada 35 alamat (status hukum pihak yang tak diketahui tempat tinggalnya), "(RT/RW 03/03)", "(Dusun III)", "(Jl. Pogampe)" - nama jalan/RT yang kebetulan di dalam kurung -, "(BTN ...)", "(Huntara ...)", "(Lapas ...)", riwayat ("dahulu", "sesuai surat ..."). Membuang semua kurung akan menghilangkan "gaib" dan RT/RW dari putusan, maka aturan memilah.

## Aturan

Fungsi `isian_rtf_alamat_arah(isi)` memutuskan isi satu pasang kurung (huruf kecil):

| urut | bila | hasil |
|---|---|---|
| 1 | kosong / hanya tanda baca | dibuang |
| 2 | memuat `gaib`/`ghaib` | **dipertahankan** |
| 3 | diawali rt, rw, dusun, dsn, dukuh, desa, kelurahan, kel, kecamatan, kec, kabupaten, kab, kota, provinsi, jl, jln, jalan, gang, gg, lingkungan, lk, blok, dahulu, semula, awalnya, sekarang, sesuai, saat ini, tidak diketahui | **dipertahankan** (bagian alamat / keterangan status; kalau ada kata petunjuk di dalamnya pun tetap, supaya tak ada nama jalan/RT yang hilang) |
| 4 | memuat kata petunjuk utuh: rumah*, di/dirumah*, sesudah, setelah, sebelum, sebelah, depan, belakang, samping, dekat, arah, masuk, lorong, lrg, seberang, sebrang, atas, bawah, menuju, jurusan, sekitar, perbatasan, pertigaan, perempatan, tikungan, simpang, belok, meter, km, pinggir, cat, warna, dikenal, kiri, kanan (dan bentuk "di-"-nya) | dibuang |
| 5 | diawali penanda tempat: di, kios, toko, warung, bengkel, salon, apotik, mesjid/masjid, sd/sdn/smp/sma/mts/paud/tk, puskesmas, kantor, pasar, lapangan, jembatan, pabrik, gereja, polsek, sekolah, dealer, ruko, cafe, depot, tugu, tanggul, gudang, taman, dapur, foto, optik, spbu, madrasah, panti, ponpes, peternakan, pemotongan | dibuang |
| 6 | selain itu (nama kompleks, huntara, lapas, nama kampung, ...) | **dipertahankan** (aman: tidak ada yang hilang diam-diam) |

Fungsi `isian_rtf_alamat_buang_arah(x)` memindai alamat dan membuang pasang kurung terluar yang isinya petunjuk (kurung bertingkat dinilai sebagai satu kesatuan). Tanda baca: spasi sebelum kurung dibuang; sesudah kurung spasi dipangkas; bila yang berikut koma/titik/titik koma/kurung tutup, tidak ada spasi (`"... No. 103 (samping PAUD) , Mamboro"` -> `"... No. 103, Mamboro"`); bila huruf, satu spasi (`"Dusun I (rumah ...) Desa Malei"` -> `"Dusun I Desa Malei"`); koma ganda di sebelah kurung (`"Desa X, (rumah ..), Kec"`) menjadi satu; di awal alamat tanpa koma menggantung. **Kurung tak berpasangan dibiarkan** (22 baris), alamat tanpa kurung dikembalikan **tidak berubah sama sekali** (fast path; dibuktikan atas 14.186 + 4.904 + 30 alamat). `isian_rtf_alamat_putusan(x)` = `isian_rtf_alamat(isian_rtf_alamat_buang_arah(x))`: perapi ekor wilayah paket alamat-ganda-26okt tetap jalan sesudahnya.

Hasil atas data (1.289 alamat berkurung): **1.062 dari 1.276 pasang kurung dibuang (83%)**; 214 dipertahankan = 35 (GAIB) + 6 (RT/RW) + 17 (dusun/desa/jalan/dst.) + 4 (riwayat) + ±152 nama kompleks/huntara/BTN/lapas/nama kampung/dll. **1.061 alamat berubah** (182 Pemohon/Penggugat + 879 Termohon/Tergugat), 228 tak berubah karena semua kurungnya dipertahankan atau tak berpasangan. Tidak ada alamat yang tanda bacanya rusak (spasi ganda, " ,", ",,", koma di tepi: 0) dan tidak ada yang bertambah panjang (0).

## Dokumen mana yang membuang kurung

Variabel yang memanggil `isian_rtf_alamat` DIUKUR menurut tutupan rujukan (blangko -> variabel -> variabel yang dipanggilnya) atas 1.759 blangko RTF `derry_briantono` (salinan 26 Okt; putusan 388 berkas, penetapan 152, BAS 1.100 + 62 alur, relaas `[JS]` 29):

| yang memanggil | dicapai oleh | keputusan |
|---|---|---|
| **7047, 7048** (identitas Pemohon/Penggugat dan Termohon/Tergugat I-IV; juga 7062) | putusan, penetapan, **BAS**, alur BAS - TIDAK relaas | **diubah** |
| **8700** (pertimbangan kewenangan relatif cerai), **8890** ("terbukti bahwa ... bertempat tinggal di wilayah ...") | putusan, penetapan | **diubah** |
| **9349, 9350** (ekonomi syariah: identitas) | putusan, penetapan, BAS | **diubah** |
| fungsi `isian_rtf_pihak_identitas` (jalur perkara urutan tidak rapat, dipanggil 7047/7048) dan `isian_rtf_pihak_utama` (Pemohon V+/Tergugat VI+; 3507 3509 3513 3514) | putusan, BAS - TIDAK relaas | **diganti definisinya** (dua tempat per fungsi) |
| 7108, 7109, 9230, 9231, 9292, 9293 | **hanya relaas** | **tidak diubah** - kurung tetap |
| 3943, 3944 (eksekusi: identitas pemohon/termohon eksekusi) | BAS, penetapan | **tidak diubah** (usulan di bawah) |
| 3517, 3518, 3519, 10126 (alamat langsung di blangko) | 116 berkas RTF, termasuk relaas | **tidak diubah** (lihat "Belum tercakup") |
| `isian_rtf_pihak_tambahan` (Turut Tergugat, intervensi; 7054, 8710) | putusan DAN relaas | **tidak diubah** (0 dari 30 alamat Turut Tergugat berkurung) |

**BAS ikut berubah** karena memakai 7047/7048 yang sama; ABT tidak memberi variabel nama blangko, jadi memisahkannya butuh mengganti `#7047#`/`#7048#` di ratusan berkas RTF yang md5-nya tak dapat dibaca dari laptop. Alamat di BAS dan penetapan tanpa petunjuk arah dinilai tidak merugikan (bukan dokumen yang diantar juru sita); yang berpendapat BAS harus tetap lengkap perlu memilih: pisahkan variabel (butuh baca md5 RTF server dulu).
**Isian "Alamat Putusan" (variabel 8548/8549, ketikan/usulan petugas per perkara) tidak diubah:** bila terisi ia tetap menggantikan alamat SIPP apa adanya (yang diterima petugas sudah dirapikan portal).
**Tidak diubah di SIPP, di data perkara, di blangko RTF mana pun.** Tidak ada pemilik baru: keenam variabel `modifier = admin` (milik pekerjaan Derry); tidak ada variabel bawaan ABT disentuh, dan karena putusan Derry memakai alamat lewat variabel Derry sendiri (7047/7048/8700/8890/9349/9350), tidak perlu variabel Derry BARU - cukup membungkus ulang pemanggilan `isian_rtf_alamat`.

## Isi

- **3 fungsi baru** (MariaDB 5.5, komentar `AP:`): `isian_rtf_alamat_arah`, `isian_rtf_alamat_buang_arah`, `isian_rtf_alamat_putusan`. Hanya membaca argumen (dan tabel referensi wilayah lewat `isian_rtf_alamat`).
- **2 fungsi paket 27 Okt diganti** (`isian_rtf_pihak_identitas`, `isian_rtf_pihak_utama`): DROP + CREATE; satu-satunya selisih `isian_rtf_alamat(` -> `isian_rtf_alamat_putusan(` pada dua kursor tiap fungsi. Definisi lama dicadangkan di `-FUNGSI-LAMA.sql` (persis paket 27 Okt, dijaga md5 oleh uji).
- **6 variabel diubah** (`nomor-ubah.txt`: 7047 7048 8700 8890 9349 9350; 24 + 23 + 2 + 3 + 1 + 1 = 54 penggantian `aps_badilag.isian_rtf_alamat(` -> `aps_badilag.isian_rtf_alamat_putusan(`); selebihnya kueri persis (diuji dengan pembalikan: kueri baru dibalik = md5 kueri lama).

## PRASYARAT (baca saja)

`2|0|6|0|0|1|0` = A fungsi identitas+utama yang isinya persis paket 27 Okt (2) | B yang sudah isi baru paket ini (0) | C dari 6 variabel, yang isi lama (6) | D yang isi baru (0) | E fungsi AP yang sudah ada (0) | F `isian_rtf_alamat` persis keadaan server (md5 `dfb14adb...`, 1) | G baris diubah yang bukan lama bukan baru, ditambah fungsi identitas/utama yang bukan lama bukan baru (0). Pasang ulang: `0|2|0|6|3|1|0`. Angka lain = berhenti, tidak ada yang diubah (diuji: satu variabel diubah orang lain -> `2|0|5|0|0|1|1`).
Keadaan dasar: basis laptop = dump server 27 Okt (`aps_badilag_pu3`, 2.677 baris, 49 fungsi) + paket `pihak-urut-sisa-28okt` dipasang (2.677 baris, 50 fungsi). **Dibaca dari dump 27 Okt:** bila sesudahnya ada orang yang mengubah 7047/7048/8700/8890/9349/9350, `isian_rtf_alamat`, atau dua fungsi 27 Okt, PRASYARAT berhenti (C/G/A/F) dan paket dibangun ulang (`python sumber/bangun_paket.py`; butuh HEX `abt_variabel` basis server, di luar repo: `VAR_DASAR_HEX`).

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/w111/abt-paket/alamat-putusan-28okt     # atau folder repo hasil gabung
rm -rf paket-satker/cadangan                               # cadangan uji laptop JANGAN ikut tersalin
ssh aleta 'mkdir -p /root/abt-alamat-putusan-20261028'
scp -r paket-satker/* aleta:/root/abt-alamat-putusan-20261028/
ssh aleta 'cd /root/abt-alamat-putusan-20261028 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-alamat-putusan-20261028/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (2|0|6|0|0|1|0)`, `CADANGAN: ... (6 baris lama)`, `FUNGSI: 3 dibuat (...), 2 diganti (identitas, utama)`, `SEMUA COCOK`, enam baris `UJI tanpa kurung|berkurung perkara_pihak1|2|4` (kolom "berubah" pada "tanpa kurung" = 0; "tanda baca baru rusak" dan "jadi lebih panjang" = 0), satu baris `uji kueri baru perkara NNNN: 6 variabel jalan, 0 galat` per perkara contoh, `SELESAI`. Lama: ±1 menit di laptop.
Pulih: `ssh aleta 'bash /root/abt-alamat-putusan-20261028/pulih-satker.sh'` (baris terakhir `PULIH COCOK`). **Pulihkan paket INI sebelum `pihak-urut-sisa-28okt` dan `pihak-urut-ecourt-27okt`.** Gagal sesudah FUNGSI/PASANG/PERIKSA/UJI = pulih otomatis. Tidak perlu memulai ulang apa pun (ABT membaca `abt_variabel` dan fungsi setiap cetak). Tidak ada blangko RTF disentuh; tidak ada kata aplikasi di apa pun yang masuk ABT (`modifier` tak diubah = `admin`).
Catatan: PRASYARAT paket `pihak-urut-sisa-28okt` (angka P=9 fungsi 27 Okt persis) tidak lagi cocok bila paket itu dipasang ULANG sesudah paket ini (dua fungsi 27 Okt sudah berganti isi); pulihkan paket ini lebih dulu.

## Hasil uji (28 Okt 2026, laptop)

- **Siklus bolak-balik** (`sumber/uji_lokal.sh semua`; basis `aps_badilag_alamat`, dump `dasar-dump.sql`): PRASYARAT `2|0|6|0|0|1|0` -> pasang (6 baris, 3 fungsi baru, 2 diganti) -> PERIKSA `SEMUA COCOK` -> UJI data nyata -> 15 perkara contoh x 6 kueri: 0 galat -> pasang ulang (`0|2|0|6|3|1|0`, idempoten: sidik jari variabel+fungsi sama) -> **pulih `PULIH COCOK`: sidik jari variabel (2.677 baris) dan fungsi (50) kembali PERSIS keadaan awal** -> PRASYARAT sesudah pulih `2|0|6|0|0|1|0` -> pasang lagi = sama dengan pasang pertama. Jalur gagal: `gagal1` (8700 ditambah spasi oleh "orang lain") -> `GAGAL: prasyarat '2|0|5|0|0|1|1'`, sidik jari sama sebelum/sesudah; `gagal2` (PERIKSA dibuat gagal) -> `GAGAL: PERIKSA tidak cocok - dipulihkan`, sidik jari sama dengan awal.
- **UJI atas data nyata** (di `pasang-satker.sh`, baca saja): alamat tanpa kurung - 14.186 + 4.904 + 30 baris (pihak1/2/4) berubah 0; alamat berkurung - 244 + 1.045 + 0 baris: berubah 182 + 879, tanda baca baru rusak 0, lebih panjang 0.
- **Lama vs baru atas perkara nyata** (`alat/bandingkan.js`, meniru penyulihan `#NNNN#` ABT; lama `aps_badilag_alamat_lama` = server sesudah 27 Okt + sisa 28 Okt, baru = paket terpasang; hasil `hasil/bandingkan-ringkasan.json`): **394 perkara** = 294 (setiap perkara ke-4 dari 1.176 perkara yang pihak1/pihak2-nya memuat kurung) + 99 kontrol tanpa kurung + 1 (perkara 630). 0 galat. **Diubah:** 7047 pada 46 perkara, 7048 pada 211, 8700 pada 93, 8890 pada 92, 9349 pada 46, 9350 pada 211, 3513 pada 46, 3514 pada 211, 7062 pada 240; **0 perubahan pada perkara tanpa kurung** (kontrol) dan 0 di luar perkara berkurung; 3507 (Pemohon V+) 0. Pemeriksaan isi atas 40 contoh tiap variabel: 40 dari 40 lebih pendek; setelah kurung dibuang dari lama dan baru keduanya sama pada 39 dari 40 (satu pasang berbeda hanya pada spasi sebelum kata sesudah kurung yang ditulis rapat di data: "Tangkiang(depan Kantor)Kecamatan" -> "Tangkiang Kecamatan"). **Relaas dan lainnya: 7108 7109 9230 9231 (relaas), 3517 3518 (alamat langsung), 3943 (eksekusi) IDENTIK pada ke-394 perkara.**
- **Renderer php56 ABT asli** (`alat/render_uji.py`, salinan renderer sendiri `aps_badilag_alrender`): 7 perkara x 4 cetakan = 28 cetakan sebelum/sesudah, 0 galat baru: variabel putusan (7047 7048 8700 8890), variabel relaas (9230 9231 7108 7109 9293), blangko putusan Derry utuh `[02] [Kabul] CG - F.rtf`, relaas Derry utuh `[JS] 0. Relaas Panggilan Sidang Pertama T.rtf`. **Relaas: 14 dari 14 cetakan persis sama (kurung tetap).** Putusan: 4 perkara berkurung berubah (jumlah kurung berkurang 1-3 per cetakan; perkara 630: "Jalan Poros Palu-Bangga (rumah sesudah Jembatan / Kios ...), Desa Poi, Kecamatan Dolo Selatan, ..." -> "Jalan Poros Palu-Bangga, Desa Poi, Kecamatan Dolo Selatan, ..." di identitas Tergugat), dan perkara 10209 juga di pertimbangan kewenangan relatif (8890); 3 perkara pembanding tanpa kurung atau kurung yang dipertahankan (BTN) - 10176, 9233, 6463 - persis sama. Hasil teks memuat data perkara dan ada di luar repo (`D:/Aplikasi/aleta/tmp/w111/out`); `hasil/render-ringkasan.json` hanya hitungan.
- **Waktu** (satu alamat per panggilan, `sipp_donggala` pihak2): `isian_rtf_alamat` 10,9 dtk / 1.045 alamat berkurung (±10 ms) dan 13,4 dtk / 4.904 tanpa kurung; `isian_rtf_alamat_putusan` 14,8 dtk / 1.045 berkurung (±14 ms, tambahan ±4 ms per alamat berkurung) dan 8,2 dtk / 4.904 tanpa kurung (tambahan tak terukur: fast path). Tidak berarti untuk satu dokumen (beberapa alamat). Kueri 7047/7048/8700/8890/9349/9350 atas perkara contoh 0,06-0,17 dtk, sama sebelum/sesudah.
- `npx vitest run src/test/alamat-putusan-28okt.test.ts` hijau (14 uji) dan `paket-update-kelengkapan.test.ts` hijau (3 uji).

## Belum tercakup / usulan

- **Pemohon/Penggugat di blangko yang memakai alamat LANGSUNG:** ±34 blangko putusan (itsbat nikah, dispensasi kawin, perwalian, ...) menulis alamat lewat `#3517#` (Pemohon I), `#3519#` (Pemohon II, 9 putusan), dan `#3518#` tidak dipakai langsung di putusan. Variabel itu juga dipakai relaas (2 berkas) dan BAS (±60 berkas), jadi TIDAK bisa diubah di variabelnya. Cara aman: variabel Derry baru `3520 "ALAMAT #0046# I TANPA PETUNJUK ARAH (putusan)"` = `isian_rtf_alamat_putusan("#0101#")` dst., lalu mengganti `#3517#` -> variabel baru HANYA di berkas putusan lewat `tambal-rtf.pl` dengan penjaga md5. Butuh daftar md5 RTF server hari ini (baca saja lewat ssh); salinan laptop (26 Okt) bukan jaminan karena paket lain bisa menyentuh RTF sesudahnya. Dampak data: kurung ada pada 244 dari 14.430 alamat Pemohon/Penggugat (1,7%), jauh lebih kecil dibanding Tergugat (17,6%).
- **Eksekusi (3943/3944) dan Turut Tergugat (`isian_rtf_pihak_tambahan`)** sengaja tak diubah: petunjuk arah mungkin dibutuhkan jurusita/pelaksana eksekusi; Turut Tergugat tidak berkurung di data.
- **Isian "Alamat Putusan" 8548/8549** yang diterima petugas tidak disaring ulang.
- Kurung yang bukan petunjuk dan tak dikenali (±152 nama kompleks/huntara/kampung) tetap tercetak di putusan; daftar kata dapat ditambah di `isian_rtf_alamat_arah` (satu fungsi) tanpa mengubah paket lain.
- Uji tidak memakai mesin MariaDB 5.5 server (laptop 10.4); fungsi ditulis tanpa fitur 10.x. PRASYARAT/PERIKSA/UJI di `pasang-satker.sh` (jalan di server, pulih otomatis) adalah jaring pengamannya.
