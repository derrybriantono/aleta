# Laporan penggabungan rantai upgrade (26 Okt 2026)

Dikerjakan agen GB di laptop (worktree `D:/aleta-dev/wt/w78`), cabang `integrasi-rantai-26okt` dari `integrasi-1205-39` (c70ca746, rilis 1.205.39 yang belum terpasang). Server 192.168.10.10 tidak dijangkau, tidak ada yang dipasang, versi manifest dan `APP_VERSION` tidak dinaikkan, tidak ada push ke `main`, tidak ada PR. Cabang rantai asli tidak diubah.

## 1. Ujung cabang dan urutan merge

Ujung kode: `430f5918` (commit laporan ini menyusul di atasnya; lihat `git log` cabang).

| Urut | Rantai | Ujung rantai yang digabung | Bentrok |
| :--- | :--- | :--- | :--- |
| 1 | A Cermin Perkara (A1-A8; perbaikan `b7e3fef6` sudah ada di ujung A8) | `8265d6df` | tanpa bentrok |
| 2 | G tenggat dan berkas e-Court (bertumpuk di A) | `50775bd3` | tanpa bentrok |
| 3 | F kolam SIPP, port 8008, riwayat tunda/putus | `bdeecf3e` | jurnal, `schema.ts`, `ekstensi-berkas.ts` |
| 4 | Bagian 6 (kebijakan sandi, batas jaringan, pengaman aksi, uji pulih) | `8d3aff5b` | jurnal, `instrumentation.ts`, `client.ts`, `schema.ts` |
| 5 | E uji beban, Pusat kesehatan, pemeliharaan, lihat sebagai, OTP, penjaga integritas | `5ec3b7e4` | 11 berkas (bagian 2) |
| 6 | C jejak isian, katalog saksi, fakta non-cerai, saksi ke BAS | `c8d44eb0` | jurnal, `client.ts`, `schema.ts`, `ekstensi-berkas.ts`, `abt-usulan.test.ts` |
| 7 | D ketepatan isian sampai isian per sidang (bertumpuk di C1) | `38329c30` | 9 berkas |
| 8 | B PC tua, antrean di server, ejaan nama pihak | `a4a4cfa1` | manifest, jurnal, `client.ts`, `schema.ts`, `ekstensi-berkas.ts`, `abt-usulan.test.ts` |
| 9 | Perapian gabung: jurnal, tanam ekstensi, matriks hak, uji urutan skrip | `19ccab85` | - |
| 10 | Penyambungan kait E5/E2 ke Bagian 6, satu daftar jaringan kantor, lint `.d.mts` | `5f8c1e3b` | - |
| 11 | Penyesuaian uji sesudah uji penuh, rapatkan catatan lint | `51ebdf8f`, berikutnya, `430f5918` | - |

Semua merge memakai `git merge --no-ff` dengan pesan bahasa Indonesia.

## 2. Bentrok dan cara menyelesaikannya

- **`drizzle/meta/_journal.json`** (bentrok di F, 6, E, C, B): idx sementara 81-84 tiap rantai bentrok. Selama merge dipakai versi yang sudah ada; di akhir jurnal DISUSUN ULANG dari dasar (idx 0-80) ditambah 18 berkas migrasi baru berurutan menurut nomor berkas: idx 81-98, `when` naik 30 menit per entri dari 0088. Diperiksa dengan skrip: tiap berkas SQL punya entri dan sebaliknya, idx berurutan tanpa lubang, `when` naik monoton, tidak ada dua migrasi yang membuat tabel/kolom yang sama.
- **`shared/ekstensi-berkas.ts`** (berkas tertanam): tiap bentrok diambil versi lokal, di akhir `ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs` (134 berkas teks dan 4 ikon, versi 1.205.39).
- **`db/schema.ts`**: tiap rantai menyisipkan blok DDL di tempat yang sama sehingga git menandainya bentrok. Cara aman: ambil versi lokal, lalu setiap tambahan murni rantai (blok `DDL_*` dan baris daftar `...DDL_X.tabel/indeks/kolom`) disisipkan lewat skrip dari selisih rantai terhadap dasarnya (D terhadap C1 karena bertumpuk di C1). Tidak ada tabel yang tertulis dua kali.
- **`db/client.ts`** (`IN_MEMORY_TABLE_PERSISTENCE_ORDER`): kedua sisi dipertahankan; tidak ada nama tabel kembar.
- **`instrumentation.ts`**: detak G (tenggat), 6d (uji pulih), E2 (kesehatan), E3 (pemeliharaan), E6 (integritas) semuanya dipertahankan, tiap detak punya env pematiannya sendiri. Ditambah satu blok baru untuk penyambung kait (bagian 4).
- **`lib/matriks-peran.ts`**: hak Bagian 6 (`keamanan.lihat`, `keamanan.atur`) dan hak rantai E (`kesehatan.*`, `galat.kelola`, `pemeliharaan.atur`, `lihat-sebagai.pakai`, `verifikasi.*`, `integritas.*`) sama-sama dipertahankan; `docs/hak-akses/MATRIKS-HAK-AKSES-18okt.md` dibangkitkan ulang (`npx tsx scripts/hak-akses-md.ts`).
- **`app/(portal)/layout.tsx`**: urutan penjaga: batas jaringan (6b), paksa ganti sandi (6a), lalu mode pemeliharaan (E3); pita pengaman aksi, pita pemeliharaan, dan penangkap kesalahan semuanya ada.
- **`api/auth/[...all]/route.ts`**: kode `JARINGAN_DITOLAK`, `PERLU_VERIFIKASI_LUAR_KANTOR`, `BATAS_PERANGKAT`, dan `VERIFIKASI_DIPERLUKAN` semuanya dikecualikan dari hitungan percobaan masuk yang gagal (sandi sudah benar).
- **`tasks/service.ts`**: dua butir lonceng terpisah (Uji pulih cadangan dan Pusat kesehatan).
- **`lib/tutorial-isi.ts`**, **`components/portal/aleta-ecourt-admin.tsx`**, **`lib/fitur-satker.ts`**: semua entri baru dipertahankan; uji `banyak-satker-fitur` memuat semua saklar bawaan-mati dari C dan D.
- **Bot** (`app.js`, `internalGatewayRoutes.js`, `gerbangIsian.js`): rute `cermin` dan `gerbang-isian` keduanya terpasang; `gerbangIsian.putuskan(u, gerbang, opsi)` memakai keputusan lapangan D1 dulu, lalu entri `perJenis` C5, lalu entri umum; jenis perkara diteruskan lewat ekstraksi tiga angka milik C5.
- **`ekstensi-sipp/manifest.json`**: `portal-jalur.js` (F) paling depan, lalu `pengamat-bersama.js`, `mode-ringan.js`, `antrean-server.js`, `berkas-server.js` (B); skrip C (`jejak-isian.js`, `saklar-fitur.js`, katalog per jenis, `saksi-ke-bas.js`) tetap di tempatnya. Uji urutan skrip ABT (`abt-usulan`) disusun dari manifest gabungan.
- **`panel.css`**: tidak ada aturan baru sesudah blok "V2 LAYAR (18 Okt 2026)".

## 3. Tabel migrasi akhir

| Nomor | idx | Tabel / kolom | Rantai |
| :--- | :--- | :--- | :--- |
| 0090 | 81 | `aleta_cermin_perkara`, `_sidang`, `_pihak`, `_mediasi`, `_tag`, `_jejak` | A2 |
| 0091 | 82 | `aleta_saksi_butir`, `aleta_isian_jejak` | C1 |
| 0092 | 83 | `aleta_ketepatan_isian`, `aleta_ketepatan_keputusan` | D1 |
| 0093 | 84 | `aleta_saksi_katalog`, `aleta_saksi_katalog_versi` | C4 |
| 0094 | 85 | `aleta_catatan_galat`, `_kejadian`, `aleta_uji_beban_hasil`, `aleta_kesehatan_status`, `_riwayat`; kolom `aleta_perangkat.versi_ekstensi` | E2 |
| 0095 | 86 | `aleta_verifikasi_authenticator`, `_tantangan`, `_lolos`, `_kode_cadangan` | E5 |
| 0096 | 87 | empat kolom tanggal di `aleta_cermin_perkara` | A5 |
| 0098 | 88 | `aleta_antrean_peramban` | B3 |
| 0100 | 89 | `aleta_alias_nama` | B6 |
| 0101 | 90 | `aleta_saksi_kirim_bas` | C6 |
| 0102 | 91 | `aleta_blangko_lapor` | D3 |
| 0103 | 92 | `aleta_isian_sidang` | D6 |
| 0104 | 93 | `aleta_integritas_berkas`, `_temuan`, `_aman`, `_pindai` | E6 |
| 0105 | 94 | `aleta_otomatis_jejak` | F3 |
| 0107 | 95 | `aleta_setelan_keamanan`, `aleta_riwayat_sandi`, `aleta_status_sandi` | 6a |
| 0108 | 96 | `aleta_subnet_kantor`, `aleta_aturan_jaringan_peran` | 6b |
| 0109 | 97 | `aleta_uji_pulih` | 6d |
| 0110 | 98 | `aleta_tenggat_kirim` | G1 |

Nomor yang tidak dipakai: 0097, 0099, 0106, 0111. Semuanya `CREATE TABLE IF NOT EXISTS` tanpa kunci asing; kembaran DDL ada di `schema.ts` dan daftar cadangan di `client.ts` (uji `tabel-cadangan-terdaftar` hijau).

Penting: Drizzle hanya menjalankan migrasi yang `when`-nya LEBIH BESAR dari yang terakhir tercatat. Jurnal di cabang ini adalah SATU-SATUNYA jurnal yang boleh dipasang; memasang cabang rantai asli satu per satu (dengan idx/when sementara masing-masing) dapat membuat sebagian migrasi dilewati diam-diam.

## 4. Penyambungan kait dan penyatuan daftar jaringan

- **Langkah kedua pengaman aksi (6c <- E5)**: `keamanan/sambung-kait.ts`, dipanggil dari `instrumentation.ts`. Memakai authenticator atau kode cadangan; tersedia hanya bila saklar authenticator menyala DAN akun sudah mendaftar. Kode WhatsApp TIDAK disambungkan (kotak konfirmasi pengaman tidak punya tahap kirim kode). Saklar "kode langkah kedua" di Pengaturan Keamanan tetap mati bawaan.
- **Laporan uji pulih (6d -> E2)**: uji pulih yang GAGAL dicatat sebagai kelompok di Catatan error Pusat kesehatan (jenis `uji-pulih-cadangan`); yang baik atau peringatan tidak.
- **"Luar kantor wajib verifikasi" (6b <- E5) SENGAJA tidak disambungkan.** Pemeriksaan jaringan 6b berjalan SEBELUM kait masuk E5, jadi akun luar kantor akan ditolak tanpa pernah diberi tiket kode; menyambungkannya aman hanya bila kait masuk diubah untuk menerbitkan tiket E5 dari jalur penolakan 6b. Aturan itu tetap tidak bisa dipilih di layar (tanpa pendaftar). Kebutuhan yang sama sudah dipenuhi aturan per peran E5 "hanya dari luar kantor" (bawaan hakim dan pejabat).
- **Satu daftar jaringan kantor** (`verifikasi/pengaturan.ts`: `sumberJaringanKantor`, `ipDiKantorEfektif`): bila Pengaturan Keamanan (batas jaringan) punya jaringan AKTIF, itulah daftar yang dipakai verifikasi dua langkah juga; tanpa jaringan aktif di sana (bawaan) daftar milik verifikasi dipakai persis seperti dulu. Panel Verifikasi Dua Langkah menampilkan daftar yang berlaku (baca-saja, dengan catatan) dan tidak menimpa daftarnya sendiri saat daftar Keamanan yang berlaku.
- Uji baru `gabung-kait-keamanan-26okt.test.ts` (9 uji) dan lint: `eslint.config.mjs` mengecualikan `**/*.d.mts` (galat urai pada `scripts/uji-beban.d.mts`, satu-satunya galat lint BARU dari rantai E).

## 5. Saklar baru semua rantai dan bawaannya

Semua MATI bawaan kecuali yang tertulis lain.

| Rantai | Saklar (tempat) | Bawaan |
| :--- | :--- | :--- |
| A | Pemindai Cermin Perkara; layar `mediasi`, `status`, `jadwal`, `ekstensi`, `kabar` (Admin > Pemantau Cermin Perkara, Super Admin); env `ALETA_CERMIN_PEMINDAI=0` | mati semua |
| A | Tabel Jadwal ringan (`localStorage aleta-tabel-ringan` atau `NEXT_PUBLIC_ALETA_TABEL_RINGAN=1` saat build) | mati |
| A | TTL singgahan (`ALETA_SINGGAH_*_MS`) | AKTIF pendek (hanya memangkas pekerjaan berulang; 0 mematikan) |
| B | Kartu "Kinerja untuk PC tua" (Integrasi e-Court, Super Admin): `pengamatTunggal`, `modeRinganOtomatis`, `antreanDiServer`, `berkasDiServer`, `konteksDiServer`, `ejaanNamaPihak` | mati semua; mode ringan per PC "Otomatis" |
| C | Fitur Satker: `jejak-isian`, `mesin-saksi-tunggal`, `katalog-saksi-basis-data`, `fakta-non-cerai`, `saksi-ke-bas-sipp` | mati semua |
| D | Fitur Satker: `ketepatan-isian`, `isian-sekali`, `wajib-sebelum-cetak`, `huruf-alasan-belajar`, `isian-per-sidang` | mati semua. D5 (sebutan Pelawan/Terlawan, Pembantah/Terbantah) TANPA saklar: melengkapi aturan yang tadinya selalu keliru |
| E | Mode pemeliharaan; OTP WhatsApp; authenticator; penjaga integritas berkas (+ peringatan WA integritas, hanya berlaku bila penjaga menyala); pemeriksaan berkala dan peringatan WA Pusat kesehatan; env `ALETA_KESEHATAN_BERKALA=0`, `ALETA_PEMELIHARAAN_DETAK=0`, `ALETA_INTEGRITAS_DETAK=0` | mati semua. "Lihat sebagai" tanpa saklar (alat Super Admin, baca-saja) |
| F | Kolam SIPP (`terpisah`, `batas`, `batasInteraktif`, `antreMaksMs`, `antreanMaks`, `putusKueriLambat`; Pengaturan Bot, Super Admin) | semua = perilaku lama |
| F | Port 8008: env `ALETA_CORS_ASAL_WIDGET` | kosong = tanpa CORS; `portal-jalur.js` tidak berbuat apa-apa |
| F | **Jejak tunda/putus otomatis (`aleta_otomatis_jejak`)** | **MENYALA bawaan** (hanya menulis baris di tabelnya sendiri; env `ALETA_OTOMATIS_JEJAK=0` mematikan). Satu-satunya pengecualian, lihat pertanyaan 1 |
| G | Jadwal harian penjaga tenggat 07.30; pengingat WhatsApp; aturan baru `banding-14-hari`, `kasasi-14-hari`, `mediasi-30-hari` (tidak dicentang); `bukti`, `kesimpulan`, `buktiSaksi` berkas e-Court; env `ALETA_PENJAGA_TENGGAT=0` | mati semua |
| 6 | `sandi.aktif`, `pengaman.aktif` (+ per aksi), `pulih.aktif`; batas jaringan per peran (semua peran "dari mana pun"); langkah kedua pengaman; env `ALETA_BATAS_JARINGAN=0`, `ALETA_UJI_PULIH=0`, `ALETA_UJI_PULIH_BATAS_MENIT` | mati semua |

## 6. Hasil verifikasi

- `npx tsc --noEmit` bersih (diulang di ujung kode).
- `npm run lint:jangan-bertambah`: 45 galat, SAMA dengan dasar. Satu-satunya galat baru dari rantai E (`scripts/uji-beban.d.mts`, berkas deklarasi yang diurai sebagai JS) dibereskan dengan mengecualikan `**/*.d.mts`. Catatan `lint-utang.json` di dasar sudah tertinggal (25 baris "BARU" yang sama persis ada juga di dasar, diperiksa di `w33`), jadi sesudah tidak ada galat baru dijalankan `--rapatkan` (45 galat pada 25 pasangan berkas-aturan).
- **Uji penuh** (`ALETA_UJI_UTAS=3 node scripts/periksa-uji.mjs`, ±68 menit, log `D:\Aplikasi\aleta\tmp\uji-gabung-26okt.log`, rincian `D:\aleta-dev\kerja\hasil-vitest-2026-10-25T20-18-42-186Z.txt`) di ujung kode `5f8c1e3b`: **1012 berkas: 992 hijau, 2 dilewati, 18 merah; 19.053 uji: 19.012 hijau, 20 dilewati, 21 merah.** Dasar `integrasi-1205-39` memuat 944 berkas uji; gabungan 1012 (+68). Dasar TIDAK dijalankan penuh ulang; pembanding merah memakai daftar yang sudah diketahui dan uji ulang terpisah di `w33`.

| Berkas merah | Sebab | Keadaan akhir |
| :--- | :--- | :--- |
| `alias-nama`, `antrean-peramban`, `isian-per-sidang`, `jejak-isian`, `katalog-saksi-db`, `ketepatan-isian`, `penjaga-tenggat-terjadwal`, `saksi-ke-bas-sipp`, `wajib-sebelum-cetak`, `cermin-mediasi-status` (10 uji) | AKIBAT PENGGABUNGAN: uji migrasi tiap rantai menuntut idx jurnal sementara (81-84) dan tetangga tertentu | diperbaiki: idx akhir 81-98 menurut nomor berkas; hijau |
| `ekstensi-mode-ringan`, `ekstensi-pengamat-tunggal` (2 uji) | AKIBAT PENGGABUNGAN: B menuntut `pengamat-bersama.js` paling depan, F menuntut `portal-jalur.js` paling depan | diperbaiki: `portal-jalur.js` (pembungkus fetch tanpa pewaktu/pengamat) boleh mendahului; hijau |
| `bawaan-abt-itsbat-18okt` (3), `elitigasi-7139-otomatis-17okt` (1) | harness uji mengiris `blangko-derry-isian.js` tanpa peubah `konteksJejak` yang diperkenalkan C1 | diperbaiki: harness diberi `konteksJejak`; hijau |
| `tema-ecourt-23okt` (1) | mengunci versi manifest 1.205.38; dasar 1.205.39 | diperbaiki: cukup berbentuk `1.205.x`; hijau |
| `performa-denyut-susulan-19okt` (1) | batas waktu 55 ms terlampaui saat beban uji penuh | hijau bila dijalankan sendirian |
| `referensi-pihak-isian-t8-23okt` (1) | uji balapan yang sudah acak di dasar | tetap acak: 2 dari 3 jalan gagal di cabang ini DAN 2 dari 3 di dasar `w33` |
| `root-redirect` (2) | lingkungan: worktree ini tanpa `.env.local` (sengaja tidak disalin), beranda mengarah ke `/setup` | merah lingkungan; hijau di checkout yang punya `.env.local` |

Sesudah perbaikan, enam belas berkas yang pernah merah dijalankan ulang (kecuali `root-redirect` dan `referensi-pihak-isian-t8` di atas) dan hijau; `tabel-cadangan-terdaftar`, `istilah-tampilan`, `banyak-satker-fitur`, `abt-usulan`, `hak-akses-*`, `tutorial-hidup`, dan `gabung-kait-keamanan-26okt` hijau. Uji penuh TIDAK diulang sesudah perbaikan uji (yang berubah sesudahnya hanya uji, `lint-utang.json`, dan laporan ini; kode produksi identik dengan yang diuji penuh).

## 7. Langkah pemasangan bertahap

Prinsip: pasang SEKALI dari cabang ini dengan semua saklar mati, lalu nyalakan per rantai. Alasannya: (1) hanya jurnal di cabang ini yang idx/when-nya benar; cabang rantai asli memakai idx sementara yang bentrok dan Drizzle hanya menjalankan migrasi yang `when`-nya lebih besar dari yang terakhir tercatat, jadi memasang rantai satu per satu dari cabang asli dapat MELEWATI sebagian migrasi tanpa suara; (2) kedelapan rantai saling menyentuh berkas yang sama (ekstensi tertanam, skema, instrumentation). Bila tetap harus kode bertahap, bangun dari cabang ini dan nyalakan saja per rantai.

**Tahap 0 - pasang gabungan, semua mati (setelah server hidup, Senin 26 Okt 08.00):**

1. Cadangan penuh. SEBELUM memasang, bila sempat, jalankan uji beban K9 di kembaran laptop (`scripts/uji-beban.mjs`, hanya ke kembaran) dan simpan angka awal (rantai E, langkah 2).
2. Naikkan versi sekali (portal dan ekstensi, skill `rilis-ekstensi`): manifest bertambah skrip konten baru, jadi versi WAJIB naik agar Chrome memperbarui; salin ke folder Chrome.
3. Pasang portal DAN bot (kode bot berubah di A, C, D, F, G; bot WAJIB dibangun ulang) dengan `ALETA_RUN_DB_MIGRATIONS=1`: kedelapan belas migrasi (0090-0110) jalan sekali. Tanpa env itu migrasi tidak jalan diam-diam dan layar menjawab "tabel belum ada".
4. Periksa: semua layar lama tampil seperti biasa, tidak ada pemindaian, pengiriman, atau pembatasan yang berjalan. Satu pengecualian: jejak tunda/putus (F3) menulis baris di tabelnya sendiri.

**Tahap menyalakan (urutan disarankan; tiap tahap boleh ditunda tanpa mengganggu yang lain):**

| Tahap | Rantai | Migrasi yang dipakai | Yang dikerjakan |
| :--- | :--- | :--- | :--- |
| 1 | E (ukur dan admin) | 0094, 0095, 0104 | Pusat kesehatan (pemeriksaan berkala dulu, WA kemudian); Mode pemeliharaan siap pakai; "Lihat sebagai"; penjaga integritas: mount BACA-SAJA folder website di `docker-compose.override.yml`, daftarkan folder, pindai pertama = baseline; pengguna memasang authenticator lebih dulu, barulah Super Admin menyalakan authenticator, lalu OTP WhatsApp |
| 2 | F (server) | 0105 | ukur `max_connections` SIPP lalu nyalakan kolam bertahap (`antreMaksMs`+`antreanMaks`, `terpisah`, `putusKueriLambat`); Apache 8008 pada jendela pemeliharaan (`docs/pasang/PORT-8008.md`), baru isi `ALETA_CORS_ASAL_WIDGET`; buka sekali layar "Ketepatan Tunda dan Putus Otomatis" untuk menyusun jejak lama |
| 3 | A (Cermin Perkara) | 0090, 0096 | nyalakan pemindai (malam 18.00-06.30, dapat dilanjutkan); sesudah 100% dan pencocokan bersih nyalakan layar SATU PER SATU: Mediasi, Status Perkara, Jadwal Sidang, Panel ekstensi, Kabar perubahan; tabel Jadwal ringan di satu PC dulu |
| 4 | B (PC tua) | 0098, 0100 | ukur dulu di PC tua (Pengelola Tugas Chrome); urutan: `pengamatTunggal`, `modeRinganOtomatis`, `antreanDiServer`, `berkasDiServer`, `konteksDiServer`, `ejaanNamaPihak`; isi kamus alias awal |
| 5 | C lalu D | C: 0091, 0093, 0101; D: 0092, 0102, 0103 | nyalakan `jejak-isian` dan biarkan 2-4 pekan; `fakta-non-cerai`, `mesin-saksi-tunggal`, `katalog-saksi-basis-data`; D: `ketepatan-isian` dan `huruf-alasan-belajar` butuh data jejak, `isian-sekali`, `wajib-sebelum-cetak`, `isian-per-sidang` (uji tangan atas ABT dulu); `saksi-ke-bas-sipp` TERAKHIR dan hanya setelah dicoba pada satu perkara latihan di SIPP |
| 6 | G (tenggat dan berkas e-Court) | 0110 | `npx tsx scripts/coba-penjaga-tenggat.ts <tanggal> --baru` dan tinjau angka; nyalakan jadwal (tanpa WA) beberapa hari; baru pengingat WA; centang aturan baru SESUDAH dasar hukumnya diperiksa Derry; ukur berkas e-Court sungguhan sebelum menyalakan isi otomatis |
| 7 | Bagian 6 (keamanan tambahan) | 0107, 0108, 0109 | beri tahu pegawai; kebijakan sandi mulai dengan masa berlaku 0; isi daftar jaringan kantor sebelum membatasi peran (layar menolak aturan yang mengunci diri sendiri; darurat `ALETA_BATAS_JARINGAN=0`); pengaman aksi sesudah satu admin mencoba satu aksi, langkah kedua berarti setelah authenticator tahap 1 terpasang; uji pulih: beri peran Postgres `CREATEDB`, jalankan manual dulu |

Mundur: setiap saklar dapat dimatikan kapan saja. Env darurat: `ALETA_CERMIN_PEMINDAI=0`, `ALETA_KESEHATAN_BERKALA=0`, `ALETA_PEMELIHARAAN_DETAK=0`, `ALETA_INTEGRITAS_DETAK=0`, `ALETA_PENJAGA_TENGGAT=0`, `ALETA_BATAS_JARINGAN=0`, `ALETA_UJI_PULIH=0`, `ALETA_OTOMATIS_JEJAK=0`.

## 8. Pertanyaan terbuka

1. **Jejak tunda/putus (F3) menyala bawaan** (hanya menambah baris di tabelnya sendiri; `ALETA_OTOMATIS_JEJAK=0` mematikan). Satu-satunya fitur baru yang tidak mati bawaan. Dibiarkan seperti keputusan agen F; mau dibuat mati bawaan (perlu saklar layar)?
2. **"Luar kantor wajib verifikasi" (6b <- E5) tidak disambungkan.** Perlu perubahan kait masuk: bila 6b menolak dengan `PERLU_VERIFIKASI_LUAR_KANTOR`, kait menerbitkan tiket E5 (`terbitkanTantangan`) dan melempar `VERIFIKASI_DIPERLUKAN`; lalu `sudahTerverifikasi` membaca catatan lolos perangkat. Sesi yang sudah ada dari luar kantor akan diminta masuk ulang. Mau dikerjakan, atau cukup aturan per peran E5?
3. **Langkah kedua pengaman hanya authenticator atau kode cadangan.** Kode WhatsApp butuh tahap "kirim kode" di kotak konfirmasi; belum dibangun.
4. **Satu daftar jaringan**: bila Pengaturan Keamanan punya jaringan aktif, daftar itu menggantikan daftar verifikasi (termasuk bawaan loopback 127.0.0.1 dan ::1 milik verifikasi, jadi akses dari mesin server sendiri dianggap "luar kantor" sampai ditambahkan di sana). Alternatifnya menggabung (union) kedua daftar.
5. **Peringatan ganda**: bila peringatan WA Pusat kesehatan dan peringatan WA uji pulih sama-sama menyala, admin dapat beberapa pesan untuk satu uji pulih yang gagal (lonceng, WA 6d, dan Catatan error).
6. **Versi**: cabang ini TIDAK menaikkan versi (manifest tetap 1.205.39, `APP_VERSION` tidak disentuh); naikkan sekali saat rilis (tahap 0).
7. **Uji penuh**: `root-redirect` butuh `.env.local`; `referensi-pihak-isian-t8-23okt` acak sejak dasar. Skrip penyiapan worktree sebaiknya menyalin `.env.local`, logo PNG, dan `abt-paket/`.
8. **Pertanyaan terbuka tiap rantai** tetap berlaku (lihat `docs/awan/laporan-rantai-{A,B,C,D,E,F,G}.md` dan `laporan-bagian-6.md`, semuanya ada di cabang ini): terutama dasar hukum tiga aturan tenggat G (banding 14 hari, kasasi 14 hari, mediasi 30 hari), penyetuju ketepatan isian D1, arti "BAS SIPP" untuk C6 (dipilih e-Doc BAS sidang), pekerjaan berkas B4 yang hilang saat portal dimulai ulang, dan uji tangan `isian-per-sidang` dan `saksi-ke-bas-sipp` atas ABT/SIPP sungguhan.
9. **Penjaga integritas (E6)** butuh mount folder website ke kontainer portal; tanpa itu komponen kelabu.
