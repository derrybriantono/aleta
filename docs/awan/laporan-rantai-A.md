# Laporan rantai A - Cermin Perkara (A1-A8), 25 Okt 2026

Dikerjakan agen RA di laptop (worktree `D:/aleta-dev/wt/w70`) mengikuti `docs/awan/rantai-upgrade-24okt.md`.
Cabang bertumpuk dari `integrasi-1205-39` lokal (merge-base `1787ccf1`); tiap cabang di-push ke origin
sesudah uji sasarannya hijau. Versi TIDAK dinaikkan (`manifest.json` tetap 1.205.38, `APP_VERSION` tidak
disentuh), tidak ada push ke `main`/`integrasi-*`, tidak ada PR, tidak ada pemasangan ke server.

Aturan yang dijaga di semua cabang: cermin hanya untuk DIBACA (tulisan ke SIPP tetap lewat jalur lama yang
membaca ulang sumber), tidak ada trigger atau ubahan skema di SIPP/ABT, tidak satu kata "Aleta" ke
SIPP/ABT/e-Court, semua saklar baru MATI bawaan (mati / cermin belum siap = jalur lama persis), kueri SIPP
berindeks dan berkelompok, pemindaian awal hanya 18.00-06.30 WITA dan dapat dilanjutkan.

## 1. Cabang dan commit ujung

| No | Cabang | Commit ujung | Isi |
| :--- | :--- | :--- | :--- |
| A1 | `fitur/singgah-jadwal` | `e05ace47` | K2+K6: `tandaiTulisan` selektif, jawaban singgahan disimpan sekali, antrian bersinggah 2 dtk, `rekamAntrian` menulis hanya yang berubah |
| A2 | `fitur/cermin-dasar` | `6981abd1` | C0: migrasi 0090 (6 tabel `aleta_cermin_*`), pemindai awal berkelompok yang dapat dilanjutkan, layar admin "Pemantau Cermin Perkara" |
| A3 | `fitur/cermin-pembaruan` | `8abbc544` | pembaruan tiap menit dari kolom waktu SIPP, tulisan lewat ALETA masuk seketika, pencocokan mingguan Minggu 02.00 |
| A4 | `fitur/cermin-jadwal-sidang` | `f565ee7b` | Jadwal Sidang, `/jadwal`, layar publik dan antrean membaca cermin + tanda "Cermin - diperbarui"; K1 tahap 1 (`sidang/ringan`, `sidang/disidang` bersinggah) |
| A5 | `fitur/cermin-mediasi-status` | `4632d968` | migrasi 0096 (tanggal tambahan), Jadwal Mediasi + tag Status Perkara dari cermin (menggantikan K8) |
| A6 | `fitur/cermin-ekstensi` | `59513bcd` | "Keadaan perkara" panel SIPP satu panggilan ke cermin; panel ringan bertanda Cermin saat bot/SIPP tidak menjawab |
| A7 | `fitur/tabel-jadwal-ringan` | `4b02fa07` | K13: baris tabel Jadwal Sidang dibungkus `memo` dengan kebergantungan diiris per baris (saklar mati bawaan) |
| A8 | `fitur/kabar-perubahan` | `b7e3fef6` + commit laporan ini | U17: kabar perubahan data SIPP di panel ekstensi dari jejak cermin; perbaikan hasil uji penuh |

Urutan gabung: cukup gabung ujung A8 (`fitur/kabar-perubahan`); seluruhnya satu tumpukan lurus.
(Perbaikan wording "galat" pada layar Pemantau milik A2 dan penjaga `alatAmbil` ada di commit `b7e3fef6` di A8,
bukan di cabang A2 - cabang yang sudah di-push tidak ditulis ulang.)

## 2. Angka uji

Uji sasaran per cabang (hijau semua pada waktu komit):

| Cabang | Berkas uji baru | Uji | Terkait ikut dijalankan |
| :--- | :--- | :--- | :--- |
| A1 | `singgah-jadwal-25okt.test.ts` | 32 | `performa-muat-19okt` diperbarui (dua asersi berubah arti, diberi komentar) |
| A2 | `cermin-dasar-25okt.test.ts`, `cermin-panel-25okt.test.tsx` | 32 + 5 | `tabel-cadangan-terdaftar` |
| A3 | `cermin-pembaruan-25okt.test.ts` | 37 | |
| A4 | `cermin-jadwal-sidang-25okt.test.ts` | 28 | uji PERBANDINGAN: data rekaan sama = isi dari cermin sama dengan jalur lama |
| A5 | `cermin-mediasi-status-25okt.test.ts` | 35 | 12 berkas terkait, 280 uji hijau; uji PERBANDINGAN Mediasi/Status |
| A6 | `cermin-ekstensi-25okt.test.ts` | 18 | 8 berkas ekstensi/hak akses (172) + 7 berkas ekstensi (187) hijau |
| A7 | `tabel-jadwal-ringan-25okt.test.tsx` | 5 | 79 berkas yang menyebut `aleta-ecourt-sidang`: 1.734 uji hijau (1 dilewati) |
| A8 | `cermin-kabar-25okt.test.ts` | 18 | 16 berkas terkait cermin/ekstensi/hak akses hijau; `ekstensi-sipp-tahap7` (Lama identik) hijau |

`npx tsc --noEmit` bersih di tiap cabang. ESLint: berkas baru bersih; `aleta-ecourt-sidang.tsx` tetap 9
kesalahan lama ("Compilation Skipped") yang SAMA dengan dasar (diukur sebelum dan sesudah A7).

Uji PENUH sekali di ujung A8 (`periksa-uji`, utas 3, di w70, sebelum commit perbaikan `b7e3fef6`):
953 berkas - 939 hijau, 2 dilewati, 12 merah; 18.000 uji - 17.969 hijau, 20 dilewati, 11 merah. Dibandingkan
dengan DASAR (worktree `D:/aleta-dev/wt/ra-dasar` di merge-base `1787ccf1`, 12 berkas yang sama dijalankan):

| Berkas merah | Dasar | Sebab / keputusan |
| :--- | :--- | :--- |
| `docx-tabel-gambar`, `eviden-skp-cetak`, `xlsx-lembar-bebas` | merah juga | lingkungan worktree: `public/mahkamah-agung-logo.png` tidak ada (berkas tak terlacak git) |
| `w2a-kebendaan`, `w3b-blangko-baru-21okt` | merah juga | lingkungan worktree: folder `abt-paket/` tak terlacak tidak ada |
| `aleta-ai-tugas-25okt` (2 uji) | merah juga | Windows: modul Python `resource` tidak ada |
| `referensi-pihak-isian-t8-23okt`, `root-redirect` | merah juga | sudah merah di dasar (bukan dari rantai A) |
| `istilah-tampilan` | hijau | DARI RANTAI A (kata "galat" di layar Pemantau A2) - DIPERBAIKI di `b7e3fef6`, hijau |
| `ekstensi-pesan-gagal` | hijau | DARI RANTAI A (fetch mentah baru di pemantau kabar A8) - dicatat sebagai pengecualian sengaja di uji, hijau |
| `aleta-blocked-account`, `tema-tanpa-kedip-23okt` | hijau | kedip karena beban uji penuh: lulus sendirian (tema: 1 dari 6 jalan di cabang rantai merah, 0 dari 6 di dasar - uji berjeda waktu yang peka beban; tidak memuat `konten.js`) |

Sesudah `b7e3fef6` tidak ada berkas merah yang berasal dari rantai A. Sisanya 8 berkas = merah di dasar yang
sama (lingkungan laptop/worktree), TIDAK diulang-ulang.

## 3. Saklar baru dan bawaannya

Semua MATI bawaan kecuali TTL singgahan yang hanya memperpendek pekerjaan berulang.

| Saklar | Tempat | Bawaan | Catatan |
| :--- | :--- | :--- | :--- |
| Pemindai Cermin Perkara | Admin > Pemantau Cermin Perkara (Super Admin mengubah, Admin melihat) | MATI | `ALETA_CERMIN_PEMINDAI=0` mematikan detaknya sama sekali |
| Layar `mediasi`, `status`, `jadwal`, `ekstensi`, `kabar` | sama | MATI semua | satu per satu; layar yang mati / cermin tertinggal membaca SIPP seperti sebelum ada cermin |
| Tabel Jadwal ringan (K13) | `localStorage["aleta-tabel-ringan"] = "1"` atau `NEXT_PUBLIC_ALETA_TABEL_RINGAN=1` saat build | MATI | mati = baris digambar langsung (jalur lama persis) |
| TTL singgahan K1/K2 | env `ALETA_SINGGAH_ANTRIAN_MS` (2000), `_RINGAN_MS` (2500), `_DISIDANG_MS` (2000), `_JADWAL_MS` (4000), `_TAG_MS` (30000), `_PEGAWAI_MS` | AKTIF (pendek) | `0` mematikan; selalu 0 di lingkungan uji; tulisan lewat ALETA membuang singgahan yang terkena seketika |

## 4. Migrasi

| Nomor | Jurnal idx | Isi |
| :--- | :--- | :--- |
| `0090_aleta_cermin_perkara` | 81 | `aleta_cermin_perkara`, `_sidang`, `_pihak`, `_mediasi`, `_tag`, `_jejak` |
| `0096_aleta_cermin_perkara_tanggal` | 82 | kolom `tanggal_sidang_maks`, `tanggal_akta`, `tanggal_relaas`, `tanggal_ikrar` |
| `0097` | - | TIDAK dipakai (tidak ada tabel baru) |

Tiga tempat pendaftaran terisi di keduanya (SQL + `_journal.json`, DDL di `schema.ts`, daftar tabel di
`client.ts`); uji `tabel-cadangan-terdaftar` dan `cermin-dasar-25okt` menjaga kesamaannya. Sesi laptop merapikan
idx bila `integrasi-*` sudah memakai 81/82. Ingat: migrasi baru HANYA jalan dengan `ALETA_RUN_DB_MIGRATIONS=1`.

## 5. Langkah laptop/server sesudah gabung

1. Gabung `fitur/kabar-perubahan` ke cabang integrasi. Bentrok yang diperkirakan: `ekstensi-berkas.ts`
   (berkas tanaman; selesaikan dengan `ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs` atau tanam normal
   bila versi dinaikkan), `_journal.json`/`schema.ts`/`client.ts` (idx migrasi), `matriks-peran`/`hak-akses-peta`
   (entri layar Pemantau + dokumen matriks lewat `npx tsx scripts/hak-akses-md.ts`).
2. Rilis ekstensi (skill `rilis-ekstensi`): `konten.js` berubah di A6 dan A8, jadi versi WAJIB dinaikkan agar
   Chrome memperbarui; salin ke folder Chrome.
3. Deploy portal + bot dengan `ALETA_RUN_DB_MIGRATIONS=1`; mulai ulang bot (rute `/internal/aleta-bot/cermin`).
4. Admin > Pemantau Cermin Perkara (Super Admin): NYALAKAN pemindai. Pemindaian awal hanya berjalan 18.00-06.30
   WITA dan dapat dilanjutkan; malam pertama memuat perkara per kelompok 300 dan sidang per jendela 7 hari.
   Pantau persen dan perkiraan selesai; bila belum 100% ia lanjut malam berikutnya.
5. Sesudah 100% dan pencocokan pertama bersih (tekan "Cocokkan sekarang" bila perlu), nyalakan layar SATU PER
   SATU dan amati tanda "Cermin - diperbarui hh.mm" serta kartu kesegaran:
   **Jadwal Mediasi -> Status Perkara -> Jadwal Sidang -> Panel ekstensi -> Kabar perubahan.**
   Mematikan saklar kapan saja mengembalikan layar itu ke SIPP tanpa kehilangan apa pun.
6. Tabel Jadwal ringan: coba dulu di satu PC (`localStorage.setItem("aleta-tabel-ringan","1")`, muat ulang);
   bila baik, sertakan `NEXT_PUBLIC_ALETA_TABEL_RINGAN=1` pada build.
7. Kabar perubahan hanya tampil di tampilan UI Baru ekstensi (lihat pertanyaan 5).

## 6. Pertanyaan terbuka (dipilih opsi paling aman, dicatat, dilanjutkan)

1. **Toleransi tulisan sendiri untuk tag (90 detik).** Daftar tag dipercaya dari cermin hanya bila siklus
   penanda lengkap dan tidak lebih tua dari tulisan ALETA terakhir + 90 dtk; di luar itu layar membaca SIPP.
   Angka 90 detik perkiraan - mohon dinilai setelah dipakai.
2. **Fakta pernikahan/anak/pihak untuk Blangko Derry dan susun saksi (usulan U5) belum di cermin.** Usulan itu
   dihitung di bot (`faktaPerkara`, U6), bukan data mentah; tabel `aleta_cermin_pihak` sudah ada tetapi BELUM
   diisi. A6 hanya memindahkan "keadaan perkara" (tanpa nama pihak). Lanjutan ikut rantai C.
3. **"Klik tag" pada daftar perkara masih jalur lama** (hanya hitungan tag per lingkup dan keanggotaan yang
   dari cermin).
4. **Kabar perubahan tidak menyebut nama petugas.** Cermin tidak menyimpan siapa yang mengubah (jejak per petugas
   ada di audit SIPP). Yang dikabarkan: bagian yang berubah (data perkara / jadwal sidang) dan pukulnya;
   bila perubahan jatuh dalam 2 menit dari tulisan ALETA terakhir (heuristik global) kalimatnya dilunakkan
   ("mungkin dari tindakan di ALETA"). Mau diganti dengan pembacaan audit SIPP (menambah kueri)?
5. **Kabar perubahan hanya di tampilan UI Baru.** Uji `ekstensi-sipp-tahap7` mensyaratkan tampilan Lama
   (Klasik) identik dengan commit `fd9aad7` termasuk permintaannya; pemantau kabar karenanya tidak jalan di Lama.
6. **K13 tanpa virtualisasi.** Tinggi baris beragam (rincian terbuka, borang catat) dan cetak/unduh membaca
   seluruh baris; hanya pekerjaan menggambar ulang yang dipangkas. Sidik baris memakai cache per identitas obyek
   (mengasumsikan obyek keadaan tidak diubah di tempat - benar untuk seluruh state React layar ini).
   Penjaga `tabel-jadwal-ringan-25okt` mencocokkan daftar kebergantungan dengan semua peubah yang dibaca baris,
   sehingga peubah baru yang terlupa membuat uji merah.
7. **Berkas tanaman ekstensi** berganti sidik (isi `konten.js`) tetapi versinya sengaja tetap 1.205.38; naikkan
   pada rilis berikutnya.
8. **Lingkungan laptop:** `aleta-ai-tugas-25okt` (2 uji, Python `resource`) dan beberapa uji yang membaca berkas
   tak terlacak (`abt-paket/`, logo MA) merah di worktree tetapi hijau di checkout utama bila berkasnya ada;
   bukan dari rantai A.
