# Panduan Install Paket ALETA 1.4.5 di SSH Linux CentOS 7

Paket ini adalah paket update kumulatif aman dari baseline ALETA `1.2.1` sampai versi terbaru `1.4.5`.

File paket:

- `aleta-update-1.4.5.tar.gz`
- `aleta-update-1.4.5.tar.gz.sha256`
- `aleta-update-latest.json`

Checksum SHA256:

```bash
2d3dba9b761990ff078490faa7a6bdde62c00d47521af3ba334369aad3b46d95  aleta-update-1.4.5.tar.gz
```

Paket ini sengaja tidak membawa `.env`, config server lokal, database, uploads, PDF, session WhatsApp, `node_modules`, `.next`, logs, dan folder runtime lain.

## 1. Upload Paket ke Server

Dari komputer lokal, upload paket dan checksum ke server.

Contoh dari PowerShell Windows:

```powershell
scp "D:\Download File\server aleta baru\aleta_server\manajemen_surat\releases\aleta-update-1.4.5.tar.gz" root@IP_SERVER:/root/
scp "D:\Download File\server aleta baru\aleta_server\manajemen_surat\releases\aleta-update-1.4.5.tar.gz.sha256" root@IP_SERVER:/root/
```

Ganti `IP_SERVER` dengan IP/domain server ALETA.

## 2. Masuk SSH

```bash
ssh root@IP_SERVER
```

Masuk ke folder aplikasi ALETA:

```bash
cd /var/www/html/aleta
pwd
ls -lah
```

Pastikan file script update ada:

```bash
ls -lah scripts/aleta-update.sh
```

## 3. Cek Paket dan Checksum

```bash
cd /root
ls -lah aleta-update-1.4.5.tar.gz aleta-update-1.4.5.tar.gz.sha256
sha256sum -c aleta-update-1.4.5.tar.gz.sha256
```

Hasil yang benar:

```text
aleta-update-1.4.5.tar.gz: OK
```

## 4. Backup Manual Tambahan

Script update akan membuat backup otomatis. Namun sebelum update besar, tetap disarankan backup manual tambahan.

```bash
cd /var/www/html/aleta
mkdir -p ../aleta-backups
tar \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.git' \
  --exclude='./.wwebjs_auth' \
  --exclude='./.wwebjs_cache' \
  --exclude='./data' \
  --exclude='./uploads' \
  --exclude='./tmp' \
  --exclude='./reports' \
  -czf ../aleta-backups/aleta-before-1.4.5-$(date +%Y%m%d-%H%M%S).tar.gz .
```

Backup database juga disarankan sesuai SOP server masing-masing.

## 5. Jalankan Update Resmi

Untuk server CentOS 7 yang memakai `docker-compose` lama:

```bash
cd /var/www/html/aleta
ALETA_RUN_DB_MIGRATIONS=1 \
ALETA_REBUILD_CMD='docker-compose build portal' \
ALETA_RESTART_CMD='docker-compose up -d portal' \
bash scripts/aleta-update.sh /root/aleta-update-1.4.5.tar.gz
```

Jika server memakai Docker Compose v2:

```bash
cd /var/www/html/aleta
ALETA_RUN_DB_MIGRATIONS=1 \
ALETA_REBUILD_CMD='docker compose build portal' \
ALETA_RESTART_CMD='docker compose up -d portal' \
bash scripts/aleta-update.sh /root/aleta-update-1.4.5.tar.gz
```

Catatan:

- Gunakan `ALETA_RUN_DB_MIGRATIONS=1` bila server memang memakai migrasi database ALETA dari source.
- Jika migrasi database dikelola manual oleh admin database, set ke `0` dan jalankan migrasi sesuai SOP.

## 6. Jika Script Update Belum Ada

Jika server sangat lama dan belum punya `scripts/aleta-update.sh`, ekstrak paket sementara untuk mengambil script terlebih dahulu:

```bash
mkdir -p /root/aleta-update-preview
tar -xzf /root/aleta-update-1.4.5.tar.gz -C /root/aleta-update-preview scripts/aleta-update.sh
cp /root/aleta-update-preview/scripts/aleta-update.sh /var/www/html/aleta/scripts/aleta-update.sh
chmod +x /var/www/html/aleta/scripts/aleta-update.sh
```

Lalu ulangi langkah update resmi pada bagian 5.

## 7. Verifikasi Setelah Update

Cek container:

```bash
cd /var/www/html/aleta
docker-compose ps
docker-compose logs --tail=120 portal
```

Jika memakai Docker Compose v2:

```bash
docker compose ps
docker compose logs --tail=120 portal
```

Cek halaman utama dari server:

```bash
curl -I http://127.0.0.1:3000/login
curl -I http://127.0.0.1:3000/portal
```

Jika server memakai base path `/aleta`, cek juga:

```bash
curl -I http://127.0.0.1:3000/aleta/login
curl -I http://127.0.0.1:3000/aleta/portal
```

Validasi dari browser:

- `/login` atau `/aleta/login`
- `/portal` atau `/aleta/portal`
- Patch Notes harus menampilkan `v1.4.5`
- Panduan harus memuat JLF, E-Status, SIPP, APS Badilag, dan integrasi
- ALETA Judicia / Legal Form
- E-Status
- E-Kepegawaian
- Admin > Audit Trail
- Admin > Akses Menu per Role
- Admin > Manajemen Akun

## 8. Hal yang Harus Dicek Khusus

1. Login dan logout kembali ke halaman login.
2. Patch Notes dari `1.2.1` sampai `1.4.5` tampil.
3. Panduan JLF, E-Status, SIPP/APS Badilag tampil.
4. Dropdown jenis perkara JLF lengkap.
5. E-Status masuk ke daftar aplikasi sesuai role.
6. SIPP dan APS Badilag muncul jika role diberi akses.
7. Audit Trail mencatat proses penting.
8. Ringkasan Kerja, Tugas, dan Notifikasi Portal tetap tampil.

## 9. Rollback Jika Bermasalah

Jika setelah update aplikasi tidak berjalan dan perlu kembali ke backup terakhir:

```bash
cd /var/www/html/aleta
bash scripts/aleta-rollback.sh
```

Jika rollback script meminta konfirmasi, baca nama backup yang akan dipakai sebelum mengetik `YES`.

Setelah rollback:

```bash
docker-compose build portal
docker-compose up -d portal
docker-compose logs --tail=120 portal
```

## 10. Catatan Penting

- Jangan copy `.env.local` dari komputer lokal ke server.
- Jangan menimpa `next.config.ts`, Dockerfile, atau docker-compose server kecuali admin teknis memang memutuskan begitu.
- Jangan ikut upload folder `node_modules`, `.next`, `uploads`, `data`, `aleta-pdf`, atau `.wwebjs_auth`.
- Pastikan update dilakukan saat jam sepi atau jadwal maintenance.
- Simpan paket `.tar.gz`, checksum, dan backup sampai update dinyatakan stabil.
