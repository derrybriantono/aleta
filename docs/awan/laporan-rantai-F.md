# Laporan rantai F: Server (F1 kolam SIPP, F2 port 8008, F3 riwayat tunda/putus)

Dikerjakan di laptop (worktree `D:\aleta-dev\wt\w73`), 25 Okt 2026, dari `integrasi-1205-39` (c70ca746).
Server kantor tidak dijangkau. Versi tidak dinaikkan, tidak ada yang dipasang.

## 1. Cabang dan commit ujung (bertumpuk F1 -> F2 -> F3)

| Cabang | Commit | Isi |
| :--- | :--- | :--- |
| `fitur/kolam-sipp` | `b92dd7b6` | K3: kolam layar terpisah dari latar, gagal cepat, putus kueri lambat |
| `fitur/port-8008` | `ad7c2c21`, `c4bade45` | K7: bacaan widget SIPP/ABT lewat 8008 dengan cadangan 80; CORS portal |
| `fitur/riwayat-tunda-putus` | `35a2cff9`, merge `90d69c66`, laporan ini | U19: jejak terstruktur + layar ketepatan |

Semua sudah di-push. Tidak ada push ke `main`/`integrasi-*`, tidak ada PR.

## 2. Hasil uji

| Cabang | Uji sasaran baru | tsc | lint:jangan-bertambah |
| :--- | :--- | :--- | :--- |
| F1 | `kolam-sipp-25okt` (12), `kolam-sipp-portal-25okt` (8): 20 hijau | bersih | 45 (= dasar) |
| F2 | `port-8008-widget-25okt` (17) + `port-8008-19okt` (11): 28 hijau; 131 berkas "ekstensi*/zip/penjaga" (3.020 uji) hijau | bersih | 45 |
| F3 | `otomatis-jejak-25okt` (18) hijau; `tunda-otomatis*`, `tulis-hari-itu-putus-otomatis`, `tabel-cadangan-terdaftar`, jejak-masuk, dompet AI: 118 hijau | bersih | 45 |

Skrip bot lama tetap hijau: `verify-db-wrapper` (31), `verify-query-guard` (52), `verify-legacy-reference-date`. `verify-pemisahan-database` (2 gagal) dan `verify-sipp-baca-saja` (1 gagal) sudah merah sebelum perubahan ini (menyebut `dokumenPenetapanService`, `ktpPihakService`, `putusanUnggahService`, `sidangHasilService`).

**Uji penuh sekali di ujung F3** (`periksa-uji.mjs`, utas 3, ±76 menit): 948 berkas, 934 hijau, 2 dilewati; 17.815 uji hijau, 10 merah, 20 dilewati. Berkas merah/habis waktu:

| Berkas | Sebab | Milik rantai F? |
| :--- | :--- | :--- |
| `abt-usulan` | daftar skrip konten ABT kini memuat `portal-jalur.js` | YA, sudah diperbaiki (`c4bade45`), hijau |
| `docx-tabel-gambar`, `eviden-skp-cetak`, `xlsx-lembar-bebas` | `public/mahkamah-agung-logo.png` tidak ada di worktree baru (PNG diabaikan git) | tidak (lingkungan) |
| `w2a-kebendaan`, `w3b-blangko-baru-21okt` | folder `abt-paket/` (tidak masuk git) tidak ada di worktree | tidak (lingkungan) |
| `root-redirect` | butuh `manajemen_surat/.env.local` (tidak di git); lulus di `w33` yang memilikinya | tidak (lingkungan) |
| `tema-ecourt-23okt` | menuntut versi `1.205.38`, manifest dasar sudah `1.205.39`; merah juga di `integrasi-1205-39` | tidak (sudah merah di dasar) |
| `alamat-desa-ketik-22okt`, `arsip-cadangan`, `blangko-derry-isi-otomatis-19okt` | waktu/beban (tiga utas + agen lain); hijau bila dijalankan sendirian | tidak (habis waktu/flake) |
| `referensi-pihak-isian-t8-23okt` | tidak stabil; juga gagal acak (1 dari 4) di `integrasi-1205-39` | tidak (flake lama) |

Tidak ada kegagalan baru yang berasal dari rantai F sesudah perbaikan `abt-usulan`.

## 3. Pengaturan baru dan bawaannya (semua = perilaku lama persis)

### F1 Kolam SIPP (Super Admin: Pengaturan Bot > "Sambungan Bot ke SIPP"; tanpa migrasi)
Disimpan di `aleta_ekstensi_setelan` (`*sistem*`, `sistem:kolam-sipp`), dikirim ke bot lewat sinkron runtime (`kolamSipp`), diterapkan **saat berjalan tanpa mulai ulang**, disalin ke `data/kolam-sipp.json` bot. Belum pernah disimpan = portal tidak mengirim apa pun.

| Nama | Bawaan | Rentang | Arti |
| :--- | :--- | :--- | :--- |
| `terpisah` | mati | - | permintaan portal (layar) memakai kolam sendiri; WhatsApp, cron, penilaian, e-Court tetap di kolam utama |
| `batas` | 10 | 1-50 | ukuran kolam utama (satu-satunya bila `terpisah` mati) |
| `batasInteraktif` | 10 | 1-50 | ukuran kolam layar |
| `antreMaksMs` | 0 (tunggu tanpa batas) | 0-60000 | menunggu sambungan paling lama; lewat itu gagal dengan pesan jelas |
| `antreanMaks` | 0 (tanpa batas) | 0-5000 | antrean paling panjang |
| `putusKueriLambat` | mati | - | kueri yang melewati batas waktu klien dihentikan di server (`KILL QUERY` lewat sambungan sekali pakai) |

Galat kolam penuh (`KOLAM_ANTRE_HABIS`, `KOLAM_PENUH`) sengaja BUKAN tanda SIPP rusak: tidak membuka pemutus arus. Penandaan layar/latar: middleware di `/internal/aleta-bot` (awalan kerja berat di `LATAR_PREFIKS`: `/sinkron`, `/kembaran`, `/ecourt*`, `/sipp/penilaian`, `/sipp/ringkasan-massal`, `/sipp/unggah-massal`, `/sipp/rekap-petugas`, `/sipp/ukur-tipe`, `/sipp/ide-l2`, `/sipp/ktp-pihak`, `/sipp/sebaran-jurusita`, `/config/sync`, `/queue`, `/worker`). Kode tanpa tanda (cron, WhatsApp) otomatis latar. Status kolam (semua/bebas/antre) ada di `kolamSipp` pada status layanan bot.

### F2 Port 8008 (tanpa migrasi)
| Nama | Bawaan | Arti |
| :--- | :--- | :--- |
| env portal `ALETA_CORS_ASAL_WIDGET` | kosong = tidak ada kepala CORS | daftar asal halaman SIPP/ABT, mis. `http://192.168.10.10`. Hanya untuk permintaan yang MASUK lewat port tambahan (`ALETA_PORT_PORTAL_TAMBAHAN`, 8008), jalur `/api/`, GET/HEAD/OPTIONS |
| ekstensi `portal-jalur.js` | aktif, tetapi tanpa CORS portal ia tidak pernah terbukti dan semua tetap di port 80 | hanya GET/HEAD ke `/aleta/api/...` dari halaman SIPP/ABT; tulisan tetap di port 80; gagal jaringan/404/502/503/504 diulang di port 80; uji ulang tiap 2 menit |

Popup dan pekerja latar sudah memakai 8008 dengan cadangan 80 sejak K1 (19 Okt); portal sudah memercayai asal 8008. Pengalihan otomatis halaman portal 80 -> 8008 tetap OPSI di `aleta-8008.conf` (dikomentari).

### F3 Jejak tunda/putus (migrasi 0105)
`aleta_otomatis_jejak`: satu baris per (fitur, tanggal sidang, jadwal sidang): aturan, nomor aturan, hasil, kering/nyata, ditolak saat dibaca ulang, dibatalkan petugas, pesan (300 huruf), e-Doc, pemicu, jam. Hanya nomor perkara (tanpa nama pihak/NIK). Ditulis **berdampingan** dengan blob harian (blob tetap sumber logika harian); baris tak berubah dilewati; kegagalan tabel/jejak ditelan dan dicoba lagi 10 menit, tidak pernah mengganggu tunda/putus otomatis. Mati dengan env `ALETA_OTOMATIS_JEJAK=0`. Layar Admin/Super Admin: halaman admin e-Court (di bawah kartu KTP pihak), kartu "Ketepatan Tunda dan Putus Otomatis" (lolos, ditolak saat dibaca ulang, gagal, dibatalkan, mode kering, usulan, persen lolos per aturan, sebab dilewati, 100 kejadian terakhir). Tabel kosong tetapi blob lama ada: diisi otomatis sekali saat laporan dibuka (tombol "Susun ulang dari riwayat harian" untuk mengulang, idempoten). Api: `/api/aleta-ecourt/otomatis-jejak`.

"Ketepatan" = diterima atau ditolak penjaga bot saat membaca ulang SIPP sebelum menulis; bukan benar-salahnya putusan.

## 4. Migrasi dan idx jurnal
- Dipakai: **0105** `aleta_otomatis_jejak`. **0106 tidak dipakai.**
- `idx` jurnal: **81** (bukan 95). Alasan: banyak uji (`jejak-masuk-perangkat`, `aleta-ai-dompet-25okt`, `agen-h7-putusan-f42`, dll.) menuntut `idx == urutan` tanpa lubang; idx 95 membuat uji-uji itu merah. `when` = 1792440000001 (lebih besar dari 0090). Bentrok idx dengan 0090/0091/0094... diselesaikan saat gabung akhir.
- Tiga tempat terdaftar: SQL + `_journal.json`; `DDL_OTOMATIS_JEJAK` di `schema.ts`; `aleta_otomatis_jejak` di `IN_MEMORY_TABLE_PERSISTENCE_ORDER`. `tabel-cadangan-terdaftar` hijau. Tanpa FK/CHECK.
- Ingat catatan lama: migrasi baru HANYA jalan bila `ALETA_RUN_DB_MIGRATIONS=1` saat pembaruan; tanpa itu laporan menjawab jujur "Tabel jejak otomatis belum ada" (bukan galat 500).

## 5. Langkah laptop/server Senin 26 Okt 08.00 (urut)
1. **Gabung** F1-F3 ke `integrasi`; rapikan idx jurnal; tanam ekstensi dengan `rilis-ekstensi` (naikkan versi; `portal-jalur.js` dan manifest sudah siap, `susun-ekstensi` sudah dijalankan dengan `ALETA_TANAM_PAKSA=1` tanpa naik versi).
2. **Pasang** portal dengan `ALETA_RUN_DB_MIGRATIONS=1` (migrasi 0105) dan mulai ulang bot (memuat `kolamSippService`).
3. **Ukur di server SIPP** (MariaDB 5.5; baca saja):
   ```sql
   SHOW VARIABLES LIKE 'max_connections';
   SHOW STATUS    LIKE 'Max_used_connections';
   SHOW VARIABLES LIKE 'max_user_connections';
   SELECT user, COUNT(*) FROM information_schema.processlist GROUP BY user;
   ```
   Total sambungan bot (`batas` + `batasInteraktif` bila dipisah) sebaiknya < separuh `max_connections` dan < `max_user_connections` akun SIPP bot (layar Pengaturan memberi peringatan bila kolom batas diisi). Contoh bila `max_connections` = 151 dan `max_user_connections` tidak dibatasi: `batas` 6, `batasInteraktif` 16, `antreMaksMs` 4000, `antreanMaks` 64. Nyalakan bertahap: (a) `antreMaksMs`+`antreanMaks` saja, (b) `terpisah`, (c) `putusKueriLambat` setelah memastikan akun SIPP bot boleh `KILL` utasnya sendiri (kewenangan bawaan; tidak perlu hak SUPER). Pantau `kolamSipp.hitung` dan `semua/bebas/antre` di status bot.
4. **Apache 8008** (jendela pemeliharaan, sesi utama): ikuti `docs/pasang/PORT-8008.md` bagian 1-3 (`aleta-8008.conf` -> `/etc/httpd/conf.d/`, `apachectl configtest`, `reload`); firewall `8008/tcp` dijalankan pengguna sendiri; lalu uji dari komputer petugas. Baru sesudah itu isi `ALETA_CORS_ASAL_WIDGET=http://192.168.10.10` di env portal dan mulai ulang kontainer portal (bagian 7 dokumen yang sama). Mundur: kosongkan env itu.
5. **Isi jejak lama**: buka halaman admin e-Court > "Ketepatan Tunda dan Putus Otomatis" sekali (otomatis menyusun dari blob harian), atau tekan "Susun ulang".

## 6. Pertanyaan terbuka (opsi aman sudah dipilih)
1. **idx 81 vs 95**: dipilih 81 agar uji tidak merah; sesi utama menyesuaikan saat gabung.
2. **Saklar F2 berupa env, bukan layar Super Admin**: kepala CORS dipasang di `proxy.ts` yang tidak memegang basis data. Bila Derry ingin tombol di layar, perlu cara baca setelan tanpa DB (mis. dikirim lewat env/berkas).
3. **Jejak F3 menyala bawaan** (dengan saklar mati hanya lewat env `ALETA_OTOMATIS_JEJAK=0`): ia hanya menambah baris di tabel sendiri, tidak mengubah perilaku tunda/putus; bila Derry mau saklar layar bawaan mati, tambahkan pada cabang berikutnya.
4. **Blob harian belum dihapus/dipindahkan penuh**: tetap sumber logika harian (satu jalan per tanggal, tanda batal, pemberitahuan). Dipindahkan penuh berisiko mengubah perilaku lama; cukup bila laporan sudah dipakai.
5. **Retensi jejak** belum diatur (±6 MB per tahun, ringan). Usul: 2 tahun seperti jejak lain.
6. **Daftar `LATAR_PREFIKS`** disusun dari nama rute bot; mohon dicocokkan dengan beban nyata (rute portal yang berat dan tidak ada dalam daftar akan dihitung "layar").
7. **Batas waktu kueri layar** tetap 15 dtk (server) + 2 dtk (klien) seperti sekarang. Layar yang lebih sabar/pendek dari kerja latar dapat diatur terpisah bila hasil ukur Senin menunjukkan perlu.
8. **Widget menulis** (POST) tetap lewat port 80; bila antrean 80 masih terasa, tulisan dapat ikut dipindah dengan CORS metode lain, tetapi itu mengubah jaminan CSRF dan sengaja tidak dilakukan.
9. Uji lingkungan merah (bagian 2) perlu `.env.local`, logo PNG, dan `abt-paket/` di worktree baru; usul: skrip penyiapan worktree menyalinnya.
