# Laporan integrasi awan 24 Okt 2026 (`integrasi-awan-24okt`)

Tahap 0 bagian awan dari rencana upgrade: dasar gabungan untuk rantai A–F
(`docs/awan/rantai-upgrade-24okt.md`). Dikerjakan di sesi cloud mengikuti bagian GABUNG dan
VERIFIKASI `docs/awan/gabung-23okt.md`. Bagian rilis/pasang tetap untuk laptop (lihat bagian 5).

- Dasar: `origin/integrasi-1205-38` = `24fa2f74` (GitHub; BELUM memuat perbaikan error 1.205.38 lokal laptop).
- Versi tidak dinaikkan: `ekstensi-sipp/manifest.json` tetap 1.205.38, `APP_VERSION` tidak disentuh.
- Tidak ada push ke `main`/`integrasi-1205-38`, tidak ada PR, tidak ada rilis/pasang.

## 1. Commit tiap merge (merge `--no-ff`, satu per satu, ujung terbaru di origin)

| No | Cabang (ujung) | Commit merge | Bentrok |
| :--- | :--- | :--- | :--- |
| 1 | `fitur/kalender-libur-sidang` (`e3fa87c9`) | `e8c28088` | - |
| 2 | `fitur/t6-kartu-saksi-terlipat` (`8d4c378c`) | `a409d317` | - |
| 3 | `fitur/t7-t8-referensi-pihak` (`42bba875`) | `8e574b42` | berkas tanaman |
| 4 | `fitur/t2-saksi-semua-jenis` (`5740aa78`) | `a5bba402` | berkas tanaman |
| 5 | `fitur/t4-tema-ekeuangan-ecourt` (`d46111f4`) | `8e96ecf1` | berkas tanaman |
| 6 | `fitur/t3-kasir-jurnal-keuangan` (`b0a36bfc`) | `c9eb0bee` | berkas tanaman |
| 7 | `fitur/t5-panduan-kasir-sorot` (`f6f3d4bd`) | `c2e6af42` | berkas tanaman |
| 8 | `fitur/t1-aleta-ai-tahap2` (`b1568d99`) | `1f69306a` | `manifest.json`, `matriks-peran.ts`, berkas tanaman |
| 9 | `fitur/audit-login-perangkat` (`fa19f27c`) | `b3b1005b` | `_journal.json`, `schema.ts`, `client.ts`, berkas tanaman |
| 10 | `fitur/t10-dompet-aleta-ai` (`1687e32e`) | `f2c7cd43` | `_journal.json`, `akses.ts`, `mesin.ts`, `tasks/service.ts` |
| 11 | `fitur/t9-aleta-ai-tugas` (`10c8c576`) | `924aadaf` | `_journal.json`, `schema.ts`, `client.ts` |
| 12 | `fitur/pwa-pasang` (`ee8ea45d`) | `0b74143f` | - |
| 13 | `fitur/rencana-fitur-admin` (`10816361`) | `7ea0dcb7` | - |
| 14 | `fitur/awan-cabang-dasar` (`858a072b`) | `cca336d9` | - (tidak dilewati; bersih) |
| + | `fitur/panduan-gabung-23okt` (`4c05f4a2`) | `3c920fb7` | - |
| + | `fitur/rencana-upgrade-otomatisasi` (`9fea0c9e`) | `99c81c59` | - |
| | Penyelarasan sesudah gabung | `094f1d38` | lihat bagian 2-3 |
| | Laporan ini | (commit terakhir cabang) | |

## 2. Bentrok dan cara penyelesaian

- **Berkas tanaman** `src/server/shared/ekstensi-berkas.ts` (no. 3-9): diambil sisi cabang integrasi, lalu
  sesudah semua merge ditanam ulang `ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs` (75 berkas teks +
  4 ikon, versi 1.205.38). Diperiksa: semua berkas `content_scripts`/`web_accessible_resources` manifest ada
  di tanaman dan di `ekstensi-sipp/`.
- **`ekstensi-sipp/manifest.json`** (T1 x T4): entri e-Court dipertahankan dua: tema `document_start`
  (`tema-pusat.js`, `ecourt-tema.js` + `ecourt-tema.css`) dan `document_idle` `ecourt-masuk.js` +
  `aleta-ai-gelembung.js` (T1).
- **`src/lib/matriks-peran.ts`** (T5 x T1): keduanya dipertahankan (`bolehPanduanKasir` + blok matriks
  kemampuan/akses data ALETA Ai). Dokumen `docs/hak-akses/MATRIKS-HAK-AKSES-18okt.md` dibangkitkan ulang
  (`npx tsx scripts/hak-akses-md.ts`).
- **Jurnal migrasi** `drizzle/meta/_journal.json`: disatukan per tag dan diberi idx urut menurut nomor
  berkas, tanpa ganda dan tanpa lubang:

  | idx | tag | when |
  | :--- | :--- | :--- |
  | 75 | `0083_aleta_sidang_keliling_hakim` | 1792224000001 |
  | 76 | `0084_aleta_ai_samaran` (T1) | 1792227600001 |
  | 77 | `0085_aleta_jejak_masuk_perangkat` (audit login) | 1792231200001 |
  | 78 | `0086_aleta_ai_tugas` (T9) | **1792233000001** (diubah; semula sama dengan 0085) |
  | 79 | `0087_aleta_ai_templat_kiriman` (T9) | 1792234800001 |
  | 80 | `0088_aleta_ai_dompet` (T10) | 1792260000001 |

  `when` 0086 di cabang T9 sama persis dengan 0085 (audit login) - uji "when naik" merah; diubah ke nilai di
  antara 0085 dan 0087. Aman karena 0084-0088 belum pernah berjalan di server mana pun.
- **`src/server/db/schema.ts` & `client.ts`**: DDL dan daftar tabel cadangan disatukan (0084, 0085,
  0086-0087; 0088 tetap di tempat yang dipilih T10). Uji `tabel-cadangan-terdaftar` hijau.
- **`aleta-ai/akses.ts`** (T1 x T10): impor `KunciAksi` + `PenggunaGolongan`; `pelakuAiBerhak` (T10) kini
  juga mengisi `positionId`/`peranTambahan` (T1) supaya matriks kemampuan tahap 2a tetap benar untuk rute
  yang memakai `pelakuAiBerhak`.
- **`aleta-ai/mesin.ts`** (T1 x T10): impor kedua sisi disatukan (penyamar/alat/kemampuan T1 + batas, kuota,
  perkiraan, saklar T10). Badan fungsi tergabung otomatis; `tsc` bersih.
- **`tasks/service.ts`** (audit login x T10): kedua pemberitahuan dipertahankan (masuk di luar jam kerja
  untuk admin; rekonsiliasi tidak cocok hanya untuk Super Admin).
- `ekstensi-sipp/latar.js`, `scripts/susun-ekstensi.mjs`, `src/proxy.ts`, `src/app/layout.tsx`,
  `src/lib/auth.ts`: tergabung tanpa bentrok. Diperiksa per cabang: setiap baris tambahan cabang 1-11 di
  berkas-berkas ini (serta manifest, matriks, schema, client) masih ada di hasil gabung.

## 3. Penyelarasan T9 (tugas) dengan T10 (dompet) - commit `094f1d38`

- **Saklar darurat**: `saklarDaruratMenyala(db)` kini memanggil `aletaAiDihentikan(db)` (baca segar, galat =
  anggap mati). Tiap jalan tugas didaftarkan `daftarkanPekerjaanAi` (dilepas di `finally`); panggilan model
  yang sedang mengalir ikut diputus SEKETIKA saat Super Admin mematikan saklar (tidak menunggu pantau 2 detik).
- **Dana**: tahan awal jalan tugas memakai `tahanDana(..., rujukan, { sekali: true })`; penambahan tahanan
  (`tambahTahanan`) dan penutupan (`selesaikanTahanan`) tetap. Harga tugas kini memakai `parameterHarga` T10
  (perkiraan.ts) sehingga **MDR 1% ikut** - sebelumnya pelari T9 memakai salinan rumus tanpa MDR.
- **Batas**: sebelum jalan tugas mulai, `periksaBatas` T10 (harian token, harian rupiah, satker bulanan) atas
  perkiraan sisa langkah; tolak = status "gagal" dengan pesan batas, tanpa memanggil model dan tanpa tahanan.
  `pemakaianHariIni` kini menjumlahkan juga token tugas (`aleta_ai_penggunaan` jenis "tugas") dan rupiah
  potongan jalan tugas (rujukan `ait-...`). Batas laju per menit diperiksa di rute mulai/lanjutkan tugas
  (`pastikanLajuTugas`, 429) - hitungan yang sama dengan percakapan. Di dalam pelari, batas laju membuat
  jalan beruntun (uji, lanjut-otomatis) gagal, jadi dipasang per permintaan pengguna.
- **Laporan laba** (`laporan.ts`): baris tugas ikut - biaya API per panggilan tugas, pendapatan = potongan
  mutasi jalan tugas (satu jalan = satu "giliran"), MDR = bagian MDR dalam potongan itu
  (pendapatan x MDR/(100+MDR), memakai persen MDR pengaturan saat laporan dibuat - lihat catatan 6).
  Pendapatan laporan = jumlah potongan di buku mutasi.
- **Rekonsiliasi harian** (`rekonsiliasi.ts`): pemeriksaan baru 2b - untuk tiap tugas yang dipotong hari itu,
  `aleta_ai_tugas.biaya_rp` = jumlah potongan semua jalannya; tidak cocok = rincian `jenis: "tugas"`, status
  "selisih". Tahanan tugas yang menggantung sudah tertangkap pemeriksaan 3 (rujukan `ait-...`).
- **Uji perilaku baru** (di `aleta-ai-tugas-25okt.test.ts`): saklar seketika (pantau berkala dibuat 1 jam,
  tetap putus < 2 detik, pekerjaan terdaftar dilepas), batas harian berlaku untuk tugas, laporan laba &
  rekonsiliasi memuat tugas (termasuk selisih buatan terdeteksi).

### Uji lama yang harapannya diselaraskan (perilaku sengaja dari cabang lain, bukan dilewati)
- `aleta-ai-dompet-25okt`: 0088 kini di idx 80 (sesudah 0087), bukan 76 - sesuai urutan wajib panduan.
- `aleta-ai-tugas-25okt`: pembantu harga uji memakai `parameterHarga` T10 (dengan MDR).
- `hak-akses-peta-18okt`: aksi `sidang.kasir` menulis kini hanya golongan kasir (+Admin) - keputusan
  12 Okt yang ditegakkan T3; panitera/panmud tetap "Pakai" di ekstensi.
- `tema-ecourt-23okt`: skrip `document_idle` e-Court = `ecourt-masuk.js` lalu `aleta-ai-gelembung.js` (T1).

## 4. Verifikasi

- `npx tsc --noEmit`: bersih.
- `npm run lint:jangan-bertambah`: 45 galat, keluaran IDENTIK dengan dasar `origin/integrasi-1205-38`
  (25 baris "BARU" yang sama di dasar - dari lingkungan/versi aturan eslint, bukan dari gabungan). Tidak
  bertambah. Eslint atas semua berkas .ts/.tsx/.js yang berubah: 3 galat, ketiganya sudah ada di dasar.
- Uji baru di tabel panduan + `tabel-cadangan-terdaftar` + `hak-akses-peta-18okt`: 26 berkas hijau
  (442 uji; 13 dilewati oleh `skipIf` bawaan `pembaru-otomatis-23okt` - butuh PowerShell/Windows).
- Uji penuh: **verifikasi berjalan** (dimulai 24 Okt; angka dan perbandingan dengan dasar menyusul di commit berikutnya cabang ini).

## 5. Langkah yang tetap untuk laptop

1. `git fetch origin`, lalu di `integrasi-1205-38` LOKAL (yang berisi perbaikan error 1.205.38):
   `git merge origin/integrasi-awan-24okt` (merge, bukan rebase). Bila bentrok di `ekstensi-berkas.ts`,
   ambil salah satu sisi lalu `ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs`. Periksa jurnal migrasi
   tetap urut 0083 → 0088 tanpa ganda bila perbaikan 1.205.38 menambah migrasi.
2. Uji penuh lewat skill `periksa-uji` (dengan MySQL lokal) - bandingkan dengan angka di bagian 4.
3. Rilis ekstensi 1.205.39 lewat skill `rilis-ekstensi` (satu-satunya tempat versi dinaikkan). `APP_VERSION`
   tetap.
4. Pasang: `bash scripts/aleta-deploy-from-git.sh HEAD --dry-run` lalu tanpa `--dry-run`; pastikan migrasi
   0084-0088 berjalan, **bot dibangun ulang dan dimulai ulang (T2; rute ARP audit login)**, `/aleta/sw.js`
   terbuka.
5. Tetap MATI kecuali Derry memerintahkan: kunci API ALETA Ai, `ALETA_AI_ALAT_DATA`, akun `sipp_ai_baca`,
   batas perangkat (bawaan tanpa batas), `isiBerbayarAktif`, sandbox (`ALETA_SANDBOX_SPOOL`).
6. Sisanya mengikuti `docs/awan/gabung-23okt.md` bagian "Rilis dan pasang" butir 4-8 (sandbox, audit login di
   server, kurs JISDOR, cek browser/HP, papan kemajuan).

## 6. Catatan dan hal yang perlu diputuskan

- MDR tugas di laporan laba diturunkan dari potongan (harga = pokok x (1 + MDR%)), dengan persen MDR saat
  laporan dibuat; percakapan menyimpan MDR per giliran. Bila MDR diubah di tengah bulan, angka MDR tugas
  bulan itu sedikit berbeda. Bila perlu tepat, tambah kolom `biaya_mdr_rp` di tugas (migrasi 0090+ - minta
  nomor ke sesi laptop).
- Batas laju tugas berlaku di rute (mulai/lanjutkan), tidak di dalam pelari.
- Pertanyaan terbuka dari panduan (T7+T8 agama pihak kedua, https untuk Android, salinan HTML yang
  dibutuhkan) belum berubah.
