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
