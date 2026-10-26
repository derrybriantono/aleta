# Laporan Bagian 6 (keamanan tambahan) - agen R6, 25 Okt 2026

Dikerjakan di laptop, worktree `D:\aleta-dev\wt\w74`, dasar `integrasi-1205-39` (c70ca746). Server kantor tidak dijangkau. Empat cabang bertumpuk, semuanya sudah di-push; tidak ada push ke `main`/`integrasi-*`, tidak ada PR, versi tidak dinaikkan.

## Cabang dan commit ujung

| Urut | Cabang | Commit ujung | Isi |
| :--- | :--- | :--- | :--- |
| 6a | `fitur/kebijakan-sandi` | `7d234d09` | Kebijakan sandi di Pengaturan Keamanan (migrasi 0107) |
| 6b | `fitur/batas-jaringan-peran` | `98322c1f` | Batas jaringan per peran (migrasi 0108) |
| 6c | `fitur/pengaman-aksi-admin` | `0637bd91` | Pengaman aksi admin (tanpa migrasi; memakai tabel 0107) |
| 6d | `fitur/uji-pulih-cadangan` | commit fitur `8b80e88e`; perbaikan istilah + laporan = commit berikutnya (`git log` cabang ini) | Uji pulih cadangan (migrasi 0109) |

Butir 5b, 6e, 6f tidak dikerjakan (butuh server/jaringan).

## Angka uji

Uji sasaran baru (semuanya uji perilaku nyata: pg-mem + Better Auth + rute asli, atau jsdom):

| Berkas | Jumlah | Hasil |
| :--- | :--- | :--- |
| `kebijakan-sandi-25okt.test.ts` | 18 | hijau |
| `kebijakan-sandi-layar-25okt.test.tsx` | 5 | hijau |
| `batas-jaringan-peran-25okt.test.ts` | 20 | hijau |
| `batas-jaringan-layar-25okt.test.tsx` | 6 | hijau |
| `pengaman-aksi-admin-25okt.test.ts` | 11 | hijau |
| `pengaman-aksi-layar-25okt.test.tsx` | 9 | hijau |
| `uji-pulih-cadangan-25okt.test.ts` | 30 | hijau |
| `uji-pulih-layar-25okt.test.tsx` | 6 | hijau |
| **Jumlah baru** | **105** | **hijau** |

Per cabang: `npx tsc --noEmit` bersih; `npm run lint:jangan-bertambah` = 45 galat (sama dengan dasar; daftar "BARU" yang dicetak skrip hanya berkas lain yang sudah ada di dasar, tidak ada berkas keamanan di dalamnya). Uji lama yang tersentuh dijalankan ulang dan hijau: `tutorial-hidup`, `hak-akses-peta-18okt`, `tabel-cadangan-terdaftar`, `jejak-masuk-perangkat`, `jejak-masuk-pencabutan`, `aleta-super-admin-reset`, `aleta-blocked-account`, `panduan-fitur-peran-r9`, `ecourt-sumberdaya-panduan-u5-9okt`, `arsip-cadangan`.

Uji penuh (`periksa-uji.mjs`, ujung 6d): uji penuh pertama (utas 3, mesin dipakai bersama) 23 berkas merah dari 952 (17.841 uji lulus, 30 gagal). Dipilah:
- 1 cacat saya, SUDAH DIPERBAIKI: `istilah-tampilan` menolak kata "galat" di panel uji pulih; diganti "kesalahan" (hijau).
- Habis waktu 120 detik karena beban mesin: 12 berkas (`aleta-blocked-account`, `bas-acc-hakim`, `penunjukan-pengisian`, `pemetaan-jabatan`, dll.); dijalankan ulang, lulus. `arsip-cadangan` (300 detik) dan `referensi-pihak-isian-t8` lulus bila dijalankan sendirian.
- Gagal juga di dasar `integrasi-1205-39` tanpa perubahan saya (diperiksa di w33): `aleta-ai-dompet-25okt` (urutan mutasi), `tema-ecourt-23okt` (versi manifest 1.205.39 vs 1.205.38).
- Lingkungan worktree w74 (berkas tidak terlacak tidak ada di salinan): `docx-tabel-gambar`, `eviden-skp-cetak`, `xlsx-lembar-bebas` (public/mahkamah-agung-logo.png), `w2a-kebendaan`, `w3b-blangko-baru` (folder abt-paket), `root-redirect` (basis data lokal belum disiapkan, alih ke /setup); `alamat-desa-ketik-22okt` (batas waktu cari 25 ms, terukur 47 ms karena beban).
Tidak ada berkas merah yang disebabkan cabang Bagian 6 selain yang sudah diperbaiki.

Cacat nyata yang ditemukan uji dan sudah diperbaiki: pemindai SQL uji pulih tidak menutup aliran berkas saat berhenti lebih awal (berkas kerja tidak bisa dihapus di Windows, fd bocor di Linux).

## Saklar baru dan bawaannya

| Fitur | Saklar | Bawaan | Catatan |
| :--- | :--- | :--- | :--- |
| Kebijakan sandi | `sandi.aktif` (tabel `aleta_setelan_keamanan`) | MATI | mati = aturan sandi persis seperti dulu |
| Batas jaringan per peran | tanpa saklar tunggal; aturan per peran | semua peran "dari mana pun" | tanpa baris = perilaku lama |
| Pengaman aksi admin | `pengaman.aktif` (+ saklar per aksi, bawaan semua dijaga bila menyala) | MATI | |
| Uji pulih cadangan | `pulih.aktif` | MATI | uji manual ("Jalankan uji sekarang") tidak menunggu saklar |
| Penegakan jaringan, darurat | env `ALETA_BATAS_JARINGAN=0` | tidak diset | mematikan penegakan di server |
| Penjadwal uji pulih | env `ALETA_UJI_PULIH=0` | tidak diset | mematikan pewaktu 5 menit |
| Batas waktu psql | env `ALETA_UJI_PULIH_BATAS_MENIT` | 30 | |

Layar: Pusat Kendali > Pengaturan Keamanan (`/admin/keamanan`), empat tab. Hak baru di matriks: `keamanan.lihat` (Admin + Super Admin), `keamanan.atur` (hanya Super Admin). Ada entri tutorial dan kartu di Pusat Kendali.

## Migrasi dan idx jurnal

| Nomor | Tabel | idx dipakai |
| :--- | :--- | :--- |
| 0107 | `aleta_setelan_keamanan`, `aleta_riwayat_sandi`, `aleta_status_sandi` | 81 (`when` 1792440000001) |
| 0108 | `aleta_subnet_kantor`, `aleta_aturan_jaringan_peran` | 82 (`when` 1792440000002) |
| 0109 | `aleta_uji_pulih` | 83 (`when` 1792440000003) |

Catatan: kartu menyuruh idx sementara mulai 100, tetapi lebih dari sepuluh berkas uji lama menuntut jurnal tanpa lubang (`idx` = urutan). Maka dipakai 81-83 (idx 81 dan 82 juga dipakai 0090/0096 rantai A di cabang lain: saat gabung, `idx` dan `when` cukup diurutkan ulang). Semua migrasi: berkas SQL + jurnal + kembaran DDL di `schema.ts` + daftar `client.ts`; `tabel-cadangan-terdaftar` hijau. Tanpa kunci asing/CHECK.

## Perkiraan skor keamanan per bidang (perkiraan saya, bukan pengukuran)

Angka "sesudah" berlaku bila saklarnya dinyalakan dan diisi benar.

| Bidang | Sebelum | Sesudah | Pendorong |
| :--- | :--- | :--- | :--- |
| Sandi dan autentikasi | ±40 | ±60 | kebijakan sandi (6a); 80+ butuh OTP/authenticator (E5) |
| Pembatasan akses jaringan | ±30 | ±65 | batas jaringan per peran (6b); 80+ butuh VPN/segregasi (6e, tidak dikerjakan) |
| Pengendalian aksi admin | ±35 | ±70 | sandi ulang + kata konfirmasi (6c); 85 butuh langkah kedua OTP |
| Ketahanan dan pemulihan data | ±50 | ±80 | cadangan terbukti dapat dipulihkan tiap minggu (6d) |
| Audit dan deteksi | ±70 | ±75 | penolakan jaringan dan konfirmasi aksi tercatat |
| Lalu lintas (http) | ±20 | ±20 | tidak berubah (6e: tetap http atas keputusan Derry) |
| Segregasi website | ±40 | ±40 | 5b/6f belum |
| **Keseluruhan** | **±45** | **±62-65** | 85-90 masih menuntut E5, E6, 5b, 6e, 6f |

## Langkah server sesudah gabung (jangan dilakukan sebelum Senin 26 Okt 08.00)

1. Gabung keempat cabang ke `integrasi-*`. Titik yang kemungkinan bentrok dengan rantai lain: `perangkat/kait-auth.ts` (satu blok jaringan sebelum `tegakkanBatas` - OTP E5 sebaiknya sesudahnya), `shared/auth.ts` (`resolveActorUserId`), `app/api/auth/[...all]/route.ts` (dua kode galat dikecualikan dari hitungan percobaan), `app/(portal)/layout.tsx`, `shared/rate-limit.ts` (dua cakupan baru), `lib/matriks-peran.ts`, `db/schema.ts`, `db/client.ts`, jurnal migrasi (idx/when), `instrumentation.ts`, `tasks/service.ts`, `lib/tutorial-isi.ts`, `admin-hub.tsx`.
2. Bangun ulang citra portal dan mulai ulang. Migrasi 0107-0109 berjalan lewat jalur biasa (`ensureAletaSchema` membuat tabelnya; pada deploy pakai `ALETA_RUN_DB_MIGRATIONS=1` agar jurnal drizzle ikut).
3. Bot dan ekstensi tidak berubah: tanpa mulai ulang bot, tanpa rilis ekstensi, tanpa perubahan Apache.
4. Sebelum menyalakan uji pulih: beri peran Postgres hak membuat basis data (`ALTER ROLE <peran> CREATEDB;`), pastikan `psql` dan `7z` ada di citra (Dockerfile sudah memasang `postgresql-client`, `p7zip-full`, `xz-utils`) dan folder kerja sementara punya ruang bebas minimal sekitar 8 kali ukuran arsip ALETA. Mulai dengan "Jalankan uji sekarang" (manual), lihat rinciannya, baru nyalakan jadwal.
5. Batas jaringan: isi dulu daftar jaringan kantor (contoh 192.168.10.0/24 dan 192.168.9.0/24, sesuaikan), perhatikan "Alamat Anda sekarang", baru batasi peran satu per satu. Layar menolak aturan yang akan mengunci akun penyimpannya. Akses langsung ke port portal tanpa Apache tidak membawa X-Forwarded-For, jadi dianggap bukan kantor bila peran dibatasi. Darurat: `ALETA_BATAS_JARINGAN=0` lalu mulai ulang portal.
6. Pengaman aksi: nyalakan sesudah satu admin mencoba satu aksi (mis. ubah batas perangkat) untuk melihat kotak konfirmasi.
7. Kebijakan sandi: beri tahu pegawai lebih dulu; mulai dengan masa berlaku 0 (tanpa kedaluwarsa). Akun lama tampil "belum diganti sejak aturan ini" tanpa dipaksa; paksa ganti per akun dari tabel itu.

## Kait untuk cabang lain (tanpa menyentuh berkas inti E5/E2)

`src/server/modules/keamanan/kait.ts` (pendaftar di `globalThis`):
- `daftarkanVerifikasiLuarKantor({ nama, sudahTerverifikasi(db, { userId, sessionId, ip, tahap }) })` - E5. Tanpa pendaftar, aturan "luar kantor wajib verifikasi" tidak dapat dipilih (layar menonaktifkan, rute menolak).
- `daftarkanLangkahKedua({ nama, tersedia(db, aktor), periksa(db, aktor, kode) })` - E5. Dipakai pengaman aksi bila saklar "kode langkah kedua" menyala; tanpa pendaftar dilewati.
- `daftarkanPenerimaLaporanKesehatan({ nama, terima(db, laporan) })` - E2. Uji pulih melapor dengan `sumber: "uji-pulih-cadangan"`, tingkat `baik|peringatan|gagal`.
- Aksi katalog pengaman yang menunggu fitur lain: `lihat-sebagai` (E4), `otp.nyalakan` (E5), `cadangan.pulihkan` (belum ada tombol pulihkan di ALETA). Pemanggilnya cukup `tegakkanPengaman(db, request, aktor, "<kode>")` di rute masing-masing.

## Pertanyaan terbuka (dijawab dengan opsi paling aman; mohon ditinjau)

1. Penjagaan "paksa ganti sandi" ditegakkan di tata letak portal (layar penuh), bukan di tiap API; akun yang sengaja memanggil API langsung tidak terhenti. Penegakan di API menambah satu pembacaan basis data pada setiap permintaan - sengaja belum dilakukan.
2. Sandi pada kotak konfirmasi pengaman dikirim lewat header di jaringan yang masih http (sama dengan sandi saat masuk). Tidak berubah sampai ada keputusan 6e.
3. Uji pulih memakai `CREATE DATABASE` pada server Postgres yang sama (basis data lain). Bila Derry tidak ingin memberi hak CREATEDB, alternatifnya kontainer Postgres sementara - belum dibangun.
4. Perbandingan migrasi memakai jumlah baris `drizzle.__drizzle_migrations`; bila produksi tidak punya catatan itu (skema dibuat `ensureAletaSchema`), bagian itu dilewati. Toleransi selisih baris 30% (dapat diatur).
5. Daftar tabel penting dibandingkan: users, roles, positions, accounts, letters, dispositions, audit_logs, institution_identity, panel_settings, aleta_jejak_masuk, aleta_isian_perkara, aleta_keterangan_perkara (hanya yang ada dan berisi di produksi).
6. Tampilan hanya diuji di jsdom; tidak dibuka di peramban sungguhan karena server/basis data kantor mati.
