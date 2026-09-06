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

## Jalan Mundur Cepat lewat Tag Image (dilatih 6 Sep 2026)

Ada **dua** jalan mundur, dan keduanya menjawab keadaan yang berbeda.

| | Tag image | `aleta-rollback.sh` (tar.gz) |
|---|---|---|
| Waktu | **3–23 detik** | menit — perlu bangun ulang |
| Yang dipulihkan | image jadi | berkas sumber |
| Syarat | image lama masih ada di server | tarball cadangan ada |
| Dipakai saat | portal/bot rusak sesudah naik, harus pulih SEKARANG | perlu kembali ke rilis lama seutuhnya |

Angka di atas hasil latihan sungguhan pada 6 Sep 2026 (Minggu, 0 sidang
terjadwal), bukan perkiraan.

### Sebelum menaikkan: tandai dulu yang sedang berjalan

Tanpa langkah ini tidak ada yang bisa dikembalikan — `docker compose build`
menimpa tag `latest`, dan image lama menjadi tanpa nama.

```bash
docker tag $(docker inspect aleta-portal --format '{{.Image}}' | cut -c8-19) \
  aleta-portal-backup:sebelum-<perubahan>-$(date +%Y%m%d)
docker tag $(docker inspect aleta-bot --format '{{.Image}}' | cut -c8-19) \
  aleta-bot-backup:sebelum-<perubahan>-$(date +%Y%m%d)
```

### Mundur

```bash
cd /var/www/html/aleta
# jaring pengaman: beri nama pada yang sekarang, agar bisa maju lagi
docker tag $(docker inspect aleta-portal --format '{{.Image}}' | cut -c8-19) \
  aleta-portal:kembali-$(date +%Y%m%d)

docker tag aleta-portal-backup:sebelum-<perubahan>-<tgl> aleta-portal:latest
docker compose up -d --force-recreate portal
```

Untuk bot, ganti `aleta-portal` dengan `aleta-aleta_bot` dan `portal` dengan
`aleta_bot` (nama image bot memang `aleta-aleta_bot`, nama layanannya
`aleta_bot`).

### Maju lagi

```bash
docker tag aleta-portal:kembali-<tgl> aleta-portal:latest
docker compose up -d --force-recreate portal
```

### Membuktikan versi mana yang hidup

Cara termudah - **cap build**, sejak 6 Sep 2026:

```bash
docker exec aleta-portal cat /app/BUILD-STAMP.txt
# contoh: 20260906-1548 WITA 8941891   <- tanggal-jam, zona, penanda commit
```

Cap yang sama tampil di footer portal, jadi tidak perlu SSH untuk memeriksanya
dari layar. Nilainya ditanam saat `next build`, jadi tidak dapat berubah tanpa
membangun ulang. Kirim penanda commit saat membangun agar dapat dicocokkan ke
git:

```bash
ALETA_BUILD_REF=$(git rev-parse --short HEAD) docker compose build portal
```

Server tidak punya git, jadi hash-nya dihitung di sisi yang punya repo lalu
dikirim lewat perintah build.

**Cara lama** - masih berguna bila capnya belum ada atau yang diperiksa bot,
karena bot tidak punya cap: pakai rute yang hanya ada di versi baru.

```bash
curl -s -o /dev/null -w "%{http_code}
"   "http://127.0.0.1/aleta/api/aleta-ecourt/prompt-putusan?nomor=x"
# 401 = versi baru (rute ada, tertolak karena belum masuk)
# 404 = versi lama (rutenya memang belum lahir)
```

Penanda ini tegas karena membedakan "ada tapi terlindungi" dari "tidak ada".

### Hasil latihan 6 Sep 2026

- Portal mundur: **3 detik**; rute baru berubah 401 → 404; fitur lama tetap
  melayani.
- Portal maju: **18 detik**; kembali 404 → 401.
- Bot mundur: **23 detik**; maju **13 detik**.
- **Mundur sebagian aman.** Dengan portal baru + bot lama, portal tetap hidup
  penuh dan rutenya tetap ada — jawaban bot yang hilang ditangani sebagai
  "ALETA Bot belum dapat dihubungi", bukan sebagai kerusakan. Jadi tidak wajib
  memundurkan keduanya sekaligus.
- Nol galat pada log portal maupun bot sepanjang latihan.

### Lubang yang ditemukan saat latihan

**Deploy dengan salin tangan TIDAK membuat tarball cadangan.** Empat deploy
pada 6 Sep 2026 dikerjakan lewat `scp` + `docker compose build`, sehingga
melewati `aleta-update.sh` yang biasanya membuat tar.gz. Akibatnya tarball
terbaru tertanggal 10:22 — sebelum seluruh pekerjaan hari itu — dan satu-
satunya jalan mundur ke keadaan antara adalah tag image yang dibuat manual.

Artinya: **kalau menaikkan tanpa `aleta-update.sh`, penandaan image di atas
bukan pilihan melainkan keharusan.**

## Catatan Aman

Update tidak dijalankan langsung dari browser. Browser hanya menampilkan status, manifest, dan perintah server. Eksekusi tetap melalui SSH agar aplikasi web tidak memiliki hak untuk menimpa file server.
