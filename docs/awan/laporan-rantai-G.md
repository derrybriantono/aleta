# Laporan rantai G: tenggat perkara dan berkas e-Court (G1-G2)

Dikerjakan 25-26 Okt 2026 di laptop (worktree `D:\aleta-dev\wt\w77`), tanpa menjangkau server 192.168.10.10, SIPP, ABT, atau e-Court. Semua data uji rekaan; tidak ada `.env`, sandi, atau token di repo. Versi tidak dinaikkan, tidak ada yang dipasang.

## Cabang dan commit

Dasar: `origin/fitur/kabar-perubahan` (8265d6df, ujung rantai A).

| Urut | Cabang | Commit ujung kode | Keterangan |
| :--- | :--- | :--- | :--- |
| G1 | `fitur/penjaga-tenggat-terjadwal` | `d9639e68` | sudah di-push |
| G2 | `fitur/ecourt-kesimpulan-bukti` | lihat `git log -3` di cabang (commit kode lalu commit laporan ini) | bertumpuk di G1 |

## Angka uji

Sasaran (per berkas, laptop ini):

- G1: `penjaga-tenggat-terjadwal-25okt` 35 hijau; `tenggat-layar-25okt` 8 hijau (6 layar Tenggat + 2 kartu saklar G2); `penjaga-tenggat` (lama) 33 hijau; `tabel-cadangan-terdaftar` 6; `tutorial-hidup` 22 + layar 7; `hak-akses-rute-18okt` 28; `hak-akses-peta-18okt` 28; `istilah-tampilan` 3.
- G2: `ecourt-kesimpulan-bukti-25okt` 38 hijau (pembersih tata letak 8, kesimpulan 9, daftar bukti 8 + penulis ekstensi 5, pemetaan bukti-saksi 4, saklar 2, dst.); uji JJ/bukti lama (`tanya-jawab-ecourt`, `bukti-ecourt`, `jawab-menjawab-ecourt`) 78 hijau tanpa diubah.
- Gugus ekstensi/blangko Derry (157 berkas uji, di atas G2): 154 hijau pada putaran pertama; 3 berkas gagal MUAT (`ekstensi-bas-massal`, `ekstensi-portal-tahap4`, `ekstensi-pratinjau-bas-relaas-20okt`: `Timeout calling "fetch"` saat beban empat agen), hijau (92 uji) saat diulang sendirian.
- `npx tsc --noEmit`: bersih pada G1; G2 lihat bagian akhir.
- Lint: berkas yang diubah/ditambah 0 galat, 0 peringatan (eslint per berkas).

Uji penuh `scripts/periksa-uji.mjs`: lihat "Uji penuh" di bagian akhir.

## Saklar baru dan bawaannya (SEMUA MATI)

Disimpan di `aleta_ekstensi_setelan` (pengguna `*sistem*`), tanpa tabel baru; hanya Super Admin yang mengubah (rute menegakkan, bukan hanya tombol).

| Saklar | Kunci | Bawaan | Akibat bila MATI |
| :--- | :--- | :--- | :--- |
| Jadwal harian penjaga tenggat (07.30 WITA, hari kerja) | `sistem:penjaga-tenggat` `.jadwal` | MATI | detak 5 menit tidak membaca SIPP, tidak membuat catatan, tidak ada lonceng |
| Pengingat WhatsApp pribadi | `sistem:penjaga-tenggat` `.pengingatWa` | MATI | tidak ada pesan; juga mati bila jadwal mati (dua saklar) |
| Aturan yang boleh masuk pengingat WA | `.aturanPengingat` | tujuh aturan lama; tiga aturan baru TIDAK dicentang | aturan baru tidak pernah dikirim sebelum Derry memeriksa dasarnya |
| Daftar alat bukti dari e-Court ditulis otomatis | `sistem:ecourt-berkas-otomatis` `.bukti` | MATI | usulan tetap "ragu" |
| Kesimpulan ditulis otomatis ke tanya-jawab | `.kesimpulan` | MATI | kesimpulan tidak ikut tanyaJawab sama sekali (keluaran bot persis seperti sebelum G2) |
| Usulan pemetaan bukti-saksi | `.buktiSaksi` | MATI | rute `bukti-saksi` menjawab `aktif:false` tanpa membaca berkas |

Env darurat: `ALETA_PENJAGA_TENGGAT=0` mematikan detak. Layar Tenggat dan kartu saklar berkas e-Court ada di `/aleta-ecourt/tenggat`.

## Migrasi

- **0110** `aleta_tenggat_kirim` (catatan kirim pengingat; kunci utama `<tanggal>:<id penerima>` = pencegah pesan ganda), jurnal **idx 83**. Tiga tempat: SQL + `_journal.json`, `DDL_ALETA_TENGGAT_KIRIM` di `schema.ts`, daftar cadangan di `client.ts`; uji `tabel-cadangan-terdaftar` hijau.
- **0111** TIDAK dipakai (G2 tanpa tabel).
- idx jurnal berurutan tanpa lubang (diuji). Rapikan idx bila saat gabung ada rantai lain yang juga memakai idx 83.

## Aturan tenggat dan dasar hukum (WAJIB diperiksa Derry, bertanda [PERLU VERIFIKASI Derry] di kode)

Aturan lama (tidak berubah): umur perkara 5 bulan (SEMA 2/2014), ikrar talak 6 bulan sejak PHS ikrar (Pasal 70 ayat (6) UU 7/1989; keputusan pengguna no. 91), akta cerai gugat/talak, relaas sidang pertama, Direktori Putusan gagal, anonimisasi hilang. Perubahan satu-satunya: batas ikrar kini 6 BULAN KALENDER dari PHS (`ikrarTalakService.batasEnamBulanIkrar`) bila jalur baru dipakai; jalur lama tetap 180 hari.

Aturan baru (kode `src/lib/penjaga-tenggat.ts`, `ATURAN_BARU`):

| Aturan | Hitungan | Dasar yang ditulis (dari ingatan pengembang, belum diperiksa) | Sifat butir |
| :--- | :--- | :--- | :--- |
| `banding-14-hari` | 14 hari, PER PIHAK: dari putusan diucapkan bila hadir; dari pemberitahuan putusan bila tidak hadir (`appealDeadlineService`, tidak digandakan). Putusan verstek: pihak kedua dihitung dari pemberitahuan. Pihak tidak hadir yang belum diberitahu: catatan "masa belum berjalan", tanpa tanggal. | Pasal 199 RBg (RBg, bukan HIR) - 14 hari; Pasal 7 UU 20/1947 untuk Jawa-Madura | masa HAK, bukan kelalaian: menjelang (3 hari terakhir), berjalan (hanya layar), CATATAN setelah berakhir (hanya bila kehadiran pasti, 30 hari) - tidak pernah "lewat tenggat" |
| `kasasi-14-hari` | 14 hari sejak putusan banding diberitahukan (kolom pemberitahuan di `perkara_banding`, kolom yang tidak ada = aturan diam) | Pasal 46 ayat (1) UU 14/1985 jo UU 5/2004 jo UU 3/2009 | sama dengan banding |
| `mediasi-30-hari` | 30 hari sejak penetapan penunjukan mediator, laporan mediator belum masuk, perkara belum putus (angka sama dengan `BATAS_MEDIASI_HARI`, dijaga uji) | Pasal 24 ayat (2) PERMA 1/2016; perpanjangan ayat (3) TIDAK terbaca dari SIPP | kewajiban petugas: lewat/menjelang/berjalan |

Pengaman tuduhan palsu: jendela baca 60 hari (putusan) / 120 hari (mediasi); banding dibaca hanya yang belum BHT dan belum ada permohonan banding; sandi kehadiran saat putusan selain 1-4 = "tidak pasti" sehingga tidak pernah dinyatakan "masa berakhir". Ambang belum diukur atas SIPP (mati sampai 26 Okt): ukur dengan `npx tsx scripts/coba-penjaga-tenggat.ts <tanggal> --baru` (mencetak jumlah per aturan dan tingkat, tanpa nama pihak).

## Yang dibangun

G1:
- Mesin aturan murni (`penjaga-tenggat.ts`, `tenggat-terjadwal.ts`): hitung mundur, tanggal batas, sebutan pihak dari `sebutan-pihak.ts`, penerima pribadi ketat (`namaAdaDi` atas majelis/PP/jurusita/mediator; tanpa "gagal-terbuka"), saringan layar.
- Bot: `penjagaTenggatService.js` (pembaca banding/kasasi/mediasi, petugas perkara, batas ikrar tegas; hanya bila `baru=1` - rute lama berbunyi persis seperti sebelumnya), `appealDeadlineService.js` (`computeAppealWindows`, `computeKasasiDeadline`).
- Portal: penjadwal (`instrumentation.ts`, `server/modules/penjaga-tenggat/layanan.ts`), lonceng (`tasks/service.ts`), rute `/api/aleta-ecourt/tenggat`, layar `/aleta-ecourt/tenggat` (saringan majelis/PP, perkara saya, dasar tiap aturan, saklar), entri panduan.
- Penyaringan "perkara saya" ditegakkan di SERVER (hakim/PP/jurusita hanya menerima perkara bernama mereka; pimpinan/panitera/panmud/admin melihat semua).

G2:
- Kesimpulan: `tanyaJawabEcourtService.TUJUAN_KESIMPULAN` (kunci `kesimpulan lisan <0046|0047>`, tanpa kode tetap); ekstensi mencari variabel tanya-jawab kesimpulan dari DAFTAR VARIABEL blangko (bukan angka tetap); hanya saat saklar menyala.
- Daftar bukti: `nilaiRapiBukti` (7 ukuran), `buktiOtomatis` per pihak, usulan naik ke "cukup" hanya saat saklar menyala dan daftar rapi; ekstensi `barisBuktiEcourt` mengisi penyunting bukti HANYA bila isian ABT kosong dan tanpa bawaan (sekali per perkara-pihak).
- Pembersih tata letak (replik/duplik): nomor butir berdiri sendiri disatukan, glif butir, kata terpenggal, kepala bernomor perkara pada surat 1-2 halaman, blok tanda tangan tanpa "Demikian", tempat-tanggal berbulan singkat.
- Pemetaan bukti-saksi: `src/lib/bukti-saksi.ts` + rute `POST /api/aleta-ecourt/bukti-saksi` (usulan "ragu", kutipan jawaban apa adanya).
- Skrip ukur: `manajemen_surat/scripts/ukur-berkas-ecourt-g2.mts`.

## Langkah laptop/server sesudah gabung

1. Gabung rantai, rapikan idx jurnal (0110), jalankan migrasi dengan `ALETA_RUN_DB_MIGRATIONS=1`.
2. **Bangun ulang bot** (kode bot berubah: penjagaTenggat, appealDeadline, route, isiGugatan, bukti, tanyaJawab, pembersih) dan portal. Mulai ulang bot.
3. Ekstensi: `blangko-derry-isian.js` berubah dan sudah ditanam (`ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs`, tanpa naik versi); rilis/salin ke folder Chrome lewat sesi utama (skill `rilis-ekstensi`).
4. Setelah SIPP hidup (Senin 26 Okt 08.00): jalankan `npx tsx scripts/coba-penjaga-tenggat.ts <tanggal> --baru` dan tinjau angka ketiga aturan baru SEBELUM menyalakan jadwal; nyalakan jadwal dulu (tanpa WA), lihat layar Tenggat beberapa hari; baru nyalakan pengingat WA, lalu centang aturan baru satu per satu SESUDAH dasar hukumnya diperiksa.
5. Ukur berkas e-Court sungguhan: salin berkas ke folder lokal dengan penamaan `<apa-saja>__<Jenis>__<Pengunggah>__<yyyy-mm-dd>.pdf`, jalankan `npx tsx scripts/ukur-berkas-ecourt-g2.mts <folder> --keluar=<json>`; hanya angka yang keluar. Sesuaikan `AMBANG` (tanya-jawab) dan `AMBANG_BUKTI` dari angka itu, baru nyalakan saklar isi otomatis berkas e-Court.

## Pertanyaan terbuka (pilihan paling aman sudah diambil, lanjut tanpa menunggu)

1. Dasar hukum tiga aturan baru (tabel di atas) dan apakah perpanjangan mediasi perlu dibaca (kolomnya belum dikenal).
2. Cermin Perkara (rantai A) TIDAK dipakai: Cermin belum memuat tanggal pemberitahuan putusan per pihak dan putusan banding, jadi G1 selalu lewat bot/SIPP (jalur lama). Bila kelak Cermin memuatnya, pembaca dapat dialihkan di `penjagaTenggatService.js`.
3. Siapa melihat SEMUA perkara di layar Tenggat: dipilih admin, super admin, pimpinan, panitera, panmud. Hakim/PP/jurusita hanya miliknya.
4. Kolom ABT untuk tanya-jawab KESIMPULAN: di data lokal tidak ada variabel `tanya jawab kesimpulan ...` (hanya 8436/8437 satu kalimat). Fitur menulis ke variabel itu HANYA bila blangko Derry punya variabelnya (kunci `kesimpulan lisan 0046/0047`); bila tidak punya, kesimpulan tetap ringkasan 8436/8437 + tombol Salin. Perlu dicek di ABT apakah variabel itu ada atau perlu dibuat Derry.
5. Penyunting bukti blangko Derry (1214/9911) hampir selalu punya BAWAAN ABT (KTP, akta nikah), sehingga isi otomatis dari e-Court menyala hanya bila bawaan juga kosong. Menambah butir e-Court ke bawaan (bukan hanya bila kosong) lebih berguna tetapi lebih berisiko; perlu keputusan.
6. Tampilan pemetaan bukti-saksi di ekstensi belum dibuat (hanya rute/API dan tes); perlu keputusan letak tampilannya (panel saksi?).
7. Kartu saklar berkas e-Court sementara ada di layar Tenggat; dapat dipindah ke Integrasi e-Court.
8. Pesan WhatsApp pengingat gagal tidak diulang otomatis; ada tombol "Kirim ulang yang gagal" untuk Super Admin.
9. Daftar bukti yang memuat bukti elektronik (WA, foto) tidak ditulis ke penyunting bukti surat karena nomor P/T akan bergeser; tetap usulan untuk variabel bukti lain.

## Uji penuh dan penutup

`ALETA_UJI_TMP=D:\Aplikasi\aleta\tmp\ujiRG ALETA_UJI_UTAS=2 node scripts/periksa-uji.mjs` dari `manajemen_surat/` di w77, dijalankan SEKALI sesudah G2 (menunggu uji penuh agen lain berakhir dulu): **956 berkas, 944 hijau, 2 dilewati, 10 merah; 18.081 uji, 18.052 hijau, 20 dilewati, 9 merah**. Rincian 10 berkas merah itu (semua sudah dijelaskan; tidak ada uji yang dinonaktifkan):

| Berkas merah | Sebab | Keadaan sekarang |
| :--- | :--- | :--- |
| `docx-tabel-gambar`, `eviden-skp-cetak`, `xlsx-lembar-bebas` | `public/mahkamah-agung-logo.png` tak terlacak git, belum saya salin ke worktree | hijau sesudah disalin (tidak di-commit) |
| `w2a-kebendaan`, `w3b-blangko-baru-21okt` | `abt-paket/` (data paket) tak terlacak, belum disalin | hijau sesudah disalin (tidak di-commit) |
| `alamat-desa-ketik-22okt` | batas waktu pencarian (35 ms lawan 25 ms) saat tiga agen menguji bersamaan | hijau diulang |
| `ekstensi-sdg-muatan-dan-jeda` | gagal sesaat saat beban | hijau diulang |
| `draf-h7-mulus-19okt` | **regresi saya**: penjaga teks menuntut rute isi-gugatan memuat `bacaGugatanEcourt`; refaktor singgahan memindahkannya | diperbaiki (pembaca disuntikkan dari rute ke singgahan), hijau |
| `aleta-ai-tugas-25okt` (2 uji) | lingkungan Windows: `python3` tanpa modul `resource` untuk sandbox Python T9; berkas ini dan sandbox tidak disentuh rantai G | merah lingkungan, ada sejak sebelum rantai G |
| `root-redirect` (2 uji) | lingkungan: mesin belum terpasang, mengarah ke /setup bukan /login; juga merah di rantai B dan D | merah lingkungan |

Sebelum uji penuh (sasaran): G1 dan G2 lihat "Angka uji". `npx tsc --noEmit` bersih di ujung G1 (d9639e68) dan di ujung G2 (lihat commit terakhir cabang). Lint (`node scripts/lint-jangan-bertambah.mjs`): 45 galat, sama dengan dasar; tidak satu berkas rantai G pun tercatat.

Catatan kerja: `tsc` penuh di laptop ini memakan 8-10 menit dan uji penuh sekitar 70 menit bila ada agen lain berjalan; uji "gagal muat" (`Timeout calling fetch`) pada gugus ekstensi muncul hanya saat empat agen berjalan bersamaan dan hijau bila diulang sendirian (92 uji pada tiga berkas ekstensi).
