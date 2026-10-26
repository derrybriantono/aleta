# Laporan K11 - skrip hanya di halaman yang memakainya (26 Okt 2026)

Cabang `fitur/skrip-sesuai-halaman` (dasar `origin/integrasi-rantai-26okt` f2427b6d). Commit tahap: `f7b0072a` (1), `78c0dc6a` (2), `8587d8d4` (3), ditambah laporan ini. Versi manifest TIDAK dinaikkan; tidak dipasang; tidak PR.

## Ringkasan

Hasil diukur di Chromium sungguhan dengan ekstensi terpasang (`manajemen_surat/scripts/k11-e2e.mjs`, halaman SIPP/ABT/portal tiruan, API portal tiruan, tanpa login ke sistem nyata). Rupa DOM ALETA, galat, dan permintaan ke portal **sama** sebelum dan sesudah di semua skenario, termasuk menekan tiap tab panel dan membentangkan semua bagian.

## Yang dipecah

| Berkas lama | Menjadi | Dimuat kapan |
| :--- | :--- | :--- |
| `konten.js` 1.254 KB (tiap halaman SIPP) | inti 294 KB + `konten-panel-bersama.js` 242 KB + `konten-panel-perkara.js` 610 KB + `konten-panel-daftar.js` 86 KB + `konten-kontak.js` 27 KB | panel perkara: saat `segarkan()` mengenali halaman satu perkara; panel daftar: saat mengenali halaman daftar; kontak: saat blangko pihak/kuasa muncul |
| `abt.js` 1.003 KB (tiap halaman ABT) | inti 165 KB + `abt-panel-bersama.js` 32 KB + `abt-panel-blangko.js` 719 KB + `abt-panel-beranda.js` 85 KB | `pasang()` (halaman daftar variabel / tanya-jawab) dan `pasangMassalAbt()` (beranda ABT) menunggu modulnya tepat sebelum menggambar |
| `jurusita.js` 134 KB | tetap berkas yang sama, kini modul malas di SIPP (ABT tetap manifest) | prasyarat panel perkara dan panel daftar (satu-satunya pemakainya) |
| `saksiscan.js` 128 KB | modul malas | blangko `form#frm_ref_pihak` / `frm_ref_pengacara` / `frm_user` muncul, atau bersama panel perkara |
| `pihak-lengkap.js` 68 KB | modul malas (+ `konten-kontak.js`) | `form#frm_ref_pihak` / `frm_ref_pengacara` muncul |
| `penetapan-borang.js` 39 KB | modul malas | `form#frm_majelis` / `frm_panitera` / `frm_juru_sita` / `frm_sidang_pertama` muncul |
| `tarik-satu-perkara.js` 29 KB | modul malas | alamat cocok pola yang SAMA dengan gerbang skripnya (`detil[_-]?perkara\|detail[_-]?perkara`) |

Cara kerja: `modul-malas.js` (global `AletaModul`, dimuat sebelum `konten.js` / `abt.js`) meminta pekerja latar (`latar.js`, pesan `muat-modul`) menyuntik berkas ke dunia terasing halaman lewat `chrome.scripting.executeScript`. Skrip klasik yang disuntik berbagi lingkup const/let global dengan skrip manifest (diukur), jadi kode yang dipindah TIDAK berubah artinya. Modul ES (`import()`) sengaja tidak dipakai: ia memberi tiap berkas lingkup sendiri sehingga setiap rujukan silang const/let harus diekspor dan salinannya bisa basi. Pekerja latar hanya mau menyuntik berkas dalam daftar putih, hanya dari skrip konten ekstensi ini, hanya ke bingkai pengirim; tidak menyimpan keadaan apa pun (halaman yang mencatat berkas mana sudah dimuat; antrean mencegah suntik ganda). Tiap berkas menutup diri dengan penanda `__aletaModulSelesai`; jawaban "ok" tanpa penanda dianggap gagal. Gagal = panel tidak digambar pada putaran itu dan dicoba lagi sesudah 3 dtk (tidak pernah melempar).

Pembagian `konten.js` / `abt.js` dari **graf rujukan** (acorn + eslint-scope): simpul yang dapat dicapai dari kode inti TANPA melewati titik-masuk tetap di inti; sisanya pindah. Titik-masuk konten.js: `susunPanel` (3 pemanggil, semua ditandai `K11-GUARD`) dan `susunPanelDaftar`; abt.js: lima fungsi dalam `pasang()` dan dua dalam `pasangMassalAbt()`. Tambahan penjaga: `Date.now()` penanda waktu muat (`A1_MUAT_MS`) sengaja tetap di inti.

## Sengaja dibiarkan (dan sebabnya)

- `panel-alat.js` (581 KB, 591 simbol dipakai ±20 skrip), `checklist.js` (300 KB, widget yang harus muncul di semua halaman), inti `konten.js` (294 KB), `basmassal.js` (kasir di inti memakainya), `sipp-ide-*`, `penetapan-sipp`/`putusan-sipp`/`putusan-terjadwal*`/`popup-aksi`/`muat-ulang-sipp` (gerbangnya dari struktur DOM yang rumit dan saling memakai): memindahkannya berarti mengubah kapan fitur muncul atau menebak pola alamat SIPP. Tanpa bukti gerbang yang tepat, dibiarkan (sesuai arahan "bila ragu biarkan").
- `blangko-derry-isian.js` (472 KB) dan keluarga Blangko Derry di ABT: belum dianalisis gerbangnya.
- Pola `matches` manifest TIDAK dipersempit: halaman perkara SIPP bersandi base64 dan panel dikenali dari isi (nomor perkara), bukan alamat, jadi pola alamat tidak dapat dibuktikan aman. Penggantinya pemicu DOM/alamat di modul malas yang memakai penunjuk yang sama dengan modulnya.
- `saksi-ke-bas.js` tidak disentuh (C6 akan dihapus di cabang lain).

## Ukuran JS yang dimuat per jenis halaman (byte skrip ekstensi di-parse, e2e)

| Halaman tiruan | Skrip sebelum | sesudah | Byte sebelum | Byte sesudah | Selisih |
| :--- | ---: | ---: | ---: | ---: | ---: |
| SIPP beranda / laporan / cetak | 44 | 40 | 3.669.688 | 2.321.505 | -37% |
| SIPP daftar perkara (Lama & UI Baru) | 44 | 43 | 3.669.688 | 2.783.020 | -24% |
| SIPP halaman satu perkara | 44 | 44 | 3.669.688 | 3.435.076 | -6% |
| SIPP detil_perkara_agama (alamat cocok tombol Tarik data) | 44 | 45 | 3.669.688 | ±3.464.000 | -6% |
| SIPP blangko pihak (Lama & UI Baru) | 44 | 43 | 3.669.688 | 2.544.582 | -31% |
| SIPP blangko saksi (UI Baru) | 44 | 41 | 3.669.688 | 2.449.544 | -33% |
| SIPP borang penetapan (UI Baru) | 44 | 45 | 3.669.688 | 3.474.676 | -5% |
| ABT beranda | 38 | 39 | 3.520.502 | 2.697.560 | -23% |
| ABT beranda penuh (panel putusan/BAS massal) | 38 | 41 | 3.520.502 | 2.815.182 | -20% |
| ABT halaman daftar variabel blangko | 38 | 41 | 3.520.502 | 3.448.780 | -2% |
| Portal ALETA | 12 | 12 | 1.182.925 | 1.182.925 | 0 |

Halaman yang memang memakai semua fitur (perkara, blangko ABT) memuat hampir semua kode seperti sebelumnya (hanya yang tidak terpakai, mis. panel daftar, yang hilang) - itu disengaja: "fitur tetap ada dan bekerja persis sama". Jumlah skrip naik 1-3 pada halaman yang memuat modul malas (modul disuntik terpisah).

## Bukti tidak ada fitur hilang

1. `src/test/fixtures/k11-peta-fitur-sebelum.json` (inventaris ekstensi 1.205.39 SEBELUM K11: tiap berkas, nama tingkat atas, ekspor global, sidik tiap pernyataan `konten.js` dan `abt.js`) + `k11-peta-fitur-26okt.test.ts` + `k11-peta-abt-26okt.test.ts`: setiap pernyataan tingkat atas lama masih ada **persis** (multiset sidik sama), hanya lem K11 yang bertambah (2 fungsi penunggu per berkas induk + penanda selesai per modul); tiga pemanggil `susunPanel` dan satu `susunPanelDaftar` didahului penunggu; inti hanya merujuk titik-masuk; modul tidak merujuk ke atas; tiap berkas manifest lama masih di kelompoknya atau terdaftar modul malas; berkas lama yang jadi modul malas hanya bertambah satu baris penanda; berkas lain identik byte demi byte.
2. Rakitan ulang `konten.js` dari empat pecahan (urutan asli lewat fixture) sama dengan `konten.js` lama **byte demi byte** (dicek sekali, minus lem K11 dan baris kosong tambahan).
3. Uji lama tidak dilemahkan. `src/test/k11-konten-gabungan.ts` (setup vitest) membuat pembacaan `ekstensi-sipp/konten.js` dan `abt.js` mengembalikan gabungan pecahan pada urutan aslinya, sehingga ratusan uji penjaga teks dan uji jsdom tetap memeriksa seluruh kode (env `ALETA_KONTEN_MENTAH=1` untuk membaca inti mentah). Uji yang memang menyebut daftar manifest/izin diperbarui dengan pemeriksaan setara: izin `scripting` (aleta-ecourt-zip, ekstensi-unduh-universal, katalog-saksi-sebagian, menu-ecourt-sipp, pembaru-otomatis), urutan `abt-usulan`, `ekstensi-jurusita`, `saksi-scan-2okt`, `tarik-satu-perkara-21okt`, `tombol-muat-ulang-21okt`, `isi-borang-langsung-17okt`.
4. e2e Chromium (`scripts/k11-e2e.mjs`, 17 skenario): DOM ALETA, galat, dan permintaan portal sama; kini juga menekan tiap tab dan membuka semua bagian panel.

## Angka uji

- Sasaran per tahap: `npx tsc --noEmit` bersih; `npm run lint:jangan-bertambah` 45 = 45; 393 berkas uji yang menyebut `ekstensi-sipp` hijau (4 yang merah di tahap 3 diperbaiki dan hijau).
- Uji penuh: lihat bagian bawah (diisi sesudah selesai).

## Langkah uji tangan sesudah dipasang (SIPP/ABT nyata)

Muat ulang ekstensi (izin baru `scripting`; tanpa peringatan pasang, tetapi muat ulang di `chrome://extensions` diperlukan), buka console pekerja latar ekstensi untuk melihat galat, lalu:

1. SIPP: beranda, menu Laporan, halaman cetak relaas - tidak ada panel, tidak ada galat merah di console halaman; widget checklist/menu atas muncul seperti biasa.
2. SIPP: daftar perkara - panel DAFTAR PERKARA muncul (menu massal: penetapan, BAS, relaas, putusan) dan penanda baris.
3. SIPP: buka satu perkara lewat daftar (alamat bersandi `perkara_detil_agama/<enc>`) - panel perkara lengkap; tekan semua tab (Penetapan, Putusan, Berkas, PTSP, dst.), buka bagian Data Umum dan Juru Sita; tombol Tarik data di kepala bila alamatnya `detil_perkara_agama`.
4. SIPP: buka blangko Tambah Pihak (lajur Isi dari KTP, kontak e-Court, pekerjaan, alamat otomatis), blangko Saksi, blangko Penetapan Majelis/PP/JS/Hari Sidang (tombol Isi otomatis) dan Putusan Akhir - fitur muncul beberapa ratus milidetik sesudah blangko terbuka.
5. SIPP: jurnal keuangan / Tambah Biaya (Kasir), dasbor (Jadwalkan Putusan melayang) - tidak berubah.
6. ABT: beranda (panel putusan/BAS massal), halaman daftar variabel blangko (panel lengkap, Susun saksi), halaman tanya-jawab saksi, Blangko Derry.
7. Portal ALETA: panel tidak berubah.
8. Tutup pekerja latar (chrome://extensions > service worker > hentikan) lalu buka halaman perkara: panel tetap muncul (pekerja bangun sendiri).

## Pertanyaan terbuka

1. **Izin `scripting`** baru di manifest. Tanpa peringatan pasang (diketahui dari dokumentasi Chrome; belum diuji pada pemasangan nyata satker). Beberapa uji lama menjaga daftar izin supaya "tidak diam-diam bertambah" (pembaru-otomatis: `not.toContain("scripting")`); saya mengubahnya menjadi sengaja. Alternatif tanpa izin baru (modul ES `import()`) memaksa ekspor tiap const/let silang berkas - ditolak karena berisiko mengubah perilaku. Perlu keputusan Derry.
2. Latensi: panel pertama di halaman perkara menunggu suntik modul sejajar dengan permintaan ke portal (diprefetch begitu halaman dikenali); belum diukur di PC tua. Pada kegagalan suntik panel menunggu 3 dtk lalu mencoba lagi.
3. `tarik-satu-perkara.js` aktif hanya pada alamat `detil_perkara_agama` (bukan `perkara_detil_agama/<enc>`) - SAMA dengan gerbang lamanya; bila di SIPP nyata alamat bersandi tidak cocok, perilaku lama (tombol tidak muncul) tetap.
4. Sisa ±2,3 MB di beranda SIPP didominasi `panel-alat.js`, `checklist.js`, inti konten.js; memecahnya lagi butuh keputusan perilaku (widget muncul lebih lambat) atau analisa gerbang per berkas.
5. Rilis: setelah gabung jalankan skill `rilis-ekstensi` (versi naik, tanam, salin ke `D:\Download File\ekstensi-sipp`); hasil tanam di cabang ini dibuat dengan `ALETA_TANAM_PAKSA=1`, versi tetap 1.205.39.
