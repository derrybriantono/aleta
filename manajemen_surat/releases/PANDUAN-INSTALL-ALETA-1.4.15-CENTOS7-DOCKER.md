# Panduan Install Paket ALETA 1.4.15 di Linux CentOS 7 Docker

Paket ini dibuat untuk server ALETA yang sudah aktif dan sebelumnya berjalan pada baseline Patch Notes `v1.4.5`.
Paket update ini membawa source aplikasi Portal ALETA sampai `v1.4.15` tanpa menimpa setting server aktif.

File paket:

- `aleta-update-1.4.15.tar.gz`
- `aleta-update-1.4.15.tar.gz.sha256`
- `aleta-update-latest.json`
- `PANDUAN-INSTALL-ALETA-1.4.15-CENTOS7-DOCKER.md`

## 1. Isi Paket

Paket berisi source aplikasi Portal ALETA, termasuk:

- `src/`
- `public/`
- `drizzle/`
- `scripts/`
- `docs/`
- `e2e/`
- `package.json`
- `package-lock.json`
- file konfigurasi build/test frontend seperti `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `eslint.config.mjs`, `vitest.config.ts`, dan `playwright.config.ts`
- `aleta-update.json`

Paket sengaja tidak membawa setting/runtime server berikut:

- `.env`, `.env.local`, `.env.production`, dan semua `.env.*`
- `data/`
- `uploads/`
- `.wwebjs_auth/`
- `.wwebjs_cache/`
- `.next/`
- `node_modules/`
- `tmp/`
- `reports/`
- `test-results/`
- `.git/`
- `.vscode/`
- `.backup/`
- `.runtime-logs/`
- `.codex-logs/`
- file log `*.log`, `*.err.log`, `*.out.log`
- file screenshot/gambar runtime di root seperti `*.png`, `*.jpg`, `*.jpeg`, `*.webp`
- `*.pdf`, `*.tar`, `*.tar.gz`, `*.zip`, `*.bak*`, `*.swp`, `tsconfig.tsbuildinfo`
- `Dockerfile`, `docker-compose*.yml`, dan `next.config.ts` karena sering berisi setting deployment server aktif

Jika server Anda memang membutuhkan perubahan pada `Dockerfile`, `docker-compose`, atau `next.config.ts`, lakukan manual setelah membandingkan file lokal dan file server. Jangan langsung menimpa setting server aktif.

## 2. Upload Paket ke Server

Dari Windows PowerShell lokal:

```powershell
scp "D:\Download File\server aleta baru\aleta_server\manajemen_surat\releases\aleta-update-1.4.15.tar.gz" root@IP_SERVER:/root/
scp "D:\Download File\server aleta baru\aleta_server\manajemen_surat\releases\aleta-update-1.4.15.tar.gz.sha256" root@IP_SERVER:/root/
scp "D:\Download File\server aleta baru\aleta_server\manajemen_surat\releases\PANDUAN-INSTALL-ALETA-1.4.15-CENTOS7-DOCKER.md" root@IP_SERVER:/root/
```

Ganti `IP_SERVER` dengan IP/domain server.

## 3. Masuk SSH dan Tentukan Folder Aplikasi

```bash
ssh root@IP_SERVER
```

Masuk ke folder aplikasi. Contoh umum:

```bash
cd /var/www/html/aleta
pwd
ls -lah
```

Jika lokasi berbeda, gunakan lokasi aplikasi ALETA yang benar di server Anda.

Pastikan folder memiliki struktur aplikasi, misalnya ada `src`, `scripts`, `package.json`, atau container Docker portal.

## 4. Verifikasi Checksum Paket

```bash
cd /root
ls -lah aleta-update-1.4.15.tar.gz aleta-update-1.4.15.tar.gz.sha256
sha256sum -c aleta-update-1.4.15.tar.gz.sha256
```

Hasil yang benar:

```text
aleta-update-1.4.15.tar.gz: OK
```

Jika checksum gagal, jangan install paket. Upload ulang file `.tar.gz` dan `.sha256`.

## 5. Backup Sebelum Update

Walaupun script update membuat backup otomatis, tetap lakukan backup manual tambahan.

Backup source aplikasi tanpa runtime besar:

```bash
cd /var/www/html/aleta
mkdir -p ../aleta-backups
tar \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.git' \
  --exclude='./data' \
  --exclude='./uploads' \
  --exclude='./tmp' \
  --exclude='./reports' \
  --exclude='./.wwebjs_auth' \
  --exclude='./.wwebjs_cache' \
  -czf ../aleta-backups/aleta-before-1.4.15-$(date +%Y%m%d-%H%M%S).tar.gz .
```

Backup database sesuai SOP server. Contoh bila PostgreSQL berada di container bernama `postgres`:

```bash
docker-compose exec postgres pg_dump -U postgres aleta > /root/aleta-db-before-1.4.15-$(date +%Y%m%d-%H%M%S).sql
```

Sesuaikan nama container, user, dan database dengan server Anda.

## 6. Cara Install yang Direkomendasikan: Script Update ALETA

Jika server sudah memiliki `scripts/aleta-update.sh`, gunakan script ini karena aman untuk backup dan history.

Untuk CentOS 7 dengan `docker-compose` lama:

```bash
cd /var/www/html/aleta
ALETA_RUN_DB_MIGRATIONS=0 \
ALETA_REBUILD_CMD='docker-compose build portal' \
ALETA_RESTART_CMD='docker-compose up -d portal' \
bash scripts/aleta-update.sh /root/aleta-update-1.4.15.tar.gz
```

Untuk Docker Compose v2:

```bash
cd /var/www/html/aleta
ALETA_RUN_DB_MIGRATIONS=0 \
ALETA_REBUILD_CMD='docker compose build portal' \
ALETA_RESTART_CMD='docker compose up -d portal' \
bash scripts/aleta-update.sh /root/aleta-update-1.4.15.tar.gz
```

Catatan migrasi database:

- Default di atas memakai `ALETA_RUN_DB_MIGRATIONS=0` agar update source tidak menjalankan migrasi otomatis tanpa keputusan admin.
- Jika server memang siap menjalankan migrasi dari host, ubah menjadi `ALETA_RUN_DB_MIGRATIONS=1`.
- Jika Node/npm hanya ada di container, jalankan migrasi setelah rebuild dengan perintah pada bagian 8.

## 7. Jika Script Update Belum Ada di Server

Ambil script update dari paket tanpa menimpa setting server:

```bash
mkdir -p /root/aleta-update-preview
rm -rf /root/aleta-update-preview/*
tar -xzf /root/aleta-update-1.4.15.tar.gz -C /root/aleta-update-preview scripts/aleta-update.sh scripts/aleta-rollback.sh
cp /root/aleta-update-preview/scripts/aleta-update.sh /var/www/html/aleta/scripts/aleta-update.sh
cp /root/aleta-update-preview/scripts/aleta-rollback.sh /var/www/html/aleta/scripts/aleta-rollback.sh
chmod +x /var/www/html/aleta/scripts/aleta-update.sh /var/www/html/aleta/scripts/aleta-rollback.sh
```

Lalu ulangi bagian 6.

## 8. Migrasi Database Bila Diperlukan

Jika ada migration baru dan host server punya Node/npm:

```bash
cd /var/www/html/aleta
npm run db:migrate
```

Jika aplikasi hanya berjalan melalui Docker container:

```bash
cd /var/www/html/aleta
docker-compose exec portal npm run db:migrate
```

Atau Docker Compose v2:

```bash
docker compose exec portal npm run db:migrate
```

Jangan menjalankan migrasi destruktif tanpa backup database.

## 9. Rebuild dan Restart Container

Jika belum dilakukan oleh script update:

CentOS 7 / docker-compose lama:

```bash
cd /var/www/html/aleta
docker-compose build portal
docker-compose up -d portal
```

Docker Compose v2:

```bash
cd /var/www/html/aleta
docker compose build portal
docker compose up -d portal
```

Jika nama service bukan `portal`, cek dulu:

```bash
docker-compose ps
cat docker-compose.yml
```

Lalu ganti `portal` dengan nama service yang benar.

## 10. Verifikasi Setelah Install

Cek container:

```bash
cd /var/www/html/aleta
docker-compose ps
docker-compose logs --tail=150 portal
```

Cek endpoint dari server:

```bash
curl -I http://127.0.0.1:3000/login
curl -I http://127.0.0.1:3000/portal
```

Jika server memakai base path `/aleta`:

```bash
curl -I http://127.0.0.1:3000/aleta/login
curl -I http://127.0.0.1:3000/aleta/portal
```

Cek dari browser:

- Login page tampil normal.
- Patch Notes menampilkan `v1.4.15`.
- Login Super Admin berhasil.
- Logout kembali ke halaman login.
- Portal menampilkan modul sesuai role.
- Manajemen Surat dapat dibuka.
- ALETA Bot dapat dibuka dan tetap dry-run bila belum siap live.
- ALETA x SIPP dapat dibuka.
- ALETA Judicia / Legal Form dapat dibuka.
- Pusat Masukan dan Panduan sudah memuat rilis `v1.4.15`.

## 11. Jalankan Preflight

Jika npm tersedia di host:

```bash
cd /var/www/html/aleta
npm run preflight
```

Jika lewat container:

```bash
docker-compose exec portal npm run preflight
```

Hasil lokal/staging yang baik:

- Tidak ada `error` untuk database connection.
- Runtime database harus `postgres`, bukan fallback.
- Query Registry ALETA x SIPP dan JLF harus tersedia.
- Unsafe active query harus `0`.
- WhatsApp boleh warning jika dry-run aktif dan live gateway belum diuji.

Untuk staging-public/production, pastikan environment server memiliki:

```bash
BETTER_AUTH_SECRET=isi-secret-kuat-dari-server
DATABASE_URL=postgres://...
```

Jangan memakai secret lokal development untuk staging-public.

## 12. Hal yang Tidak Boleh Ditimpa

Jangan menimpa file/folder berikut dari lokal ke server aktif kecuali admin teknis memang sengaja mengubahnya:

- `.env`, `.env.local`, `.env.production`
- `data/`
- `uploads/`
- `.wwebjs_auth/`
- `.wwebjs_cache/`
- `node_modules/`
- `.next/`
- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.override.yml`
- `docker-compose.postgres.yml`
- `next.config.ts`

Paket ini sudah mengecualikan item tersebut.

## 13. Rollback Jika Bermasalah

Jika script rollback tersedia:

```bash
cd /var/www/html/aleta
bash scripts/aleta-rollback.sh
```

Jika rollback manual diperlukan:

```bash
cd /var/www/html
mkdir -p aleta-broken-$(date +%Y%m%d-%H%M%S)
# Simpan folder bermasalah dulu bila perlu, lalu ekstrak backup yang dibuat pada bagian 5.
```

Setelah rollback:

```bash
cd /var/www/html/aleta
docker-compose build portal
docker-compose up -d portal
docker-compose logs --tail=150 portal
```

## 14. Checklist UAT Setelah Update

1. Login gagal menampilkan pesan jelas.
2. Login Super Admin berhasil.
3. Logout menghapus session dan kembali ke login.
4. User tanpa login diarahkan ke login atau API mengembalikan 401.
5. Admin panel bisa dibuka oleh role berhak.
6. Manajemen Surat bisa dibuka dan data berasal dari database.
7. ALETA Bot memakai template/setting database dan tidak mengirim live bila dry-run aktif.
8. ALETA x SIPP membaca query registry database dan read-only.
9. JLF membaca variable/query registry database.
10. Upload/download file tetap terlindungi hak akses.
11. Patch Notes, Panduan, dan Pusat Masukan tampil versi `v1.4.15`.

## 15. Catatan Penting

- Lakukan update saat jam sepi atau window maintenance.
- Simpan paket, checksum, panduan, dan backup sampai aplikasi stabil.
- Jangan kirim WhatsApp live saat validasi awal kecuali gateway staging memang sudah disiapkan.
- Jangan menjalankan migrasi database tanpa backup.
- Jika ada error, kumpulkan `docker-compose logs --tail=200 portal`, hasil `npm run preflight`, dan screenshot halaman terkait.
