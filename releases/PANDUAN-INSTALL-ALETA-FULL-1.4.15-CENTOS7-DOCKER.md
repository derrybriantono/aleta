# Panduan Install Paket FULL ALETA 1.4.15 di Linux CentOS 7 Docker

Paket ini adalah paket **seluruh aplikasi ALETA** dari root `aleta_server`, bukan hanya modul `manajemen_surat`.
Paket dibuat untuk server Linux CentOS 7 Docker yang sudah aktif dan sebelumnya berjalan pada baseline Patch Notes `v1.4.5`.

Paket membawa source aplikasi sampai `v1.4.15` dan sengaja **tidak membawa setting aktif server** agar konfigurasi yang sudah berjalan tidak tertimpa.

File paket:

- `aleta-full-app-1.4.15.tar.gz`
- `aleta-full-app-1.4.15.tar.gz.sha256`
- `aleta-full-app-1.4.15.json`
- `PANDUAN-INSTALL-ALETA-FULL-1.4.15-CENTOS7-DOCKER.md`

## 1. Isi Paket FULL

Paket ini mencakup source/folder aplikasi utama:

- `manajemen_surat/`
- `aleta_bot/`
- `scripts/`
- `deploy/`
- `docs/`
- `drizzle/`
- root project files yang bukan setting aktif server

Contoh file penting yang ikut:

- `manajemen_surat/src/`
- `manajemen_surat/public/`
- `manajemen_surat/drizzle/`
- `manajemen_surat/scripts/`
- `manajemen_surat/package.json`
- `manajemen_surat/package-lock.json`
- `aleta_bot/app.js`
- `aleta_bot/routes/`
- `aleta_bot/services/`
- `aleta_bot/helpers/`
- `aleta_bot/utils/`
- `aleta_bot/scripts/`
- `aleta_bot/package.json`
- `aleta_bot/package-lock.json`
- root `scripts/` untuk maintenance/deploy

## 2. Yang Sengaja Tidak Ikut Paket

Agar setting server aktif aman, paket ini mengecualikan:

- `.env`, `.env.local`, `.env.production`, dan file env aktif lain
- folder `config/` root
- folder `aleta_bot/config/`
- `aleta_bot/db_config*.js`
- `data/`
- `uploads/`
- `node_modules/`
- `.next/`
- `.wwebjs_auth/`
- `.wwebjs_cache/`
- `tmp/`, `.tmp/`
- `logs/`, `runtime-logs/`, `.runtime-logs/`
- `.git/`, `.vscode/`, `.backup/`, `.codex-logs/`
- `releases/`
- folder backup lama
- file log `*.log`, `*.err`, `*.out`, `*.err.log`, `*.out.log`
- file backup `*.bak*`, `*.backup`, `*.swp`
- arsip lama `*.tar`, `*.tar.gz`, `*.zip`
- screenshot/gambar runtime di root aplikasi
- PDF runtime di root aplikasi atau root `aleta_bot`
- `Dockerfile`, `Dockerfile.*`
- `docker-compose*.yml`
- `next.config.ts` dan backupnya

Jika server memang membutuhkan perubahan `Dockerfile`, `docker-compose`, `next.config.ts`, atau config lain, lakukan manual dengan membandingkan file lama dan baru. Jangan overwrite otomatis.

## 3. Upload Paket ke Server

Dari Windows PowerShell lokal:

```powershell
scp "D:\Download File\server aleta baru\aleta_server\releases\aleta-full-app-1.4.15.tar.gz" root@IP_SERVER:/root/
scp "D:\Download File\server aleta baru\aleta_server\releases\aleta-full-app-1.4.15.tar.gz.sha256" root@IP_SERVER:/root/
scp "D:\Download File\server aleta baru\aleta_server\releases\PANDUAN-INSTALL-ALETA-FULL-1.4.15-CENTOS7-DOCKER.md" root@IP_SERVER:/root/
```

Ganti `IP_SERVER` dengan IP/domain server.

## 4. Masuk SSH dan Tentukan Folder Root ALETA

```bash
ssh root@IP_SERVER
```

Masuk ke folder root aplikasi ALETA. Contoh umum:

```bash
cd /var/www/html/aleta_server
pwd
ls -lah
```

Pastikan di folder ini ada minimal:

```bash
ls -lah manajemen_surat aleta_bot
```

Jika server Anda memakai path lain, gunakan path yang benar. Jangan lanjut bila Anda belum yakin sedang berada di root aplikasi ALETA.

## 5. Cek Checksum Paket

```bash
cd /root
sha256sum -c aleta-full-app-1.4.15.tar.gz.sha256
```

Hasil benar:

```text
aleta-full-app-1.4.15.tar.gz: OK
```

Jika gagal, jangan install. Upload ulang paket dan checksum.

## 6. Backup Sebelum Update

Backup source aplikasi tanpa runtime berat:

```bash
cd /var/www/html/aleta_server
mkdir -p ../aleta-backups
tar \
  --exclude='./.git' \
  --exclude='./manajemen_surat/node_modules' \
  --exclude='./manajemen_surat/.next' \
  --exclude='./manajemen_surat/data' \
  --exclude='./manajemen_surat/uploads' \
  --exclude='./manajemen_surat/tmp' \
  --exclude='./manajemen_surat/reports' \
  --exclude='./aleta_bot/node_modules' \
  --exclude='./aleta_bot/data' \
  --exclude='./aleta_bot/tmp' \
  --exclude='./aleta_bot/.wwebjs_auth' \
  --exclude='./aleta_bot/.wwebjs_cache' \
  -czf ../aleta-backups/aleta-full-before-1.4.15-$(date +%Y%m%d-%H%M%S).tar.gz .
```

Backup database sesuai SOP server masing-masing. Jangan lanjut update besar tanpa backup database bila ada migration yang akan dijalankan.

## 7. Install Paket FULL Secara Aman

Penting: **jangan hapus folder `manajemen_surat` atau `aleta_bot` sebelum ekstrak**, karena paket ini sengaja tidak membawa setting aktif server.

Ekstrak paket di atas folder root aplikasi:

```bash
cd /var/www/html/aleta_server
tar -xzf /root/aleta-full-app-1.4.15.tar.gz -C /var/www/html/aleta_server
```

Perintah ini akan menimpa source yang ada di paket, tetapi file/folder yang tidak ada di paket seperti `.env`, `config`, `data`, `uploads`, dan session WhatsApp akan tetap berada di server.

## 8. Install Dependency Bila Diperlukan

Jika `package.json` atau `package-lock.json` berubah, install dependency ulang di container atau host sesuai pola server.

Untuk Portal `manajemen_surat` dari host:

```bash
cd /var/www/html/aleta_server/manajemen_surat
npm ci
```

Untuk ALETA Bot dari host:

```bash
cd /var/www/html/aleta_server/aleta_bot
npm ci
```

Jika dependency hanya dikelola melalui Docker build, cukup lakukan rebuild container pada bagian 10.

## 9. Migrasi Database Bila Diperlukan

Portal ALETA:

```bash
cd /var/www/html/aleta_server/manajemen_surat
npm run db:migrate
```

Jika lewat container Docker:

```bash
cd /var/www/html/aleta_server
docker-compose exec portal npm run db:migrate
```

Jangan menjalankan migrasi destruktif tanpa backup database.

## 10. Rebuild dan Restart Docker

CentOS 7 umumnya memakai `docker-compose` lama.

Jika service bernama `portal` dan `aleta_bot`:

```bash
cd /var/www/html/aleta_server
docker-compose build portal aleta_bot
docker-compose up -d portal aleta_bot
```

Jika nama service berbeda, cek dulu:

```bash
docker-compose ps
cat docker-compose.yml
```

Lalu rebuild service yang benar.

Jika server memakai Docker Compose v2:

```bash
docker compose build portal aleta_bot
docker compose up -d portal aleta_bot
```

Jika server hanya menjalankan Portal tanpa service ALETA Bot terpisah, rebuild/restart service yang memang ada di server.

## 11. Verifikasi Setelah Install

Cek container:

```bash
cd /var/www/html/aleta_server
docker-compose ps
docker-compose logs --tail=150 portal
docker-compose logs --tail=150 aleta_bot
```

Jika service `aleta_bot` tidak ada, abaikan log service tersebut dan cek service bot sesuai nama di server.

Cek halaman Portal:

```bash
curl -I http://127.0.0.1:3000/login
curl -I http://127.0.0.1:3000/portal
```

Jika memakai base path `/aleta`:

```bash
curl -I http://127.0.0.1:3000/aleta/login
curl -I http://127.0.0.1:3000/aleta/portal
```

Cek dari browser:

- Halaman login tampil normal.
- Patch Notes menampilkan `v1.4.15`.
- Login Super Admin berhasil.
- Logout kembali ke halaman login.
- Manajemen Surat bisa dibuka.
- ALETA Bot bisa dibuka.
- ALETA x SIPP bisa dibuka.
- ALETA Judicia / Legal Form bisa dibuka.
- Panduan dan Pusat Masukan sudah sesuai rilis `v1.4.15`.

## 12. Jalankan Preflight Portal

Dari host:

```bash
cd /var/www/html/aleta_server/manajemen_surat
npm run preflight
```

Dari container:

```bash
cd /var/www/html/aleta_server
docker-compose exec portal npm run preflight
```

Hasil yang diharapkan untuk staging-public:

- Database runtime `postgres`.
- Fallback database dev tidak aktif.
- Super Admin tersedia.
- Role utama tersedia.
- Module visibility tersedia.
- ALETA Bot setting dan template tersedia dari database.
- Query Registry ALETA x SIPP tersedia dari database.
- Query Registry JLF tersedia dari database.
- Unsafe active query `0`.
- `BETTER_AUTH_SECRET` tersedia dari environment server.

## 13. Setting yang Wajib Tetap dari Server

Pastikan setting berikut tetap berasal dari server aktif:

- `.env` / `.env.production`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- konfigurasi base path/domain/reverse proxy
- konfigurasi Docker Compose
- session WhatsApp `.wwebjs_auth`
- upload dan file lampiran
- database PostgreSQL
- setting gateway WhatsApp/SIPP yang tersimpan di database

## 14. Rollback Jika Bermasalah

Jika aplikasi bermasalah setelah update:

1. Simpan log error.
2. Stop service yang bermasalah.
3. Restore backup pada bagian 6.
4. Rebuild/restart container.

Contoh:

```bash
cd /var/www/html
mkdir -p aleta_server_broken_$(date +%Y%m%d-%H%M%S)
# Pindahkan atau backup folder bermasalah sesuai SOP Anda.
# Ekstrak backup alih-alih menghapus data runtime penting.
```

Jika ada script rollback server, gunakan sesuai SOP server.

## 15. Catatan Penting

- Paket ini full source, tetapi bukan full clone runtime server.
- Paket tidak membawa setting aktif agar server yang sudah berjalan tidak rusak.
- Jangan menjalankan `rm -rf manajemen_surat` atau `rm -rf aleta_bot` sebelum extract paket ini.
- Jangan mengirim WhatsApp live saat verifikasi awal kecuali gateway staging sudah disiapkan.
- Lakukan update saat jam sepi atau maintenance window.
- Simpan paket, checksum, panduan, dan backup sampai aplikasi stabil.
