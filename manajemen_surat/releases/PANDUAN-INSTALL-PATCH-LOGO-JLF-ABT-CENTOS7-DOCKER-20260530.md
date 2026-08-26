# Panduan Install Patch Logo + JLF/ABT ALETA di CentOS 7 Docker

Paket:

- `aleta-combined-logo-jlf-abt-fix-20260530-r2.tar.gz`
- `aleta-combined-logo-jlf-abt-fix-20260530-r2.tar.gz.sha256`

Checksum SHA256 ada di file `.sha256` yang dikirim bersama paket. Setelah file disalin ke server, lihat nilainya dengan:

```bash
cat aleta-combined-logo-jlf-abt-fix-20260530-r2.tar.gz.sha256
```

Panduan ini untuk server CentOS 7 yang menjalankan ALETA via Docker Compose, dengan folder aplikasi contoh:

```bash
/var/www/html/aleta
```

Jika folder server berbeda, sesuaikan semua path.

## 1. Upload Paket ke Server

Dari komputer lokal Windows:

```powershell
scp "D:\Download File\server aleta baru\aleta_server\.tmp\deploy\aleta-combined-logo-jlf-abt-fix-20260530-r2.tar.gz" root@IP_SERVER:/root/
scp "D:\Download File\server aleta baru\aleta_server\.tmp\deploy\aleta-combined-logo-jlf-abt-fix-20260530-r2.tar.gz.sha256" root@IP_SERVER:/root/
```

Ganti `IP_SERVER` dengan IP server, misalnya `192.168.10.10`.

## 2. Masuk SSH dan Cek Service

```bash
ssh root@IP_SERVER
cd /var/www/html/aleta
docker-compose config --services
docker-compose ps
```

Panduan ini memakai nama service `portal`. Jika hasil `docker-compose config --services` berbeda, ganti `portal` dengan nama service aplikasi web yang benar.

## 3. Verifikasi Checksum Paket

```bash
cd /root
sha256sum -c aleta-combined-logo-jlf-abt-fix-20260530-r2.tar.gz.sha256
```

Hasil yang benar:

```text
aleta-combined-logo-jlf-abt-fix-20260530-r2.tar.gz: OK
```

Jika tidak `OK`, hentikan proses dan upload ulang paket.

## 4. Backup Sebelum Patch

Backup source aplikasi dan konfigurasi penting:

```bash
cd /var/www/html/aleta
mkdir -p /var/www/html/aleta-backups

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
  -czf /var/www/html/aleta-backups/aleta-before-logo-jlf-abt-$(date +%Y%m%d-%H%M%S).tar.gz .

cp -a docker-compose.yml /var/www/html/aleta-backups/docker-compose.yml.before-logo-jlf-abt-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
cp -a .env.production /var/www/html/aleta-backups/.env.production.before-logo-jlf-abt-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
```

Backup database PostgreSQL juga disarankan. Jika database ada di service `postgres`:

```bash
cd /var/www/html/aleta
docker-compose exec -T postgres pg_dump -U postgres aleta > /var/www/html/aleta-backups/aleta-db-before-logo-jlf-abt-$(date +%Y%m%d-%H%M%S).sql
```

Jika user, database, atau service PostgreSQL berbeda, sesuaikan perintah `pg_dump`.

## 5. Ekstrak Patch

Pastikan posisi berada di root aplikasi:

```bash
cd /var/www/html/aleta
tar -xzf /root/aleta-combined-logo-jlf-abt-fix-20260530-r2.tar.gz
```

Paket ini hanya membawa file patch. Paket tidak membawa `.env.production`, database, upload, PDF, session WhatsApp, `node_modules`, atau `.next`.

## 6. Jalankan Migrasi Database

Patch JLF/ABT membawa migration Drizzle. Jalankan migrasi dari container `portal` setelah source diekstrak:

```bash
cd /var/www/html/aleta
docker-compose run --rm portal npm run db:migrate
```

Jika server memakai Docker Compose v2:

```bash
docker compose run --rm portal npm run db:migrate
```

Jika database migration dikelola manual oleh admin database, jangan skip diam-diam. Pastikan minimal migration berikut sudah masuk:

```text
manajemen_surat/drizzle/0004_jlf_variable_query_preview.sql
```

## 7. Rebuild dan Restart Portal

Untuk CentOS 7 yang biasanya memakai `docker-compose` lama:

```bash
cd /var/www/html/aleta
docker-compose build portal
docker-compose up -d portal
```

Jika memakai Docker Compose v2:

```bash
docker compose build portal
docker compose up -d portal
```

Jika perubahan Bot juga ingin direstart karena integrasi JLF/SIPP:

```bash
docker-compose restart aleta_bot
```

Ganti `aleta_bot` jika nama servicenya berbeda.

## 8. Verifikasi Setelah Install

Cek container dan log:

```bash
cd /var/www/html/aleta
docker-compose ps
docker-compose logs --tail=120 portal
```

Cek route lokal:

```bash
curl -I http://127.0.0.1:3000/login
curl -I http://127.0.0.1:3000/aleta/login
curl -I http://127.0.0.1:3000/aleta/judicia/legal-form
```

Buka dari browser:

```text
http://IP_SERVER/aleta/login
http://IP_SERVER/aleta/judicia/legal-form
```

Yang perlu dicek:

- logo login tidak punya kotak/bayangan putih di belakang logo;
- JLF bisa mencari nomor perkara mulai 1 karakter;
- klik baris perkara langsung aktif;
- pilihan sidang tampil sebagai panel compact, bukan dropdown native terang;
- label tabel variabel memakai `Hasil Variabel`;
- edit nilai sederhana bisa inline;
- tombol unduh draft tetap terlihat setelah draft dibuat;
- perkara yang punya jadwal di `perkara_jadwal_sidang` atau `jadwalsidangweb` tampil di panel sidang, misalnya perkara `302/Pdt.G/2026/PA.Dgl` membaca jadwal `2026-06-08` jika data SIPP server sama dengan backup lokal;
- variabel ABT `multi_sidang`, `tanggal_hijriah`, dan `data_sql` mengikuti data dari `abt_variabel.xls` dan `abt_variabel_tipe.xls`;
- query ABT yang memakai dependency seperti `#0033#` memakai nilai mentah SQL, misalnya tanggal `2026-06-08`, sementara tampilan dokumen tetap memakai format Indonesia/Hijriah.

## 9. Jika Gagal Build atau Aplikasi Tidak Naik

Jangan lanjut `up -d` berkali-kali tanpa membaca error. Cek:

```bash
cd /var/www/html/aleta
docker-compose logs --tail=200 portal
docker-compose build portal
```

Jika perlu rollback source dari backup:

```bash
cd /var/www/html
mkdir -p /root/aleta-rollback-work
tar -xzf /var/www/html/aleta-backups/NAMA_BACKUP_SEBELUM_PATCH.tar.gz -C /root/aleta-rollback-work
```

Rollback terbaik mengikuti SOP server masing-masing. Jangan menghapus folder data persistent:

- `/var/www/html/aleta-data`
- `/var/www/html/aleta-pdf`
- `.wwebjs_auth`
- volume PostgreSQL

## 10. Catatan CentOS 7

CentOS 7 sudah EOL, jadi lakukan update saat jam sepi dan simpan backup. Jangan membuka port `3000` atau `3003` ke publik jika server memakai reverse proxy `/aleta`.
