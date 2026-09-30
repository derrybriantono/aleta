# Sinkron laptop ALETA

Menarik cadangan basis data terbaru (ALETA, SIPP, ABT, antrian sidang, ALETA Bot) dari server ALETA
ke laptop, memeriksa SHA-256 tiap berkas, lalu, bila diatur, memulihkannya ke basis data laptop.
Hanya memakai Node.js (versi 18 ke atas), tanpa pustaka tambahan.

Server tidak dapat mengirim ke laptop. Laptop yang menarik, lewat token yang dibuat di layar admin.

## Aturan keras

* Basis data **`sipp`** di laptop (salinan PA Bungku) **tidak pernah disentuh**. Konfigurasi yang
  menunjuk ke `sipp` (huruf besar maupun kecil) ditolak sebelum apa pun dijalankan. SIPP server
  dipulihkan ke **`sipp_donggala`**.
* Aliran SQL yang memuat `USE`, `CREATE DATABASE`, atau `DROP DATABASE` dihentikan. Dump ALETA tidak
  pernah memuatnya, dan basis data tujuan selalu disebut di baris perintah.
* Semua berkas ditulis di drive **D:** (bawaannya `D:/Aplikasi/aleta/sinkron`). Jalur di C: ditolak.

## 1. Siapkan di layar admin (Super Admin)

1. Buka **Admin > Sinkron & cadangan** di portal ALETA.
2. Isi **kata sandi arsip** (minimal 12 aksara) lalu simpan. Catat sandinya di tempat aman di luar
   ALETA. Tanpa sandi itu arsip tidak dapat dibuka siapa pun.
3. Nyalakan **Izinkan laptop menarik**, isi nama laptop, tekan **Buat token**. Token hanya
   diperlihatkan **sekali**. Salin ke berkas `D:/Aplikasi/aleta/sinkron/rahasia/token.txt`.
4. Nyalakan **Cadangan basis data > Otomatis** dan pilih jadwalnya, atau tekan **Sinkron sekarang**.

## 2. Pasang di laptop

```powershell
New-Item -ItemType Directory -Force D:\Aplikasi\aleta\sinkron\rahasia
Copy-Item konfigurasi.contoh.json konfigurasi.json
```

Sunting `konfigurasi.json`:

| Ruas | Arti |
|---|---|
| `server` | alamat portal, mis. `http://192.168.10.10/aleta` (laptop harus di jaringan kantor) |
| `cara` | `portal` (lewat token) atau `ssh` (lewat `ssh aleta` dan `scp`, tanpa token) |
| `tokenBerkas` | berkas berisi token laptop (atau isi langsung di `token`) |
| `folderSimpan` | tempat arsip di laptop (drive D:) |
| `simpanSalinan` | berapa bundel terakhir yang disimpan di laptop |
| `sandiDariEnv` / `sandiBerkas` | dari mana kata sandi arsip dibaca: nama env atau berkas di D: |
| `pulihkan.<sumber>.aktif` | `true` = pulihkan ke basis data laptop sesudah diunduh |
| `pulihkan.<sumber>.basisData` | basis data tujuan (SIPP: `sipp_donggala`, **tidak boleh** `sipp`) |
| `pulihkan.mysql.mysqlExe` | `mysql.exe` XAMPP laptop |
| `pulihkan.postgres.*` | PostgreSQL laptop (port 54329); `binFolder` = folder `pg_restore.exe`/`psql.exe` |

Periksa konfigurasi tanpa mengunduh apa pun:

```powershell
node sinkron-laptop.mjs --uji
```

Tarik (dan pulihkan yang diaktifkan):

```powershell
$env:ALETA_SINKRON_SANDI = "<kata sandi arsip>"   # hanya untuk jendela PowerShell ini
node sinkron-laptop.mjs
```

Pilihan lain:

* `--hanya-unduh`: tarik saja, tidak memulihkan.
* `--konfigurasi D:/jalur/konfigurasi.json`: berkas konfigurasi lain.
* `--buka-sandi <berkas.aleta-enc> <keluaran>`: membuka satu arsip secara manual (sandi dari
  `ALETA_SINKRON_SANDI`).

Catatan kegiatan ditulis ke `<folderSimpan>/sinkron-laptop.log`, tanpa token dan tanpa sandi.

## 3. Menjadwalkan (dilakukan pengguna sendiri)

Alat ini **tidak** mendaftarkan jadwal sendiri. Bila ingin berjalan tiap hari pukul 07.30, simpan
kata sandi arsip di berkas yang hanya dapat dibaca akun Anda (mis.
`D:/Aplikasi/aleta/sinkron/rahasia/sandi.txt`, isi ruas `sandiBerkas`), lalu jalankan sekali di
PowerShell:

```powershell
schtasks /Create /TN "ALETA Sinkron Laptop" /SC DAILY /ST 07:30 /F `
  /TR "\"C:\Program Files\nodejs\node.exe\" \"D:\Download File\server aleta baru\aleta_server\tools\sinkron-laptop\sinkron-laptop.mjs\" --konfigurasi \"D:\Aplikasi\aleta\sinkron\konfigurasi.json\""
```

Sesuaikan jalur `node.exe` dan skrip. Menghapus jadwal: `schtasks /Delete /TN "ALETA Sinkron Laptop" /F`.

## Isi bundel

```
arsip/20260930-020000/
  aleta-database-<cap>.tar.gz.aleta-enc   ALETA PostgreSQL (pg_dump polos + kustom)
  sipp-20260930-020000.sql.gz.aleta-enc   SIPP server
  abt-...  antrian-...  aleta_bot-...     ABT, antrian, ALETA Bot (MySQL)
  MANIFEST.json                           nama, ukuran, SHA-256
```

`.aleta-enc` = AES-256-GCM, kunci dari scrypt (N=32768, r=8, p=1). Kepala 41 byte (`ALETASNK`,
versi, parameter, garam, IV) ikut diautentikasi, tag 16 byte di ujung berkas. Isi `.sql.gz`
dapat dipulihkan manual dengan `mysql -u root sipp_donggala < sipp.sql` sesudah dibuka dan
di-gunzip. Arsip ALETA berupa `.tar.gz`/`.tar.xz` (dibuka `tar -xf`) atau `.7z` (butuh 7-Zip,
isi `tujuhZipExe`).

## Bila ada masalah

* `Token laptop tidak sah atau sudah dicabut`: buat token baru di layar admin.
* `Sinkron ke laptop belum diaktifkan`: nyalakan **Izinkan laptop menarik** di layar admin.
* `SHA-256 ... tidak cocok`: unduhan rusak, jalankan lagi (berkas separuh dibuang).
* `Kata sandi salah atau arsip rusak`: sandi berbeda dengan yang dipakai saat arsip dibuat.
  Arsip lama tetap memakai sandi lama bila sandinya pernah diganti.
* `max_allowed_packet`: naikkan `max_allowed_packet=512M` di `my.ini` XAMPP bila MySQL laptop
  menolak baris besar.
