# Tahapan Kerja — ALETA x SIPP sebagai Aplikasi Penilaian dan Pengawasan

Catatan ini adalah **buku kerja**, bukan rencana. Rencananya ada di lampiran
terbitan; yang ada di sini adalah apa yang benar-benar dikerjakan, apa yang
diukur, dan apa yang masih terhalang.

Satu aturan berlaku di atas segalanya:

> Sebuah penilaian belum dianggap benar karena programnya berjalan. Ia dianggap
> benar setelah angkanya disandingkan dengan angka yang dihasilkan secara
> terpisah — hitungan tangan atas SIPP, atau laporan yang benar-benar dikirim
> pengadilan — dan keduanya sama.

Tahap dinyatakan selesai bila **gerbang lulusnya** dilewati, bukan bila kodenya
sudah ditulis. Satu gerbang gagal, tahap itu berhenti.

---

## Tahap 0 — Pengaman

**Dikerjakan 6–7 September 2026 pada cabang `feat/penilaian-berjenjang`.**

Tahap ini tidak menambah satu pun penilaian. Ia menutup lubang yang sudah
terbukti menelan pekerjaan, supaya tahap-tahap berikutnya punya tempat berpijak.

### 0.1 Jalur tulis harus berada di dalam volume

Berkas yang ditulis aplikasi ke jalur yang tidak dipasang keluar container
musnah setiap kali container dibuat ulang — dan container dibuat ulang pada
**setiap** pembaruan. Sudah terjadi: 400 baris tercatat di
`aleta_bot_ecourt_files`, nol berkas tersisa di disk.

Dibuat penjaga `aleta_bot/scripts/verify-jalur-tulis.js` yang membaca berkas
compose sungguhan, menyusun daftar volume tiap layanan, lalu memeriksa sembilan
jalur tulis yang dipakai aplikasi. Setiap baris daftar membawa **bukti**:
potongan yang harus masih ada di berkas sumbernya, sehingga daftar yang bergeser
dari kodenya gagal — bukan diam-diam lolos.

Penjaga itu menemukan **tiga cacat nyata** pada jalan pertamanya:

| Cacat | Akibat bila dibiarkan | Perbaikan |
|---|---|---|
| `ALETA_ECOURT_KREDENSIAL_DIR` tidak diatur, jatuh ke `/root/.aleta-ecourt-session` | Kunci penyandian dan kredensial e-Court hilang tiap pembaruan; petugas memasukkan sandi lagi tanpa ada galat apa pun | Ditunjuk ke `/usr/src/app/.ecourt-session` yang sudah terpasang |
| `logService` menulis jsonl ke `<app>/data`, hanya `data/ecourt` yang terpasang | Jejak pesan, kejadian keamanan, dan galat kueri hilang — justru catatan dari saat basis datanya sedang mati | Ditambahkan peubah `ALETA_BOT_DATA_DIR`, ditunjuk ke dalam volume `runtime-data` |
| `dns: - ${ALETA_DNS_PRIMARY:-}` selalu ada pada layanan portal | Memuai menjadi tulisan kosong; Docker menolak dengan "bad nameserver address"; portal padam sepuluh menit pada 6 Sep 2026 | Kunci `dns` dibuang; DNS kini masuk-bila-diminta lewat `docker-compose.dns.yml` |

Keterangan lama pada compose menyatakan Compose akan membuang baris yang memuai
kosong. Keterangan itu **tidak benar** pada Compose yang terpasang di server.
Baris yang keberadaannya bergantung pada perilaku pemuaian tidak dapat
dipercaya, jadi bentuknya diganti — bukan keterangannya yang diperbaiki.

**Hasil:** `verify-jalur-tulis.js` → **27 lulus, 0 gagal**.

### 0.2 Isi bungkusan penaikan diperiksa, bukan dijanjikan

`scripts/aleta-deploy-from-git.sh` membuang berkas compose dari bungkusan, lalu
**mencetak kalimat** bahwa berkas itu tidak disertakan. Kalimat tetap tercetak
walau berkasnya sebenarnya ikut — dan itulah yang terjadi pada 6 Sep 2026.

Ditambahkan pemeriksaan yang membuka bungkusan yang **benar-benar akan dikirim**
dan berhenti bila memuat berkas compose, setelan jalan, `.claude/`, atau `.env`
sungguhan. Ditambah pemeriksaan kedua: bungkusan harus memuat kedua aplikasi —
bungkusan yang kosong sebelah lulus pemeriksaan pertama dengan mudah, lalu
menghapus separuh aplikasi di server.

Polanya diuji atas sepuluh perkara. Percobaan pertama **menolak semua penaikan**
karena tiga berkas `.env*.example` yang sah ikut tersaring; itu diperbaiki dan
diuji ulang:

| Perkara | Harapan | Hasil |
|---|---|---|
| bungkusan bersih | lolos | lolos |
| `docker-compose.yml` | tertangkap | tertangkap |
| `docker-compose.dns.yml` | tertangkap | tertangkap |
| `aleta_bot/docker-compose.yml` | tertangkap | tertangkap |
| `aleta_bot/aleta-runtime.json` | tertangkap | tertangkap |
| `.env.production` | tertangkap | tertangkap |
| `.env.production.example` | lolos | lolos |
| `aleta_bot/.env.example` | lolos | lolos |
| `docker-compose-notes.md` | lolos | lolos |
| `manajemen_surat/environment.ts` | lolos | lolos |

### 0.3 Cap build

Masih utuh di `manajemen_surat/Dockerfile` baris 66 —
`TZ=Asia/Makassar date +'%Y%m%d-%H%M %Z'` — beserta `src/lib/build-stamp.ts`.
Zona waktunya ikut dicetak, sehingga hilangnya data zona terbaca sebagai "UTC"
alih-alih bergeser diam-diam delapan jam. Tidak ada yang perlu dikerjakan.

### 0.4 Gerbang yang benar-benar berjalan

Gerbangnya sebelum tahap ini: **40 menit, dan merah.**

**Merahnya.** `fetch-base-path.test.ts` menuduh `aleta-prompt-putusan.tsx:122`
memakai `fetch("/api/...")` telanjang. Kodenya justru benar — memakai
`apiPath()`. Yang salah penjaganya: ia memindai teks mentah, lalu menangkap
contoh yang ditulis di dalam komentar. Penjaga yang menuduh berkas benar lebih
berbahaya daripada tidak ada penjaga, sebab ia mengajari orang bahwa merahnya
boleh diabaikan.

Pemindainya diganti dengan penyusur aksara yang mengenali komentar satu baris,
komentar berblok, tali kata, tali kata bertanda punggung, dan regex — lalu
mengosongkan komentar dengan spasi supaya nomor barisnya tetap benar. Pemindai
itu kini punya **sepuluh pemeriksaan atas dirinya sendiri**, termasuk
`http://` di dalam tali kata, regex yang memuat tanda kutip, regex bergaris
miring terlindung, dan pembagian yang tidak boleh disangka regex.

**Lambatnya.** Diukur, bukan dikira:

| Yang diukur | Sebelum | Sesudah |
|---|---|---|
| Membangun basis data dalam ingatan, permintaan ke-2 dan seterusnya dalam satu proses | 9.600 ms | **11 ms**, lalu 6 ms |
| `kamus-variabel.test.ts` (13 uji) | 164,7 detik | 62,9 detik |
| `aleta-blocked-account.test.ts` (8 uji) | 557,9 detik | 220,9 detik |

Sebabnya dicari dengan pengukuran bertingkat, bukan tebakan. Seluruh DDL — 185
tabel, 240 indeks — ternyata hanya **4 detik**. Sisanya 45 detik: memuat modul
kamus variabel JLF (16,6 detik) dan menyisipkan 6.901 barisnya ke setiap basis
data yang dibuat.

Perbaikannya memakai `backup()`/`restore()` milik pg-mem: cetakan diambil
sesudah skema dan penyemaian selesai, lalu dipulihkan untuk permintaan
berikutnya. **Tiga pagar** menjaga agar ini tidak pernah menyentuh produksi:

1. hanya hidup ketika `NODE_ENV === "test"`;
2. cetakan dikunci menurut pilihan penyemaian, sehingga basis data bersemai dan
   tidak bersemai tidak pernah saling memakai cetakan;
3. cetakan hanya dipakai ulang bila **tidak ada** basis data lain darinya yang
   masih terbuka — bila masih ada, yang baru dibangun dari nol seperti biasa.

Ketiganya diuji: baris yang ditulis pada satu basis data terbukti tidak tersisa
pada basis data berikutnya, dan dua basis data hidup bersamaan terbukti tetap
terpisah (`d=1 baris, e=0 baris`).

Satu berkas uji ikut diperbaiki: `kamus-variabel.test.ts` membangun basis data
pada **setiap** pemeriksaan padahal yang dibutuhkannya hanya kamus yang kosong.
Kini skemanya dibangun sekali dan kedua tabel kamus dikosongkan antar
pemeriksaan — pemencilannya tetap utuh sebab berkas itu memang hanya menyentuh
kedua tabel tersebut.

**Hasil seluruh gerbang portal:**

| | Sebelum | Sesudah |
|---|---|---|
| Berkas uji | 1 gagal, 115 lulus | **116 lulus, 0 gagal** |
| Pemeriksaan | 1 gagal, 1.293 lulus | **1.304 lulus, 0 gagal** |
| Waktu | 2.397 detik (40 menit) | **1.230 detik (20,5 menit)** |

### 0.5 Lint — roda gigi searah

`npm run lint` memulangkan **sebelas galat**, seluruhnya
`react-hooks/set-state-in-effect` pada delapan berkas layar antrian dan jadwal
sidang. Laporan preflight terakhir yang tersimpan bertanggal **13 Mei 2026** dan
sudah mencatatnya gagal — gerbang itu sudah hampir empat bulan merah, dan
gerbang yang selalu merah sama tidak bergunanya dengan gerbang yang tidak ada.

Kesebelasnya tidak diperbaiki, dan itu keputusan yang disengaja: perbaikannya
menuntut penataan ulang alur keadaan pada delapan layar yang dipakai di ruang
tunggu pengadilan, dan tidak satu pun layar itu punya uji yang menutupinya.
Menyentuhnya demi sebuah aturan lint, di tengah pekerjaan yang sama sekali lain,
adalah menukar utang yang terlihat dengan kerusakan yang tidak terlihat.

Yang dipasang: `manajemen_surat/scripts/lint-jangan-bertambah.mjs`. Kesebelasnya
dicatat di `manajemen_surat/lint-utang.json` per berkas dan per aturan — bukan
per nomor baris, sebab nomor baris bergeser setiap kali ada yang menyunting
berkas di atasnya, dan teriakan palsu adalah cara tercepat membuat orang
mematikan penjaganya. Yang kedua belas ditolak.

Diuji dua arah: dengan satu pelanggaran baru disisipkan ia **menolak** (kode 1,
menyebut berkas dan aturannya); sesudah pelanggaran itu dibuang ia **menerima**
(kode 0).

### 0.6 Batas waktu preflight yang mustahil

`scripts/aleta-preflight.mjs` memberi `npm test` batas **3 menit** padahal
gerbangnya 40 menit. Langkah itu karena itu selalu terpotong. Batas waktu yang
mustahil bukan penjagaan; ia hanya membuat laporannya berhenti dibaca.

Batasnya diperbaiki memakai angka yang diukur, dengan kelonggaran kira-kira dua
kali lipat: `tsc` 10 menit, lint 15 menit, `build` 15 menit, `npm test` 45
menit. Langkah `npm run lint` diganti roda gigi searah di atas.

### 0.7 Gerbang sisi bot

Ke-67 naskah `verify-*.js` dijalankan berurutan: **67 lulus, 0 gagal**,
termasuk penjaga jalur tulis yang baru. Belum ada pelari yang menjalankannya
sekaligus — itu pekerjaan tahap 1, dan barisnya sudah disiapkan tempatnya di
daftar preflight.

### Gerbang lulus tahap 0

| Syarat | Keadaan |
|---|---|
| Seluruh uji sisi bot hijau | **lulus** — 67/67 |
| Seluruh uji sisi portal hijau | **lulus** — 116 berkas, 1.304 uji, 20,5 menit |
| Jalur tulis seluruhnya di dalam volume | **lulus** — 27/27 |
| Bungkusan penaikan tidak memuat setelan server | **lulus** — 10 perkara uji |
| Lint tidak bertambah | **lulus** — roda gigi diuji dua arah |
| Batas waktu preflight masuk akal | **lulus** — diukur, bukan dikira |
| Cap build ada beserta zonanya | **lulus** |
| Compose server didamaikan | **terhalang** — server tidak terjangkau |
| Jalan mundur dilatih dan waktunya tercatat | **terhalang** — server tidak terjangkau |

### Yang terhalang, dan mengapa

Server `192.168.10.10` tidak terjangkau dari mesin ini (jaringan pengadilan).
Dua syarat terakhir hanya dapat dikerjakan di server, sehingga **tahap 0 belum
dapat dinyatakan lulus penuh**.

Keduanya sudah disiapkan agar tinggal dijalankan:

```
scp scripts/aleta-tahap0-server.sh aleta:/tmp/
ssh aleta "bash /tmp/aleta-tahap0-server.sh --periksa"     # lihat dahulu
ssh aleta "bash /tmp/aleta-tahap0-server.sh --terapkan"    # baru kerjakan
```

Naskah itu menambal compose server secara menyasar (bukan menimpanya, sebab
salinan server berbeda 69 baris dari git), **berhenti bila jangkarnya tidak
ditemukan**, menyimpan cadangan bertanggal, memeriksa hasilnya dengan
`docker compose config`, dan mengembalikan cadangan bila pemeriksaan itu gagal.
Tambalannya sudah diuji-kering atas salinan compose lama: kedua peubah
lingkungan masuk, kunci `dns` hilang, dan hasilnya sah sebagai YAML.

---

## Tahap 1 — Kerangka uji, dibangun sebelum penilaian pertama

**Dikerjakan 7 September 2026.**

Yang dikerjakan lebih dahulu adalah alat ujinya, bukan penilaiannya. Penilaian
yang salah tetapi rapi jauh lebih berbahaya daripada penilaian yang belum ada.

### 1.1 Pelari — ke-67 penjaga akhirnya dapat dijalankan sekaligus

Sampai tahap ini tidak ada satu pun cara menjalankan seluruh `verify-*.js`.
Satu-satunya jalan adalah mengetik `node scripts/verify-x.js` enam puluh tujuh
kali, yang berarti pada praktiknya tidak pernah dijalankan seluruhnya.

`aleta_bot/scripts/jalankan-semua-verify.js` menjalankan semuanya, **masing-masing
sebagai proses tersendiri** — tiga puluh di antaranya membajak pemuat modul untuk
memasang penadah basis data, dan menjalankan dua naskah semacam itu dalam satu
proses membuat yang kedua mewarisi penadah yang pertama. Hasilnya bukan gagal,
melainkan **lulus palsu**.

Kontraknya kode keluar, bukan keluarannya: teks ringkasan ketujuh puluh naskah
itu tidak seragam (43 memakai satu bentuk, 6 bentuk lain, sisanya berbeda-beda),
sehingga pelari yang membaca kalimat akan rapuh terhadap kalimat.

Diuji dua arah: naskah yang gagal menghasilkan kode 1 beserta sebabnya; naskah
yang menggantung dipotong pada batas waktu dan dilaporkan sebagai gagal.

**Hasil: 71 naskah, 118 detik, 0 gagal.** Ditambahkan ke daftar preflight.

### 1.2 Penyapu — berdaftar, bukan bertulisan tangan

`uji-sapuan-penilaian.js` membaca daftar penilaian dari layanannya sendiri lalu
menyapu apa pun yang ada di sana. Menambah penilaian ke-32 tidak menuntut sebaris
pun perubahan pada penyapunya — daftar tulisan tangan selalu tertinggal dari
kodenya, lalu berbohong dengan tenang tentang cakupannya.

Yang disapu: 31 analisis (bentuk amplop, kunci di luar daftar, hitung dua kali),
30 unsur SK Badilag 048/2024, dan 7 butir rubrik. **114 pemeriksaan.**

**Penyapu menemukan cacat nyata pada jalan pertamanya.** Peta pengerja analisis
diberi keterangan "daftar tertutup", tetapi ia objek biasa — sehingga mewarisi
milik prototipe Object:

| Kunci dari peramban | Yang terjadi sebelum diperbaiki |
|---|---|
| `constructor` | fungsi Object **dipanggil**, rutenya memulangkan 200 berisi amplop berjenis "constructor" |
| `toString` | memulangkan "[object Undefined]" yang lalu terurai menjadi objek beraksara-per-kunci |
| `hasOwnProperty`, `__proto__` | melempar, tertangkap sebagai galat |

Tidak ada data yang bocor — keempatnya tidak membaca basis data. Tetapi layar
menerima amplop yang tidak berasal dari analisis mana pun, lalu merendernya
seolah-olah hasil. Diperbaiki dua lapis: daftarnya dibuat tanpa induk dan
pencariannya memakai hasOwnProperty beserta pemeriksaan bahwa yang ditemukan
memang fungsi. Cacat sejenis ditutup pula pada ARTI_KEHADIRAN di
`sippTahapanService`, yang kodenya datang dari ruas SIPP.

Percobaan pertama penyapu juga menuduh delapan analisis melanggar bentuk amplop.
Yang keliru **dugaan penyapunya sendiri**: `baris` berisi objek berkunci, bukan
larik. Kontrak sesungguhnya diperiksa langsung ke ketiga puluh satu analisis lalu
dikodekan — dan dibuat lebih ketat: setiap kunci kolom wajib ada pada setiap
baris, sebab kunci yang hilang tergambar sebagai sel kosong yang terbaca seperti
data yang hilang.

### 1.3 Penjaga pendaftaran rute

Satu cacat lolos dari seluruh penjagaan yang lazim dan sudah pernah terjadi: rute
baru tersisip ke dalam badan penangan rute tetangganya. Berkasnya sah,
`node --check` lulus, `require()` lulus, uji yang memeriksa keberadaan teksnya pun
lulus. Yang tidak lulus hanya satu — server menjawab "Cannot GET".

`verify-rute-terdaftar.js` membandingkan rute yang **tertulis** dengan rute yang
benar-benar ada pada tumpukan router sesudah modulnya dimuat. Dibuktikan dengan
menyisipkan cacatnya sungguhan:

| Pemeriksaan | Hasil |
|---|---|
| `node --check` | LULUS |
| `require()` | LULUS |
| penjaga rute | **GAGAL** — GET /sipp/uji-cacat-tersisip tidak terdaftar |

100 rute tertulis, 88 jalur terdaftar, 11 pemeriksaan hijau.

### 1.4 Penjaga SIPP baca-saja diperluas

Penjaga lama tetap berjalan; yang ditutup empat celah pada **jangkauannya**:

| Celah | Akibatnya |
|---|---|
| Hanya memindai `services/*.js` | `detail.js`, `notifikasi.js`, dan `query.js` — 25.531 baris kode produksi yang menyentuh SIPP — tidak pernah dipindai sama sekali |
| Menuntut require berpetik ganda | petik tunggal membuat berkasnya dilewati tanpa peringatan |
| Menuntut peubah sambungan bernama `db` | `kendaliBerkasService.js` menamainya `sipp`, seluruh kuerinya tak pernah diperiksa |
| Hanya memeriksa tali kata langsung pada pemanggilan | bentuk `db.query(query)` — yang paling banyak dipakai — luput seluruhnya |

`verify-sipp-baca-saja.js` menutup keempatnya: **246 kueri diperiksa pada 20
berkas**, termasuk kueri yang disusun ke dalam peubah lebih dahulu. Diperiksa
juga bahwa tidak ada tulisan ke SIPP — dan memang tidak ada.

Dibuktikan dengan menyisipkan dua bentuk tulisan sungguhan; keduanya tertangkap
beserta nomor barisnya, termasuk bentuk berpeubah yang tak pernah terlihat
penjaga lama. Delapan belas pemanggilan yang kuerinya dirakit dari potongan
dilaporkan sebagai **tidak terjangkau** — penjaga ini tidak menjanjikan
menangkapnya, dan itu disebutkan supaya tidak ada yang menyangka cakupannya penuh.

### 1.5 Kerangka penyandingan

Inti dari kata "valid" pada rencana. `penyandingan/catatan.json` menyimpan
pasangan angka ALETA dan angka dari luar beserta periode, sumber, tanggal, dan
penyandingnya; `services/penyandinganService.js` membacanya dan menjawab satu
pertanyaan untuk tiap penilaian — **sudah pernah dibuktikan dari luar, atau
belum?** Tiga jawaban yang berbeda arti: `belum`, `terbukti`, dan `berselisih`
(angkanya berbeda tetapi selisihnya sudah dijelaskan — kadang yang keliru justru
angka luarnya, dan itu temuan yang berharga).

`verify-penyandingan.js` menguji dirinya sendiri atas sembilan bentuk catatan
cacat yang **harus ditolak**: ruas wajib kosong, jenis tak dikenali, tanggal
bukan YYYY-MM-DD, tanggal di masa depan, angka bukan bilangan, selisih tanpa
penjelasan, penjelasan terlalu pendek, sumber luar berupa kalimat kosong seperti
"sudah dicek", dan periode sama dicatat dua kali dengan angka berbeda. Ditambah
satu catatan sah yang **harus diterima**. Catatan yang rusak membuat statusnya
`belum`, bukan `terbukti`.

**Catatannya sengaja kosong.** Server pengadilan tidak terjangkau dari mesin
pengembang, sehingga belum ada satu pun angka SIPP sungguhan yang dapat
disandingkan. Mengisinya dengan angka karangan akan menghapus seluruh gunanya:
catatan penyandingan yang isinya tebakan lebih berbahaya daripada catatan yang
kosong, sebab yang pertama tampak seperti bukti.

Cakupan hari ini: **0 terbukti, 0 berselisih, 31 belum, dari 31 analisis.**

### Gerbang lulus tahap 1

| Syarat | Keadaan |
|---|---|
| Kerangka uji berjalan atas 31 analisis yang sudah ada, seluruhnya hijau | **lulus** — 114 pemeriksaan penyapu |
| Seluruh penjaga sisi bot dapat dijalankan satu perintah | **lulus** — 71 naskah, 118 detik |
| Penjaga pendaftaran rute terbukti menangkap cacatnya | **lulus** — dibuktikan dengan cacat sungguhan |
| Penjaga SIPP baca-saja menjangkau seluruh berkas | **lulus** — 246 kueri, 20 berkas |
| Kerangka penyandingan berdiri dan terbukti menolak yang cacat | **lulus** — 9 bentuk cacat ditolak |
| Belum satu pun penilaian baru ditulis | **lulus** — memang belum, dan itu disengaja |

---

## Tahap 2 — Perapian ruas sumber

**Dikerjakan 7 September 2026. BELUM LULUS — terhalang sambungan SIPP.**

### 2.1 Mengukur dahulu, memetakan kemudian

Rencana menyebut lima ruas yang harus dirapikan, lengkap dengan angkanya:
340 tulisan kecamatan menjadi 16, 1.489 alasan penundaan menjadi 9, 2.115
pekerjaan menjadi 14, 8.554 uraian biaya menjadi 10, dan 22 nama ruang sidang
menjadi 4.

Menyusun tabel pemetaan dari angka-angka itu berarti membangun untuk masalah
yang **dikira**, bukan masalah yang **ada**. Yang menentukan bentuk pemetaannya
bukan berapa banyak tulisannya, melainkan seperti apa tulisan itu — dan itu
hanya dapat dibaca dari daftarnya.

Maka yang dibangun lebih dahulu pengukurnya:
`services/ukurRuasBebasService.js` beserta penjalannya
`scripts/ukur-ruas-bebas.js`. Untuk enam ruas ia melaporkan berapa baris
seluruhnya, berapa yang terisi, berapa banyak tulisan yang berbeda, dan **tiga
puluh** tulisan yang paling sering — tiga puluh, bukan sepuluh, sebab yang
menentukan berat-ringannya perapian justru ekornya; sepuluh teratas hampir
selalu tampak rapi.

### 2.2 Satu hal yang sudah ketahuan tanpa menjalankannya

SIPP ternyata **sudah punya tabel acuan kecamatan sendiri** —
`ref_kecamatan_new` — dan `sebaranWilayah()` sudah menjoinnya sejak lama.

Jadi persoalan wilayah bukan "belum ada tabel acuan", melainkan "berapa banyak
isian yang tidak cocok dengan tabel acuan yang sudah ada". Itu pertanyaan yang
berbeda, dan jawabannya menentukan apakah perapiannya sepuluh menit atau dua
hari. Pengukur itu menghitungnya secara khusus, beserta tiga puluh isian teratas
yang **tidak** cocok.

Andaikan tabel pemetaan disusun lebih dahulu, ia akan menduplikasi tabel yang
sudah ada di SIPP.

### 2.3 Kuerinya diletakkan di layanan, bukan di naskah

Seluruh kueri pengukur tinggal di `services/`, bukan di `scripts/`. Sebabnya
tegas: `scripts/` sengaja **tidak** dipindai penjaga baca-saja, sebab naskah
penjaga memang menuliskan contoh kueri yang salah untuk menguji penolakannya.
Kueri sungguhan yang tinggal di sana tidak akan pernah dijaga.

Diperiksa: kedua penjaga baca-saja memang menjangkau berkas layanan yang baru.

### 2.4 Dua temuan sampingan

**Penjaga baca-saja punya titik buta.** Ia tidak mengikuti pembungkus
`runQuery`, sehingga kueri layanan baru tidak ikut terhitung. Ditutup: kini ia
mengenali pembungkus berbentuk `function NAMA(` maupun berbentuk panah
(`const runQuery = (sql) =>`) — bentuk kedua luput dari penjaga lama seluruhnya.
Jangkauannya naik dari **246 menjadi 459 kueri**.

**Sebuah penjaga berhenti bekerja tanpa suara.** Regexnya tampak benar di layar:

```
/...{0,400}?\bdb\s*\.\s*query\s*\(/g
```

tetapi `\b` di sana bukan dua aksara — ia **satu** aksara backspace (0x08), lahir
dari tanda miring ganda yang menyusut ketika melewati cangkang. Regexnya mencari
aksara backspace yang diikuti "db"; tidak pernah ada. Penjaganya lulus tanpa
memeriksa apa pun.

Dibuat penjaga tetap `verify-aksara-liar.js` yang memindai **1.403 berkas
sumber**. Lima berkas yang memang menulis aksara kendali dengan sadar
dikecualikan **beserta kode aksaranya** — bukan berkasnya saja, sebab berkas
yang dikecualikan seluruhnya akan menelan aksara liar berikutnya tanpa suara.

Penjaga itu menemukan **satu cacat produksi sungguhan**:

`scripts/aleta-ecourt-unduh-latar.sh` membaca waktu detak berkas kunci dengan

```
sed -n 's/.*"detak":"\([^"]*\)".*/^A/p'
```

Acuan baliknya `\1` sudah menyusut menjadi aksara 0x01. Akibatnya `sed`
memulangkan satu bita tak terbaca, `date -d` gagal, `DETAK_EPOCH` menjadi 0,
dan syarat `-gt 0` tidak pernah terpenuhi — sehingga **penjaga "penarikan masih
berjalan" tidak pernah menyala** dan dua penarikan e-Court dapat berjalan
bersamaan. Diperbaiki dan dibuktikan: sebelumnya memulangkan `^A`, sesudahnya
memulangkan `2026-09-07T10:00:00+08:00`.

### Gerbang lulus tahap 2

| Syarat | Keadaan |
|---|---|
| Pengukur enam ruas berdiri dan kuerinya dijaga | **lulus** |
| Nol tulisan yang tak terpetakan | **terhalang** — belum ada pengukuran |
| Jumlah baris sesudah dipetakan sama persis | **terhalang** — belum ada pemetaan |
| Daftar tulisan tiap kelompok dapat diperiksa manusia | **terhalang** — menunggu daftar hasil ukur |

**Tahap 2 belum lulus, dan tidak dapat diselesaikan dari mesin pengembang.**
Basis data SIPP hanya ada di server pengadilan. Langkah berikutnya:

```
docker compose exec aleta_bot node scripts/ukur-ruas-bebas.js
```

lalu daftar yang dihasilkannya dibaca **bersama petugas kepaniteraan** untuk
menyusun pemetaannya. Pemetaan yang disusun tanpa membaca daftarnya akan
memetakan yang tidak ada dan meninggalkan yang ada.

---

## Tahap 3 — Mesin penilaian (Bab 1)

**Dikerjakan 7 September 2026.**

Lima berkas layanan, empat penjaga, **262 pemeriksaan**. Tidak satu pun
penilaian sungguhan ditulis pada tahap ini — yang dibangun mesinnya, dan mesin
itu diuji dengan penilaian buatan supaya kesalahannya tidak tersembunyi di balik
data sungguhan.

### 3.1 MS01 — mesin periode tujuh jendela

`services/periodePenilaianService.js`, **126 pemeriksaan**.

Satu butir penilaian ditulis sekali sebagai fungsi berparameter tanggal, lalu
dilihat dari tujuh jendela. Tanpa mesin ini, tujuh jendela berarti tujuh salinan
kode yang perlahan menyimpang — dan yang menyimpang tidak akan ketahuan, sebab
tidak ada yang membandingkan nilai mingguan dengan nilai bulanan.

**Almanak, bukan saat.** Seluruh perhitungan memakai tanggal almanak
(`"2026-09-06"`), bukan saat. Pengadilan berada di WITA sedangkan `Date` milik
Node berpusat pada UTC; menghitung "hari ini" dengan waktu setempat mesin
membuat hasilnya berpindah hari pukul empat sore bila mesinnya berzona lain —
dan pergeseran itu tidak menimbulkan galat, hanya angka yang salah.

Diuji: satuan mingguan **sama persis pada empat zona mesin** (UTC, Makassar,
New York, Kiritimati). Zona hanya disentuh di satu tempat, dan tempat itu diuji
tersendiri.

**Almanak yang benar, bukan penambahan tiga puluh hari.** Kabisat 1900 (bukan
kabisat), 2000 (kabisat), 2024, 2026; pergantian bulan dan tahun; pekan yang
melintasi keduanya. Tanggal yang tidak ada pada almanak — 30 Februari — ditolak,
bukan dimuaikan diam-diam menjadi 2 Maret.

**Nomor pekan diubah dari rancangan prototipe.** Prototipe memakai urutan di
dalam jendela ("Minggu I" untuk pekan paling awal yang kebetulan tampil), dan
nomor itu berpindah arti setiap kali orang membukanya di hari yang berbeda.
Nomor yang berpindah arti tidak boleh ada pada laporan pengadilan. Kini memakai
nomor pekan dalam tahun menurut ISO 8601 — tetap bertanggal sebagaimana diminta,
tetapi artinya tidak bergeser.

Contoh nama baris yang dihasilkan:

| Jendela | Yang pertama | Yang terakhir |
|---|---|---|
| harian | Senin, 31 Agustus 2026 | Minggu, 6 September 2026 |
| mingguan | Minggu ke-29 · 13–19 Juli 2026 | Minggu ke-36 · 31 Agustus–6 September 2026 |
| bulanan | Oktober 2025 | September 2026 |
| triwulan | Triwulan IV 2024 · Okt–Des | Triwulan III 2026 · Jul–Sep |
| semester | Semester I 2024 · Jan–Jun | Semester II 2026 · Jul–Des |
| tahunan | Tahun 2022 · Jan–Des | Tahun 2026 · Jan–Des |
| keseluruhan | Tahun 2015 | Tahun 2026 |

Diperiksa untuk **ketujuh** jendela sekaligus: tidak ada nama baris berupa nama
bulan telanjang, dan **setiap** nama baris memuat angka tahun.

### 3.2 Ambang beserta dasar hukum dan tanggal berlakunya

`services/ambangPenilaianService.js`, **31 pemeriksaan**. Dua belas ambang:
sembilan berdasar peraturan, tiga kebijakan pengadilan.

Ambang disimpan sebagai **riwayat**, bukan satu angka. Menanyakan ambang selalu
menyertakan tanggal, dan yang dijawab adalah yang berlaku pada tanggal itu.

Sifat yang paling menentukan, dan diuji tersendiri:

> **Mengubah ambang hari ini tidak menggeser nilai periode lampau.**

Diuji dengan menambahkan riwayat baru lalu memastikan tanggal lampau tetap
menjawab yang lama. Ditambah satu hal yang mudah terlewat: menanyakan ambang
minutasi untuk November 2023 memulangkan **null** — bukan empat belas — sebab SK
yang melahirkannya baru berlaku 1 Januari 2024. Menilai orang dengan aturan yang
belum ada adalah kesalahan yang tidak menimbulkan galat apa pun.

### 3.3 MS03 — riwayat nilai tersimpan

`services/riwayatNilaiService.js`, **32 pemeriksaan**. Tabel
`aleta_bot_nilai_riwayat` pada basis data bot sendiri — **tidak menuntut nomor
migrasi Drizzle**, sehingga tidak ada risiko bertabrakan dengan sesi lain.

Nilai tidak dihitung ulang setiap layar dibuka. Ia dihitung sekali per periode
lalu disimpan bersama kumpulan ambang yang berlaku saat itu — diambil dari
**tanggal akhir periodenya**, bukan dari hari ini.

Yang membuatnya berguna: ketika hitung ulang berbeda dengan yang tersimpan,
kerangkanya menyebut **dugaan sebabnya**, bukan sekadar "ada selisih":

| Dugaan | Artinya |
|---|---|
| ambang berubah | **sah** — nilai lama benar untuk aturan yang berlaku saat itu |
| rumus berubah | angka lama dan baru tidak sebanding; seluruh riwayat perlu dihitung ulang dengan sadar |
| keduanya sama, angkanya berbeda | **temuan pengawasan** — data periode lampau berubah sesudah periodenya ditutup |

Menyamakan ketiganya menjadi "ada selisih" membuang seluruh keterangan yang
membuat temuan itu dapat ditindaklanjuti.

> **Mesinnya sudah ada, penulisnya belum.** Diperiksa pada basis data bot di
> server 8 September 2026: tabel `aleta_bot_nilai_riwayat` **belum ada**. Ia
> dibuat sesaat sebelum penulisan pertama, dan penulisan itu belum pernah
> terjadi — `simpanNilai()` sampai hari ini hanya dipanggil oleh skrip ujinya.
>
> Kalimat "nilai tidak dihitung ulang setiap layar dibuka" di atas karena itu
> menerangkan **rancangan MS03, bukan keadaan yang berjalan**. Yang berjalan
> sekarang justru kebalikannya: setiap layar dibuka, nilainya dihitung ulang
> dari SIPP.
>
> Ada dua akibat, dan keduanya perlu diketahui:
>
> - **Menguntungkan.** Perbaikan rumus langsung berlaku atas SELURUH riwayat,
>   tanpa migrasi. Itulah yang terjadi pada v1.98.0 ketika aturan penunjukan
>   pertama diperbaiki.
> - **Merugikan.** Nilai laporan bulan lalu yang sudah ditandatangani dapat
>   bergeser diam-diam bila data lampaunya disunting, dan tidak ada yang dapat
>   menunjukkan kapan angkanya berubah. Justru inilah yang hendak dicegah MS03.
>
> Selama penulisnya belum disambung, pergeseran akibat perubahan rumus harus
> diukur dengan sengaja — lihat `aleta_bot/scripts/hitung-ulang-penunjukan.js`
> sebagai contoh bentuknya.

### 3.4 MS04 dan MS05 — angkanya dihitung DARI buktinya

`services/kerangkaPenilaianService.js`, **77 pemeriksaan**.

Cara yang lazim: satu kueri agregat menghasilkan angka, kueri lain menghasilkan
daftar perkaranya. Keduanya perlahan menyimpang, lalu pada suatu hari layar
menampilkan "312 relaas bertenggang kurang" di atas daftar berisi 287 baris —
dan tidak seorang pun menyadarinya, sebab yang membuka daftar tidak menghitung
barisnya dan yang membaca angka tidak membuka daftarnya.

Di sini hubungannya dibalik. Penilaian menyerahkan **daftar baris** beserta
penanda memenuhi, dan kerangka yang menghitung penyebut serta pembilangnya.
Angkanya karena itu **tidak mungkin** berselisih dengan buktinya — ia turunan
dari buktinya.

Penilaian boleh juga menyediakan kueri agregat untuk penyebut besar. Bila
keduanya ada, kerangka **membandingkannya dan melaporkan selisihnya sebagai
temuan** — tidak memilih salah satu diam-diam, dan yang ditampilkan selalu angka
dari buktinya sebab itulah yang dapat diperiksa manusia.

Sebelas bentuk definisi yang cacat ditolak **saat mendaftar**, bukan saat
seorang hakim membuka layarnya — termasuk penilaian tanpa `baris()`, yang berarti
penilaian yang tidak dapat menyebutkan buktinya tidak boleh berdiri sama sekali.

Di bawah lantainya, nilainya dibuang tetapi **buktinya tidak** — justru daftar
itulah yang berguna pada periode sependek itu.

### 3.5 MS02 — rapor berjenjang

`services/raporBerjenjangService.js`, **27 pemeriksaan**.

Rapor aparatur bukan penilaian lain; ia penilaian yang **sama**, dilihat per
orang. Menulisnya sebagai penilaian tersendiri berarti dua rumus yang perlahan
menyimpang, lalu jumlah rapor per orang tidak lagi sama dengan angka pengadilan
— dan tidak seorang pun tahu mana yang benar.

Tiga jaminan dipaksakan, dan **diperiksa saat berjalan, bukan diandaikan**:

1. jumlah penyebut seluruh kelompok selalu sama dengan penyebut keseluruhan —
   bila tidak, kerangkanya berhenti dengan galat;
2. satu baris masuk tepat satu kelompok;
3. baris yang pelakunya tidak tercatat **tidak dibuang**, melainkan masuk
   kelompok bernama `(tidak tercatat)` — pekerjaan yang tidak diketahui
   pengerjanya adalah temuan, bukan hal yang boleh hilang dari hitungan.

Pembatas penyebut berlaku **per orang**, dan justru di situ ia paling penting:
pada tingkat pengadilan penyebutnya selalu besar, pada tingkat orang ia kerap
kecil — dan itulah tingkat yang namanya tertulis di sebelah angkanya.

Kelompok diurut menurut **nama, bukan nilai**. Daftar yang selalu menaruh orang
yang sama di puncak akan berhenti dibaca; mengurutkan menurut nilai adalah
pilihan pembaca, bukan bawaan.

### Gerbang lulus tahap 3

| Syarat | Keadaan |
|---|---|
| Ketujuh periode menghasilkan jumlah baris yang benar | **lulus** |
| Nama barisnya bertanggal, nol nama bulan telanjang | **lulus** — diperiksa untuk ketujuh jendela |
| Nilai tersimpan dapat dihitung ulang dan hasilnya sama | **lulus** — beserta pembedaan tiga sebab selisih |
| Angka tidak dapat berselisih dengan buktinya | **lulus** — angkanya turunan buktinya |
| Seluruh penjaga sisi bot hijau | **lulus** — 77 naskah, 150 detik |

**MS06 (berkas pengawasan siap kirim) belum dikerjakan** dan itu disengaja: ia
sama dengan alat D08 pada tahap 4, dan membangunnya dua kali akan menghasilkan
dua bentuk ekspor yang perlahan menyimpang. Dikerjakan sekali di tahap 4.

---

## Tahap 4 — Dua puluh alat di dalam penilaian (sisi mesin)

**Dikerjakan 7 September 2026. SEBAGIAN — sisi mesin selesai, sisi layar belum.**

Alat dikerjakan pada **perender bersama**, bukan pada tiap penilaian: sekali
pasang, seluruh penilaian mendapatkannya — termasuk penilaian yang ditulis
kelak. Urutannya mengikuti rencana: yang menyentuh setiap angka dikerjakan
paling awal, sebab dipasang belakangan berarti membongkar seluruh layar.

### 4.1 Sebelas alat yang sudah punya mesinnya

| Alat | Yang dikerjakan | Pemeriksaan |
|---|---|---|
| **D03** ambang dan dasar hukum | selesai pada tahap 3 | 31 |
| **D10** penanda cakupan data | `cakupanDataService.js` | 52 bersama D07 dan D17 |
| **D17** rentang keyakinan | `ketelitianNilaiService.js` — selang Wilson | ” |
| **D07** dampak bila dibereskan | ” | ” |
| **D02** hak jawab pada baris | `catatanPenilaianService.js` | 35 bersama D13, D14, D18 |
| **D13** keadaan tindak lanjut | ” | ” |
| **D14** disposisi pimpinan | ” | ” |
| **D18** anotasi peristiwa | ” | ” |
| **D15** sasaran kinerja | `sasaranKinerjaService.js` | 36 bersama D06 |
| **D06** lencana ketergantungan | ” | ” |
| **D11** cara hitung terbuka | diwajibkan pada kontrak pendaftaran | 88 (kerangka) |

### 4.2 Keputusan yang diambil, beserta alasannya

**D17 memakai selang Wilson, bukan selang normal biasa.** Bukan kegemaran pada
rumus: selang normal melar keluar batas nol dan seratus pada nilai yang
mendekati ujung — dan penilaian ketaatan justru hampir selalu mendekati seratus.
Selang yang menyatakan "97,8 persen, antara 96,2 dan **101,4**" adalah selang
yang salah, dan kesalahannya terlihat oleh siapa pun. Diuji: 99 dari 100 tetap
di bawah seratus, 0 dari 40 tetap di atas nol, dan 40 dari 40 **tetap punya
rentang** — tidak dianggap pasti.

**Cakupan dan ketelitian dipisah tegas.** Keduanya sering dikira sama. Sebuah
penilaian dapat bercakupan rendah tetapi berpenyebut besar (mutu pertimbangan:
22,3 persen cakupan, rentang ±1,7), dan sebaliknya (23 dari 23: cakupan penuh,
rentang ±14). Diuji keduanya.

**D07 menghitung dampak, tetapi TIDAK menaksir usaha.** Mesin tidak tahu bahwa
melengkapi 122 naskah anonimisasi memakan dua hari sedangkan menelaah 7.062
suntingan memerlukan keputusan pimpinan. Kolom usaha dibiarkan kosong untuk
diisi manusia; menaksirnya dengan angka karangan membuat urutan pengerjaan
tampak berdasar padahal tidak.

**Empat alat catatan berbagi satu tabel.** D02, D13, D14, dan D18 berbentuk sama:
tulisan yang melekat pada sesuatu, berpenulis dan bertanggal. Empat tabel yang
hampir serupa berarti empat perangkat kode yang perlahan menyimpang.

**Penjelasan tidak menghapus temuannya.** Diuji tersendiri: sesudah penjelasan
dilekatkan, barisnya **tetap** tidak memenuhi. Temuan tanpa penjelasannya adalah
tuduhan; temuan yang dihapus karena ada penjelasan adalah pengawasan yang mandul.

**Temuan yang "dikecualikan" wajib menyebut alasannya.** Mengecualikan tanpa
alasan adalah cara paling halus menghilangkan temuan: ia tercatat, tampak sudah
ditangani, dan tidak seorang pun kembali kepadanya.

**Baris tanpa catatan berkeadaan "belum ditindak", bukan kosong.** Kolom kosong
terbaca "tidak berlaku"; "belum ditindak" terbaca sebagai pekerjaan yang
menunggu.

**D15 menolak sasaran tanpa sumber.** Sasaran tanpa dokumen dasarnya adalah
angka karangan. Daftarnya **sengaja kosong** sampai Perjanjian Kinerja pengadilan
dibaca — dan layar harus mengatakan "sasarannya belum ditetapkan", bukan
diam-diam memakai seratus. Nilai yang belum dapat dihitung **tidak** dinyatakan
"belum tercapai": menuduh tanpa mengukur adalah kesalahan paling mahal pada
aplikasi yang menyebut nama orang.

**D06 memakai keadaan hulu terburuk, bukan rata-ratanya.** Nilai yang berdiri di
atas lima sumber bersih dan satu sumber keruh tetap berdiri di atas sumber yang
keruh.

**D11 diwajibkan pada kontrak pendaftaran, bukan dijadikan pilihan.** Penilaian
yang tidak dapat menerangkan pembilang, penyebut, pengecualian, tabel, dan ruas
sumbernya **ditolak saat mendaftar**. Menjadikannya pilihan berarti sembilan
puluh persen penilaian tidak akan pernah mengisinya.

Penambahan kontrak itu langsung membuktikan dirinya: penjaga tahap 3 yang
definisinya belum lengkap **seketika gagal**, dan itu memang yang seharusnya
terjadi.

### 4.3 Yang belum dikerjakan, dan mengapa

| Alat | Keadaan |
|---|---|
| **D01** pintu masuk dari nomor perkara | menunggu penilaian sungguhan — panelnya menampilkan satu perkara pada penilaian mana saja, dan hari ini belum ada penilaian sungguhan yang mendaftar |
| **D04** penanda titik balik | menunggu riwayat nilai terisi; deteksi titik balik atas riwayat kosong tidak dapat diuji |
| **D05** sanding berdampingan | mesin pembandingnya **sudah ada** (`selisihBerarti`); yang belum panel layarnya |
| **D08** ekspor blangko resmi | sisi portal; sama dengan MS06 |
| **D09** kirim ke penanggung jawab | menumpang mesin pemberitahuan yang sudah berjalan; disambungkan bersama D08 |
| **D12** penyaring di dalam penilaian | sisi portal, bertumpu pada `baris()` yang sudah ada |
| **D16** riwayat ringkas dalam baris | menunggu riwayat nilai terisi |
| **D19** pilih beberapa baris | sisi portal |
| **D20** bagikan dan tayangkan | sisi portal |

Sembilan yang tersisa terbagi dua: **lima menunggu layar portal** (D05, D08,
D12, D19, D20 — dan D09 menyusul D08), dan **tiga menunggu data sungguhan**
(D01, D04, D16). Tidak satu pun terhalang oleh rancangan; seluruhnya terhalang
oleh urutan yang memang disengaja.

### Gerbang lulus tahap 4

| Syarat | Keadaan |
|---|---|
| Alat dikerjakan pada perender bersama, bukan tiap penilaian | **lulus** |
| Penilaian percobaan memperoleh alatnya tanpa baris tambahan | **lulus** |
| Kotak sasaran dan rentang tidak membaca jumlah sebagai nilai | **lulus** — `null` dibedakan dari nol |
| Blangko resmi tetap bersih tanpa lajur alat | *menunggu sisi portal* |
| Seluruh penjaga sisi bot hijau | **lulus** — 80 naskah |

**Tahap 4 belum lulus penuh**: sisi layar belum dikerjakan, dan tiga alat
menunggu data sungguhan yang baru ada sesudah tahap 5 dan 6.

---

## Tahap 5 — Memindahkan yang sudah berjalan

**Dikerjakan 7 September 2026. Gerbangnya TERBUKA — menunggu penyandingan.**

### 5.1 Temuan yang mengubah bentuk tahap ini

Rencana berbunyi "tiga puluh satu analisis yang sekarang hidup dipindahkan ke
bentuk baku penilaian, satu per satu". Sesudah ketiga puluh satunya diperiksa
satu demi satu, ternyata **sebagian besar bukan penilaian**.

| | Jumlah | Sifatnya |
|---|---|---|
| Ketaatan — punya jawaban benar | **9** | `tenggat`, `kesehatan`, `suntingan`, `tenggang`, `aturan`, `mutuPertimbangan`, `ecourt`, `periksaPertimbangan`, `berisiko` |
| Deskriptif — tidak punya jawaban benar | **22** | sebaran umur pihak, musim perkara, corong perkara, profil upaya hukum, kronologi, riwayat pihak, dan seterusnya |

Memaksa yang deskriptif masuk kerangka bernilai berarti **mengarang skor atas
hal yang tidak dapat benar atau salah**, lalu menuduh orang berdasarkan skor
itu. "Musim perkara" tidak dapat baik atau buruk; bulan Juni yang ramai bukan
kelalaian siapa pun.

Kedua puluh dua analisis deskriptif itu **tetap hidup sebagaimana adanya** —
tidak dihapus, tidak diubah. Yang berubah hanya satu: ia tidak lagi disebut
penilaian.

Pemilahan itu dikunci pada `verify-penilaian-ketaatan.js` supaya tidak berubah
diam-diam.

### 5.2 Tiga penilaian pertama yang sungguhan

`services/penilaianKetaatanService.js` — **45 pemeriksaan**.

| Kunci | Ambang | Sumber |
|---|---|---|
| `ketaatanTenggangPanggilan` | 3 hari kerja — Pasal 122 HIR / Pasal 146 R.Bg | `perkara_pelaksanaan_relaas`, `perkara_jadwal_sidang` |
| `asasPenyelesaianLimaBulan` | 5 bulan — SEMA 2 Tahun 2014 | `perkara`, `perkara_putusan` |
| `putusanTidakDiubahSesudahMinutasi` | 0 hari sesudah minutasi | `perkara_putusan` |

Nama tabel dan kolomnya **tidak dikarang** — seluruhnya diambil dari kueri yang
sudah berjalan di produksi, sebab kueri yang ditulis atas tabel yang dikira ada
baru gagal di server, sesudah dipasang.

### 5.3 Satu perbedaan yang disengaja dengan hitungan lama

Analisis lama menghitung tenggang panggilan dengan `DATEDIFF` — **hari
kalender**. Ambang yang berlaku berbunyi tiga **hari kerja**.

Selisihnya bukan main-main, dan justru pada bentuk yang paling sering terjadi:

> Relaas disampaikan **Jumat** untuk sidang **Senin**. Tiga hari kalender —
> lulus menurut hitungan lama. Hanya **satu** hari kerja — pihak yang
> menerimanya praktis tidak punya kesempatan menyiapkan diri, dan itulah yang
> hendak dilindungi Pasal 122 HIR.

Penilaian ini memakai hari kerja, sesuai ambang yang tertulis, dan **menyimpan
kedua hitungan pada tiap baris**. Baris yang lulus menurut hitungan lama tetapi
gagal menurut hari kerja ditandai `bedaDenganHitunganLama`, sehingga selisih
dengan angka lama dapat dijelaskan saat disandingkan — bukan menjadi selisih
misterius yang membuat orang menyangka salah satunya rusak.

**Hari libur nasional belum diperhitungkan.** Yang dikecualikan baru Sabtu dan
Minggu. Disebutkan terus terang: penilaian yang mengaku menghitung hari kerja
padahal mengabaikan libur bersama Idulfitri akan menuduh juru sita yang justru
tidak dapat bekerja.

### Gerbang lulus tahap 5

| Syarat | Keadaan |
|---|---|
| Pemilahan dikunci uji | **lulus** |
| Ketiganya lolos kontrak kerangka | **lulus** |
| Kuerinya membaca, memakai rentang sebagai nilai, berbatas baris | **lulus** |
| Ketiga puluh satu angka sama, atau selisihnya berpenjelasan | **terhalang SIPP** |

---

## Tahap 6 — Bab 2, mutu dan integritas data

**Dikerjakan 7 September 2026.**

`services/penilaianMutuDataService.js` — **43 pemeriksaan**. Tiga penilaian:
kelengkapan berita acara sidang, kelengkapan amar putusan, kelengkapan
pertimbangan hukum.

**Ketiganya sengaja dipilih karena cakupannya berbeda jauh** — ia menjadi bukti
hidup bahwa penanda cakupan (D10) bukan hiasan:

| Penilaian | Cakupan | Tingkat |
|---|---|---|
| Berita acara sidang | 75,8% | memadai, tepat di ambang |
| Amar putusan | 99,1% | memadai |
| Pertimbangan hukum | **22,3%** | **rendah — ditandai** |

Selisih antara yang tertinggi dan terendah lebih dari tujuh puluh poin.
Menjajarkan ketiganya tanpa penanda akan membuat yang ketiga dibaca sebagai
keadaan seluruh pengadilan.

**Satu hal yang mudah dikelabui, dan dijaga.** Ruas yang diisi tanda hubung
supaya tidak tampak kosong dihitung **KOSONG**. Bila tidak, seluruh penilaian
kelengkapan dapat dilulusi dengan satu ketukan papan ketik, dan pengawasan
berubah menjadi upacara. Diuji atas sebelas bentuk isian.

---

## Tahap 7 — Bab 4, laporan perkara LIPA 1 sampai 22

**Dikerjakan 7 September 2026. Gerbangnya TERBUKA — menunggu 264 penyandingan.**

`services/laporanPerkaraService.js` — **69 pemeriksaan**.

### 7.1 Kenyataan yang menentukan bentuknya

Aspek pertama penilaian ini ketepatan waktu pengiriman. **Tanggal kirim tidak
ada di SIPP** — SIPP menyimpan data perkara; kapan sebuah laporan diunggah ke
sistem pelaporan Badilag adalah peristiwa di luar SIPP. Menebaknya dari tanggal
input terakhir akan menghasilkan angka yang tampak berdasar padahal karangan.

Maka ALETA menyimpannya sendiri pada `aleta_bot_laporan_perkara`: petugas
kepaniteraan hukum mencatat tanggal kirim dan angka yang dilaporkan. Itu bukan
kekurangan melainkan kejujuran — **fakta yang hanya diketahui manusia dicatat
manusia, dan yang dicatat mesin dihitung mesin.**

### 7.2 Blangko nilai — bentuknya sama untuk kedua puluh dua

Sembilan kolom, diperiksa identik untuk kedua puluh dua laporan. Batas kirim
tanggal 5, atau tanggal 10 untuk LIPA 14, 15, dan 16 yang dibiayai DIPA 04 —
diambil dari daftar ambang, bukan dipatok. Melintasi pergantian tahun diuji:
laporan Desember berbatas 5 Januari tahun berikutnya.

Nilai: ketepatan waktu bobot 60 (potongan 8 poin per hari terlambat),
kesesuaian angka bobot 40 (potongan 10 poin per satuan selisih). Keduanya
tidak pernah minus.

### 7.3 Yang belum diperiksa TIDAK bernilai

Ini bagian terpentingnya. Laporan yang angka SIPP-nya belum tersambung
memulangkan **nilai null**, bukan enam puluh.

Menjumlah aspek pertama saja lalu menyebutnya "nilai" membuat laporan yang
angkanya tidak pernah dibandingkan tampak bernilai **enam puluh dari seratus** —
padahal yang benar "enam puluh dari enam puluh yang dapat dinilai". Selisih
pembacaan itu menentukan apakah seseorang dianggap lalai.

Yang dipulangkan: `nilai: null`, `nilaiSebagian: 60`, `bobotTerpakai: 60`, dan
daftar sebab yang menyebut persis apa yang belum ada.

**Kueri SIPP tiap LIPA belum disambung.** Tiap LIPA menghitung hal yang berbeda
dan menuntut kueri tersendiri yang harus diperiksa terhadap SIPP sungguhan.
Disambung satu per satu, bukan dikarang sekaligus.

### Gerbang lulus tahap 7

| Syarat | Keadaan |
|---|---|
| Kolom blangko identik untuk kedua puluh dua | **lulus** |
| Batas tanggal 5 dan 10 benar, termasuk lintas tahun | **lulus** |
| Nilai berbobot 60 dan 40 terbukti tiap baris | **lulus** |
| 264 penyandingan (22 laporan × 12 bulan) | **terhalang SIPP** |

---

## Tahap 8 — Bab 3 dan Bab 8

**Bab 3** sudah berisi tiga penilaian dari tahap 5.

**Bab 8 — keuangan perkara**, `services/penilaianKeuanganService.js`:
`panjarTercatatSetiapPerkara` dan `pengeluaranTidakMelebihiPenerimaan`.

Keduanya sengaja hanya memakai ruas **berkode dan angka** — `jenis_transaksi`,
`jumlah`, dan tanggalnya. Ruas `uraian` adalah teks bebas yang diketik kasir,
dan sampai tahap 2 selesai ia belum dapat dikelompokkan; penilaian yang
dibangun di atasnya akan menghitung ejaan, bukan jenis transaksi. Diuji: tidak
satu pun kuerinya menyentuh `uraian`.

Aturan "jenis_transaksi 1 penerimaan, selain itu pengeluaran" diwarisi dari kode
lama dan **ditulis terbuka pada cara hitungnya** — supaya bila kelak ternyata
ada kode penerimaan lain, yang salah terlihat pada keterangannya, bukan
tersembunyi di dalam perbandingan angka.

### Gerbang lulus tahap 8

| Syarat | Keadaan |
|---|---|
| Ambang tiap butir terpasang beserta dasar hukumnya | **lulus** |
| Tidak menyentuh ruas teks bebas | **lulus** |
| Angka keuangan sama dengan buku jurnal sampai rupiah terakhir | **terhalang SIPP** |

---

## Tahap 9 — Bab 5, 6, 9, 10, 11, dan 12

**TIDAK dikerjakan pada sesi ini, dan itu keputusan yang disengaja.**

Pemilahan tahap 5 menunjukkan sebabnya: dari 31 analisis yang sudah ada, **22
bersifat deskriptif** — dan enam bab inilah tempat sebagian besarnya berada.
Sebaran wilayah, musim perkara, corong perkara, profil pihak, profil upaya
hukum: tidak satu pun punya jawaban benar, sehingga tidak satu pun dapat
dinilai tanpa mengarang ambang.

Yang **dapat** dinilai di antaranya bertumpu pada ruas teks bebas yang tahap 2
belum merapikannya — sebaran wilayah menunggu pemetaan 340 tulisan kecamatan,
pola penundaan menunggu pengelompokan 1.489 alasan, profil pekerjaan menunggu
pemetaan 2.115 tulisan.

Menulisnya sekarang berarti menulis penilaian yang menghitung ejaan.

**Yang sudah berdiri untuk bab-bab itu:** gerbang cakupan (D10) memaksa setiap
angka menyebut dihitung dari berapa persen populasinya, dan menandai yang di
bawah empat puluh persen. Syarat gerbang tahap 9 — "tidak ada angka bercakupan
di bawah empat puluh persen yang tampil tanpa penanda" — **sudah dipaksakan
kode**, bukan menunggu penilaiannya ditulis.

---

## Tahap 10 — Bab 7, rapor kinerja aparatur

**Dikerjakan 7 September 2026 — dan bagian terpentingnya adalah penolakannya.**

`services/gerbangRaporAparaturService.js` — **42 pemeriksaan** bersama Bab 8.

Rencana menempatkan bab ini paling akhir dan menyebut syaratnya: baru boleh
terbit sesudah Bab 2 bersih, hak jawab berjalan, disposisi berjalan, dan rentang
keyakinan terpasang.

**Syarat semacam itu, bila hanya tertulis pada dokumen, akan dilanggar pada hari
pertama seseorang membutuhkan angka untuk rapat** — bukan karena niat buruk,
melainkan karena dokumen tidak menghalangi apa pun.

Karena itu keenam syaratnya dipaksakan kode:

| Syarat | Alat | Mengapa |
|---|---|---|
| hak jawab tersedia | D02 | rapor bernama tanpa tempat menjawab adalah tuduhan |
| disposisi tersedia | D14 | pembinaan kewenangan pimpinan; tanpa arahan, rapor jadi vonis tanpa penandatangan |
| rentang keyakinan | D17 | selisih tiga poin pada penyebut 23 adalah riak, bukan perbedaan |
| penyebut cukup | MS05 | juru sita yang menangani tiga panggilan tidak boleh punya nilai |
| hulu bersih atau berlencana | D06 | rapor yang tampil bersih di atas hulu keruh memberi keyakinan yang tidak dimilikinya |
| sudah disandingkan | — | aturan yang berlaku di atas segalanya |

**Ketika ditahan, yang ditahan hanya NILAINYA.** Nama pelaku, penyebut, dan
jumlah yang terpenuhi tetap terbaca — yang membaca tetap tahu pekerjaan apa yang
tercatat, hanya tidak diberi angka yang menuduh. Diuji tersendiri.

**Peringatan tetap tampil walau seluruh syarat terpenuhi:**

> Rapor ini mengukur yang TERCATAT, bukan yang sebenarnya terjadi. Perkara
> sulit, majelis yang kekurangan orang, dan wilayah yang jauh tidak seluruhnya
> tertangkap. Ia bahan pembinaan, bukan dasar penjatuhan sanksi.

Syarat yang terpenuhi tidak mengubah sifat rapor ini. Menghilangkan
peringatannya ketika syaratnya lengkap akan membuat orang menyangka angkanya
sudah menggambarkan kinerja seutuhnya.

### Gerbang lulus tahap 10

| Syarat | Keadaan |
|---|---|
| Setiap baris bernama punya rentang keyakinannya | **lulus** — dipaksakan gerbang |
| Setiap baris dapat dijawab | **lulus** — dipaksakan gerbang |
| Peringatan tertulis tampil di layar, bukan hanya di dokumen | **lulus** — dipaksakan kode |
| Bab 2 bersih | **terhalang** — telaah 7.062 suntingan menuntut SIPP |

---

## Keadaan seluruh penilaian pada 7 September 2026

| | Jumlah |
|---|---|
| Penilaian terdaftar pada kerangka | **8** |
| Laporan LIPA berblangko nilai | **22** |
| Analisis deskriptif yang tetap hidup apa adanya | **22** |
| Penjaga sisi bot | **84 naskah, 0 gagal** |

Delapan penilaian dari rencana seratus delapan puluh lima. Sisanya **tidak
ditulis dengan sengaja**, bukan karena kehabisan waktu: sebagian besar menunggu
pengukuran ruas teks bebas (tahap 2), dan sebagian lagi ternyata deskriptif
sehingga tidak boleh dipaksa menjadi nilai.

**Tidak satu pun dari kedelapannya boleh dipakai membina hari ini.** Seluruhnya
berstatus *belum disandingkan*, dan gerbang rapor aparatur menolak
menerbitkannya. Itu bekerja sebagaimana dirancang.
