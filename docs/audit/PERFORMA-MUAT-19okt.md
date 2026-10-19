# Performa muat aplikasi ALETA - 19 Oktober 2026

Permintaan pengguna: "buat loading data semua aplikasi ringan saat dibuka".
Cabang `fitur/performa-muat` (dari `integrasi-1205-11`). Belum dipasang.

## 1. Cara mengukur

Semua pengukuran hanya membaca; tidak ada yang diubah di server.

| Sumber | Cara |
| :--- | :--- |
| Waktu bot per rute | `docker exec -i aleta-portal node -` (skrip dikirim lewat stdin, tidak ada berkas yang ditinggal) memanggil GET rute internal bot dengan token yang sudah ada di env container; 2-3 kali per rute, angka ms per panggilan |
| Waktu Postgres ALETA | `pg` dari container portal, 50 kali per SELECT |
| Frekuensi dan ukuran | `access_log` Apache (minggu 12-19 Okt dan hari ini 08.30-10.50); `%b` = bait terkirim |
| Statistik DB | `pg_stat_user_tables`, `pg_stat_wal`, `lsblk` |
| SIPP berat | `daftarSidang` dijalankan di laptop atas `sipp_donggala` lokal (Oktober 2026, 205 sidang), tiap kueri dicatat waktunya |
| Peramban | satu kali muat `/aleta/aleta-ecourt` di Chrome (Resource Timing), 10.40 |

Tidak ada sesi portal untuk uji di produksi (dan tidak dibuat akun baru), jadi
waktu rute portal = waktu bot + overhead portal yang diukur terpisah.

## 2. Angka sebelum (server produksi, 19 Okt pagi)

### Rute bot (dari container portal)

| Rute bot | Waktu (ms) | Ukuran JSON |
| :--- | ---: | ---: |
| jadwal-sidang hari ini (18 sidang) | 191-220 | 68 KB |
| jadwal-sidang hari ini `waktu=1` (layar Jadwal) | 182-220 | 75 KB |
| jadwal-sidang sepekan `waktu=1` | 380-483 | 356 KB |
| jadwal-sidang sebulan `waktu=1` (±160 sidang) | 941-1005 | 1,05 MB |
| status-perkara/tag (hitungan, "total") | **1.178-2.297** | 20 KB |
| status-perkara/tag (rentang 1-19 Okt) | **1.494-1.611** | 20 KB |
| status-perkara/tag katalog saja | 6-39 | 18 KB |
| status-perkara satu perkara | 266-291 | 55 KB |
| kesiapan satu sidang | 127-353 | 3 KB |
| rincian sidang / konteks SIPP | 51-62 | 7-8 KB |
| jadwal-mediasi hari ini / sepekan / sebulan | 6 / 23-31 / 41-46 | <10 KB |
| kalender, verifikasi hari ini, antrian/sidang, disidang | 3-18 | <7 KB |
| penunjukan/pegawai (daftar hakim) | 10-47 | 1 KB |
| rekap-petugas (sudah bersinggah di bot) | 5-86 | 48 KB |

### Portal dan Postgres ALETA

- SELECT 1 = 0,20 ms; seluruh pengguna (66) = 0,53 ms; sesi, akses peran = 0,13-0,19 ms.
  Overhead autentikasi per rute (±5 kueri) ≈ 1,5 ms - **bukan** penyebab lambat.
- `aleta_rekam_antrian`: 296 baris, **18.194 UPDATE** sejak 5 Okt - ditulis ulang tiap muat Jadwal.
  `synchronous_commit = on`, disk `sda` berputar (ROTA=1) di balik PRAID CP400i (tanpa cache tulis).
- Tanpa sesi: rute portal menjawab 401 dalam 3-17 ms; `/api/install` 3-4 ms.

### Lalu lintas (access_log, 12-19 Okt)

| Rute | Panggilan/minggu | Rata-rata bait |
| :--- | ---: | ---: |
| sumber-daya (widget, ±5 dtk) | 9.674 | 1,1 KB |
| sidang/disidang (±5 dtk) | 4.223 | 1,6 KB |
| checklist | 1.774 | 2,3 KB |
| auth/get-session | 991 | 0,6 KB |
| sidang (Jadwal Sidang) | 953 | 52 KB |
| ekstensi | 759 | 30 KB |
| status-perkara | 159 | 37 KB |

Permintaan jadwal dengan kunci sama dalam 4 detik: 7,1% (minggu), 11-14% (hari ini, termasuk widget kehadiran-saya).

### Peramban (satu muat, Chrome, 10.40)

Navigasi `/aleta/aleta-ecourt`: sambung TCP 5,3 dtk, byte pertama 26 dtk; `get-session` 27,9 dtk;
`/api/install` 55,6 dtk; roles/users/positions 26 dtk - padahal rute yang sama dijawab server dalam
3-4 ms. Dari laptop yang sama: RTT 22-95 ms, unduhan 277 KB dalam 2,4 dtk (±115 KB/dtk).
Artinya pada saat itu antrean ada **di sisi peramban/jaringan**, bukan di server.

## 3. Sepuluh penyebab lambat teratas

| # | Penyebab | Angka | Ditangani |
| ---: | :--- | :--- | :--- |
| 1 | Antrean sambungan di peramban: SIPP, ABT, ALETA, dan polling ekstensi memakai host yang sama (`192.168.10.10:80`, HTTP/1.1, 6 sambungan per host) | permintaan 3 ms di server menunggu 26-56 dtk di peramban | Tidak (keputusan K1, K2) |
| 2 | Rekaman antrian: satu commit (fsync) per baris, tiap muat Jadwal Sidang | 18 baris hari ini, ±100 sepekan, ±160 sebulan; perkiraan 5-10 ms/fsync di disk berputar tanpa cache = ±0,1-0,2 dtk (hari ini) s.d. ±0,8-1,6 dtk (sebulan) | **Ya** - satu transaksi |
| 3 | Hitungan tag Status Perkara | 1,2-2,3 dtk tiap panel dibuka | **Ya** - singgah 30 dtk |
| 4 | Jadwal sidang dihitung ulang untuk tiap tab/widget/layar publik (±40 kueri SIPP, pool 10) | 0,2 dtk (hari ini), 0,4-0,5 dtk (sepekan), 0,9-1,0 dtk (sebulan) | **Ya** - singgah 4 dtk + penyatuan serentak |
| 5 | Ukuran jawaban jadwal: 74 ruas, ±6,6 KB per sidang | 1,05 MB sebulan, 356 KB sepekan (sebelum gzip) | Tidak (keputusan K4) |
| 6 | Rute bot jadwal berurutan: jadwal -> peta antrian -> waktu antrian -> kehadiran per tanggal satu-satu | peta antrian 12-15 ms + kehadiran N tanggal berurutan | **Ya** - dibaca bersamaan |
| 7 | Polling ekstensi | 9.674 sumber-daya + 4.223 disidang + 1.774 checklist per minggu (sudah bersinggah 3 dtk / 60 dtk di server) | Tidak (keputusan K2) |
| 8 | Muat awal portal: 4 permintaan penghalang (roles, users 18 KB, module-visibility 19 KB, positions 8,5 KB) + 8 permintaan susulan (surat 12 KB, disposisi, setelan AI, ...) di setiap halaman, ikut berebut 6 sambungan | 12 permintaan sebelum isi tab | Tidak (keputusan K3) |
| 9 | Kesiapan satu sidang saat rincian dibuka | 127-353 ms | Sudah paralel dengan rincian; tidak diubah |
| 10 | Daftar hakim diminta ulang tiap Jadwal Sidang/SK Majelis dibuka | 10-47 ms | **Ya** - singgah 60 dtk |

Yang **bukan** penyebab: Postgres ALETA (semua < 1,5 ms), autentikasi per rute (±1,5 ms), berkas JS
statis (gzip + `immutable`, 15-60 ms dari cache), jadwal mediasi (< 50 ms).

## 4. Perbaikan (kode, belum dipasang)

1. **`src/server/shared/singgah-singkat.ts`** (baru) - singgahan di memori portal:
   penyatuan permintaan serentak, umur berbatas, salinan untuk tiap pemanggil, dan
   `tandaiTulisan()` yang membuang semuanya. Bacaan yang sedang berjalan saat tulisan
   terjadi **tidak disimpan** (dijaga generasi), jadi petugas yang baru menyimpan tidak
   pernah melihat data sebelum simpanannya. Hanya jawaban `ok` yang disimpan.
2. **Invalidasi seketika**: setiap tulisan ke bot memanggil `tandaiTulisan()` sebelum dikirim
   dan sesudah dijawab - `gatewayFetch` (POST/DELETE kecuali POST kesiapan yang hanya membaca),
   `panggilBotJadwalSidang` (skors, selesai, mediator, ...), `panggilBot` aksi e-Court,
   `panggilBotPenetapanKembali("/tulis")`.
3. **Jadwal sidang bersinggah 4 detik** (`jadwal-sidang-singgah.ts`, `ALETA_SINGGAH_JADWAL_MS`)
   untuk Jadwal Sidang, kehadiran-saya, Perkara Saya, antrian-publik, antrian-tampil,
   sidang-ruang. Gerbang mentah `getGatewayJadwalSidang` tidak berubah.
4. **Hitungan tag Status Perkara bersinggah 30 detik** (`ALETA_SINGGAH_TAG_MS`); katalog tidak.
5. **Daftar hakim/panitera/SK tetap bersinggah 60 detik** (`ALETA_SINGGAH_PEGAWAI_MS`).
6. **Rekaman antrian satu transaksi** (`rekamAntrian`): isi sama, satu fsync; baris dikunci
   menurut urutan id supaya dua muat serentak tidak deadlock. Gagal = seluruhnya dibatalkan
   (`ditulis: 0`), jadwal tetap terjawab. Urutan "tulis lalu baca rekaman" di rute dipertahankan.
7. **Bot `/sipp/jadwal-sidang`**: `daftarSidang` dan `petaAntrian` dalam satu `Promise.all`;
   waktu antrian dan kehadiran per tanggal dibaca bersamaan (`allSettled`: tanggal yang gagal
   dilewati, sebelumnya tanggal sesudahnya ikut hilang).

Semua singgahan mati di lingkungan uji kecuali env diisi, dan dapat dimatikan di produksi dengan
env bernilai `0`.

## 5. Perkiraan sesudah

Dihitung dari angka di atas (belum terpasang - perkiraan).

| Keadaan | Sebelum | Sesudah (perkiraan) |
| :--- | ---: | ---: |
| Jadwal Sidang hari ini, muat pertama | bot 0,2 dtk + rekam 18 commit (±0,1-0,2 dtk) | bot 0,2 dtk + rekam 1 commit (±0,02 dtk) |
| Jadwal Sidang sebulan, muat pertama | bot 1,0 dtk + rekam ±160 commit (±0,8-1,6 dtk) = ±1,8-2,6 dtk | bot 1,0 dtk + ±0,06 dtk = ±1,1 dtk |
| Jadwal yang sama dalam 4 dtk (tab lain, widget, layar publik, muat ulang) | 0,2-1,0 dtk kueri SIPP | < 5 ms (salinan), 0 kueri SIPP; 7-14% permintaan jadwal hari ini |
| Membuka ulang panel tag Status Perkara dalam 30 dtk | 1,2-2,3 dtk | < 5 ms |
| Bot jadwal `waktu=1` sepekan | 0,38-0,48 dtk | ±15-40 ms lebih cepat (peta antrian + kehadiran tidak berurutan) |
| Daftar hakim | 10-47 ms | < 1 ms (60 dtk) |

Sesudah menyimpan tunda/putus/kehadiran: bacaan berikutnya **selalu** ke bot (diuji).
Perubahan yang dibuat langsung di SIPP di luar ALETA tampil paling lambat 4 detik
(jadwal), 30 detik (hitungan tag), 60 detik (daftar hakim).

Penyebab #1 (antrean di peramban) tidak hilang oleh perubahan ini; itu yang paling
menentukan di laptop dengan jaringan lambat - lihat K1-K3.

## 6. Uji

`src/test/performa-muat-19okt.test.ts` (baru): penyatuan serentak, kedaluwarsa, ttl 0,
invalidasi oleh tulisan, tulisan di tengah bacaan, galat tidak disimpan, salinan, galat
diteruskan; jadwal lewat gerbang sungguhan (5 serentak = 1 ke bot; tunda/selesai membatalkan;
GET disidang dan POST kesiapan tidak); hakim; tag; rekaman antrian satu transaksi; bacaan
bersamaan di rute bot.

Hasil 19 Okt (laptop, uji sasaran saja - bukan uji penuh):

- `npx tsc --noEmit`: bersih.
- `performa-muat-19okt` + `rekam-antrian-detik` + `rekam-antrian-lampau`: 3 berkas, 52 uji hijau.
- `perkara-saya-16okt` + `jadwal-sidang-waktu-pilihan` + `sidang-keadaan-rekomendasi-q3`: 3 berkas, 27 uji hijau.
- `eslint` atas berkas yang disentuh: bersih. `node --check` rute bot: bersih.

## 7. Keputusan untuk pengguna

- **K1** Pisahkan host ALETA dari SIPP di peramban (mis. nama `aleta.<satker>` atau port lain)
  supaya ALETA punya 6 sambungan sendiri, atau pasang HTTPS + HTTP/2 di Apache (satu sambungan
  banyak permintaan). Ini perubahan server, bukan kode.
- **K2** Kurangi polling ekstensi (sumber-daya 5 dtk -> 30 dtk, gabungkan disidang + kehadiran-saya
  + checklist dalam satu permintaan). Perlu rilis ekstensi.
- **K3** Muat susulan portal (surat, disposisi, setelan AI, WhatsApp, ...) ditunda sampai isi tab
  selesai, atau hanya dimuat di halaman yang memakainya.
- **K4** Pangkas ruas jadwal sidang yang tidak dipakai layar (perlu dicocokkan dengan agen JADWAL-3).
- **K5** Lama singgahan: jadwal 4 dtk, tag 30 dtk, hakim 60 dtk - setuju atau diubah lewat env.
