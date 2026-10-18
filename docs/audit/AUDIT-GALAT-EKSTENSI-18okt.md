# Audit galat ekstensi ALETA dan widget — 18–19 Oktober 2026

Agen AUDIT-GALAT, cabang `fitur/audit-galat` (dari `origin/integrasi-1205-8`).
Lingkup: `ekstensi-sipp/` (skrip konten SIPP/ABT/portal, `latar.js`, popup, widget/checklist, blangko Derry, saksi, jurusita, BAS massal, kasir, putusan-advance, konseptor, unduh).

## Ringkasan temuan dan perbaikan

| # | Tingkat | Berkas:baris | Gejala bagi petugas | Perbaikan | Uji regresi (perilaku) |
|---|---|---|---|---|---|
| G1 | sedang | `abt.js` ±7193 (`susunPanelMassalAbt`) | Setiap kali beranda ABT dibuka dan ABT menjawab bukan-200 atau tidak terjangkau, muncul satu `Uncaught (in promise) Error: ABT menjawab 404 saat membaca bilah kelompok` baru di chrome://extensions. Lencana merah Chrome terus menyala sehingga galat sungguhan tertimbun. **Terukur di Chromium sungguhan** (ekstensi unpacked atas replika beranda ABT), dua kali per kunjungan. Uji lama menutupinya dengan jawaban ABT "kosong, bukan 404". | `void lengkapiTokenPeta(...).then(...)` kini memakai `.catch`, dan galatnya dicatat ke kotak hitam (`massal-galat`). | `ekstensi-abt-token-tolak-18okt.test.ts`: panel-alat.js dan abt.js dijalankan di jsdom dengan ABT 404 dan jaringan putus. Uji menghitung `unhandledRejection` (harus 0) dan memeriksa catatan kotak hitam. **MERAH pada kode lama, HIJAU sesudah perbaikan.** |
| G2 | sedang | `abt.js` ±7483 (tombol "Simpan nama" di Pemetaan blangko putusan) | Saat ABT tidak terjangkau, galatnya lepas tanpa kabar dan baris kabar membeku di "mencari…". Petugas mengira proses masih berjalan. | Pemanggilan `cariTokenBlangko` dibungkus `try`. Kabar kini menyebut sebabnya dan memberi tahu bahwa nama tetap tersimpan. | Uji yang sama, kasus "Simpan nama" (merah pada kode lama). |
| G3 | kecil (laporan koordinator) | `konten.js` ±23040 (kartu *Langkah berikutnya*, s1) dan ±18837 (tenggat Penilaian SK) | Muncul kalimat "Keadaan perkara tidak terbaca: Keadaan perkara tidak terbaca dari ALETA." | Pembantu baru `sambungSebab(awalan, galat, titik)` di konten.js: awalan tidak diulang bila sebabnya sudah dimulai dengan awalan yang sama, dan titik ganda dicegah. | `ekstensi-sipp-1okt.test.ts` mendapat dua kasus baru (status tanpa `status`, dan status dengan `alasan`). "Keadaan perkara tidak terbaca" harus muncul tepat sekali. **MERAH pada kode lama, HIJAU sesudah perbaikan.** |
| G4 | kecil (sisir pola "X: X") | `konten.js`: "Anonimisasi tidak dibuat: …" (5 titik), "Edoc tidak terunggah: …" (4 titik), "Hasil sidang tidak terbaca: …" | Fungsi anonimisasi memulangkan pesan yang sudah berawalan "Anonimisasi tidak dibuat", lalu pembungkusnya menambahkan awalan yang sama lagi. Hasilnya "Anonimisasi tidak dibuat: Anonimisasi tidak dibuat: …". Ada juga akhiran "…ditolak..". Bila `u.pesan` kosong, kalimat dulu berakhir "…: undefined". | Seluruhnya kini memakai `sambungSebab`. Bunyi yang memang tidak berulang tetap sama. Yang berubah hanya teks pesan; logika tulis ke SIPP (e-Doc) tidak disentuh. | Dijaga oleh uji perilaku G3 (pembantu yang sama) ditambah uji e-Doc/anonim yang sudah ada (lihat di bawah). |
| G5 | kecil | `panel-alat.js` `alatPesanGagal` ±1978 | Galat yang dibungkus ulang berbunyi "Membaca usulan gagal: Membaca usulan gagal: …", dan sebab yang sudah bertitik menjadi "…rusak..". | Awalan pekerjaan tidak diulang dan titik akhir tidak digandakan. | `ekstensi-pesan-gagal.test.ts` mendapat dua kasus baru (merah pada kode lama). |
| G6 | kecil (tampilan) | `panel.css` `.aleta-perkakas-nama` | Nama jenis yang panjang ("Asal Usul Anak · Dikabulkan (anak sah perkawinan tercatat)") menghimpit kolom nilai. Nama berkas jadi terbaca "[01 ] [Ka" per dua huruf, dan isi panel massal ABT bergulir menyamping. Terukur di Chromium. | `max-width: 45%` dan `overflow-wrap: anywhere`. Nama pendek tidak berubah. Sesudah perbaikan, `.aleta-isi` tidak lagi punya bilah gulir mendatar (diukur). | `ekstensi-panel-tata-18okt.test.ts` (kaskade getComputedStyle atas panel.css asli). |
| G7 | kecil (tampilan, tema gelap) | `panel.css` bilah gulir panel | Muncul kotak putih kecil di pojok kanan bawah isi panel (sudut pertemuan dua bilah gulir). Terukur di Chromium. | `::-webkit-scrollbar-corner` dibuat tembus pandang, sama dengan jalurnya. | Uji yang sama. Tangkapan sebelum/sesudah: `sim/mati-abt-beranda.png` → `sim/sudut2.png`, `sim/sudut3.png`. |

Tidak ada perubahan pada jalur tulis ke SIPP/ABT, kecuali teks pesan galat e-Doc (G4). Tidak ada kata "Aleta" baru yang dikirim ke SIPP/ABT; semua teks baru hanya tampil di panel ekstensi. `patch-notes.ts`, `catatan-ekstensi.ts`, nomor versi, dan rilis-ekstensi tidak disentuh.

**Untuk sesi utama:**
- `ekstensi-versi-tanam.test.ts` ("menanam ulang menghasilkan berkas yang sama persis") akan merah sampai skill `rilis-ekstensi` dijalankan. Ini sama seperti setiap perubahan berkas ekstensi lain.
- Lima uji lama memotong fungsi satu per satu dari konten.js (`potongFungsi`). Pada uji-uji itu `sambungSebab` sudah ditambahkan ke daftar potongannya: `ekstensi-edoc-putusan-tanpa-anonim-14okt`, `ekstensi-bukti-simpan`, `ekstensi-massal-ujung-ke-ujung`, `ekstensi-putusan-otomatis-macet`, `ekstensi-sipp-1okt`. Tanpa penambahan itu, satu uji e-Doc gagal dengan `ReferenceError: sambungSebab is not defined`. Ini terjadi hanya di uji; di peramban, konten.js selalu dimuat utuh.

## Cara memeriksa

### 1. Analisis statis

Skrip pemeriksa ada di `D:\Aplikasi\aleta\tmp\audit-galat\`: `analisa.mjs`, `urutan.mjs`, `chromeapi.mjs`, `then-lepas.mjs`, `tolak2.mjs`.

Ekstensi dianalisis per **dunia muat**, persis seperti Chrome menyuntikkannya menurut `manifest.json`. Semua skrip konten di satu halaman berbagi satu lingkup global:

- SIPP (dunia terisolasi): penjaga-tanda → tema-awal → deteksi-sisa-blangko → panel-alat → jurusita → basmassal → saksiscan → konten → checklist → sipp-ide-l1/l2/m1/m2 → unduh-universal
- SIPP (dunia MAIN): unduh-halaman, jembatan
- ABT (dunia terisolasi): penjaga-tanda → tema-awal → deteksi-sisa-blangko → panel-alat → jurusita → basmassal → saksi-katalog → saksi-katalog-data → saksi-susun → abt → checklist → abt-klien → blangko-derry → blangko-derry-isian → konseptor-langkah → putusan-advance → sipp-ide-l1 → unduh-universal
- Portal: deteksi-sisa-blangko → panel-alat → aleta → checklist → unduh-universal
- Pekerja latar: deteksi-sisa-blangko (lewat importScripts) → latar
- Popup: daftar-fitur → popup → popup-ide-l2
- salinan

| Pemeriksaan | Alat | Hasil |
|---|---|---|
| Nama yang dipakai tetapi tidak terdefinisi (`no-undef`, seperti kasus `isianBernama`). Diperiksa per dunia, dengan deklarasi tingkat atas berkas lain di dunia yang sama dihitung sebagai global. | ESLint 9 `Linter` dengan konfigurasi sementara | **Tidak ada galat sungguhan.** Ke-35 temuan semuanya sudah dijaga `typeof x === "function"` (misalnya `suntingLangsungNyala` di panel-alat.js pada SIPP/portal, `t7AlamatAleta`/`cariNomorPerkara` di sipp-ide-l1.js pada ABT), atau berasal dari jalur `module.exports` milik uji. Pemakaian `document` di deteksi-sisa-blangko.js dalam pekerja latar hanya ada di fungsi halaman, dan pemasangnya dijaga `typeof document`. |
| Deklarasi `let/const/class` ganda lintas berkas dalam satu dunia. Bila ada, muncul SyntaxError "already declared" dan seluruh berkas kedua gagal dimuat. | `analisa.mjs` | Tidak ada. |
| Kode yang berjalan saat muat memanggil nama milik berkas yang dimuat SESUDAHNYA, atau membaca `let/const` yang masih dalam TDZ. Rantai panggilan serempak ditelusuri sampai `await` pertama. | `urutan.mjs` (eslint-scope dengan titik-tetap rantai panggilan; diuji-diri dengan kasus buatan) | Tidak ada yang sungguhan. Satu kandidat: di popup.js, `pasangNilai({})` → `modePopupBerlaku` membaca `ujiKeadaan` sebelum dideklarasikan. Ini hanya terjadi bila `chrome.storage` tidak ada, dan sudah ditangkap `try`. |
| Aturan bug ESLint lain: no-dupe-keys, no-unreachable, no-self-compare, valid-typeof, no-constant-binary-expression, no-unsafe-optional-chaining, no-cond-assign, no-unmodified-loop-condition, dan seterusnya | `analisa.mjs` | Tidak ada yang sungguhan. Tiga temuan `no-unmodified-loop-condition` adalah gelung tunggu yang memakai `await`. |
| `chrome.runtime.sendMessage` tanpa penanganan `lastError` atau tanpa `try` (konteks ekstensi mati sesudah pembaruan otomatis) | grep dan `chromeapi.mjs` | Ke-21 pemanggilan sudah menangani `lastError` atau `catch`, dan dibungkus `try`. |
| Akses `chrome.storage` tanpa cadangan | `chromeapi.mjs` | Skrip konten: semuanya di dalam `try`. latar.js: beberapa `await chrome.storage.*` tanpa `try`, tetapi pemanggilnya menangkap galat, dan pekerja latar tidak mengalami "Extension context invalidated". |
| Promise yang menolak padahal hasilnya dibuang (`void f()`, `x.then(cb)` tanpa catch, pendengar `async`) | `then-lepas.mjs` (60 kandidat) dan `tolak2.mjs` (titik-tetap "fungsi yang dapat menolak": `throw`/`await fetch`/`await chrome.*`/`.json()` di luar `try`, menelusuri pemanggilan) | Yang sungguhan: **G1 dan G2**. Sisanya hanya menolak pada galat pemrogram (misalnya `alatTipeKeluaran`/`alatPemetaanBlangko` dengan kunci tak dikenal, yang dijaga uji) atau pembantu yang memang tidak pernah menolak. |
| Variabel modul `latar.js` yang hilang setiap ±30 detik | baca kode | `versiMenunggu`, `antreanNama`, dan `konteksIngatan` dicerminkan ke `chrome.storage.session`. `pelariRelaasHidup` dan `mulaiRelaasDisiapkan` SENGAJA dibiarkan sebagai variabel modul (alasannya didokumentasikan di kode). `rantaiAntreanKerja` dan `periksaBerjalan` hanya penyerialisasi dalam satu masa hidup pekerja. Tidak ada temuan. |
| Interval atau pengamat yang tidak dibersihkan, pendengar yang menumpuk | grep 27 `setInterval` dan 37 `MutationObserver` | Interval panel dibersihkan saat panel hilang atau keadaan berganti. Interval tingkat atas (aleta.js 800 ms, checklist portal 1 detik, sipp-ide-l2 5 menit) sengaja hidup selama halaman terbuka dan murah. Tidak ada temuan. |
| `querySelector(...)` yang langsung dirantai tanpa cek null | grep | Ke-13 kasus menyasar unsur milik ALETA sendiri, bukan unsur SIPP/ABT. |
| Kunci saklar per akun antara popup.js dan latar.js | baca kode | `KUNCI_SETELAN_AKUN` sama di kedua berkas. Semua saklar yang ditulis popup dalam simulasi termasuk di daftar itu. |

### 2. Simulasi Chromium sungguhan

Ekstensi unpacked (salinan cabang ini ditambah ikon) dimuat ke Chromium Playwright. Chrome 152 tidak dipakai karena ia membuang `--load-extension`.

Halaman disajikan oleh peladen replika `sim/server.mjs` di 127.0.0.1:8097/8098/8099. Isinya replika statis (`D:\aleta-dev\kerja\pratinjau-*.html`, `sipp-8056.html`, `uji-abt.html`) pada jalur yang cocok dengan manifest (`/index.php/…`, `/aps_badilag/…`, `/aleta/…`), lengkap dengan jQuery SIPP asli.

API `/aleta/api/*` ditiru dalam tiga mode:
- **masuk**: `siapa` = Super Admin, API lain menjawab 404;
- **server mati**: semua API menjawab 502;
- **masuk + checklist**: tiga butir (lewat, hari ini, minggu ini).

Galat dikumpulkan lewat CDP dari SEMUA konteks, termasuk dunia terisolasi skrip konten dan pekerja latar, bukan hanya konsol halaman.

Langkah per halaman: muat → klik kepala dan tombol bagian panel (kecuali tombol yang mengubah sesuatu) → ubah lebar ke 390 px (ukuran HP) → kembalikan lebar → muat ulang.

Langkah popup: buka, centang semua saklar kecuali saklar induk, muat ulang, lalu baca `chrome.storage.local`. Diuji di tema terang dan gelap.

| Putaran | Sebelum perbaikan | Sesudah perbaikan |
|---|---|---|
| masuk, terang/gelap | 2 `Uncaught (in promise)` (G1) per kunjungan beranda ABT | **0 pengecualian** (51 catatan, semuanya 404 berkas statis replika dan peringatan cadangan tipe keluaran yang memang dirancang) |
| server mati (502) | 2 × G1 | **0 pengecualian** |
| popup | 30–31 saklar tersimpan dan terbaca ulang (17–19 kunci) | 30 saklar, 19–22 kunci tersimpan |
| widget checklist (SIPP, ABT, portal; tema gelap) | — | Widget lahir di ketiga situs, menampilkan "3 tugas belum selesai (1 lewat tenggat)", kotak *Kehadiran sidang hari ini* dan *Draf putusan H-7* tampil terlipat, tanpa pengecualian. Saklar widget tetap tersimpan. |

Batas simulasi: replika statis tidak memuat isi perkara sungguhan. Karena itu panel SIPP (yang menunggu `sipp-konteks`) tidak tergambar, dan halaman tanya-jawab/blangko ABT tidak tersedia. Jalur-jalur itu diperiksa lewat uji jsdom. Tab popup yang sempat tertutup sendiri dalam mode "masuk" ternyata akibat penguji menekan "Muat ulang ekstensi" di panel portal; itu bukan galat.

### 3. Uji jsdom (≤3 berkas per jalan, kunci `tsc.lock`, tanpa uji penuh)

| Kelompok | Hasil |
|---|---|
| Uji baru/diubah: token-tolak-18okt, sipp-1okt, pesan-gagal | 3/3 berkas, 63 uji hijau |
| panel-tata-18okt, abt-sederhana, lapisan-permintaan, putusan-otomatis-macet | hijau |
| edoc-putusan-tanpa-anonim-14okt, bukti-simpan, massal-ujung-ke-ujung | 3/3 berkas, 71 uji hijau |
| Bukti merah pada kode lama (berkas ekstensi diganti versi HEAD sementara, lalu dipulihkan) | token-tolak 3/3 merah, sipp-1okt 2 uji baru merah, pesan-gagal 2 uji baru merah |
| Prioritas (widget/popup/latar/fitur 16–18 Okt) | lihat tabel di bawah |

| Kelompok prioritas | Berkas | Uji |
|---|---|---|
| ekstensi-putusan-massal, ekstensi-massal-keadaan, abt-usulan | 3/3 | 242 hijau |
| ekstensi-checklist-milestone, ekstensi-widget-tahap3, ekstensi-popup-tahap2 | 3/3 | 154 hijau |
| u2c-popup-widget, widget-kotak-sidang-17okt, widget-popup-per-peran-12okt | 3/3 | 59 hijau |
| draf-h7-widget-f42, kehadiran-widget-f32, ekstensi-saklar-widget-audit-12okt | 3/3 | 139 hijau |
| ekstensi-lipat-widget-1okt, tarik-ecourt-widget-12okt, ekstensi-latar-pembaruan-mati-hidup | 3/3 | 56 hijau |
| unduhan-abt-dinamai, ekstensi-tdz-tingkat-atas, blangko-derry-isian-16okt | 3/3 | 51 hijau |
| ekstensi-isian-tanpa-kode-tampil-18okt, buang-grup-tersembunyi-18okt, tanya-jawab-ecourt-18okt | 2/3 → 3/3 | **2 merah, bukan akibat perubahan audit.** Ini benturan gabungan di `integrasi-1205-8`: penjaga "kode telanjang" (049de58) bertemu nama berkas blangko ABT "[03b] [Tolak] DK … (Alasan Lain, Isian 9771)" (70e7729) di panel-alat.js dan kunci internal `"jawaban lisan 0047"` (567f02c) di blangko-derry-isian.js. Keduanya bukan teks yang dilihat petugas, jadi pola sahnya ditambahkan ke penjaga (commit 51495c7). Sesudah itu 15/15 hijau. |
| bawaan-abt-itsbat-18okt, sipp-ide-l1-16okt, saksi-susun-ekstensi | 3/3 | 52 hijau |
| ekstensi-tab-saksi-isi-16okt, deteksi-sisa-blangko-17okt, ekstensi-unduh-universal-17okt | 3/3 | 116 hijau |
| hak-tampilan-per-peran-12okt, ekstensi-portal-tahap4, anonim-nama-pihak-12okt | 3/3 | 146 hijau |

Total yang dijalankan: 46 berkas uji ekstensi, sekitar 1.200 uji, semuanya hijau sesudah perbaikan. Sekitar 130 berkas uji perilaku ekstensi lain tidak sempat dijalankan karena kunci `tsc.lock` dipakai bergantian oleh 5–6 agen dan satu uji penuh. Berkas-berkas itu tidak menyentuh baris yang saya ubah.

Hasil awal sebelum daftar diprioritaskan: abt-data-ecourt-kontak-11okt, abt-sunting-langsung-12okt, agen-h7-putusan-f42, alur-bas-baru, dan alur-bas hijau. abt-usulan sempat gagal hanya karena `aleta_bot/node_modules` belum tertaut di worktree (`Cannot find module "dotenv"`), bukan karena galat kode. Sesudah ditautkan, uji itu hijau (baris pertama tabel di atas).

`tsc` atas berkas uji baru: tidak ada galat tipe selain TS7016 (deklarasi `jsdom`), yang juga muncul pada uji lama di konfigurasi sempit itu.

## Pengamatan yang tidak diubah (keputusan desain atau di luar lingkup)

- **Popup Klasik/Lama**: kata tebal di dalam uraian saklar (`<strong class="saklar-nama">`) tampil di baris sendiri ("Saat / mati / , sel isi tabel…"). Ini sengaja: komentar popup.html menyebut perbaikan sebaris hanya untuk UI Baru, karena Tampilan Lama wajib persis.
- **Panel putusan massal ABT di UI Baru** lahir di kiri atas dan, pada layar setinggi 800 px, menutupi kartu checklist widget di kiri bawah. Keputusan 12 Okt menyebut "panel sesi baru di KANAN ATAS". Perlu dicek apakah panel massal ABT termasuk dalam keputusan itu. Posisi dikelola `alatPasangPanel` (bersama), jadi tidak saya ubah.
- Widget di halaman portal replika memakai tema terang walau peramban diset gelap. Widget mengikuti tema portal, dan portal replika tidak punya penanda tema. Ini tidak dapat dinilai tanpa portal sungguhan.

## Temuan di wilayah agen lain (dilaporkan, tidak diubah)

- AUDIT-JEJAK (penjaga-tanda.js, `kirimKeJembatan`): analisis per dunia tidak menemukan nama tak terdefinisi, deklarasi ganda, maupun TDZ di penjaga-tanda.js (dunia SIPP dan ABT, document_start) atau jembatan.js (dunia MAIN). Tidak ada pengecualian dari keduanya di simulasi.
- AUDIT-POLA, LIBUR-PENETAPAN, PERAN, JADWAL-UI: tidak ada temuan dari analisis statis maupun simulasi di jalur mereka. Satu-satunya sentuhan saya di dekat wilayah tulis SIPP adalah teks pesan galat e-Doc (G4), tanpa perubahan logika.

## Yang tidak dapat diperiksa

- SIPP dan ABT sungguhan: server mati, SIPP lokal 8056 tidak menyala, dan login tidak boleh disentuh. Halaman perkara SIPP dengan konteks nyata, tanya-jawab ABT, blangko Derry, dan Jadwal Sidang SIPP hanya diperiksa lewat uji jsdom.
- Widget dengan data per akun/peran yang nyata (butuh portal hidup): diperiksa lewat uji widget/popup per peran.
- Simulasi sempat tertunda karena mesin dipakai penuh oleh uji penuh sesi lain (CPU 100 %, `serviceWorker.evaluate` habis waktu bahkan untuk kode HEAD). Simulasi diulang sesudah beban turun.
