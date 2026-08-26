# Panduan Instalasi ALETA (Portal Manajemen Surat + WhatsApp Bot)

Paket ini berisi **seluruh kode aplikasi ALETA** tanpa konfigurasi rahasia,
database, file PDF, atau session WhatsApp. Satu paket melayani dua keperluan:

| Skenario | Untuk siapa | Yang terjadi |
|---|---|---|
| **FRESH** | Satker baru yang belum punya ALETA | Semua file dipasang, config diisi dari awal |
| **UPDATE** | Server yang sudah menjalankan ALETA | Hanya kode diperbarui; config & data dipertahankan |

`install.sh` mendeteksi sendiri skenario berdasarkan ada/tidaknya
`.env.production` di folder aplikasi.

---

## Prasyarat server (kedua skenario)

- Linux (teruji **CentOS 7**) dengan **Docker** + **docker compose** (atau `docker-compose`).
- Untuk fitur WhatsApp Bot: **MySQL/MariaDB** yang bisa diakses server
  (database internal `aleta_bot` + akses **read-only** ke database SIPP bila dipakai).
- Reverse proxy (Nginx/Apache) di host untuk menyajikan path `/aleta`.
- Ruang disk cukup untuk build image Docker (Node 20 + Chromium).

Isi paket:

```
aleta-installer-<versi>/
├── install.sh                ← installer pintar (fresh + update)
├── INSTALL.md                ← panduan ini
├── aleta-installer.json      ← manifest versi & checksum
└── app/                      ← seluruh file aplikasi
    ├── manajemen_surat/      (portal Next.js + Dockerfile)
    ├── aleta_bot/            (WhatsApp bot + Dockerfile + .env.example)
    ├── deploy/               (nginx, apache, sql schema)
    ├── scripts/              (backup, rollback, start/stop, dll.)
    ├── docs/                 (runbook & catatan teknis)
    ├── docker-compose.yml
    ├── docker-compose.override.yml
    └── .env.production.example
```

---

## A. FRESH INSTALL — satker baru

> Tujuan: memasang ALETA dari nol di server yang belum pernah ada ALETA.

### 1. Salin & ekstrak paket
```bash
# unggah aleta-installer-<versi>.tar.gz ke server, lalu:
tar -xzf aleta-installer-<versi>.tar.gz
cd aleta-installer-<versi>
```

### 2. Jalankan installer
```bash
sudo bash install.sh
```
Installer akan menyalin file ke `/var/www/html/aleta`, membuat folder data
persisten, dan menyiapkan `.env.production` dari template — **lalu berhenti**
(fresh install tidak di-build otomatis, karena Anda wajib mengisi config dulu).

> Ingin folder aplikasi berbeda? set env sebelum menjalankan, misal:
> `ALETA_APP_DIR=/opt/aleta sudo -E bash install.sh`

### 3. Isi konfigurasi rahasia
Edit `/var/www/html/aleta/.env.production`, ganti **semua** `CHANGE_ME_*`:

| Variabel | Isi dengan |
|---|---|
| `POSTGRES_PASSWORD` & `DATABASE_URL` | Password Postgres yang sama (kuat) |
| `BETTER_AUTH_SECRET` | String acak panjang — `openssl rand -hex 32` |
| `ALETA_BOT_INTERNAL_TOKEN` & `ALETA_BOT_INTERNAL_API_TOKEN` | **Nilai sama** di keduanya |
| `SERVER_IP`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS` | IP/alamat server satker Anda |
| `ALETA_BOT_DB_*` (SIPP, antrian, aps) | Host/nama/kredensial DB MySQL setempat (SIPP **read-only**) |
| `GEMINI_API_KEY` | Opsional, hanya bila memakai fitur AI |

Bila IP satker **bukan** `192.168.10.10`, sesuaikan juga baris IP di
`/var/www/html/aleta/docker-compose.yml`
(`BETTER_AUTH_URL: http://<IP-ANDA>/aleta`).

### 4. Siapkan database MySQL untuk ALETA Bot
Sebagai DBA MySQL (ganti dulu password placeholder di dalam file SQL):
```bash
mysql -u root -p < /var/www/html/aleta/deploy/sql/setup-aleta-mysql-databases.sql
mysql -u root -p < /var/www/html/aleta/deploy/sql/schema-aleta-bot-mysql.sql
```
> Database portal PostgreSQL dibuat otomatis oleh container `postgres`,
> dan skema tabelnya dimigrasi otomatis saat portal pertama kali menyala.

### 5. Build & jalankan
```bash
cd /var/www/html/aleta
docker compose build
docker compose up -d
docker compose ps      # tunggu status semua service "healthy"
```

### 6. Reverse proxy
Tempel `deploy/nginx/aleta.conf` (atau `deploy/apache/aleta.conf`) ke konfigurasi
web server host, arahkan `/aleta` → `127.0.0.1:3000`, lalu reload web server.

### 7. Setup awal via browser
Buka `http://<IP-SERVER>/aleta`. Karena database masih kosong, aplikasi
menampilkan **Wizard Setup** untuk membuat **identitas instansi** dan
**akun Super Admin pertama**. Setelah itu login dan konfigurasikan ALETA Bot.

### 8. Aktifkan WhatsApp Bot
Login Super Admin → **Pengaturan ALETA → ALETA Bot → Mode Lanjutan → tab
WhatsApp** → hubungkan → **scan QR** dengan HP kantor (sesi tersimpan permanen).

---

## B. UPDATE — server yang sudah berjalan

> Tujuan: memperbarui kode ALETA tanpa mengganggu config, database, PDF,
> maupun session WhatsApp yang sudah aktif.

### 1. Salin & ekstrak paket di server
```bash
tar -xzf aleta-installer-<versi>.tar.gz
cd aleta-installer-<versi>
```

### 2. Jalankan installer
```bash
sudo bash install.sh
```
Karena `.env.production` sudah ada, installer masuk **mode UPDATE**:
1. Membuat **backup otomatis** (database + PDF + file aplikasi) ke
   `/var/www/html/aleta-backup`.
2. Menyalin kode baru (`manajemen_surat`, `aleta_bot`, `deploy`, `scripts`,
   `docs`, `.env.production.example`).
3. **Tidak menyentuh** `.env.production`, `docker-compose.yml`, database,
   PDF, atau session WhatsApp.
4. `docker compose build portal aleta_bot` lalu `docker compose up -d`.

Jalankan tanpa tanya-jawab (untuk otomasi):
```bash
ALETA_ASSUME_YES=1 sudo -E bash install.sh
```

### 3. Verifikasi
```bash
cd /var/www/html/aleta
docker compose ps                       # semua "healthy"
docker compose logs -f --tail=100       # pantau log
```

### 4. Bila perlu rollback
```bash
bash /var/www/html/aleta/scripts/aleta-rollback.sh
```
atau pulihkan manual dari `app-before-update-<timestamp>.tar.gz` di folder backup.

> **Catatan:** mode UPDATE sengaja **tidak** menimpa `docker-compose.yml`.
> Bila rilis ini menyertakan perubahan compose (mis. healthcheck/timezone),
> terapkan manual dengan membandingkan `app/docker-compose.yml` di paket
> terhadap milik server.

### 5. Lampiran dokumen gugatan SIPP (perlu langkah manual)

Agar dokumen gugatan (`petitum_dok`) ikut terkirim ke penggugat/tergugat,
container bot harus bisa **membaca** folder dokumen SIPP. Karena UPDATE tidak
menimpa `docker-compose.yml`, tambahkan sendiri baris ini pada `volumes:`
service `aleta_bot` (sesuaikan path kiri dengan docroot SIPP satker):

```yaml
      - /var/www/html/SIPP:/usr/src/app/SIPP:ro
```

Tanda `:ro` wajib — akses SIPP harus tetap read-only. Lalu `docker compose up -d`
dan uji tanpa mengirim pesan apa pun:

```bash
docker compose exec aleta_bot node scripts/check-sipp-document.js
```

Skrip melaporkan tiap dokumen sebagai `OK/lok` (terbaca dari mount), `OK/url`
(terbaca lewat `ALETA_BOT_SIPP_DOCUMENT_BASE_URL`), atau `GAGAL` beserta
sebabnya. Bila gagal, pesan tetap terkirim sebagai **teks tanpa lampiran** dan
dicatat di log sistem sebagai `queue_attachment_unavailable`.

---

## Perbedaan singkat kedua mode

| Item | FRESH | UPDATE |
|---|---|---|
| Menyalin seluruh file | ✅ | ✅ (kecuali config) |
| `.env.production` | Dibuat dari template, diisi operator | **Dipertahankan** |
| `docker-compose.yml` | Disalin, operator sesuaikan IP | **Dipertahankan** |
| Database / PDF / session WA | Baru / kosong | **Dipertahankan** |
| Build otomatis | ❌ (operator setelah isi config) | ✅ |
| Backup sebelum jalan | — | ✅ otomatis |

## Keamanan paket

- Tidak berisi `.env.production`, `.env` bot, password, token, atau API key.
- Tidak berisi `node_modules`, `.next`, database, PDF, atau session WhatsApp.
- Integritas paket bisa dicek: `sha256sum -c aleta-installer-<versi>.tar.gz.sha256`.
