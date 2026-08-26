# Panduan Deploy Patch ALETA di CentOS 7 Docker

Dokumen ini untuk patch aplikasi ALETA yang sudah berjalan di server Linux CentOS 7.
Tujuannya memperbarui kode tanpa menghapus database, upload PDF, laporan, atau sesi WhatsApp.

## Ringkasan Konfigurasi

File utama deployment:

- `docker-compose.yml`: service utama `postgres`, `portal`, dan `aleta_bot`.
- `docker-compose.override.yml`: mount runtime config `aleta_bot` ke `/usr/src/app/runtime-data`.
- `.env.production`: secret dan koneksi production. Jangan diganti dari laptop kalau server sudah jalan.
- `manajemen_surat/Dockerfile`: build portal Next.js.
- `aleta_bot/Dockerfile`: build runtime WhatsApp bot dengan Chromium.
- `deploy/nginx/aleta.conf` atau `deploy/apache/aleta.conf`: reverse proxy host untuk path `/aleta`.

Catatan:

- Warning `version is obsolete` dari `docker-compose.override.yml` tidak kritis untuk Docker Compose baru.
- Jika server CentOS 7 memakai `docker-compose` lama dan aplikasi sudah berjalan, biarkan format compose yang ada.
- Jangan jalankan `docker compose config` di terminal publik karena perintah itu menampilkan env yang sudah diekspansi.
- Folder database PostgreSQL dan folder PDF tidak harus sama. Database menyimpan metadata/path surat, sedangkan file PDF fisik dibaca dari folder host `/var/www/html/aleta-pdf` yang dimount ke container portal sebagai `/app/uploads/pdf`.
- Token internal wajib sama di service `portal` dan `aleta_bot`. Gunakan `ALETA_BOT_INTERNAL_API_TOKEN` atau `ALETA_BOT_INTERNAL_TOKEN` dengan nilai yang sama di kedua container.
- Sejak patch launching Juli 2026: semua service memakai `TZ=Asia/Makassar`, scheduler cron bot dipaksa timezone `Asia/Makassar` (override via `ALETA_BOT_CRON_TIMEZONE`), bot punya endpoint `GET /health` tanpa token, dan ketiga service punya `healthcheck` Docker (cek via `docker ps` kolom STATUS atau `docker inspect --format '{{.State.Health.Status}}' aleta-bot`).
- AI production wajib memakai env key di container `aleta_bot`, misalnya `ALETA_BOT_AI_API_KEY_ENV=GEMINI_API_KEY` dan `GEMINI_API_KEY=...`. Jangan mengandalkan secret AI volatile hasil sync manual karena bisa hilang setelah restart.

## File yang Perlu Dicopy via FileZilla

Copy file berikut ke folder aplikasi server, biasanya:

`/var/www/html/aleta`

File patch fitur utama:

- `docker-compose.yml`
- `.env.production.example` (referensi variabel, jangan menimpa `.env.production` server)
- `manajemen_surat/Dockerfile`
- `manajemen_surat/.dockerignore`
- `manajemen_surat/package.json`
- `manajemen_surat/package-lock.json`
- `manajemen_surat/src/app/page.tsx`
- `manajemen_surat/src/lib/auth.ts`
- `manajemen_surat/src/lib/patch-notes.ts`
- `manajemen_surat/src/lib/user-guides.ts`
- `manajemen_surat/src/server/shared/pdf-storage.ts`
- `manajemen_surat/src/app/api/uploads/pdf/route.ts`
- `manajemen_surat/src/app/api/pdf-content/route.ts`
- `manajemen_surat/src/lib/pdf-viewer-route.ts`
- `manajemen_surat/src/lib/pdf-binary.ts`
- `manajemen_surat/src/components/pdf/pdf-live-viewer.tsx`
- `manajemen_surat/src/components/ui/button.tsx`
- `manajemen_surat/src/components/portal/document-viewer.tsx`
- `manajemen_surat/src/components/portal/letter-registration-panel.tsx`
- `manajemen_surat/src/components/portal/aleta-bot-dashboard.tsx`
- `manajemen_surat/src/app/(portal)/surat/page.tsx`
- `aleta_bot/app.js`
- `aleta_bot/routes/internalGatewayRoutes.js`
- `manajemen_surat/src/components/portal/aleta-bot-admin.tsx`
- `manajemen_surat/src/components/portal/admin-panels.tsx`
- `manajemen_surat/src/server/db/schema.ts`
- `manajemen_surat/src/server/modules/users/service.ts`
- `manajemen_surat/src/server/modules/aleta-bot/service.ts`

File test yang ikut berubah dan boleh dicopy bila server menyimpan source lengkap:

- `manajemen_surat/src/test/auth-session.test.ts`
- `manajemen_surat/src/test/root-redirect.test.ts`
- `manajemen_surat/src/test/pdf-storage.test.ts`
- `manajemen_surat/src/test/document-viewer.test.tsx`
- `manajemen_surat/src/test/letter-draft-ai.test.ts`
- `manajemen_surat/src/test/backend-db.test.ts`
- `manajemen_surat/src/test/aleta-bot-settings.test.ts`
- `manajemen_surat/src/test/button-wiring.test.tsx`
- `manajemen_surat/src/test/patch-notes.test.ts`
- `manajemen_surat/src/test/user-guides.test.ts`

File script operasional:

- `scripts/docker-start-aleta.sh`
- `scripts/docker-backup-aleta.sh`

File dokumentasi opsional:

- `docs/CENTOS7_DEPLOY_PATCH.md`

File konfigurasi yang boleh dicopy hanya jika memang berubah sengaja:

- `docker-compose.override.yml`
- `manajemen_surat/Dockerfile`
- `aleta_bot/Dockerfile`
- `deploy/nginx/aleta.conf`
- `deploy/nginx/aleta-container.conf`
- `deploy/apache/aleta.conf`
- `scripts/docker-restart-aleta.sh`
- `scripts/docker-status-aleta.sh`

## File yang Jangan Dicopy / Jangan Ditimpa

Jangan timpa file/folder berikut di server production:

- `.env.production`
- `manajemen_surat/.env.local`
- `aleta_bot/.env`
- `/var/www/html/aleta-data/postgres`
- `/var/www/html/aleta-data/uploads`
- `/var/www/html/aleta-pdf`
- `/var/www/html/aleta-data/reports`
- `/var/www/html/aleta-data/wwebjs_auth`
- `/var/www/html/aleta-data/aleta-bot-runtime`
- `manajemen_surat/data/aleta-bot-runtime.json`
- `node_modules`
- `.next`
- `.wwebjs_auth`

Alasannya: file/folder tersebut berisi secret, database, upload PDF, report, build output lama, dan sesi WhatsApp.

## Persiapan Server

Masuk ke server:

```bash
ssh root@192.168.10.10
cd /var/www/html/aleta
```

Buat backup cepat sebelum menimpa file:

```bash
BACKUP_DIR="/var/www/html/aleta-backup-$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP_DIR"
cp -a docker-compose.yml docker-compose.override.yml .env.production manajemen_surat/src aleta_bot/app.js aleta_bot/routes "$BACKUP_DIR"/ 2>/dev/null || true
```

Pastikan folder data non-database tetap ada:

```bash
mkdir -p /var/www/html/aleta-data/uploads
mkdir -p /var/www/html/aleta-pdf
mkdir -p /var/www/html/aleta-data/reports
mkdir -p /var/www/html/aleta-data/wwebjs_auth
mkdir -p /var/www/html/aleta-data/aleta-bot-runtime
```

Untuk folder database PostgreSQL, jangan buat/mindahkan folder baru jika server sudah berjalan. Cek mount database aktif dulu:

```bash
docker inspect aleta-postgres --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'
```

Pastikan source yang menuju `/var/lib/postgresql/data` tetap memakai folder database lama server.

## Deploy Patch via FileZilla

1. Buka FileZilla.
2. Masuk ke server.
3. Remote path: `/var/www/html/aleta`.
4. Upload file patch sesuai daftar "File yang Perlu Dicopy".
5. Jangan upload folder `node_modules`, `.next`, `.git`, `.env.production`, atau folder data.

## Rebuild dan Restart Container

Setelah file selesai dicopy:

```bash
cd /var/www/html/aleta
rm -rf manajemen_surat/node_modules manajemen_surat/.next
docker-compose build --no-cache portal aleta_bot
docker-compose up -d portal aleta_bot
docker-compose ps
```

Jika hanya ingin restart tanpa rebuild, gunakan:

```bash
docker-compose restart portal aleta_bot
docker-compose ps
```

Untuk patch TypeScript/Next.js, rebuild `portal` wajib.
Untuk patch `aleta_bot/app.js` atau route bot, rebuild/recreate `aleta_bot` disarankan.

## Cek Setelah Restart

Cek container:

```bash
docker-compose ps
```

Cek log portal:

```bash
docker-compose logs --tail=120 portal
```

Cek log bot:

```bash
docker-compose logs --tail=160 aleta_bot
```

Cek port lokal:

```bash
ss -ltnp | grep -E ':(3000|3003)\b' || netstat -ltnp | grep -E ':(3000|3003)\b'
```

Cek portal:

```bash
curl -I http://127.0.0.1:3000/aleta/login
curl -I http://127.0.0.1:3000/aleta
```

Saat belum login, akses `/aleta` diarahkan ke `/aleta/login`. Saat sesi login masih aktif, akses `/aleta` diarahkan ke `/aleta/portal`.

Durasi sesi login portal disetel 1 jam. Setelah patch session diterapkan, pengguna yang masih membawa cookie lama mungkin perlu login ulang sekali agar mendapatkan masa sesi baru.

Jika browser menampilkan `ERR_TOO_MANY_REDIRECTS` saat membuka `/aleta`, pastikan file `manajemen_surat/src/components/layout/portal-shell-v2.tsx` terbaru sudah dicopy dan portal sudah direbuild. Proteksi login utama dilakukan di server layout; shell portal tidak boleh memantulkan pengguna kembali ke login hanya karena state frontend masih sinkron.

Selain itu, cek reverse proxy host. Jangan ada aturan yang mengubah `/aleta` menjadi `/aleta/`, karena Next.js akan mengembalikan `/aleta/` ke `/aleta` dan browser bisa masuk loop redirect. Konfigurasi terbaru di `deploy/apache/aleta.conf`, `deploy/nginx/aleta.conf`, dan `deploy/nginx/aleta-container.conf` sudah mem-proxy exact path `/aleta` langsung ke backend.

Cek endpoint login Better Auth:

```bash
curl -i -sS -X POST http://127.0.0.1:3000/aleta/api/auth/sign-in/email \
  -H 'content-type: application/json' \
  --data '{"email":"superderry@gmail.com","password":"PASSWORD_BARU","rememberMe":true}' | head -n 30
```

Jika masih `404 Not Found`, rebuild portal dari patch terbaru. Saat aplikasi berjalan di base path `/aleta`, Next.js menerima request publik `/aleta/api/auth/...`, lalu route handler internal tetap menyerahkannya ke Better Auth sebagai `/api/auth/...`.

Cek status bot internal:

```bash
TOKEN="$(grep '^ALETA_BOT_INTERNAL_TOKEN=' .env.production | cut -d= -f2-)"
curl -sS -H "x-aleta-internal-token: $TOKEN" http://127.0.0.1:3003/internal/aleta-bot/status
curl -sS -H "x-aleta-internal-token: $TOKEN" http://127.0.0.1:3003/internal/aleta-bot/security/token-health
```

Hasil `token-health` harus menunjukkan `status: ok`. Jika `401/403`, samakan token internal di `.env.production` untuk service `portal` dan `aleta_bot`, lalu jalankan ulang `docker compose up -d portal aleta_bot`.

Jangan paste output status penuh ke chat publik karena bisa berisi metadata internal.

## Cek Fitur Utama dari UI

1. Login sebagai Super Admin.
2. Buka Manajemen Surat.
3. Upload surat masuk dengan PDF.
4. Setelah submit, daftar surat masuk harus refresh dan surat baru muncul.
5. Buka detail surat, PDF harus tampil di viewer/smart view.
6. Tekan Unduh, file PDF harus terdownload.
7. Buka Admin -> ALETA Bot.
8. Buka Pengaturan, aktifkan Bot Aktif, isi nomor admin WhatsApp bila perlu, lalu Simpan.
9. Modal tidak boleh bertanya perubahan belum disimpan setelah save.
10. Dashboard runtime harus refresh. Jika runtime belum reachable, tampil warning, bukan diam-diam gagal.
11. Buka Mapping User Jabatan dengan filter nomor WhatsApp. Nomor `812...`, `0812...`, dan `62812...` harus tersimpan sebagai `62...`.
12. Jika semua pegawai aktif sudah punya nomor valid, status kesiapan nomor WhatsApp harus hijau.

## Troubleshooting Cepat

Jika portal tidak bisa dibuka:

```bash
docker-compose logs --tail=200 portal
```

Jika build portal gagal di langkah `npm ci` dengan pesan `Exit handler never called`, biasanya masalahnya ada di jaringan/DNS Docker saat mengambil paket npm atau cache npm lama. Cek dari server:

```bash
docker run --rm node:20-bookworm-slim sh -lc "cat /etc/resolv.conf; getent hosts registry.npmjs.org; npm view next version --registry=https://registry.npmjs.org/ --fetch-timeout=30000"
```

Jika perintah di atas gagal atau sangat lama, perbaiki DNS Docker di server. Buat atau edit `/etc/docker/daemon.json`:

```bash
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "dns": ["1.1.1.1", "8.8.8.8"]
}
EOF
```

Lalu restart Docker pada waktu aman karena container akan ikut restart:

```bash
systemctl restart docker
cd /var/www/html/aleta
docker-compose up -d postgres aleta_bot portal
docker-compose build --no-cache portal
docker-compose up -d portal
```

Jika jaringan kantor memblokir `1.1.1.1` atau `8.8.8.8`, gunakan DNS gateway/router kantor, misalnya `192.168.10.1`, di `/etc/docker/daemon.json`.

Jika PDF tidak tampil:

```bash
ls -lah /var/www/html/aleta-data/uploads
ls -lah /var/www/html/aleta-data/uploads/pdf
ls -lah /var/www/html/aleta-pdf
docker-compose logs --tail=120 portal
```

Cek apakah metadata PDF sudah tersimpan di database:

```bash
docker-compose exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT id, nomor_surat, document_file_name, document_file_path, document_size_mb
FROM letters
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
"'
```

Jika `document_file_path` berisi `/uploads/pdf/nama-file.pdf` tetapi preview tetap kosong, pastikan patch `manajemen_surat/src/server/modules/letters/service.ts` terbaru sudah direbuild. Endpoint daftar surat harus tetap mengirim `documentUrl`, karena halaman detail surat dan disposisi membaca state daftar yang disinkronkan dari `/api/surat?pageSize=100`.

Di production, file PDF surat disimpan sebagai file fisik persisten di:

`/var/www/html/aleta-pdf`

Database menyimpan metadata dan path file pada tabel surat, bukan blob PDF penuh. Path baru memakai format `/uploads/pdf/nama-file.pdf`, dan path lama `/aleta-pdf/nama-file.pdf` tetap bisa dibaca oleh preview. Karena itu folder `/var/www/html/aleta-pdf` tidak boleh ditimpa saat patch.

Jika AI tidak merespons:

```bash
docker-compose logs --tail=160 portal
docker-compose logs --tail=160 aleta_bot
```

Lalu cek dari UI Super Admin:

- Pengaturan AI global aktif.
- Provider aktif punya API key.
- Env key AI tersedia di container `aleta_bot`, contoh `ALETA_BOT_AI_API_KEY_ENV=GEMINI_API_KEY` dan `GEMINI_API_KEY=...`.
- Dashboard Admin ALETA Bot tidak menunjukkan AI `needs_sync` atau `error`; jika muncul, perbaiki env key lalu sync ulang AI config.
- Status koneksi provider connected.
- Fitur Manajemen Surat AI, Disposisi AI, Mail Intelligence, dan Draft Metadata aktif.

Jika bot aktif tetap tidak berubah:

```bash
docker-compose logs --tail=200 aleta_bot
TOKEN="$(grep '^ALETA_BOT_INTERNAL_TOKEN=' .env.production | cut -d= -f2-)"
curl -sS -H "x-aleta-internal-token: $TOKEN" http://127.0.0.1:3003/internal/aleta-bot/status
```

Jika WhatsApp minta QR ulang, jangan hapus folder:

`/var/www/html/aleta-data/wwebjs_auth`

Cek dulu log `aleta_bot`, lalu gunakan menu Status WhatsApp di portal.

## Rollback

Jika patch bermasalah dan perlu rollback cepat:

```bash
cd /var/www/html/aleta
docker-compose stop portal aleta_bot
# kembalikan file dari folder backup yang dibuat sebelum upload
docker-compose build portal aleta_bot
docker-compose up -d portal aleta_bot
docker-compose ps
```

Jangan rollback folder data kecuali benar-benar paham dampaknya.
