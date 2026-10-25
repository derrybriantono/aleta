# Laporan rantai E: ukur dan admin (agen RE2, 25 Okt 2026)

Dikerjakan di laptop (worktree `D:/aleta-dev/wt/w72`), bertumpuk: E1 sampai E6 saling menyambung. Tidak ada yang dipasang, tidak ada versi dinaikkan, tidak ada push ke `main` atau `integrasi-*`.

## Cabang dan commit ujung

| Urut | Cabang | Commit ujung | Isi |
| :--- | :--- | :--- | :--- |
| E1 | `fitur/uji-beban` | `e8bdd949` | skrip peniru 100/200 perangkat, hanya ke kembaran laptop (agen sebelumnya) |
| E2 | `fitur/pusat-kesehatan` | `3b655309` | Pusat kesehatan, catatan galat, impor uji beban, migrasi 0094 (agen sebelumnya) |
| E3 | `fitur/mode-pemeliharaan` | `ccecf0ab` | mode pemeliharaan (agen sebelumnya) |
| E4 | `fitur/lihat-sebagai` | `eafc102c` | Lihat sebagai akun/peran |
| E5 | `fitur/otp-whatsapp` | `2c1e15b4` | verifikasi dua langkah, migrasi 0095 |
| E6 | `fitur/penjaga-integritas-berkas` | lihat `git log` cabang ini (commit laporan di ujung) | penjaga integritas berkas, migrasi 0104 |

## Uji

HASIL_UJI

## Saklar baru dan bawaannya

| Saklar | Bawaan | Tempat |
| :--- | :--- | :--- |
| Mode pemeliharaan (E3) | mati | Pusat Kendali > Mode Pemeliharaan |
| Lihat sebagai (E4) | tanpa saklar: hanya alat Super Admin, tidak mengubah perilaku siapa pun | Pusat Kendali > Lihat Sebagai |
| OTP WhatsApp (E5) | **mati** | Pusat Kendali > Verifikasi Dua Langkah |
| Authenticator TOTP (E5) | **mati** (terpisah dari OTP WhatsApp) | idem |
| Penjaga integritas berkas (E6) | **mati** | Pusat Kendali > Penjaga Integritas Berkas |
| Peringatan WhatsApp penjaga integritas (E6) | menyala, tetapi hanya berlaku bila penjaga menyala | idem |

Selama kedua saklar E5 mati, TIDAK ADA pengguna yang dimintai kode (diuji untuk semua peran, di kantor dan luar kantor). Pengguna tetap boleh memasang authenticator lebih dulu di halaman Akun. Passkey tidak ditawarkan selama ALETA dibuka lewat http (`passkeyTersedia()` = false; kerangka WebAuthn belum ditulis).

## Migrasi

| Nomor | Idx jurnal sementara | Tabel |
| :--- | :--- | :--- |
| 0094 (E2) | 81 | `aleta_catatan_galat`, `aleta_catatan_galat_kejadian`, `aleta_uji_beban_hasil`, `aleta_kesehatan_status`, `aleta_kesehatan_riwayat`, kolom `aleta_perangkat.versi_ekstensi` |
| 0095 (E5) | 82 | `aleta_verifikasi_authenticator`, `aleta_verifikasi_tantangan`, `aleta_verifikasi_lolos`, `aleta_verifikasi_kode_cadangan` |
| 0104 (E6) | 83 | `aleta_integritas_berkas`, `aleta_integritas_temuan`, `aleta_integritas_aman`, `aleta_integritas_pindai` |

Idx 81 sampai 83 sengaja berurutan (uji "idx = urutan" ada di banyak berkas uji). Dirapikan saat gabung akhir bersama rantai lain. E3 dan E4 tidak memakai migrasi (pengaturan di `aleta_ekstensi_setelan` pengguna `*sistem*`).

## Ringkasan per butir

**E4 Lihat sebagai.** Sudah ada "Lihat sebagai" lama di Panduan (peran) dan ekstensi (Blangko Derry, Perkara saya); `origin/fitur/lihat-sebagai-unik` ternyata sudah ada di riwayat (perbaikan daftar nama), jadi tidak digandakan. Yang baru: halaman Super Admin yang menjelaskan KENAPA sebuah menu tampil atau tersembunyi bagi akun/peran (Akses Menu per peran atau matriks hak), alasan wajib (10 sampai 300 huruf), sesi 30 menit, audit mulai/akhir, dan catatan "Dilihat oleh Super Admin" di halaman Akun pemilik. Keputusan desain: **pratinjau baca-saja yang dihitung server**, bukan masuk sebagai orang lain. Tidak ada sesi akun lain dibuka dan tidak ada data perkara orang lain terbuka, sehingga tidak ada yang bisa tertulis atas nama orang lain. Uji menjaga `tampil` selalu sama dengan `aplikasiTampil`.

**E5 Verifikasi dua langkah.**
- Kait: `databaseHooks.session.create.before` (jalur masuk email/sipp/sipp-sesi). Bila kode diperlukan, sesi tidak dibuat; server menjawab 403 `VERIFIKASI_DIPERLUKAN` + tiket 10 menit (pola sama dengan batas perangkat). Layar masuk memunculkan `KodeVerifikasiMasuk`, lalu mengulang masuk.
- Aturan bawaan per peran: Super Admin/Admin `wajib` (perangkat baru atau luar kantor), hakim dan pejabat `luar-kantor`, lainnya `opsional` (hanya bila sudah memasang authenticator). "Percayai perangkat" 30 hari (1 sampai 90 hari, atur Super Admin), memakai kuki `aleta_perangkat`; batas 5 perangkat per akun tidak diubah.
- Cara: kode WhatsApp 6 angka (5 menit, jeda 60 detik, maks 5 kiriman per tiket), authenticator TOTP RFC 6238 buatan sendiri (tanpa pustaka baru; rahasia terenkripsi AES-256-GCM dengan kunci dari rahasia aplikasi; kode tidak bisa dipakai dua kali), kode cadangan 8 buah dari Admin/Super Admin (Admin tidak boleh membantu akun Admin/Super Admin). Lima kode salah menghanguskan tiket.
- Anti-kunci: menyalakan saklar otomatis memercayai perangkat Super Admin yang menyalakannya; gangguan basis data atau akun tanpa sarana (tanpa WhatsApp dan tanpa authenticator) tidak dikunci dan dicatat di log server.
- **Kait untuk R6 (pengaman aksi admin)**, di `src/server/modules/verifikasi/layanan.ts`:
  - `kodeKeduaTersedia(db, userId)`: true hanya bila saklar menyala dan akun punya sarana;
  - `mintaKodeKedua(db, userId, { kirimWhatsapp })` mengembalikan `{ tiket, metode, nomor }`;
  - `periksaKodeKedua(db, { userId, tiket, metode, kode })` mengembalikan true atau melempar `ApiError` 400.
  Selama saklar mati, `kodeKeduaTersedia` = false sehingga R6 cukup melewati langkah kedua.
- Daftar jaringan kantor E5 berdiri sendiri (bawaan 192.168.10.0/24, 192.168.9.0/24, loopback) dan dapat disunting Super Admin. R6 punya daftar sendiri di batas jaringan per peran; menyatukannya adalah pekerjaan gabung (lihat pertanyaan terbuka).

**E6 Penjaga integritas berkas.**
- Folder HANYA dibaca (opendir/lstat/baca/stream; tautan simbolik dan junction tidak diikuti; folder `.git`, `node_modules`, `.svn` dilewati). Uji membandingkan isi, ukuran, dan waktu ubah folder sebelum dan sesudah pindai: identik.
- Deteksi: `.php` baru atau berubah (sesudah pindai awal yang hanya mencatat baseline), `.php` di folder unggahan, kode PHP di dalam gambar/berkas non-PHP di folder unggahan, pola webshell (`eval(base64_decode`, `assert(`, `gzinflate(base64_decode`, `preg_replace /e`, perintah dengan masukan pengguna, nama shell dikenal), `.htaccess` yang menjalankan PHP, dan kata judol (minimal dua kata berbeda per berkas atau halaman, agar imbauan resmi "waspada judi online" tidak disalahkan). Halaman publik website yang didaftarkan diambil lewat HTTP dan diperiksa kata judolnya.
- Isi berkas mencurigakan TIDAK disalin ke basis data, repo, atau WhatsApp: temuan hanya menyimpan jalur, jenis, nama aturan, nomor baris, ukuran, sha256.
- Peringatan: satu pesan WhatsApp ringkas ke admin (lewat jalur peringatan Pusat kesehatan), tidak berulang untuk temuan yang sama, dicoba lagi bila gagal terkirim. Komponen baru "Integritas berkas website/server" di Pusat kesehatan: kelabu bila mati, MERAH selama ada temuan baru, kuning bila belum memindai/ada galat. Komponen ini ikut menentukan warna keseluruhan.
- "Diketahui aman": sidik sha256 per jalur untuk pembaruan resmi; bila isinya berubah lagi, dilaporkan kembali. Tidak ada penghapusan otomatis apa pun.
- Detak 60 detik di `instrumentation.ts` (`ALETA_INTEGRITAS_DETAK=0` mematikannya). Saklar mati = detak tidak membaca apa pun. Selang bawaan 360 menit; pindai penuh (hitung ulang semua sidik) tiap 7 hari atau atas permintaan.
- Penyimpangan dari kartu: pemindai ada di **portal**, bukan di bot, karena tabelnya di Postgres portal dan pengirim WhatsApp portal sudah ada. Syaratnya: folder website harus tampak dari kontainer portal (mount baca-saja).

## Langkah laptop/server sesudah gabung

1. Gabungkan rantai E (urut E1 sampai E6), rapikan idx jurnal, jalankan uji penuh.
2. **Uji beban K9 di kembaran laptop SEBELUM rantai A/B dipasang** (`scripts/uji-beban.mjs`, hanya ke kembaran; menolak 192.168.10.10). Simpan angka awal, impor ke Pusat kesehatan.
3. Pasang, lalu **jangan nyalakan apa pun**: Mode pemeliharaan, OTP WhatsApp, authenticator, dan penjaga integritas semuanya mati bawaan.
4. Penjaga integritas: tambahkan mount **baca-saja** folder website satker ke kontainer portal, di `docker-compose.override.yml` server (mis. `/var/www/website-pa:/mnt/website-pa:ro`). Lalu **daftarkan folder website satker** di Pusat Kendali > Penjaga Integritas Berkas (Super Admin), isi alamat halaman publiknya, nyalakan. Pindai pertama hanya mencatat baseline. Lakukan dulu audit 5a (Bagian 5 `ambil-laptop-24okt.md`) tanpa menyalin isi berkas mencurigakan ke repo.
5. Pengguna memasang authenticator lebih dulu (Akun > Verifikasi dua langkah). Baru setelah semua Admin/hakim terdaftar dan memegang kode cadangan, Super Admin menyalakan saklar (sebaiknya authenticator lebih dulu, lalu OTP WhatsApp bila bot WhatsApp stabil).
6. Bila ALETA nanti dibuka lewat HTTPS, passkey baru bisa dikerjakan (belum ada kodenya).

## Catatan lingkungan laptop

- **Antivirus Windows memutus berkas uji yang memuat pola webshell utuh** (Defender, ThreatID 2147893196): berkas menjadi "Permission denied" dan harus ditulis ulang. Uji E6 merakit pola dari potongan (`j(...)`) dan berkas rekaan di disk hanya memakai pola ringan. Jangan menulis ulang pola utuh di berkas uji.
- Uji lambat karena banyak agen: satu basis data per berkas uji (`beforeAll`), bukan per uji.
- `npm run lint:jangan-bertambah` melaporkan 46 (dasar 45). Tambahan satu berasal dari `scripts/uji-beban.d.mts` (E1), bukan dari berkas rantai ini; berkas E4/E5/E6 bersih di ESLint.

## Pertanyaan terbuka (dipilih opsi paling aman, tidak menunggu jawaban)

1. **Lihat sebagai** dibuat pratinjau menu dan hak, bukan masuk sebagai orang lain. Bila Derry menginginkan tampilan penuh seperti akun itu (semua halaman, baca-saja), perlu rancangan lebih besar (sesi tiruan di `resolveActorUserId` + penolakan semua penulisan + klien portal berganti `currentUserId`); saran: tunda.
2. Daftar jaringan kantor ada dua (E5 sendiri dan R6 batas jaringan per peran). Saran: R6 menjadi sumber tunggal, E5 membaca dari R6 sesudah keduanya digabung.
3. Aturan bawaan OTP: Admin/Super Admin `wajib`, hakim dan pejabat `luar-kantor`. Daftar "pejabat" saya isi: ketua, wakil ketua, sekretaris, panitera, panitera muda, kasubag, pejabat struktural. Mohon ditinjau.
4. Kata judol dan pola webshell adalah daftar awal yang konservatif; daftar kata perlu disesuaikan dengan hasil audit 5a.
5. Komponen integritas ikut menentukan warna keseluruhan Pusat kesehatan (merah bila ada temuan baru). Bila peringatan WhatsApp Pusat kesehatan dinyalakan, admin dapat menerima dua pesan untuk hal yang sama (satu dari penjaga, satu dari Pusat kesehatan).
