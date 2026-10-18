# Kembaran ALETA di laptop (tahap 1)

Tujuan: ALETA, SIPP, dan ABT tetap dapat dipakai walau server kantor mati. Tahap ini = **kembaran di laptop**:
salinan SIPP/ABT/ALETA dari server dijalankan di laptop, tulisan ke SIPP/ABT **tidak langsung ditulis** melainkan
ditahan di antrean, lalu didorong ke server **setelah server hidup**, dengan pemeriksaan bentrok dan persetujuan
Super Admin. Server kantor mati sampai Senin, jadi bagian "tarik" dan "dorong" ke server nyata **belum diuji**
(lihat bagian Batasan); bagian lain diuji di MariaDB laptop dengan dua basis data tiruan.

## 1. Cara kerja singkat

```
 server kantor (SIPP, ABT, ALETA)                       laptop
 ───────────────────────────────                        ──────────────────────────────────────────
 cadangan terjadwal ──ssh aleta──► scripts/kembaran/tarik.mjs ──► sipp_donggala, aps_badilag,
                                                                  aleta_bot, Postgres ALETA
                                                                  + cap tarik (pita "data per ...")
                                                          │
                                       ALETA_MODE=kembaran│  petugas bekerja di ALETA / SIPP lokal
                                                          ▼
                                       tulisan ke SIPP/ABT/antrian ──► antrean "menunggu sinkron"
                                       (MySQL laptop, basis data aleta_kembaran, + cuplikan nilai lama)
                                                          │
 server hidup ◄── periksa bentrok ◄── Admin > Sinkron kembaran (Super Admin: periksa, setujui, kirim)
```

Penanda mode: `ALETA_MODE=kembaran` (env bot **dan** portal). Tanpa itu semuanya berperilaku seperti biasa.

### Yang berubah di mode kembaran

| Hal | Perilaku |
|---|---|
| Tulisan ke SIPP, ABT, antrian sidang | **tidak** dijalankan; dicatat ke antrean bersama cuplikan nilai lama |
| Tulisan ke tabel `aleta_*` dan basis data ALETA sendiri | tetap ditulis (di laptop) |
| Berkas e-Doc (putusan, BAS, penetapan) ke folder SIPP | tidak ditulis; isinya disimpan di `D:\Aplikasi\aleta\kembaran\berkas\<sha256>.bin`, barisnya di antrean |
| WhatsApp | mati: `readRuntimeConfig()` memaksa `botEnabled=false` dst., `startWhatsappClient` dan `ensureWhatsappClient` menolak |
| e-Court | mati: penjadwal, pemantau sesi, pemulih, verifikasi harian, pekerja notifikasi, login, dan peluncur peramban menolak |
| Pita | "Mode kembaran - data per `<waktu data dibuat di server>`" di puncak setiap halaman portal; `/health` dan `/internal/aleta-bot/status` bot memuat `mode` dan `pita` |

Pengalihan terpasang **sekali, di pintu kolam sambungan** (`aleta_bot/services/penjagaKembaran.js`, dipanggil dari
`db_config.js`, `db_config4.js`, `db_config5.js`, dan `externalDbService.createConnectionPool`). Itu menutup semua
penulis yang ada dan yang ditulis kelak. Penulis yang terdaftar di `penjagaTandaSipp.JALUR_TULIS_SIPP`
(penetapan, tunda/putus sidang, putusan, penetapan kembali, mediator, kasir/jurnal, Court Calendar, posita,
e-Doc putusan/BAS/penetapan, antrian sidang, Pengaturan SIPP & ABT) dan yang dikecualikan (`antrianDisidang`,
`antrianOnlineService`, `kehadiranAntrianService`, `panggilanAntrianService`, `sidangSelesaiService`) semuanya
lewat pintu itu. Tiga berkas yang menulis ke folder SIPP (`putusanUnggahService`, `dokumenPenetapanService`,
`basUnggahService`) memakai `kembaranBerkas.js`.

Satu permintaan HTTP ke bot = satu **kelompok** antrean (AsyncLocalStorage). Tulisan dalam transaksi
(`beginTransaction`/`START TRANSACTION`) baru dicatat saat `COMMIT`; `ROLLBACK` membuangnya. Pernyataan yang
memuat `NOW()`, `CURDATE()`, `CURRENT_TIMESTAMP`, dst. diganti literal jam SIPP laptop **saat tulisan terjadi**,
supaya yang dikirim Senin tetap jam saat petugas bekerja.

Jawaban semu ke pemanggil: `affectedRows` = jumlah baris cuplikan, `insertId` = nomor semu (di atas 1,9 miliar).
Bila baris anak memakai `insertId` itu, saat dikirim nomor semu diganti nomor sungguhan dari baris induk
di kelompok yang sama.

## 2. Menyalakan semuanya di laptop (tanpa Docker)

Prasyarat sekali jalan: MySQL XAMPP (`D:\satker asal\website pa bungku\xampp`) hidup; PostgreSQL 16 hidup (port
54329 sesuai `manajemen_surat\.env.local`); `aleta_bot\.env` dan `manajemen_surat\.env.local` ada dengan token
internal bot-portal yang sama; SSH `ssh aleta` sudah berfungsi dari laptop ini.

1. **Tarik data** (lihat bagian 3). Pertama kali: salin `scripts\kembaran\konfigurasi.contoh.json` ke
   `D:\Aplikasi\aleta\kembaran\konfigurasi.json`. Kata sandi arsip: `$env:ALETA_SINKRON_SANDI = "..."`.
2. **SIPP lokal** (port 8056, PHP 5.6): `powershell -File D:\sipp-server\jalankan-sipp.ps1`.
   ABT berjalan dari `htdocs\aps_badilag` XAMPP lewat port 8056/80 seperti biasa.
3. **Bot + portal kembaran**: `powershell -File scripts\kembaran\nyalakan.ps1`
   (`-Apa bot|portal`, `-Portal produksi` bila sudah `npm run build` dengan `NEXT_PUBLIC_BASE_PATH=/aleta`,
   `-Henti` untuk mematikan). Skrip ini mengisi `ALETA_MODE=kembaran`, nama basis data hasil tarikan
   (`sipp_donggala`, dst.), `ALETA_SIPP_ROOT=D:\Aplikasi\SIPP`, dan `TMP/TEMP` di D:.
   **Jalankan lewat PowerShell**, bukan Git Bash (MSYS merusak `/aleta`).
4. Periksa: `http://127.0.0.1:3003/health` memuat `"mode":"kembaran"`; portal `http://127.0.0.1:3000/aleta`
   menampilkan pita kuning "Mode kembaran - data per ...".

**Jangan pernah menyalakan sesi WhatsApp di laptop.** Mode kembaran menutupnya di dalam kode, tetapi jangan
mengakalinya: sesi yang sama dari dua tempat memutus sesi server.

### SIPP/ABT lokal HANYA-BACA (keputusan 18 Okt 2026, butir 23)

Selama `ALETA_MODE=kembaran`, halaman SIPP/ABT lokal (port 8056) **tidak boleh menulis** ke basis data laptop
(sebelumnya ekstensi yang menyimpan lewat halaman itu menulis langsung dan melewati antrean). `nyalakan.ps1`
menjalankan `scripts\kembaran\kunci-sipp-abt.ps1`; `nyalakan.ps1 -Henti` menjalankan pembaliknya
(`kunci-sipp-abt.ps1 -Balik`).

Cara kerja (tanpa mengubah sandi satu akun pun, tanpa menyentuh berkas SIPP/ABT):

1. SIPP (`config.ini`) dan ABT (`application/config/database.php`, folder ABT tidak boleh disunting) masuk ke MySQL
   sebagai `root`. MySQL `read_only` global tidak dipakai: `root` punya hak SUPER dan lolos darinya, sementara bot
   kembaran sendiri harus tetap menulis.
2. Hak `root` (semua host) dibaca lewat `SHOW GRANTS` dan disimpan utuh di
   `D:\Aplikasi\aleta\kembaran\kunci-sipp-abt\grants-asli.sql`.
3. Akun `kembaran_penuh` dibuat dengan hak dan **hash sandi yang sama** (GRANT yang sama, nama akun saja diganti)
   lalu dicoba masuk. Gagal = berhenti, `root` belum disentuh; `nyalakan.ps1` pun tidak menyalakan apa-apa.
4. Lewat `kembaran_penuh`, hak `root` dicabut dan diganti **SELECT saja** pada `sipp_donggala`, `aps_badilag`,
   `sipp_turunan_antrian`. SIPP/ABT yang masuk sebagai `root` kini hanya-baca (sandinya tetap, konfigurasi aplikasi
   tidak berubah).
5. `nyalakan.ps1` menjalankan bot kembaran sebagai `kembaran_penuh` (`ALETA_BOT_DB_USER`, `_SIPP_USER`, `_APS_USER`,
   `_ANTRIAN_USER`) agar ALETA tetap menulis ke salinan lokal. Sandinya = sandi `root` (sudah ada di `aleta_bot\.env`).
6. Membalik: hak asli `root` dipasang kembali PERSIS dari `grants-asli.sql`, memastikan `root` kembali `ALL PRIVILEGES`,
   baru `kembaran_penuh` dihapus. Berkas hak asli dipindah ke `grants-asli.dipulihkan-<waktu>.sql`.

Yang perlu diingat:
- Selama terkunci, **alat lain yang masuk sebagai `root`** (Navicat, `tarik.mjs`) juga hanya-baca. Jalankan
  `tarik.mjs` SEBELUM menyalakan kembaran atau sesudah `-Henti` (atau ubah `mysql.pengguna` di `konfigurasi.json`
  menjadi `kembaran_penuh`).
- Penyimpanan di halaman SIPP/ABT lokal yang menulis akan ditolak MySQL (galat tulis) - itu memang tujuannya;
  petugas bekerja lewat ALETA (yang diantrekan ke server).
- `powershell -File scripts\kembaran\kunci-sipp-abt.ps1 -Uji` hanya menampilkan SQL yang akan dijalankan.
  `nyalakan.ps1 -TanpaKunci` melewati penguncian (hanya untuk perbaikan; skrip memberi peringatan).
- Bila skrip mati di tengah jalan: `kunci-sipp-abt.ps1 -Balik` memulihkan dari `grants-asli.sql`; `keadaan.json`
  di folder yang sama mencatat tahapnya. Belum diuji terhadap MySQL nyata di laptop (MySQL sedang dipakai proses lain
  saat skrip ditulis) - uji pertama sebaiknya dengan `-Uji`.

## 3. Tarik data dari server

```powershell
$env:ALETA_SINKRON_SANDI = "<kata sandi arsip>"       # hanya jendela ini
node scripts\kembaran\tarik.mjs --rencana              # lihat apa yang akan dilakukan, tanpa menyentuh apa pun
node scripts\kembaran\tarik.mjs --uji                  # periksa server lewat ssh, tanpa mengunduh
node scripts\kembaran\tarik.mjs                        # tarik + pulihkan
node scripts\kembaran\tarik.mjs --hanya-unduh          # tarik saja
```

Skrip ini membungkus `tools/sinkron-laptop/sinkron-laptop.mjs` (alat yang sudah ada): cara `ssh` (`ssh aleta` +
`scp`), SHA-256, buka sandi, pemulihan `mysql`/`pg_restore`. Ia **menolak** basis data `sipp` (salinan PA Bungku);
SIPP server dipulihkan ke `sipp_donggala`. Bundel yang ditarik = bundel terbaru di server
(`/var/www/html/aleta-data/reports/sinkron/arsip/...`), dibuat jadwal "Sinkron & cadangan" atau tombol
*Sinkron sekarang* di server. **Tekan Sinkron sekarang di server sebelum menarik** bila ingin data terbaru.

Penjagaan sebelum memulihkan:

- bot (3003) dan portal (3000) harus mati (`nyalakan.ps1 -Henti`);
- **antrean tulis harus kosong dari baris menunggu/disetujui/gagal** - memulihkan menimpa SIPP/ABT laptop, jadi
  kirim dulu (bagian 4) atau singkirkan. `--abaikan-antrean` melewatinya (tidak dianjurkan);
- cadangan antrean (`mysqldump`) dibuat ke `D:\Aplikasi\aleta\kembaran\cadangan-antrean\` setiap kali.

Antrean disimpan di basis data **tersendiri** `aleta_kembaran` (MySQL laptop) justru agar penarikan tidak
menimpanya. Sesudah berhasil, `D:\Aplikasi\aleta\kembaran\tarik.json` ditulis; isinya dibaca pita.
Waktu pada pita = waktu **bundel dibuat di server**, bukan waktu laptop menariknya.

## 4. Dorong ke server: Admin > Sinkron kembaran (Super Admin)

Syarat: server sudah hidup; bot di laptop dapat menyambung ke MySQL server dan `ssh aleta`.

```powershell
ssh -N -L 33306:127.0.0.1:3306 aleta                    # terowongan MySQL server -> port 33306 laptop
```

Isi di `aleta_bot\.env` (bukan di repo): `ALETA_KEMBARAN_SERVER_DB_USER`, `ALETA_KEMBARAN_SERVER_DB_PASSWORD`;
opsional `ALETA_KEMBARAN_SERVER_DB_HOST` (bawaan 127.0.0.1), `_PORT` (33306), `_SIPP_NAME` (SIPP), `_ABT_NAME`
(aps_badilag), `_ANTRIAN_NAME` (sipp_turunan_antrian), `ALETA_KEMBARAN_SSH_ALIAS` (aleta), `ALETA_KEMBARAN_SSH_EXE` (ssh; isi jalur lengkap ssh.exe bila tidak ada di PATH Windows),
`ALETA_KEMBARAN_SERVER_SIPP_ROOT` (/var/www/html/SIPP). Bot **menolak** bila tujuan server ternyata sama dengan basis
data laptop sendiri.

Alur satu baris: **menunggu → periksa → (aman) → disetujui → kirim → terkirim**.

1. **Periksa terhadap server.** Tiap baris dibandingkan dengan nilai *terkini* di server:
   - UPDATE/DELETE: SELECT pencuplik yang sama dijalankan di server; himpunan baris dan kolom yang akan diubah
     (DELETE: seluruh kolom) harus sama dengan cuplikan laptop. Server berubah sejak itu = **BENTROK**.
   - INSERT: kunci unik (PRIMARY/UNIQUE) baris baru tidak boleh sudah ada di server. Tabel tanpa kunci unik selain nomor
     urut: lolos dengan catatan "tanpa pemeriksa duplikat".
   - REPLACE / ON DUPLICATE KEY: baris berkunci sama di server harus persis seperti cuplikan.
   - **Tanggal substantif** (`tanggal_sidang*`, `tanggal_putusan*`, `tanggal_penetapan*`, `tanggal_minutasi*`):
     yang sudah terisi di server tidak pernah diubah → **DITAHAN**. Pengisian pertama (kosong/`0000-00-00`) boleh.
   - DDL, `CALL`, pernyataan yang tidak terbaca, cuplikan yang gagal diambil, server tak terjangkau: **tidak dikirim**.
   - Pernyataan yang memuat kata ALETA: **ditahan** (tidak satu kata pun boleh masuk SIPP).
2. **Setujui** (hanya yang *Aman*): per baris atau per kelompok. Per kelompok = semua atau tidak sama sekali.
3. **Kirim yang disetujui.** Tiap baris diperiksa **ulang** saat itu juga. Satu transaksi per kelompok per basis data;
   SQL persis seperti yang dicatat (aktor dan jam asli tidak disentuh — baris audit SIPP ikut dalam kelompok yang sama);
   UPDATE/DELETE harus mengenai tepat sebanyak baris cuplikan, kalau tidak transaksi dibatalkan. Berkas tiba lebih dulu
   dari barisnya dan tidak pernah menimpa (`ln` ke nama akhir, `chown --reference` folder SIPP).

**Tidak ada tombol paksa.** Baris bentrok/ditahan hanya dapat *disingkirkan* atau diperbaiki dengan tangan di server.
Keputusan Super Admin (periksa, setujui, singkirkan, kirim) dicatat di jejak audit portal dan di catatan sistem bot.

"Jalur tulis yang sama dengan biasa dan audit yang sama": baris yang dikirim adalah pernyataan yang sama yang akan
dijalankan penulis aslinya (termasuk `INSERT INTO sys_audittrail` milik penulis itu), dijalankan lewat sambungan MySQL
server dengan pemeriksaan penjaga tanda ALETA yang sama. Pemeriksaan tingkat layanan (mis. batas hak per peran)
terjadi **saat tulisan dicatat** di laptop dan tidak diulang saat dikirim.

## 5. Batasan (jujur)

- **Belum diuji dengan server nyata.** Tarik (`ssh aleta`, pemulihan dump nyata), terowongan MySQL, dan pengiriman berkas
  lewat `ssh` belum pernah dijalankan; yang diuji: pengalihan dan antrean di MariaDB laptop, pemeriksaan bentrok,
  persetujuan, dan dorong ke basis data kedua di MariaDB yang sama (uji vitest `kembaran-laptop.test.ts` + uji manual).
- **Tulisan lewat SIPP/ABT lokal langsung** (halaman SIPP di port 8056, ABT, ekstensi yang menekan Simpan di halaman itu)
  **ditutup sejak 18 Okt 2026**: SIPP/ABT lokal hanya-baca selama mode kembaran (bagian 2, `kunci-sipp-abt.ps1`). Dulu tulisan itu
  masuk ke `sipp_donggala`/`aps_badilag` laptop tanpa melewati antrean, tidak terlacak, dan tidak terkirim ke server. Pakai ALETA
  (yang menulis lewat antrean) untuk pekerjaan yang harus sampai ke server.
- **Pembacaan sesudah menulis**: laptop tidak menerapkan tulisan itu ke salinan lokal, jadi layar SIPP/ABT/ALETA tetap memperlihatkan
  nilai lama sampai data ditarik ulang. Alur yang membaca balik tulisannya sendiri (verifikasi) dapat melaporkan gagal.
  Pilihan penerapan lokal ditunda (lihat Rencana).
- Dua perubahan beruntun pada **baris yang sama** di kelompok berbeda: yang kedua akan bentrok dengan yang pertama setelah
  yang pertama terkirim. Setujui dan kirim keduanya dalam satu kiriman (pemeriksaan dilakukan sebelum satu pun ditulis).
- Antrean antrian sidang (nomor dipanggil, `disidang`) sangat sementara; pada hari-hari berikutnya hampir pasti bentrok atau
  usang. Singkirkan saja kelompok seperti itu.
- Tulisan ke tabel `aleta_*`, basis data ALETA Bot, dan Postgres portal **tidak** dikirim ke server (hanya SIPP, ABT, antrian,
  dan berkas SIPP). Data ALETA yang dibuat di laptop (pengguna, pengaturan, jejak) hilang pada penarikan berikutnya.
- Pengelompokan per permintaan memakai AsyncLocalStorage. Kode berbasis callback murni dapat kehilangan konteks permintaan; tulisannya
  tetap diantrekan tetapi sebagai kelompok sendiri dengan catatan "dicatat di luar permintaan petugas" saat diperiksa.
- Pernyataan multi-tabel (UPDATE ... JOIN), INSERT ... SELECT, DDL: dicatat, tetapi tidak dikirim otomatis.
- Transaksi lintas basis data (SIPP + ABT dalam satu kelompok) dikomit satu per satu, bukan atomik lintas basis data.
- `SAVEPOINT`/`ROLLBACK TO` tidak diikuti.
- Tidak ada migrasi Drizzle: antrean hidup di MySQL laptop (`aleta_kembaran`) agar tidak ikut tertimpa pemulihan Postgres/aleta_bot.
  Bila kelak antrean dipindah ke Postgres, nomor migrasi berikutnya setelah 0073 (0074) dicadangkan untuk itu.

## 6. Rencana VPS (tahap berikutnya)

Rancangan yang sama bisa dijalankan di VPS (bukan laptop) sehingga kembaran selalu hidup:

1. VPS menjalankan bot + portal dengan `ALETA_MODE=kembaran`, MySQL/MariaDB (SIPP, ABT, antrean) dan PostgreSQL sendiri, di belakang
   TLS dan VPN/WireGuard ke kantor; SIPP dan ABT (PHP 5.6) jalan di VPS memakai salinan basis data.
2. Penarikan terjadwal (bukan manual): `tarik.mjs` lewat cron/Task Scheduler di VPS, ditarik saat server hidup, dengan
   *replikasi satu arah* (`mysqldump --single-transaction` atau replika MariaDB baca-saja) sebagai pengganti dump penuh bila perlu.
3. Dorong otomatis *periksa* (bukan setuju): server yang sudah hidup menjalankan `periksa` berkala dan menandai bentrok lebih awal;
   persetujuan tetap manusia.
4. Penerapan lokal opsional (`ALETA_KEMBARAN_TERAPKAN_LOKAL`): tulisan juga diterapkan ke salinan kembaran supaya layar menampilkan
   hasil kerja segera, dengan rantai cuplikan per baris agar tidak bentrok dengan tulisan sendiri.
5. Kebijakan *failover*: kapan VPS menjadi sumber kebenaran (server mati lama) dan cara kembali ke server — termasuk pemetaan
   nomor urut yang dipakai sementara.
6. Hak akses: akun MySQL server khusus dorong (INSERT/UPDATE/DELETE terbatas pada tabel yang dipakai penulis ALETA).

## 7. Berkas

| Berkas | Fungsi |
|---|---|
| `aleta_bot/services/kembaranMode.js` | penanda mode, cap tarik, kalimat pita |
| `aleta_bot/services/kembaranSql.js` | pembaca SQL (golongan, penguraian, jam relatif) |
| `aleta_bot/services/penjagaKembaran.js` | pembungkus kolam/koneksi, konteks permintaan, jawaban semu |
| `aleta_bot/services/kembaranAntrean.js` | antrean (MySQL `aleta_kembaran`; memori untuk uji) |
| `aleta_bot/services/kembaranBentrok.js` | pemeriksa bentrok, tanggal substantif |
| `aleta_bot/services/kembaranDorong.js` | periksa, setujui, tolak, kirim; server nyata (MySQL + ssh) |
| `aleta_bot/services/kembaranBerkas.js` | berkas e-Doc ke folder SIPP |
| `aleta_bot/routes/kembaranRoutes.js` | `/internal/aleta-bot/kembaran/*` |
| `manajemen_surat/src/server/modules/sinkron/kembaran.ts` | mode, cap tarik, panggilan ke bot |
| `manajemen_surat/src/app/api/admin/sinkron-kembaran/` | API layar (Super Admin) |
| `manajemen_surat/src/components/portal/pita-kembaran.tsx`, `sinkron-kembaran-panel.tsx` | pita dan layar |
| `scripts/kembaran/tarik.mjs`, `nyalakan.ps1`, `konfigurasi.contoh.json` | tarik, nyalakan, contoh konfigurasi |
| `scripts/kembaran/kunci-sipp-abt.ps1` | SIPP/ABT lokal hanya-baca selama kembaran; `-Balik` membuka kembali |
| `manajemen_surat/src/test/kembaran-laptop.test.ts` | uji pengalihan, bentrok, persetujuan, dorong |
