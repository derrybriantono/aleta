# Paket ABT `abt-pihak-urut-sisa-28okt` - sisa variabel Derry DAN 43 variabel bawaan ABT yang memilih pihak dengan `urutan = N` tetap kini memakai PERINGKAT ke-N; 7078 memakai jumlah Pemohon/Penggugat (agen W105 + W108, 28 Okt 2026)

**Status: teruji di ABT LAPTOP (PRASYARAT, pasang, PERIKSA, pasang ulang, pulih = keadaan awal persis, PRASYARAT sesudah pulih, pasang lagi; dua jalur gagal: prasyarat tak cocok berhenti tanpa mengubah apa pun, PERIKSA gagal memulihkan otomatis), dibandingkan lama/baru atas perkara nyata, dan dirender dengan renderer php56 ABT asli. Server: BELUM dipasang - dipasang sesi utama.**
Lanjutan paket `pihak-urut-ecourt-27okt` (sudah TERPASANG di server 27 Okt 15.57; paket ini bergantung padanya, bukan sebaliknya).
**Perluasan 28 Okt (W108) atas dua keputusan tertulis pengguna** (pengecualian aturan "hanya variabel milik Derry"): (1) `7078` memakai jumlah Pemohon/Penggugat; (2) pilihan (B): bawaan ABT bernomor rendah ikut diubah. Paket kini **120 variabel** (77 asal W105 + 43 bawaan), **135 penggantian**.

## Sebab

Pendaftaran e-Court (diinput_oleh `eCourt`) menomori kolom `urutan` BERSAMBUNG lintas tabel `perkara_pihak1..4`: Penggugat 1-25, Tergugat tunggal berurutan 25, Turut Tergugat 25 dan 26 (perkara 656/Pdt.G/2026). Paket 27 Okt memperbaiki sepuluh variabel utama (identitas, nama, kaki putusan) dengan peringkat (urut `urutan`, lalu `id`). Tersisa variabel Derry yang membaca "pihak ke-N" dengan `urutan = N` tetap: untuk Tergugat pertama yang berurutan 25 hasilnya KOSONG (email, HP, kode pos, kabupaten, umur, tanggal relaas, status pekerjaan, ...) dan "Penggugat III" bisa memilih orang yang sebenarnya peringkat kedua. Data server (27 Okt, MIN(urutan)=1 dan MAX=jumlah tanpa kembar): pihak1 tak rapat pada 9 dari 10.275 perkara, pihak2 pada 12 dari 5.849; salinan laptop `sipp_donggala`: 9 dan 12 perkara, tanpa urutan kosong dan tanpa kembar.

### Dua keputusan pengguna 28 Okt

1. **`7078` "KEDUDUKAN PIHAK DI RELAAS #0046#"**: e-Court tetap kosong; Pemohon/Penggugat (`perkara_pihak1`) **lebih dari satu** -> `#0046# I,`; hanya satu -> `#0046#,`. Kueri lama memakai JOIN `perkara_pihak1` tanpa ORDER BY (ABT mengambil baris pertama) sehingga cabang "I," (`alur 16 AND urutan = 2`) praktis tidak pernah jalan. Kueri baru memakai `(SELECT COUNT(*) ...) > 1` (SATU baris per perkara, bukan JOIN berbaris banyak) dan `AND EXISTS (pihak1)` agar perkara tanpa Pemohon tetap tanpa hasil seperti JOIN lama. **Tidak dibatasi alur 16**: di data, alur 15 (gugatan) punya 11 perkara ber-Penggugat > 1 (1 bukan e-Court), alur 16 (permohonan) 3.991; tidak ada alasan membatasi. **Dicatat dan diterima pengguna:** variabel ini TIDAK tahu relaas ditujukan kepada siapa; relaas untuk Pemohon II juga akan tertulis "Pemohon I,".
2. **Pilihan (B)**: 47 variabel `data_sql` bawaan ABT / bernomor rendah ikut diubah dengan mekanisme yang sama (`X.urutan = N` -> `aps_badilag.isian_rtf_pihak_peringkat(tabel, X.id) = N`). **43 diubah, 4 tidak** (5890-5893: urutan dipakai sebagai angka romawi `ELT(a.urutan, 'I', 'II', ...)` dan `BETWEEN`, bukan pemilihan pihak ke-N; dilaporkan).

## Aturan

`urutan = N` -> peringkat ke-N dalam tabelnya (urut `urutan`, lalu `id`; urutan kosong dihitung 0). Pada perkara yang urutannya mulai 1 dan rapat (tanpa lubang, tanpa kembar) peringkat = urutan, jadi keluaran **sama persis** (dibuktikan di bawah). Hanya operator dan angka pembanding yang dibiarkan; yang diganti hanya ungkapan `X.urutan`.

## Isi

**Satu fungsi baru** (`isian_rtf_pihak_peringkat(p_tabel, p_id)` -> INT, MariaDB 5.5, hanya MEMBACA `SIPP.perkara_pihak1..4`, komentar `PS:`): peringkat satu baris pihak dalam perkaranya; NULL bila baris/tabel tidak ada (kondisi `= N` tidak pernah benar, sama seperti baris yang tidak ada). Fungsi paket 27 Okt (`isian_rtf_pihak_jumlah` dkk.) tidak dapat menjawab "apakah baris ini yang ke-N", maka satu fungsi baru ini; tidak ada fungsi 27 Okt yang diubah.

**120 baris `abt_variabel` diubah** (135 penggantian: 90 pada 77 baris asal W105 (7078 di antaranya kini ditulis ulang), 45 pada 43 bawaan; isi lama dijaga md5 nama + jenis + isi dan dicadangkan; PULIH mengembalikan). Bentuk: `a.urutan=3` -> `aps_badilag.isian_rtf_pihak_peringkat(1, a.id)=3` (tabel 1 = pihak1 Penggugat/Pemohon, 2 = pihak2 Tergugat/Termohon; alias dan tabel dibaca dari kueri masing-masing).

| kelompok | nomor | yang diubah |
|---|---|---|
| Penggugat/Pemohon III-V | 3111-3118 (III), 3121-3128 (IV), 3131 (V) | nama, agama, NIK, tempat/tanggal lahir, umur, pekerjaan, pendidikan menurut peringkat 3/4/5 |
| Tergugat/Termohon II-V | 5078-5081 (II), 5083-5088 (III), 5091-5096 (IV), 5099, 5102-5104, 5106, 5107 (V) | idem, peringkat 2/3/4/5 |
| pihak pertama (urutan = 1) | 3642, 3643 (izin kawin), 4440 (wali adhal), 5116 (perwalian), 8129 (tanggal relaas pertama), 8510, 8524, 8533 (deteksi PNS/PPPK), 8800-8803 (email, HP), 8808-8811 (domisili elektronik), 8890 (kewenangan relatif), 9104, 9200, 9205, 9277-9279, 9290-9293, 9560, 10106, 10107 | peringkat 1 (10107: peringkat 2 untuk cerai gugat) |
| pihak pertama atau kedua | 9561, 9562 (`IN (1, 2)`) | peringkat 1 atau 2 |
| pola lain pada Derry | 3673 (dua `CASE WHEN urutan = 1/2` dalam agregat), 9404 dan 9405 (`MIN(urutan)` = nomor sebutan "Pihak Istri I/II", `urutan = z.u`) | peringkat; nomor sebutan Pihak Istri kini peringkat terkecil, bukan nilai urutan |
| tanpa fungsi | 9280, 9281 (putusan cerai para pihak, akta cerai: menelusuri SEMUA perkara cerai lain) | "peringkat 1" ditulis `NOT EXISTS (SELECT 1 FROM perkara_pihakN zA WHERE zA.perkara_id = A.perkara_id AND (urutan lebih kecil, atau sama dan id lebih kecil))`: dengan fungsi waktunya 5 dtk -> 14 dtk di laptop, dengan predikat murni SQL kembali 5 dtk |

Tambahan 28 Okt (bawaan ABT, 43 variabel):

| kelompok | nomor | yang diubah |
|---|---|---|
| pihak1 urutan 1 (Penggugat/Pemohon), 16 | 11 (agama), 21 (pendidikan), 27 (HP), 99 (umur), 100 (pekerjaan), 335 (NIK), 341 (tempat lahir), 345 (tgl lahir), 1173 (warga negara), 1517 (jenis kelamin), 8179 (email), 7000 7003 7004 (kejaksaan, NIP, jabatan jaksa), 1076 (tgl relaas), 118 (tgl relaas ulang, 2 penggantian) | peringkat 1 |
| pihak2 urutan 1 (Tergugat/Termohon), 14 | 20, 24, 45, 103, 104, 337, 343, 347, 1518, 2173, 8175, 8180, 1077, 120 | peringkat 1 |
| pihak1 urutan 2 (Pemohon II), 9 | 10, 336, 342, 346, 1033, 1034, 1035, 1174, 1176 | peringkat 2 |
| pihak2 urutan 2 (Tergugat II), 3 | 5019, 5027, 5028 | peringkat 2 |
| pasangan itsbat, 1 | 5842 (`k.urutan<=2` pada pihak1) | peringkat <= 2 |
| tampilan `v_pihak_perkara` | 118 dan 120 (cabang kedua) | `join v_pihak_perkara b ... b.urutan=1 and b.pihak_ke=K` ditulis `join perkara_pihakK b ... peringkat(K, b.id)=1`: `pihak_ke=K` pada tampilan itu persis tabel `perkara_pihakK` (tampilan UNION lima tabel, lambat dan tidak stabil; hanya kolom pihak_id/perkara_id/urutan dipakai): keluaran sama, tidak lebih lambat |
| tulis ulang | 7078 | lihat keputusan 1 |

Nomor lengkap: `paket-satker/nomor-ubah.txt`. Variabel yang LAIN MEMANGGIL variabel di atas (100 turunan, mis. 22/23/121/122 yang menunjuk 1076/1077/118/120, 7101-7109, 9230-9233, 9349/9350, 9570, 2224, 4110-4150) ikut benar tanpa diubah.

**Pemilik.** 77 variabel asal W105 = milik Derry (`modifier = admin`, diubah 2025-2026, nomor >= 2000, `data_sql`). 43 bawaan ABT / nomor rendah diubah atas **izin tertulis pengguna 28 Okt** (pengecualian). Tidak disentuh dan HANYA DILAPORKAN:
- 14 variabel paket 27 Okt (7036 7037 7047 7048 7097 7098 7148 7149 7152 8516 3520-3523): cabang lama 7047/7048/7097/7098 hanya dipakai bila urutan rapat (sudah dijaga paket itu).
- **5890-5893** (sampul pihak banyak): urutan dipakai sebagai angka romawi (`ELT(a.urutan, ...)`) dan `BETWEEN` pada nilai urutan. Catatan: pada perkara e-Court yang urutannya di atas 20 `ELT` menghasilkan NULL dan barisnya hilang dari daftar sampul; belum diperbaiki (di luar izin).
- 8 variabel jenis `data_sipp` (nomor urutan di kolom `urutan_data`, bukan kueri): 3119 3129 (alamat Penggugat III, IV), 5089 5097 5117 (alamat Tergugat III, IV, V), 5090 5098 5118 (nama Tergugat IV, V, III). Tidak diubah: jenis `data_sipp` -> `data_sql` mengubah `teks_sipp` menjadi `teks_biasa` (nl2br): 212 alamat Penggugat dan 144 alamat Tergugat di salinan SIPP memuat baris baru, jadi cetakan alamat akan berubah. Hanya dipanggil dari cabang lama 7047/7048 (urutan rapat), tidak dari blangko langsung.
- Pengurutan yang sudah berupa peringkat (`ORDER BY urutan LIMIT 1`, 8609, 10121-10126, 8521/8522/8528/8531, 3602-3639 dst.), kuasa (`perkara_pengacara`), hakim/panitera (`perkara_hakim_pn`: 8500-8502, 8550-8555, 3523, 3995-3997), jadwal sidang (`j.urutan`), saksi (`perkara_pihak5`) dan tanggal KTP e-Court (`isian_data.ktp_pihak`: 2223, 8870-8872, 11114) bukan pihak1/2 bernomor urutan tetap: tidak diubah.
- Bawaan yang memakai `max(urutan) > 1` (0068) atau romawi (5847, 5894-5897): bukan pemilihan pihak ke-N, tidak diubah. `5101` ada di rentang 5078-5107 tetapi bukan pihak (`perkara_jurusita`).

## PRASYARAT (baca saja)

`9|14|120|0|0|18|0` = P fungsi paket 27 Okt yang isinya persis paket itu (9) | Q variabel paket 27 Okt yang isinya persis (14) | C dari 120 baris yang diubah, yang masih isi LAMA (120) | D yang sudah BARU (0) | E fungsi baru yang sudah ada (0) | F dari 18 variabel yang dirujuk, yang ada (18) | G baris diubah yang bukan lama bukan baru (0). Pasang ulang: `9|14|0|120|1|18|0`. Angka lain = berhenti, tidak ada yang diubah (diuji: basis tanpa paket 27 Okt -> `0|0|120|0|0|18|0`; satu baris diubah orang lain (1517 ditambah spasi) -> `9|14|119|0|0|18|1`).
Keadaan dasar: bacaan server 27 Okt (`var_server_hex.tsv`, baca saja) + paket 27 Okt; 2.663 dari 2.677 baris persis bacaan server, 14 baris = paket 27 Okt (diperiksa pembangun). **Bacaan server itu dari 27 Okt: bawaan yang kini ikut diubah (mis. 0027, 0045, 0118, 0120, 1076, 1077, 8175-8180) bertanggal 2026 dan bisa saja diubah orang sesudahnya** - PRASYARAT berhenti (G > 0) bila begitu. Bila sesi lain mengubah salah satu dari 120 baris (atau paket 27 Okt) sebelum ini dipasang, PRASYARAT berhenti dan paket harus dibangun ulang (`python sumber/bangun_paket.py`; butuh HEX `abt_variabel` basis ps0/server, di luar repo).

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/w108/abt-paket/pihak-urut-sisa-28okt     # atau folder repo hasil gabung
rm -rf paket-satker/cadangan                                 # cadangan uji laptop JANGAN ikut tersalin
ssh aleta 'mkdir -p /root/abt-pihak-urut-sisa-20261028'
scp -r paket-satker/* aleta:/root/abt-pihak-urut-sisa-20261028/
ssh aleta 'cd /root/abt-pihak-urut-sisa-20261028 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-pihak-urut-sisa-20261028/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (9|14|120|0|0|18|0)`, `CADANGAN: ... (120 baris lama)`, `FUNGSI: 1 dibuat`, `SEMUA COCOK`, empat baris `UJI rapat/tak rapat perkara_pihak1/2` (kolom pembeda = 0, 0 0), satu baris `uji kueri baru perkara NNNN: 116 variabel jalan, 0 galat` per perkara contoh, `uji kueri berat perkara NNNN: 4 variabel jalan, 0 galat`, `SELESAI`. Lama: ±1 menit di laptop (UJI atas seluruh baris pihak1/2 + kueri baru atas 14 perkara; kueri berat hanya atas satu perkara).
Pulih: `ssh aleta 'bash /root/abt-pihak-urut-sisa-20261028/pulih-satker.sh'` (baris terakhir `PULIH COCOK`). **Pulihkan paket INI sebelum memulihkan paket 27 Okt** (paket ini bergantung padanya). Gagal sesudah FUNGSI/PASANG/PERIKSA/UJI = pulih otomatis. Tidak perlu memulai ulang apa pun (ABT membaca `abt_variabel` dan fungsi setiap cetak). Tidak ada blangko RTF yang disentuh; tidak ada kata aplikasi di apa pun yang masuk ABT (`modifier` tak diubah = `admin`).

## Hasil uji (28 Okt 2026, laptop; perluasan W108 dijalankan ulang seluruhnya)

- **Siklus bolak-balik** (`sumber/uji_lokal.sh`; basis `aps_badilag_pu3`/dump `pu3-dump.sql` = keadaan server sesudah paket 27 Okt: 2.677 baris, 49 fungsi): PRASYARAT `9|14|120|0|0|18|0` -> pasang (120 baris, 1 fungsi, 14 perkara contoh x 116 kueri + 4 kueri berat: 0 galat) -> PERIKSA `SEMUA COCOK` -> pasang ulang (`9|14|0|120|1|18|0`, idempoten: sidik jari variabel+fungsi sama) -> **pulih `PULIH COCOK`: sidik jari variabel (2.677 baris) dan fungsi (49) kembali PERSIS keadaan awal** -> PRASYARAT sesudah pulih `9|14|120|0|0|18|0` -> pasang lagi = sama dengan pasang pertama. Jalur gagal: satu baris diubah orang lain -> `GAGAL: prasyarat '9|14|119|0|0|18|1'`, sidik jari sama sebelum/sesudah; PERIKSA dibuat gagal -> `GAGAL: PERIKSA tidak cocok - dipulihkan`, sidik jari sama sebelum/sesudah.
- **UJI atas data nyata** (di `pasang-satker.sh`, baca saja, `sipp_donggala`): perkara berurutan rapat - 14.412 baris pihak1 dan 5.914 baris pihak2: peringkat beda dari urutan = 0; perkara tak rapat - 18 baris pihak1 dan 35 baris pihak2: peringkat dalam 1..jumlah dan tanpa kembar (0 dan 0).
- **Uji perilaku di repo** (`manajemen_surat/src/test/pihak-urut-sisa-28okt.test.ts`, 20 uji): selain isi paket, uji PEMBALIKAN membalik kueri baru secara mekanis (peringkat -> urutan, predikat NOT EXISTS -> `urutan = 1`, tabel pihak 118/120 -> `v_pihak_perkara`) dan mewajibkan md5 kueri LAMA persis untuk 119 variabel: satu-satunya perubahan adalah token pemilih pihak yang dirancang. 7078 diuji terpisah (e-Court, COUNT > 1, tanpa JOIN/alur).
- **Lama vs baru atas perkara nyata** (`alat/bandingkan.js` meniru penyulihan `#NNNN#` ABT; lama `aps_badilag_ps0` = server sesudah paket 27 Okt, baru = paket ini terpasang; 220 variabel = 120 diubah + 100 turunan; klasifikasi `alat/klasifikasi_beda.py`; hasil `hasil/bandingkan-*-ringkasan.json`):
  - Putaran ringan (213 variabel): **776 perkara** = semua 101 perkara istimewa (urutan tak rapat, >= 3 pihak sesisi, intervensi/Turut Tergugat) + setiap perkara ke-15 sisanya. **524 perkara identik pada ke-213 variabel; 252 berubah**: 234 karena 7078 (keputusan baru), 21 karena urutan tak rapat (persis 9 perkara pihak1 + 12 perkara pihak2; 3 perkara masuk keduanya). Tanpa 7078 **hanya 21 perkara dan 766 pasangan (variabel, perkara) berbeda**, semuanya perkara tak rapat pada tabel yang dipakai variabel itu: **0 selisih tanpa sebab yang dirancang**. Perkara berurutan rapat: keluaran sama persis pada semua variabel kecuali 7078. "Galat evaluasi" 3.104 = kueri 1072/1073 (bawaan, kesalahan sintaks `then`) yang galat IDENTIK di basis lama dan baru; bukan akibat paket. Sambungan MySQL yang mati (laptop tidur) dibuat ulang otomatis dan perkara diulang (`bandingkan.js`).
  - Putaran berat (8172 9280 9281 9290-9293, 4-12 dtk per perkara): **26 perkara** (separuh dari sampel 52 W105: setiap perkara ke-2 dari daftar) : 0 galat; 24 identik, 2 berubah (5 pasangan), semuanya perkara tak rapat; 0 tanpa sebab. Cakupan lebih kecil dari paket asal (perkara 10225 tidak ikut; waktunya diukur terpisah di bawah).
  - **7078 atas SEMUA 10.217 perkara**: 3.370 berubah ("Pemohon," -> "Pemohon I,"), 6.847 sama, 0 galat. Perkara ber-Pemohon/Penggugat > 1 dan bukan e-Court = 3.371: 3.369 berubah, 2 tidak berubah (2543, 2795: kueri lama kebetulan sudah menghasilkan "I,"), dan 1 berubah ke arah sebaliknya (1191, Pemohon tunggal berurutan 2: dulu "Pemohon I," kini "Pemohon,"). Perkara e-Court tetap kosong. Jadi **perubahan 7078 mengenai 3.370 perkara**.
- **Renderer php56 ABT asli** (`alat/render_uji.py`): 17 kelompok variabel (12 asal + 5 bawaan) x 9 perkara + 7078 x 7 perkara = 160 cetakan sebelum/sesudah. 0 galat ABT. **110 cetakan persis sama** termasuk semua 34 cetakan perkara berurutan rapat (635/Pdt.G/2025 dan 620/Pdt.G/2026); **50 berbeda**: 46 pada enam perkara tak rapat (656/Pdt.G/2026, 273/Pdt.G/2026, 26/Pdt.G/2022, 602/Pdt.G/2026, 275/Pdt.G/2020, 149/Pdt.G/2022) - mis. agama dan pendidikan Tergugat I (`#20#`, `#24#`), NIK, tempat lahir, kabupaten, tanggal relaas Tergugat I yang dulu kosong/"..." - dan 4 pada 7078 (perkara 604 dan 1356 ber-Pemohon > 1, 6779 ber-Penggugat 2: "Pemohon," -> "Pemohon I,"; 1191: "Pemohon I," -> "Pemohon,"; 8248 satu Pemohon tetap). Berkas hasil memuat data perkara, di luar repo (`D:/Aplikasi/aleta/tmp/w108/out`); `hasil/render-ringkasan.json` hanya hitungan.
- **Waktu** (`alat/waktu_kueri.py`, satu perkara, semua kueri): perkara 10025 - 120 kueri diubah: jumlah lama 20,5 dtk, baru 19,9 dtk; hasil kueri identik pada semua; yang di atas 0,5 dtk hanya 9280/9281 (5,3 dtk) dan 9290/9291 (±2 dtk), sama seperti sebelum paket. 100 kueri turunan: 12,4 dtk lama, 12,1 dtk baru. Perkara 10225 (Tergugat tunggal berurutan 25): jumlah 10,9 -> 24,9 dtk karena 9280/9281 (0,4 -> 5,3 dtk) dan 9291 (0,06 -> 3,9 dtk) kini benar-benar menghitung (dulu kosong cepat karena baris berurutan 1 tidak ada); itu pekerjaan yang sama dengan perkara biasa, bukan kemunduran. Kueri baru bawaan (0010-2173, 5019-5028, 7000-7004, 8175-8180, 0118/0120, 1076/1077, 5842) 0,04-0,10 dtk. 118/120 memakai tabel pihak, bukan tampilan `v_pihak_perkara`, sehingga tidak lebih lambat.
- `npx vitest run src/test/pihak-urut-sisa-28okt.test.ts` hijau (20 uji); tsc tidak dijalankan (hanya uji .ts yang berubah).

## Catatan jujur

- Mesin MariaDB 5.5 server tidak dipakai di laptop (MariaDB 10.4); fungsi dan kueri ditulis tanpa fitur 10.x. PRASYARAT/PERIKSA/UJI di `pasang-satker.sh` (jalan di server, pulih otomatis) adalah jaring pengamannya. Uji `isian_data.*` (email/HP/domisili elektronik) memakai tabel lokal.
- Salinan SIPP laptop tidak memuat pihak intervensi (`perkara_pihak3` kosong) dan hanya 6 perkara ber-Turut Tergugat; variabel yang diubah paket ini hanya membaca pihak1/2 sehingga tidak terpengaruh.
- 43 bawaan yang diubah dibaca dari bacaan server 27 Okt; belum dicocokkan dengan keadaan server hari ini (server tidak diakses oleh pembuat paket). PRASYARAT di server yang memutuskan.
- 7078 TIDAK tahu relaas ditujukan kepada siapa: relaas untuk Pemohon II juga tertulis "Pemohon I," (diterima pengguna). Cetakan blangko yang memakai 7078 berubah untuk ±3.370 perkara.
- Pembandingan berat dipersempit ke 26 perkara (waktu); pembandingan ringan 776 perkara, bukan seluruh 10.217 (kecuali 7078 yang seluruhnya).
- Pemanggilan `9290`/`9291` (kode pos) 4-12 dtk per variabel adalah sifat lama kueri itu, belum dioptimalkan. 5890-5893 (ELT) belum diperbaiki untuk urutan e-Court di atas 20.
