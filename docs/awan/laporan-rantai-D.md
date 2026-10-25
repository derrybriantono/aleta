# Laporan rantai D: Blangko dan ketepatan (D1-D6), 25 Okt 2026

Dikerjakan di laptop (worktree `w76`), bukan di awan. Dasar: `origin/fitur/jejak-isian` (C1, commit `24ee84b3`). Cabang bertumpuk, semuanya sudah di-push. Tidak ada `main`/`integrasi-*` yang disentuh, tidak ada PR, tidak ada kenaikan versi, tidak ada pemasangan, server 192.168.10.10 tidak dijangkau.

## Cabang dan commit ujung

| Urut | Cabang | Commit ujung | Butir |
| :--- | :--- | :--- | :--- |
| D1 | `fitur/ketepatan-isian` | `cef626ec` (isi: `4cddf4cc`) | U3 + U4 |
| D2 | `fitur/tutup-isian-manual` | `2a47b645` | U11 |
| D3 | `fitur/wajib-sebelum-cetak` | `7e7e2ee4` | U13 |
| D4 | `fitur/huruf-alasan-belajar` | `cbcd82ab` (isi: `3f53fd0d`) | U14 |
| D5 | `fitur/sebutan-pihak` | `014c3307` (merge perbaikan D4; isi: `1d023403`) | U15 |
| D6 | `fitur/isian-per-sidang` | tip cabang ini (merge `5223922b`; isi: `57e34f6f`; ditambah commit laporan) | U12 |

`cef626ec` hanya memendekkan satu langkah panduan agar lolos uji batas 400 huruf (uji itu baru ketahuan di D2); D2-D6 sudah dibangun di atasnya. `cbcd82ab` memperbaiki kode isian yang tertulis telanjang di teks tampil D4 (ketahuan uji penuh); karena cabang sudah di-push, perbaikannya DIGABUNG ke D5 dan D6 (merge, tanpa force-push), bukan ditulis ulang. `ekstensi-berkas.ts` ditanam ulang di tiap merge.

## Saklar baru (Fitur Satker; semuanya bawaan MATI, mati = perilaku lama persis)

| Kode saklar | Cabang | Yang dinyalakan |
| :--- | :--- | :--- |
| `ketepatan-isian` | D1 | menghitung ketepatan isian dari jejak (C1), membuat usulan naik/turun, mendorong keputusan ke bot |
| `isian-sekali` | D2 | isian manual tanpa sumber diingat per perkara, tampil sebagai saran di blangko lain |
| `wajib-sebelum-cetak` | D3 | riwayat kelengkapan semua jenis blangko, pengingat "biasanya terisi", saran dari perkara serupa |
| `huruf-alasan-belajar` | D4 | pertimbangan huruf alasan dari hakim/majelis/pola + saran dasar hukum per huruf |
| `isian-per-sidang` | D6 | isian BAS tersimpan per sidang, dipakai sementara saat cetak |

D5 tidak punya saklar: ia melengkapi aturan sebutan pihak (Pelawan/Terlawan, Pembantah/Terbantah) yang sebelumnya selalu salah dijawab Penggugat/Tergugat; sebutan dasar untuk semua pemanggil lama tidak berubah. Urutan menyalakan yang disarankan: `jejak-isian` (C1) lebih dulu dan biarkan 2-4 pekan, baru `ketepatan-isian` dan `huruf-alasan-belajar` (keduanya butuh datanya).

## Migrasi

| Nomor | idx jurnal | Cabang | Tabel |
| :--- | :--- | :--- | :--- |
| 0092 | 82 | D1 | `aleta_ketepatan_isian`, `aleta_ketepatan_keputusan` |
| 0102 | 83 | D3 | `aleta_blangko_lapor` |
| 0103 | 84 | D6 | `aleta_isian_sidang` |

idx 82-84 berurutan sesudah idx 81 (0091, C1) agar jurnal tanpa lubang; bentrok idx dengan rantai A/E/B dirapikan sesi utama saat gabung. Tiap migrasi: SQL + jurnal + DDL `schema.ts` + daftar `client.ts`, dijaga uji kesamaan berkas SQL dengan DDL. D2, D4, D5 tanpa migrasi (D2 memakai `aleta_isian_perkara` 0035; D4 membaca jejak C1 dan pustaka 0026/0061).

## Ringkasan per butir

- **D1 Ketepatan isian.** Angka bulanan per isian x pengisi x jenis perkara dari `aleta_isian_jejak`. Naik bila presisi >= 95% dari >= 30 kejadian dalam jendela 6 bulan; turun bila isian yang sudah boleh terisi sendiri < 90%. Usulan hanya jadi `disetujui` lewat POST bernama dari **Super Admin** (akun Derry termasuk); tidak pernah otomatis; paling tinggi "cukup" (bukan "pasti"). Keputusan didorong ke bot (`/internal/aleta-bot/gerbang-isian/sinkron`), bot menyimpannya di `data/gerbang-isian-disetujui.json` dan `gerbangIsian.js` mendahulukannya atas berkas JSON; berkas JSON tetap bawaan dan cadangan. Layar "Ketepatan isian" di Integrasi e-Court (jangkar `#ketepatan-isian`) juga menampilkan U4: kebenaran isi saksi (diterima, atau disunting tetapi kemiripan >= 0,9) per jenis keterangan, katalog, dan bulan.
- **D2 Isian sekali per perkara.** Daftar 134 isian popup tanpa pengisi otomatis (dibangun dari `DAFTAR-CEK.json`, urut menurut `BEBAN-MANUAL.json` + hitungan hidup jejak) diingat per perkara di `aleta_isian_perkara`. Tampil sebagai SARAN (Tab); tidak pernah menulis ke ABT sendiri.
- **D3 Daftar wajib sebelum cetak.** Kelengkapan semua jenis blangko dicatat (saat berubah dan saat dicetak). Isian yang terisi pada >= 90% dari >= 8 cetak (satu per perkara) ikut diingatkan di dialog cetak yang sudah ada ("Tetap cetak" tetap ada). Saran dari perkara serupa yang sudah putus (putusannya pernah dicetak): hanya isian non-identitas, tanpa tanggal/angka, nilai sama pada >= 2 perkara; selalu "ragu".
- **D4 Huruf alasan.** Tetap usulan. Kecocokan usulan mesin vs pilihan akhir per pola (jenis perkara + huruf usulan), kebiasaan hakim sendiri, anggota majelis lain (tanpa nama), dan dasar hukum per huruf dari pustaka pertimbangan; yang belum disahkan atau belum terbukti bertanda `[PERLU VERIFIKASI]`. Tombol "Pakai huruf X" ditekan hakim sendiri. Layar Admin hanya menampilkan kecocokan per pola, tanpa nama hakim.
- **D5 Sebutan pihak.** Pelawan/Terlawan (perlawanan, verzet, derden verzet, `/Pdt.Plw/`) dan Pembantah/Terbantah (bantahan, `/Pdt.Bth/`) mendahului aturan alur gugatan tetapi tidak pernah mengalahkan alur permohonan, jenis 346/341, atau jinayat. Bentuk jamak (`paraSebutan`, `sebutanBerurut`, `daftarSebutanBerurut`) dan rekonvensi (`sebutanLengkap`) dari satu tempat; katalog saksi (`isiTanda`) dan pengisi Pemohon I/II memakainya. Empat salinan (TS, bot, katalog saksi ekstensi, juru sita ekstensi) diuji menjawab sama atas tabel kasus per alur yang sama.
- **D6 Isian BAS per sidang.** Hanya BAS, hanya isian teks/tanggal. Saat BAS sidang tertentu dicetak: nilai ABT sekarang disimpan (juga di penyimpanan peramban), nilai sidang itu ditulis ke ABT sementara, naskah diambil, ABT dipulihkan. Gagal menulis di tengah = yang sudah ditulis dipulihkan dan cetak dibatalkan (tidak mencetak BAS dengan isian sidang lain). Cetak terputus (peramban tertutup) = daftar pemulihan memulihkan ABT begitu perkara dibuka lagi, tanpa menimpa suntingan petugas sesudahnya. Memakai tabel baru, bukan kolom `sidang` di `aleta_isian_perkara`, supaya indeks unik dan pembaca isian Kelas B (blangko ALETA) tidak berubah arti.

## Uji (data rekaan; tanpa `.env`, sandi, token, dump)

Uji sasaran baru, semuanya hijau saat di-commit:

| Berkas uji | Jumlah |
| :--- | ---: |
| `ketepatan-isian-25okt.test.ts` (D1) | 40 |
| `isian-sekali-25okt.test.ts` + `isian-sekali-ekstensi-25okt.test.ts` (D2) | 15 + 9 |
| `wajib-sebelum-cetak-25okt.test.ts` + `wajib-sebelum-cetak-ekstensi-25okt.test.ts` (D3) | 19 + 8 |
| `huruf-alasan-belajar-25okt.test.ts` + `huruf-alasan-belajar-ekstensi-25okt.test.ts` (D4) | 16 + 5 |
| `sebutan-pihak-lengkap-25okt.test.ts` (D5) | 40 |
| `isian-per-sidang-25okt.test.ts` + `isian-per-sidang-ekstensi-25okt.test.ts` (D6) | 12 + 11 |

Uji ekstensi menjalankan `blangko-derry-isian.js` dan kawan-kawannya SUNGGUHAN di jsdom (portal, bot, ABT ditiru di fetch), bukan hanya `toContain`. Uji lama yang disentuh dan tetap hijau: `banyak-satker-fitur` (daftar saklar bawaan mati ditambah), `tutorial-hidup`, `jejak-isian-25okt`, `jejak-isian-derry-25okt`, `blangko-derry-isian-16okt`, `blangko-derry-isi-otomatis-19okt`, `blangko-derry-cetak-massal-20okt`, `sebutan-pihak-satu-sumber`, `blangko-derry-katalog-20okt`, `pemetaan-blangko-u5-9okt`, `abt-usulan`. `npx tsc --noEmit` bersih di tiap cabang. ESLint atas berkas yang diubah/ditambah bersih. Skrip `npm run lint:jangan-bertambah` melaporkan baris "BARU" HANYA pada berkas yang tidak disentuh rantai D (catatan `lint-utang.json` di dasar C1 sudah tertinggal); tidak ada berkas rantai D yang muncul.

Catatan uji tidak stabil (bukan dari rantai D): `jejak-isian-25okt` "retensi 2 tahun ... penyimpanan sendiri ikut membersihkan sesekali" menunggu 50 ms untuk pembersihan latar dan sempat merah sekali saat mesin sibuk; hijau pada ulangan.

Hasil uji penuh (`periksa-uji.mjs`): lihat bagian "Uji penuh" di bawah.

## Yang perlu dikerjakan di laptop/server sesudah gabung

1. Gabung D1-D6 (cabang bertumpuk; ujung = `fitur/isian-per-sidang`). Rapikan idx jurnal 82-84 terhadap rantai lain.
2. Jalankan migrasi 0092, 0102, 0103 dengan `ALETA_RUN_DB_MIGRATIONS=1` (migrasi tidak jalan diam-diam tanpa itu).
3. **Bot WAJIB dibangun ulang**: `services/gerbangIsian.js` (keputusan lapangan), `routes/gerbangIsianRoutes.js` + `app.js` (rute baru), `routes/internalGatewayRoutes.js` (meneruskan jenis perkara ke gerbang), `services/sebutanPihakService.js`, `services/abtUsulanService.js`. Bot lama tetap jalan: keputusan gerbang diabaikan dan sebutan lama dipakai.
4. **Rilis ekstensi** (`jejak-isian.js`, `blangko-derry-isian.js`, `blangko-derry-katalog.js`, `jurusita.js`; sudah ditanam ke `ekstensi-berkas.ts` tanpa naik versi) lewat skill `rilis-ekstensi`. Tanpa rilis ekstensi, saklar D2/D3/D4/D6 tidak berpengaruh di layar petugas.
5. Nyalakan saklar satu per satu di Fitur Satker dan periksa: `isian-per-sidang` perlu uji tangan atas ABT sungguhan (MariaDB 5.5) sebelum dinyalakan untuk semua PP: coba satu perkara dengan dua BAS beruntun, cetak BAS sidang pertama, lalu pastikan isian ABT kembali ke yang terakhir diketik.
6. Ukur ketepatan atas data sungguhan: sesudah `jejak-isian` menyala 2-4 pekan, buka layar Ketepatan isian (Integrasi e-Court), bandingkan usulan naik dengan `docs/isi-sipp-abt/UKURAN-GERBANG-*.json`, baru setujui satu per satu. Jalankan `node scripts/isi-sipp-abt/bangun-isian-sekali.cjs` bila `DAFTAR-CEK.json` diperbarui (uji menagihnya).
7. Cari sumber SIPP yang belum dipakai untuk isian di daftar D2 (langkah 2 U11: tabel panggilan, sita, mediasi, biaya, e-Court): butuh MySQL SIPP lokal, tidak dikerjakan di sini. Kolom "Sumber yang mungkin" di layar D2 memuat petunjuk dari daftar cek.

## Keputusan yang diambil sendiri (paling aman) dan pertanyaan terbuka

1. **Penyetuju D1**: "Super Admin + Derry" dibaca sebagai peran Super Admin (akun Derry sudah Super Admin). Admin biasa boleh melihat dan menghitung ulang, tetapi tidak boleh menyetujui/menolak/mencabut. Bila Derry ingin dua penyetuju sekaligus (dua tanda tangan), itu tambahan kecil.
2. **Kunci keputusan D1**: kode isian + pengisi (penanda asal yang sama dengan jejak) + jenis perkara (id SIPP). Pengisi yang tidak melewati gerbang bot (mis. `bawaan-abt`) tidak pernah diusulkan. Keputusan "naik" paling tinggi "cukup".
3. **"Salin dari perkara serupa" (D3)** sengaja sangat konservatif karena menyalin fakta perkara lain berarti mengarang isi dokumen: hanya rumusan yang ditulis sama oleh >= 2 perkara serupa, tanpa nama/alamat/tanggal/angka/jumlah/bukti/saksi, dan hanya saran. Dengan aturan ini daftar usulan akan pendek; longgarkan `POLA_BUKAN_SALINAN` (`src/lib/wajib-cetak.ts`) hanya atas keputusan Derry. Pola perkara serupa saat ini kasar (alur, ghaib, prodeo, e-Court, jumlah pihak, verstek); pola yang lebih tajam (mis. huruf alasan) menunggu keputusan.
4. **Bahan D3 mulai kosong**: perkara serupa baru ada setelah putusan dicetak dengan saklar menyala. Itu sengaja (tanpa mengarang "sudah putus" dari sumber lain).
5. **D4** memakai pasangan (jenis perkara, huruf usulan mesin) sebagai "pola", sebab ekstensi lama belum mengirim `kodePola` isian ke jejak. Bila kelak `kodePola` dikirim, kecocokan per pola bisa lebih halus.
6. **D5**: jenis perlawanan/bantahan dikenali dari nama jenis atau kode register nomor perkara (`Pdt.Plw`, `Pdt.Bth`); `alur_perkara_id`/`jenis_perkara_id` SIPP-nya belum diketahui. Mohon dicek di SIPP Donggala begitu ada perkara perlawanan/bantahan; bila SIPP memakai id khusus, tambahkan di `sebutan-pihak.ts` dan ketiga salinannya.
7. **D6 hanya BAS** (putusan dan relaas tidak memakai lapisan ini) dan hanya isian teks/tanggal; tanya-jawab saksi dan isian multi-sidang sudah per sidang di ABT. Pratinjau tetap memakai isi ABT saat ini (bukan isian sidang); hanya cetak (dan cetak massal) yang menerapkan isian sidang. Perlu diputuskan apakah pratinjau juga harus per sidang.
8. Skrip `lint:jangan-bertambah` mencatat banyak baris "BARU" pada berkas lain (catatan utang di dasar C1 tertinggal); mohon `--rapatkan` oleh sesi utama sesudah gabung.

## Uji penuh (sekali, di ujung D6)

`ALETA_UJI_TMP=D:\Aplikasi\aleta\tmp\ujiRD ALETA_UJI_UTAS=2 node scripts/periksa-uji.mjs` dari `manajemen_surat/` di `w76`, dijalankan baru setelah folder `ujiRC`/`ujiRE`/`ujiRB` tenang 5 menit dan memori bebas >= 3 GB (menunggu sekitar 70 menit karena uji penuh rantai B). Sebelum perbaikan D4: 958 berkas, 943 hijau, 13 merah; 18.024 uji, 17.991 lulus, 13 gagal. Log: `D:\aleta-dev\kerja\hasil-vitest-2026-10-25T17-24-54-757Z.txt`. Tidak ada berkas habis waktu. Tidak ada yang diulang dalam rangkaian penuh; 13 berkas itu saya periksa terpisah:

| Berkas merah | Sebab | Keadaan |
| :--- | :--- | :--- |
| `docx-tabel-gambar`, `eviden-skp-cetak`, `xlsx-lembar-bebas` | `public/mahkamah-agung-logo.png` tidak ikut ke worktree baru (berkas tak terlacak) | hijau sesudah disalin dari `w33` (tidak di-commit) |
| `w2a-kebendaan`, `w3b-blangko-baru-21okt` | `abt-paket/` tak terlacak tidak ikut ke worktree baru | hijau sesudah disalin dari `w33` (tidak di-commit) |
| `ekstensi-isian-tanpa-kode-tampil-18okt` | **salah rantai D** (D4): literal `data-ambil="8503"` di teks tampil | diperbaiki `cbcd82ab`, hijau |
| `performa-denyut-susulan-19okt`, `blangko-derry-isi-otomatis-19okt` | merah hanya pada putaran penuh (waktu/beban mesin) | hijau saat dijalankan sendiri (7 dan 52 uji) |
| `bawaan-abt-itsbat-18okt` (3 uji), `elitigasi-7139-otomatis-17okt` (1 uji) | **sudah merah di dasar C1**: kode C1 memakai `konteksJejak` di jalur simpan, sedangkan harness uji lama mengiris sumber tanpa peubah itu sehingga penyimpanan tertelan galat. Bukan dari rantai D | tidak diubah (urusan rantai C; perbaikan = beri harness peubah `konteksJejak`) |
| `root-redirect` (2 uji) | mengarah ke `/setup` (bergantung keadaan basis data lokal), tidak disentuh rantai D | tetap merah, di luar rantai D |
| `tema-ecourt-23okt` (1 uji) | menuntut versi manifest `1.205.38`, dasar sudah `1.205.39`; tidak disentuh rantai D | tetap merah, di luar rantai D |
| `alamat-desa-ketik-22okt` (1 uji) | batas "pencarian < 5 ms" terlampaui saat mesin sibuk | tetap merah di laptop ini, di luar rantai D |

Jadi sesudah perbaikan, merah yang tersisa (9 uji di 5 berkas: `bawaan-abt-itsbat-18okt`, `elitigasi-7139-otomatis-17okt`, `root-redirect`, `tema-ecourt-23okt`, `alamat-desa-ketik-22okt`) ada tanpa rantai D; rantai D tidak menambah merah. Keterangan "sudah merah di dasar C1" untuk dua berkas pertama disimpulkan dari kode (`git show origin/fitur/jejak-isian`: jalur simpan memakai `konteksJejak`, kedua uji tidak menyediakannya), bukan dari menjalankan ulang dasar C1.
