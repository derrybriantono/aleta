# Sistem Update ALETA

Dokumen ini menjelaskan metode update ALETA agar tidak perlu copy file satu per satu melalui FileZilla.

## Prinsip

- Update dikemas menjadi satu file `aleta-update-<versi>.tar.gz`.
- Server membuat backup otomatis sebelum update diterapkan.
- Aplikasi menampilkan status versi dan pemberitahuan update dari manifest.
- Rollback/downgrade dapat dilakukan dari backup terakhir atau paket versi lama.
- `.env.production`, database PostgreSQL, file PDF, dan session WhatsApp tidak dimasukkan ke paket update.

## File Baru

- `scripts/aleta-make-update.sh`
- `scripts/aleta-update.sh`
- `scripts/aleta-rollback.sh`
- `manajemen_surat/src/app/api/system/update-status/route.ts`
- `manajemen_surat/src/server/modules/system-update/service.ts`
- `manajemen_surat/src/app/(portal)/admin/pembaruan-sistem/page.tsx`
- `docs/ALETA_UPDATE_SYSTEM.md`

## Membuat Paket Update

Jalankan dari folder aplikasi sumber:

```bash
cd /var/www/html/aleta
bash scripts/aleta-make-update.sh 0.1.0-beta.9
```

Output dibuat di:

```text
reports/updates/aleta-update-0.1.0-beta.9.tar.gz
reports/updates/aleta-update-0.1.0-beta.9.tar.gz.sha256
reports/updates/aleta-update-latest.json
```

## Menampilkan Pemberitahuan Update

Untuk memberi tahu admin bahwa update baru tersedia, copy manifest ini ke server:

```bash
cp reports/updates/aleta-update-latest.json /var/www/html/aleta-data/reports/aleta-update-latest.json
```

Atau simpan URL manifest di `.env.production`:

```env
ALETA_UPDATE_MANIFEST_URL=https://domain-internal/aleta-update-latest.json
```

Setelah itu buka:

```text
/aleta/admin/pembaruan-sistem
```

Admin akan melihat apakah versi baru tersedia.

## Menerapkan Update di Server

Upload dua file ini ke server, misalnya ke `/root`:

```text
aleta-update-0.1.0-beta.9.tar.gz
aleta-update-0.1.0-beta.9.tar.gz.sha256
```

Lalu jalankan:

```bash
cd /var/www/html/aleta
chmod +x scripts/aleta-make-update.sh scripts/aleta-update.sh scripts/aleta-rollback.sh
bash scripts/aleta-update.sh /root/aleta-update-0.1.0-beta.9.tar.gz
```

Script akan:

1. memverifikasi checksum jika file `.sha256` ada;
2. membuat backup kode aplikasi;
3. menyalin isi paket update;
4. rebuild `portal` dan `aleta_bot`;
5. menjalankan `docker-compose up -d portal aleta_bot`;
6. mencatat riwayat update di `/var/www/html/aleta-data/reports/updates/history.jsonl`.

## Rollback ke Backup Terakhir

Jalankan:

```bash
cd /var/www/html/aleta
bash scripts/aleta-rollback.sh
```

Script akan menampilkan backup yang dipakai dan meminta konfirmasi `YES`.

Jika ingin rollback tanpa prompt:

```bash
cd /var/www/html/aleta
ALETA_ROLLBACK_ASSUME_YES=1 bash scripts/aleta-rollback.sh
```

Jika ingin memilih backup tertentu:

```bash
cd /var/www/html/aleta
bash scripts/aleta-rollback.sh /var/www/html/aleta-backups/nama-backup.tar.gz
```

## Downgrade ke Versi Lama

Ada dua cara:

1. Pakai rollback ke backup sebelum update.

```bash
cd /var/www/html/aleta
bash scripts/aleta-rollback.sh
```

2. Terapkan paket versi lama.

```bash
cd /var/www/html/aleta
bash scripts/aleta-update.sh /root/aleta-update-0.1.0-beta.8.tar.gz
```

Cara kedua berguna kalau ingin turun ke versi lama yang sudah disiapkan sebagai paket rilis.

## Lokasi Status Update

State dan riwayat update disimpan di folder data, bukan di folder kode:

```text
/var/www/html/aleta-data/reports/aleta-update-state.json
/var/www/html/aleta-data/reports/aleta-update-latest.json
/var/www/html/aleta-data/reports/updates/history.jsonl
```

Karena berada di `aleta-data`, data status tidak hilang saat container dibangun ulang.

## Catatan Aman

Update tidak dijalankan langsung dari browser. Browser hanya menampilkan status, manifest, dan perintah server. Eksekusi tetap melalui SSH agar aplikasi web tidak memiliki hak untuk menimpa file server.
