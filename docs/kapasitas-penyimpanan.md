# Kapasitas penyimpanan ALETA (30 Okt 2026)

Permintaan Derry: kapasitas Docker/ALETA dibuat besar (1 TB bila bisa; bila tidak, jangan kecil).

## Kenyataan

- `/home` 200 GB memuat data Docker (`/home/docker-data`) DAN Postgres (`/home/aleta-data/postgres`); penuh 28 Agu, 2 Okt, 20 Okt oleh cache build.
- `/` 715 GB, ±600 GB menganggur (memuat `/var/www/html/aleta`, `aleta-data`, cadangan).
- Total disk fisik ±915 GB: **1 TB TIDAK mungkin tanpa disk tambahan.** XFS tidak bisa dikecilkan, jadi ruang `/` tidak bisa "dipinjamkan" ke `/home`; yang dipindah adalah datanya.
- Realistis sekarang: data Docker + Postgres pindah ke `/` (±600 GB bebas, tiga kali lipat `/home`). Untuk 1 TB: pasang disk tambahan (sedikitnya ±110 GB lagi bila hanya untuk melewati 1 TB; lebih baik 1 TB penuh), partisi dan format SENDIRI, pasang di `/aleta-docker`, lalu jalankan skrip yang sama dengan `--jalankan /aleta-docker`. Skrip tidak pernah memformat/memartisi.

## Isi

| Berkas | Fungsi |
| --- | --- |
| `scripts/kapasitas/pindah-data-docker.sh` | `--periksa` (bawaan, hanya laporan) dan `--jalankan TUJUAN [--ya]` |
| `scripts/kapasitas/kembalikan-data-docker.sh` | rollback penuh (menyalin balik data terbaru ke lokasi lama) |
| `scripts/kapasitas/aleta-kapasitas-cron.sh` | pemantau di host (cron): laporan ruang + pembersihan otomatis bersyarat |
| `scripts/kapasitas/lib-kapasitas.sh` | fungsi bersama |
| Portal: Pusat Kendali > Kapasitas penyimpanan | batang pemakaian, ambang, saklar bersih otomatis (mati), petunjuk |

Tanpa migrasi database: setelan di `aleta_ekstensi_setelan` (`*sistem*`, kunci `kapasitas:setelan`). Portal tidak memegang soket Docker; ia bertukar berkas lewat volume `reports` yang sudah ada (`reports/kapasitas/`).

## Urutan saat server hidup (minta izin pengguna di tiap tanda IZIN)

1. Pasang paket ALETA seperti biasa (membawa `scripts/kapasitas/`). `chmod +x /var/www/html/aleta/scripts/kapasitas/*.sh`.
2. **Pasang pemantau** (IZIN, mengubah /etc/cron.d):
   `echo '* * * * * root /var/www/html/aleta/scripts/kapasitas/aleta-kapasitas-cron.sh >> /var/log/aleta-kapasitas.log 2>&1' > /etc/cron.d/aleta-kapasitas`
   Dalam ±1 menit layar Kapasitas penyimpanan memuat rincian.
3. **Periksa** (aman, tanpa ubahan): `bash scripts/kapasitas/pindah-data-docker.sh --periksa` (lsblk, df, letak data, ukuran, disk kosong, saran tujuan). Laporkan ke pengguna: ruang tujuan, ada/tidaknya disk kosong, perkiraan waktu.
4. (Opsional, IZIN) kecilkan dulu: `docker builder prune --filter until=72h -f` - cache build ±75 GB tidak perlu disalin; waktu henti separuh.
5. **IZIN pengguna** untuk menghentikan ALETA. Umumkan lewat Mode pemeliharaan. Jalankan terlepas dari sambungan:
   `ssh aleta "nohup bash /var/www/html/aleta/scripts/kapasitas/pindah-data-docker.sh --jalankan /aleta-docker --ya > /root/pindah.log 2>&1 &"`
   Log juga di `/var/www/html/aleta-data/reports/pindah-docker-<waktu>.log`. Berhenti di galat pertama; bila gagal sebelum konfigurasi diubah, ia menyalakan ALETA lagi dari lokasi lama; bila terputus, jalankan ulang perintah yang sama (melanjutkan).
6. **Verifikasi** (skrip sudah memeriksa; ulangi sendiri): `docker info | grep "Docker Root Dir"` = `/aleta-docker/docker-data`; `docker ps` tiga kontainer, `docker inspect -f '{{.RestartCount}}'` = 0; `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8008/aleta/login` = 200; jumlah migrasi = jumlah entri `_journal.json`. Periksa juga login, Jadwal Sidang, WhatsApp tersambung (sesi `wwebjs_auth` tidak berubah).
7. Data lama TIDAK dihapus: `/home/docker-data.lama-<tgl>` dan `/home/aleta-data/postgres.lama-<tgl>`. Ruang `/home` baru bebas setelah itu dihapus. **Setelah beberapa hari stabil, pengguna menghapus sendiri** (`rm -rf` dicetak skrip; penghapusan permanen hanya oleh pengguna).
8. Rollback bila ada masalah: `bash scripts/kapasitas/kembalikan-data-docker.sh --ya`.
9. Di portal (Super Admin): atur ambang (80/90 bawaan). Saklar "Bersihkan sisa pembuatan lama otomatis" MATI bawaan; menyalakannya = izin tetap, jalan hanya bila partisi data Docker > ambang merah, paling sering tiap 6 jam, tercatat di jejak audit.

## Perkiraan waktu henti

ALETA mati dari "hentikan" sampai "nyalakan": salinan rsync sebesar data (Docker ±150-190 GB sekarang + Postgres kecil) ditambah satu uji kering rsync. Pada hardisk ±100-150 MB/s: ±30-60 menit; dengan cache build dikosongkan dulu (langkah 4) ±15-30 menit. Ini perkiraan; ukuran sebenarnya terlihat di `--periksa`. Disarankan di luar jam kerja.

## Selaras

- `aleta-update.sh`: memeriksa ruang di data root Docker (`docker info`, minimal 8 GB; `ALETA_MIN_GB_DOCKER`) SEBELUM menyentuh apa pun; `TMPDIR` dipilih otomatis (`/home/aleta-tmp` bila cukup, kalau tidak folder di partisi aplikasi).
- `aleta-make-update.sh`: menolak membuat paket bila skrip kapasitas rusak sintaks atau berakhir baris CRLF.
- `deploy/installer/install.sh`: folder Postgres dibaca dari compose server, bukan ditebak `/home`.
- Catatan: kebijakan bawaan `docker-compose.yml` repo tetap `/home/aleta-data/postgres`; skrip hanya mengubah compose server (dicadangkan `*.bak-pindah-<waktu>`). Pembaruan tidak mengirim berkas compose, jadi perubahan itu bertahan.

## Belum diuji di server

Skrip pindah/rollback hanya lolos `bash -n` dan uji fungsi pembantu (daemon.json, deteksi volume Postgres) di laptop; cron diuji dengan `docker`/`df` tiruan. Pemindahan sungguhan belum pernah dijalankan - jalankan `--periksa` dulu dan awasi log tahap demi tahap.

## Penjaga server (1 Nov 2026)

Mengabari Super Admin lewat WhatsApp (ALETA Bot) bila: ruang disk melewati ambang di atas (`/`, `/home`, partisi data Docker/Postgres/ALETA), cadangan harian gagal/tidak terbentuk/terlalu kecil, layanan merah (basis data, bot, WhatsApp, SIPP, ABT, antrian, e-Court, kontainer `aleta-*`), jumlah berkas (inode) penuh, folder sementara penuh, sertifikat hampir habis, halaman ABT mati, portal tidak menjawab. HANYA mengabari - tidak membersihkan apa pun.

- **Satu jadwal cron yang sama** (`aleta-kapasitas-cron.sh`) kini juga memanggil `scripts/kapasitas/penjaga-host.sh`: pemeriksaan cepat tiap >= 2 menit (satu curl, batas 5 detik) dan pemeriksaan penuh tiap 10 menit (df, df -i, docker ps, openssl). Tidak ada `du`/`find`. Tidak ada langkah pemasangan baru selain `chmod +x scripts/kapasitas/*.sh` (sudah ada di urutan di atas).
- **Putaran portal** tiap 5 menit (mulai 2 menit sesudah portal menyala; matikan dengan `ALETA_PENJAGA_SERVER=0`): memakai hasil Pusat Kesehatan bila < 4 menit, membaca `penjaga-host.json`, menulis `penjaga-penerima.json` (cerminan penerima untuk skrip host).
- **Portal mati**: portal tidak bisa mengabari, jadi `penjaga-host.sh` menyuruh ALETA Bot (`/internal/aleta-bot/messages/enqueue`, `sourceApp=aleta_bot_gateway`) mengabari penerima di `penjaga-penerima.json`. Token bot dibaca dari `ALETA_BOT_INTERNAL_API_TOKEN` atau `$APP_DIR/.env.production` dan diberikan ke curl lewat stdin. Bila ALETA Bot juga mati, tidak ada yang bisa mengirim WhatsApp: lonceng/halaman Pusat Kesehatan tetap menandai.
- Pengaturan (Super Admin): Admin > Kapasitas penyimpanan > Penjaga server. Bawaan: kabar merah MENYALA, pemberitahuan biasa MENYALA, jam tenang 21.00-05.30 WITA (hanya merah yang menembus), ingatkan merah tiap 6 jam / biasa tiap 24 jam, penerima semua Super Admin bernomor.
- Variabel opsional skrip host: `ALETA_PORTAL_URL`, `ALETA_BOT_BASE_URL`, `ALETA_ABT_URL` (kosong = ABT tidak diperiksa), `ALETA_CERT_FILES`, `ALETA_TMP_DIR`, `ALETA_KONTAINER_POLA`.
- Migrasi 0125 (journal idx 109): tabel `aleta_penjaga_kejadian` (riwayat kejadian). idx 106-108 milik 0122-0124 dari cabang lain; idx baru berurutan setelah semua digabung.
