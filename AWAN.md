# AWAN.md — panduan untuk sesi Claude Code di CLOUD (lingkungan "Default")

Baca berkas ini SEBELUM bekerja bila kamu berjalan di cloud (claude.ai/code), bukan di laptop pengembang.
`CLAUDE.md` tetap berlaku untuk gaya kerja, tetapi bagian yang menyebut drive `D:`, papan `localhost:8787`,
server `192.168.10.10`, SSH `aleta`, dan skill rilis HANYA untuk laptop.

Pengguna: Derry (hakim PA Donggala, Super Admin & pengembang ALETA). Jawab dan tulis teks untuk pengguna dalam
**bahasa Indonesia**. Istilah tampilan: "server" (bukan "peladen"), "blangko" (bukan "template"), tanpa label teknis.

---

## 1. Batas sesi cloud

| Bisa di cloud | TIDAK bisa di cloud (dikerjakan sesi laptop) |
| :--- | :--- |
| Membaca & menulis kode `manajemen_surat/` (portal Next.js), `aleta_bot/` (bot Node), `ekstensi-sipp/` (ekstensi Chrome MV3) | Menjangkau server kantor 192.168.10.10, SIPP, ABT, MySQL/Postgres asli, e-Court |
| `npm ci`/`npm install` di salinan cloud sendiri, `npx tsc --noEmit`, uji SASARAN `npx vitest run src/test/<berkas>` dari `manajemen_surat/` | Uji penuh (`scripts/periksa-uji.mjs`; beberapa uji butuh MySQL lokal laptop), pengemasan, pemasangan ke server |
| Uji dengan fixture/tiruan (jsdom, chrome tiruan, pg-mem) | Mengukur aturan atas data perkara sungguhan |
| Push cabang `fitur/<nama>` ke GitHub | Paket ABT (`abt-paket/`), papan kemajuan lokal, menyalin ekstensi ke Chrome |

**Dilarang** membawa ke repo/cloud: data perkara/putusan asli, dump SIPP/ABT, `.env`, sandi, kunci API, token.
Fixture baru wajib memakai nama dan NIK rekaan.

## 2. Alur cabang (wajib)

1. Mulai dari cabang **`integrasi-1205-38`** (sama dengan yang terpasang di server). `main` di GitHub sudah lama
   tertinggal — JANGAN mulai dari `main`, JANGAN push ke `main`.
2. Satu tugas = satu cabang: `git switch -c fitur/<nama-singkat> origin/integrasi-1205-38`.
3. Commit bergaya conventional, bahasa Indonesia, badan 1-3 baris menjelaskan SEBAB, akhiri dengan baris
   `Co-Authored-By` yang diminta lingkunganmu. Push cabangmu; jangan merge ke cabang lain.
4. **Jangan naikkan versi** (`ekstensi-sipp/manifest.json`, `APP_VERSION` portal) dan jangan menulis catatan rilis —
   sesi laptop yang menggabung, menguji penuh, menaikkan versi, dan memasang.
5. Bila mengubah `ekstensi-sipp/`, jalankan `ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs` dari `manajemen_surat/`
   agar `src/server/shared/ekstensi-berkas.ts` ikut terbarui (bila bentrok saat digabung, sesi laptop menanam ulang).
6. Migrasi Drizzle - nomor DIBAGI per tugas agar sesi cloud yang berjalan bersamaan tidak bentrok
   (idx `_journal.json` juga bentrok diam-diam): **T1 = 0084-0085, T9 = 0086-0087, T10 = 0088-0089, tugas lain = 0090+**
   (minta nomor ke sesi laptop). Tulis nomor dan idx jurnal yang kamu pakai di laporan.

## 3. Aturan keras proyek (berlaku juga di cloud)

- **TIDAK SATU KATA "Aleta"/"ALETA"** boleh masuk ke nilai/basis data SIPP, ABT, atau e-Court (label tampilan ekstensi boleh).
- Blangko & variabel ABT: hanya milik "Derry" (`derry_briantono`) yang boleh diubah; blangko non-Derry tidak disentuh.
- **Fitur lama jangan dikurangi**: UI boleh diubah, fungsi tidak boleh hilang.
- Hak per peran: pakai `manajemen_surat/src/lib/matriks-peran.ts` (bolehAksi, alatMenuPeran) + penjaga di rute API
  (bukan hanya menyembunyikan tombol). Keputusan yang sudah ada: Putusan Otomatis/Jadwalkan Putusan = Ketua, Wakil,
  Hakim, Admin, Super Admin; Penetapan Otomatis = PTSP, Ketua, Wakil, Admin, Super Admin (+ hak "Kerjakan"); unggah
  putusan SIPP/e-Court = hakim/ketua/admin; Tes putusan & saklar otomatis = Super Admin.
- CSS ekstensi: warna dari token (`--aleta-*` di panel; `--s-*` di halaman SIPP dengan cadangan di dalam `var()`), tanpa
  angka warna di aturan tema gelap; JANGAN menambah aturan di ujung `ekstensi-sipp/panel.css` sesudah blok
  "V2 LAYAR (18 Okt 2026)" (sisipkan sebelumnya); ukuran huruf ≥ 11,5px. Portal: menu memakai `bg-card` (bukan `bg-popover`).
- Tema: satu sumber pilihan (`aleta-tema-pilihan`: terang | gelap | sistem), lihat `ekstensi-sipp/tema-pusat.js`,
  `manajemen_surat/src/lib/tema-pilihan.ts` — jangan membuat penyimpan tema kedua.
- Pekerja latar MV3 tidak mengingat variabel modul; SIPP menyembunyikan elemen dengan `.hide()` (periksa yang tampak).
- Sebutan pihak dari SATU sumber (alur_perkara_id/jenis_perkara_id via `sebutan-pihak.ts`), bukan tebakan kata.
  Ingat: pelaku = `#0047#` = Tergugat/Termohon.
- Uji yang hanya `toContain` atas teks kode sendiri tidak cukup — uji perilaku nyata (jsdom/render).

## 4. Pekerjaan Minggu 25 Okt 2026 (pilih SATU per sesi)

Laporkan di akhir: cabang, commit, berkas, hasil uji sasaran, hal yang perlu diukur/diputuskan di laptop.

### T1. ALETA Ai tahap 2 (bisa dipecah 2a/2b)
Rencana lengkap: `docs/awan/rencana-aleta-ai-v2.md` (bagian 4, 8 tahap 2 & 2b, 10.1-10.4). Tahap 1 (layar chat,
rute model, catat token) sudah ada: cari `aleta-ai` di `manajemen_surat/src` dan `aleta_bot/`.
- 2a: alat data BACA-SAJA per perkara + alat REKAP lintas perkara (katalog alat berparameter, bukan SQL karangan AI),
  penyamaran dua arah wajib + uji "tidak ada data asli di permintaan", matriks kemampuan per peran (bagian 10.3)
  ditegakkan di server.
- 2b: pop-up chat di ekstensi (bagian 10.1), lewat rute portal; ekstensi tidak memegang kunci API.
- Prasyarat di server (kunci API di env, akun DB SIPP baca-saja) disiapkan sesi laptop — kode harus jalan dengan
  "fitur mati" bila prasyarat belum ada.

### T2. Keterangan saksi otomatis untuk SEMUA jenis perkara
Sekarang baru cerai (lihat `aleta_bot/services/abtUsulanService.js`, fitur "Susun saksi" di panel ABT:
`ekstensi-sipp/saksi-susun.js`, `saksi-katalog*.js`; keputusan: POSITA acuan utama, sebab yang belum dikuatkan saksi =
saran saja, tanpa kalimat penutup). Perluas ke jenis lain (itsbat, dispensasi kawin, wali adhal, asal usul anak,
harta bersama, waris, hadhanah, dll.). Kerjakan kode + uji dengan contoh rekaan; pengukuran atas posita/BAS asli
dilakukan di laptop — tulis daftar yang perlu diukur.

### T3. Tombol "Kasir ALETA" di SIPP › Jurnal Perkara › Jurnal Keuangan Perkara
Tombol membuka pop-up (pakai komponen `ekstensi-sipp/popup-aksi.js` yang sudah ada: tutup klik-ganda di luar / Esc 2x),
isinya tampilan kerja Kasir yang sama dengan ekstensi (`kasir` di ekstensi/portal; uji `kasir-*.test.ts`), warna ikut
tema gelap/terang. Hak: kasir (+ Admin/Super Admin); pengawas (panitera/panmud) hanya membaca.

### T4. Mode gelap/terang di E-Keuangan dan E-Court
- E-Keuangan = modul portal ALETA (masih kerangka): ikuti pusat tema portal yang ada.
- E-Court = situs **ecourt.mahkamahagung.go.id** (milik MA; keputusan pengguna 23 Okt). Diwarnai oleh EKSTENSI
  (content script; pencocokan host sudah ada di `ekstensi-sipp/manifest.json`, lihat `ecourt-masuk.js`): lapisan CSS
  gelap/terang memakai pusat tema (`tema-pusat.js`, pilihan terang | gelap | sistem), dipasang `document_start` tanpa
  kedip, tidak mengubah isi/perilaku situs, tidak menyembunyikan apa pun, tidak mengirim apa pun, dan dapat dimatikan
  (saklar popup, pola saklar yang ada). JANGAN menyimpan data dari situs e-Court ke repo. Susunan halaman e-Court
  tidak bisa dibuka dari cloud: tulis CSS berbasis elemen umum (body, tabel, form, kartu, navbar Bootstrap) dan minta
  sesi laptop menyalin contoh halaman (data disamarkan) bila perlu penyesuaian.

### T5. Panduan langkah kerja kasir bersorot di halaman SIPP
Sorotan bertahap (highlight) pada elemen SIPP yang ditandai ALETA untuk kasir: apa yang dikerjakan, urutannya.
Pola panduan/tutorial: `manajemen_surat/src/lib/tutorial-isi.ts`, penanda halaman SIPP di ekstensi (`konten.js`,
`sipp-ide-*.js`).

### T6. Kartu ALETA di atas form "Tambah Data Pihak Saksi" dibuat terlipat
Kartu "Saksi / Pihak" dan "Saksi Putusan" (ekstensi `saksiscan.js` / modul saksi) bawaan terlipat; fungsi tetap.

### T7. "Hubungan saksi (ALETA)" juga di form "Tambah Referensi Data Pihak"
Saat ini hanya di form saksi. Form referensi: `form#frm_ref_pihak` (lihat `ekstensi-sipp/pihak-lengkap.js`,
uji `pihak-isi-tab-ingat-22okt`, `saksi-alamat-wilayah-22okt`, `saksi-hubungan-bersih-22okt`).

### T8. Isi otomatis semua kolom "Tambah Referensi Data Pihak" yang dapat dideteksi
Jenis kelamin (dari bin/binti, hubungan), agama, umur (dari tanggal lahir), warga negara, pekerjaan, status kawin,
pendidikan, dll. Hanya isi yang KOSONG, tidak menimpa; yang ragu = usulan, bukan isian; Simpan tetap ditekan petugas.
Pengingat merah hanya untuk nilai SK yang kosong (jenis identitas, nomor identitas, telepon) — bentuk NIK/telepon
TIDAK diperiksa (keputusan 22 Okt).

Catatan T3/T5-T8: susunan DOM halaman SIPP dibaca dari fixture uji yang ada (mis. form tiruan di uji di atas). Bila
kurang, tulis di laporan halaman SIPP mana yang perlu disalin oleh sesi laptop (dengan nama disamarkan).

### T9. ALETA Ai tahap 3 - Tugas (cowork), keluaran berkas, alat bantu, kirim ke alur ALETA
Rencana: `docs/awan/rencana-aleta-ai-v2.md` bagian 3 butir 4-7 dan bagian 8 tahap 3. **Kerjakan sesudah T1 (tahap 2)
digabung** - tugas memakai alat data baca-saja dan penyamaran dari tahap 2. Kode tahap 1 yang ada:
`manajemen_surat/src/server/modules/aleta-ai/` (mesin.ts = panggilan model + SSE, percakapan.ts, proyek.ts = proyek
V4.5 dari zip yang diunggah Super Admin, saldo.ts, laporan.ts, akses.ts), rute `src/app/api/aleta-ai/*`, tabel
`drizzle/0078_aleta_ai.sql`.
1. **Tugas (cowork)**: perintah kerja panjang (draf putusan, panduan sidang, komparasi arah putusan) yang berjalan sebagai
   rangkaian langkah terlihat (rencana -> ambil data -> susun -> periksa -> berkas), dapat dihentikan, dilanjutkan,
   dan bertahan bila peramban ditutup (status di tabel baru, bukan memori proses). Satu tugas = satu tahan saldo;
   tiap langkah mencatat model/effort/token/biaya (pola `aleta_ai_penggunaan`). Rute model mengikuti tabel bagian 2
   (draf putusan = Opus high; perkara rumit = max) dan batas per peran bagian 10.3 (draf putusan hanya Ketua/Wakil/Hakim).
2. **Keluaran berkas** DOCX/RTF/PDF/HTML/XLSX dari templat proyek V4.5 dan format putusan Donggala. Templat TIDAK ada di
   repo: dibaca dari proyek aktif di basis data (proyek.ts). Uji dengan zip proyek REKAAN kecil (buat fixture sendiri,
   tanpa isi V4.5 asli). Data asli dikembalikan dari kode samaran HANYA di berkas untuk pengguna; berkas draf putusan
   diberi tanda "Draf AI - wajib diperiksa". Rujukan pasal yang belum terverifikasi ditandai dan tidak dicetak di
   berkas resmi.
3. **Alat bantu deterministik** (skrip `aleta/*.py` di proyek V4.5: kalkulator nafkah/iddah/mut'ah, cek blangko,
   cek konsistensi, anonim, analisa docx) dijalankan di **sandbox server**: kontainer Python terpisah tanpa jaringan,
   batas waktu & memori, berkas masuk/keluar lewat folder sementara, daftar skrip yang diizinkan saja; model hanya
   meminta "jalankan alat X dengan masukan Y", tidak pernah menjalankan kode bebas. Di cloud: tulis layanan, berkas
   compose/Dockerfile sandbox, dan uji dengan skrip rekaan; pemasangan kontainer dikerjakan sesi laptop.
4. **Kirim ke alur ALETA**: hasil dapat dikirim ke Blangko ABT by Derry (isian), Draf H-7, atau BAS - selalu lewat
   tombol + konfirmasi petugas; AI TIDAK PERNAH menulis langsung ke SIPP/ABT/e-Court, dan tanpa kata "ALETA" di nilai
   yang dikirim.
5. Penolakan model, batas token, dan galat langkah: hasil sementara tersimpan; saldo dipotong hanya sesuai pemakaian.
6. Uji: hak per peran x kemampuan (server menolak), kebocoran (tidak ada data asli di permintaan ke model - pakai
   klien model tiruan), berkas keluaran terbuka dan memuat tanda draf, sandbox menolak skrip di luar daftar.

### T10. ALETA Ai tahap 4 - Dompet lengkap
Rencana: bagian 6 (harga, kurs) dan 8 tahap 4. Fondasinya SUDAH ADA di `saldo.ts` (buku mutasi isi/kuota/tahan/
lepas/potong/koreksi, saldo = jumlah mutasi, idempoten), `kurs.ts`, `laporan.ts`, rute `api/aleta-ai/saldo|kurs|
laporan|pengaturan`. **Audit dulu yang sudah jalan**, lalu lengkapi yang belum:
1. **Perkiraan biaya sebelum jalan**: hitung token masukan (count tokens / perkiraan) + perkiraan keluaran menurut
   kelompok rute -> tampilkan rupiah ke pengguna SEBELUM giliran/tugas berjalan; dana ditahan; biaya aktual dipotong;
   selisih kembali; gagal = tidak dipotong (pola tahan/lepas/potong yang ada).
2. **Rumus harga** (keputusan pengguna, jangan diubah): biaya API aktual (tarif resmi per model, diisi Super Admin) x kurs
   x (1 + margin) + MDR QRIS, dibulatkan KE ATAS Rp500, minimum Rp1.000 per giliran; margin bawaan 30%; kurs harian
   otomatis (kurs tengah JISDOR BI, cadangan sumber terbuka) x (1 + penyangga 3%), kurs terakhir dipakai bila gagal
   ambil; tiap giliran mencatat kurs yang dipakai. Uji pengambil kurs dengan HTTP tiruan (cloud tidak boleh bergantung
   pada situs luar saat uji).
3. **Kuota hibah per peran** (opsional, Super Admin) tercatat sebagai mutasi `kuota`; Super Admin gratis dalam batas wajar.
4. **Batas**: per pengguna per hari (token & rupiah), per satker per bulan, batas laju; **saklar darurat** mematikan
   ALETA Ai seketika (sudah ada saklar - pastikan juga menghentikan tugas T9 yang berjalan).
5. **Laporan Super Admin**: pendapatan, biaya API, MDR, laba (= pendapatan - biaya API - MDR) per pengguna/peran/
   kelompok/model/bulan; ekspor XLSX/CSV; rekonsiliasi harian (saldo = jumlah mutasi; selisih ditandai).
6. **Pengguna**: halaman Dompet - saldo, mutasi, rincian biaya per giliran, struk (PDF/HTML), notifikasi saldo menipis.
7. **BUKAN bagian T10**: QRIS/gateway pembayaran (tahap 5, butuh akun merchant) - sediakan antarmuka "isi saldo"
   manual oleh Super Admin saja. Ingat pengingat hukum di rencana bagian 9 (PNBP/pungli, pajak, ASN, UU PDP): fitur
   isi saldo berbayar tetap MATI bawaan sampai pengguna memutuskan.
8. Uji: rumus harga (pembulatan, minimum, kurs, margin) dengan angka contoh; tahan/lepas/potong idempoten di bawah
   pemanggilan ganda; batas harian & saklar darurat; laporan laba = jumlah mutasi.

Urutan yang disarankan: T1 (tahap 2) -> T10 (tahap 4, boleh paralel dengan T1 karena memakai saldo.ts) -> T9 (tahap 3).
Prasyarat dari pengguna untuk menyalakan di server (dikerjakan sesi laptop): kunci API Anthropic di env server, akun
DB SIPP baca-saja, persetujuan matriks kemampuan per peran, keputusan tarif/margin/kurs, izin pimpinan.

## 5. Perintah berguna

```bash
cd manajemen_surat
npm ci                                   # sekali per sesi cloud (aman di cloud; di laptop DILARANG di worktree ber-junction)
npx tsc --noEmit
npx vitest run src/test/<berkas>.test.ts # uji sasaran saja; jangan menjalankan seluruh rangkaian
ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs   # bila ekstensi-sipp/ berubah
```
