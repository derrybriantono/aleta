# Laporan rantai C: Jejak isian dan saksi (25 Okt 2026)

Dikerjakan di laptop (worktree `w71`), tanpa menjangkau server 192.168.10.10. Tidak ada naik versi, tidak ada PR, tidak ada push ke `main`/`integrasi-*`, tidak ada pemasangan.

## Cabang dan commit ujung (bertumpuk: C1 dari integrasi, tiap cabang dari ujung sebelumnya)

| Urut | Cabang | Commit ujung | Butir |
| :--- | :--- | :--- | :--- |
| C1 | `fitur/jejak-isian` | `24ee84b3` | U1 + U2 + U6, migrasi 0091 |
| C2 | `fitur/katalog-saksi-sebagian` | `1f4f9c40` | K10 katalog dimuat per jenis perkara |
| C3 | `fitur/mesin-saksi-tunggal` | `8930cd92` | U7 |
| C4 | `fitur/katalog-saksi-db` | `92f6b74a` | U8, migrasi 0093 |
| C5 | `fitur/fakta-non-cerai` | `f38293f6` | U9 |
| C6 | `fitur/saksi-ke-bas-sipp` | lihat `git log` cabang ini (commit "kirim keterangan saksi ke BAS SIPP", `39074eb6`, ditambah commit laporan) | U10, migrasi 0101 |

C1 sampai C4 dikerjakan agen sebelumnya; di sini hanya C5 dan C6 (C5 memakai `kaliPertengkaranBas.js` buatan agen sebelumnya yang dilengkapi dan diuji).

## Saklar baru (semuanya MATI bawaan, katalog Fitur Satker, dinyalakan Super Admin)

| Kode | Cabang | Mati berarti |
| :--- | :--- | :--- |
| `jejak-isian` | C1 | tidak ada yang dicatat atau dibaca ulang |
| `mesin-saksi-tunggal` | C3 | tombol cerai lama persis seperti dulu |
| `katalog-saksi-basis-data` | C4 | ekstensi memakai JSON tertanam |
| `fakta-non-cerai` | C5 | keadaan non-cerai ditanyakan penuh ke petugas; 2557/2558 diketik tangan |
| `saksi-ke-bas-sipp` | C6 | tidak ada tombol, tidak ada tulisan ke SIPP, server menolak mencatat |

Ekstensi menanyakan saklar lewat `ekstensi/fitur?kode=...`; gagal bertanya = mati.

## Migrasi (idx sementara, dirapikan saat gabung akhir)

| Nomor | idx jurnal | Tabel | Cabang |
| :--- | :--- | :--- | :--- |
| 0091 | 81 | `aleta_saksi_butir`, `aleta_isian_jejak` | C1 |
| 0093 | 82 | `aleta_saksi_katalog`, `aleta_saksi_katalog_versi` | C4 |
| 0101 | 83 | `aleta_saksi_kirim_bas` | C6 |

C5 tidak memakai migrasi. Ketiganya terdaftar di SQL, `_journal.json`, `schema.ts`, `client.ts`; uji `tabel-cadangan-terdaftar` hijau. Ketiganya mengikuti tabel migrasi yang dicadangkan rantai C; 0092 dan 0094 dst. milik rantai lain.

## C5 (U9) yang dibangun

- `aleta_bot/services/keadaanNonCerai.js`: aturan posita/petitum untuk 24 katalog non-cerai (kewarisan, harta bersama, hak asuh, penguasaan anak, nafkah anak, hak bekas istri, kelalaian kewajiban, itsbat, dispensasi kawin, wali adhal, izin poligami, pengesahan/asal usul anak, ekonomi syariah, wasiat, hibah, wakaf, pembatalan, perwalian, penunjukan wali, penetapan ahli waris, mafqud, pengangkatan anak). Hasilnya SARAN: sangkalan tidak dihitung, pilih-satu yang bertentangan tidak diusulkan, isian dua nilai hanya "ada" bila posita menyebutnya, seluruh keyakinan "ragu". Uji mencocokkan setiap isian dan nilai dengan `saksi-katalog/*.json`.
- `config/gerbang-keadaan.json` (kosong) dan `gerbangIsian.js` (`perJenis`): tempat data U3 rantai D menaikkan ketepatan per jenis perkara (cukup bila otomatis, n >= 30, presisi >= 0,95). Tanpa data = semua ragu, perilaku lama utuh.
- `kaliPertengkaranBas.js`: 2557/2558 dibaca dari BAS tersimpan (dua saksi pihak P menurut urutan; hanya angka tertulis; kata samar tidak dijadikan angka; angka bertentangan = ragu). Dipanggil `/abt/usulan` hanya bila ekstensi meminta (saklar), tidak menimpa usulan yang sudah berisi, lewat gerbang (masih "tanpa ukuran" = saran ragu).
- Ekstensi: panel "Saran keadaan dari posita (periksa dulu; belum dikuatkan saksi)" di Susun saksi non-cerai: kalimat sumber pada tooltip, tombol Pakai dan Pakai semua saran; tidak ada yang terisi sendiri.

## C6 (U10) yang dibangun

Menulis ke SIPP, jadi berlapis. "BAS di SIPP" di sini = e-Doc BAS sidang (kolom `edoc_bas`), lewat jalur yang sudah ada dan teruji (mesin Unggah massal F4.1 dan rute `bas/unggah-sipp`). Tidak ada jalur tulis baru.

1. Saklar `saksi-ke-bas-sipp` mati bawaan.
2. Pratinjau tanpa menulis: sidang dicari di daftar BAS yang menjadi hak petugas; e-Doc yang sudah ada menghentikan (tidak pernah diganti dari sini); BAS dicetak ABT; setiap jawaban saksi di ABT harus ditemukan di naskah; naskah bertanda aplikasi ditahan; sisa isian dilaporkan.
3. Persetujuan petugas lewat kotak centang; tombol Kirim terkunci tanpanya.
4. Baca ulang sebelum menulis: keterangan saksi di ABT dibaca lagi dan dibandingkan sidik pratinjau (berubah = dibatalkan), lalu e-Doc di SIPP dicek lagi tepat sebelum unggah (dobel = tidak ditulis).
5. Penjaga tanda: rute unggah portal + bot sudah menolak tanda aplikasi; ditambah penahanan sejak pratinjau.
6. Tercatat: `aleta_saksi_kirim_bas` (sidik + hitungan, bukan isi BAS), rute `api/aleta-ecourt/saksi-ke-bas` (hak sama dengan unggah BAS, retensi 2 tahun).

## Uji

| Uji | Hasil |
| :--- | :--- |
| `fakta-non-cerai-25okt.test.ts` (baru) | 30 hijau |
| `saksi-ke-bas-sipp-25okt.test.ts` (baru) | 27 hijau |
| `abt-usulan`, `banyak-satker-fitur`, `tabel-cadangan-terdaftar`, `mesin-saksi-tunggal-25okt`, `saksi-semua-jenis-t2-25okt`, `gerbang-isian-u6`, `deteksi-cerai-13okt`, `ekstensi-tombol-saksi-blangko` | hijau |
| `katalog-saksi-db-25okt` | hijau bila dijalankan sendirian (17 uji, 87 dtk); pernah gagal pada tahap kumpul saat laptop sibuk dengan agen lain, lalu hijau diulang |
| `npx tsc --noEmit` | bersih |
| lint (`eslint . --format json`) | 45 galat = dasar 45; tidak ada pelanggaran di berkas yang diubah. `npm run lint:jangan-bertambah` kehabisan memori di laptop yang sedang dipakai 4 agen; jalankan dengan `NODE_OPTIONS=--max-old-space-size=3072` |
| Uji penuh (`periksa-uji`, 21.15-22.33, ujung C6 sebelum perbaikan kecil di bawah) | 10 berkas merah (salah hasil, tidak diulang). Tidak satu pun disebabkan C5/C6: `bawaan-abt-itsbat-18okt` (3), `elitigasi-7139-otomatis-17okt` (1), `aleta-ai-dompet-25okt` (1) dan `istilah-tampilan` (1) merah juga di ujung C4 (`92f6b74a`) pada pemeriksaan terpisah; `tema-ecourt-23okt` mengharap versi manifest 1.205.38 padahal dasar 1.205.39; `root-redirect` (redirect ke /setup), `docx-tabel-gambar`, `eviden-skp-cetak`, `xlsx-lembar-bebas` (gagal kumpul), `alamat-desa-ketik-22okt` (batas waktu ukur 5 ms; hijau diulang) adalah lingkungan laptop. `istilah-tampilan` diperbaiki di C6 (tulisan C3 "di borang" menjadi "di blangko") dan kini hijau. Sisanya perlu diperiksa pemilik cabangnya / sesudah gabung |

## Langkah laptop/server sesudah gabung

1. Gabungkan C1 sampai C6 (bertumpuk; ujung C6 memuat semuanya), rapikan idx jurnal (0091, 0093, 0101 bergeser), jalankan `ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs`.
2. Server: `ALETA_RUN_DB_MIGRATIONS=1` agar 0091, 0093, 0101 jalan (migrasi tidak jalan diam-diam tanpanya).
3. Mulai ulang bot (rute `/abt/usulan` memuat `keadaanNonCerai.js`, `kaliPertengkaranBas.js`, `gerbang-keadaan.json`).
4. Rilis ekstensi (berkas baru `saksi-ke-bas.js`; manifest bertambah satu entri) dan salin ke folder Chrome.
5. Semua saklar tetap MATI sampai Super Admin menyalakannya satu per satu. Urutan uji lapangan yang disarankan: `jejak-isian` (kumpulkan data 2-4 minggu untuk D1), `fakta-non-cerai`, `mesin-saksi-tunggal`, `katalog-saksi-basis-data`; `saksi-ke-bas-sipp` terakhir dan hanya setelah dicoba pada satu perkara latihan di SIPP nyata.
6. `saksi-ke-bas-sipp` perlu diuji manual pertama kali di SIPP (satu perkara, satu sidang): memeriksa bahwa e-Doc masuk dan jejak tercatat.

## Pertanyaan terbuka (dijawab dengan pilihan paling aman, tidak ada yang menghalangi)

- Arti "BAS SIPP" untuk U10: dipilih e-Doc BAS sidang (satu-satunya tempat SIPP menerima BAS). Bila yang dimaksud kolom teks BAS lain di SIPP, itu perlu penelusuran skema SIPP di server.
- Penggantian e-Doc BAS yang sudah ada sengaja tidak ditawarkan dari tombol ini; tetap lewat Unggah massal, Ganti.
- Gerbang keadaan non-cerai kosong: semua saran "ragu" sampai data U3 (rantai D) ada. Ambang 30 kejadian dan presisi 0,95 mengikuti kartu D1.
- Cakupan aturan posita 24 katalog bersifat awal; ukur atas posita nyata (n >= 10 per jenis, daftar T2) termasuk pekerjaan laptop sesudah server kembali.
