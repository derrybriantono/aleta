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
6. Migrasi Drizzle: nomor berikutnya yang bebas **0084** (cek `manajemen_surat/drizzle/meta/_journal.json`); tulis
   nomor yang kamu pakai di laporan.

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
E-Keuangan = modul portal ALETA (masih kerangka). "E-Court" — PASTIKAN dulu ke pengguna lewat laporan: halaman
ALETA e-Court di portal, atau situs ecourt.mahkamahagung.go.id yang diwarnai ekstensi. Ikuti pusat tema yang ada.

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

## 5. Perintah berguna

```bash
cd manajemen_surat
npm ci                                   # sekali per sesi cloud (aman di cloud; di laptop DILARANG di worktree ber-junction)
npx tsc --noEmit
npx vitest run src/test/<berkas>.test.ts # uji sasaran saja; jangan menjalankan seluruh rangkaian
ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs   # bila ekstensi-sipp/ berubah
```
