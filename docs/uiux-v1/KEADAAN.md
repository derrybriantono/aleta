# Keadaan pekerjaan UI/UX semua layar (agen V1) - dijeda

Branch: `fitur/v1-uiux-semua-layar` (dari `integrasi-1205-1`, tag rilis-1.205.1).
Dijeda atas perintah koordinator karena memori laptop menipis. BELUM ada tsc, lint, atau vitest yang dijalankan.

## Sudah dikerjakan (kelompok 1: komponen bersama)
- `manajemen_surat/src/app/globals.css`
  - Huruf akar naik di layar sangat lebar (>=2200px: 19px, >=2800px: 23px, >=3400px: 27px). Di bawah 2200px tidak berubah.
  - `html.aleta-layar-jauh`: huruf akar = `max(16px, min(1.04vw, 1.85vh))` untuk televisi.
  - Perangkat sentuh (`pointer: coarse`): tombol/select min 2.5rem; kolom isian 16px di <=767px (cegah zoom iOS).
  - Kata panjang dipatahkan di HP (`overflow-wrap: anywhere` pada judul/paragraf/daftar di dalam `main`).
  - Utilitas `.aleta-tabel-gulir` dan `.aleta-baris-aksi`.
  - Kerangka e-Court (`[data-lebar-ecourt]`) melebar dalam rem di >=2200px (supaya Jadwal Sidang ikut membesar di 4K); kelas lama di `lib/jadwal-sidang-2okt.ts` TIDAK diubah (uji menjaga string persisnya).
- `components/layout/portal-shell-v2.tsx`: lebar isi `max-w-[100rem]` (sama dengan 1600px di 16px), sidebar dalam rem, laci HP `100dvh`, menu notifikasi tidak melebihi layar, ikon pencarian cepat untuk HP (`sm:hidden`, tautan ke /search; sebelumnya pencarian tersembunyi di HP).
- `components/ui/tabs.tsx`: daftar tab dapat digulir di bawah lg, tab tidak menyusut.
- `components/ui/dropdown-menu.tsx`: lebar/tinggi maksimum terhadap layar, `collisionPadding`.
- Dialog tanpa batas tinggi diberi `max-h-[calc(100dvh-2rem)] overflow-y-auto`: database-admin-panel, surat/[id], jlf-variable-review-page, jlf-quick-workbench (pratinjau), aleta-bot-dashboard; `90vh` -> `90dvh` di aleta-bot-admin dan aleta-ecourt-sidang (kalender).
- Layar TV/publik: `components/layout/mode-layar-jauh.tsx` (baru) dipasang di antrian-layar, antrian-ruang, antrian-tampil, sidang-ruang.
- Uji baru: `src/test/uiux-semua-layar.test.tsx` (belum pernah dijalankan).

## Belum dikerjakan
- Pemasangan dependensi di worktree gagal/ lambat: `npm ci` pertama gagal di postinstall puppeteer; yang kedua (`PUPPETEER_SKIP_DOWNLOAD=1 npm ci --ignore-scripts`) dihentikan sebelum selesai. `manajemen_surat/node_modules` di worktree ini TIDAK lengkap (jangan di-commit). Lanjutan: ulangi perintah kedua itu, atau pakai node_modules checkout utama.
- Pemindaian luapan datar per halaman di 390/820/1366/1920/3840 dengan Playwright (skrip ada di scratchpad sesi: `scan.mjs`; harus disalin ke `manajemen_surat/` agar `@playwright/test` terbaca). Peladen: dev dengan `NEXT_PUBLIC_BASE_PATH=/aleta`, `DATABASE_URL=postgres://uji:uji@127.0.0.1:59999/aleta-uji-e2e`, `ALETA_ALLOW_IN_MEMORY_FALLBACK=1`, `ALETA_TANPA_CETAKAN_INGATAN=1`, `BETTER_AUTH_URL=http://localhost:3000`; akun uji dari e2e proyek.
- Kelompok 2 (halaman utama): Jadwal Sidang, Status Perkara, Mediasi, e-Court/Integrasi, Kasir, BAS, Blangko, SKP, Pengaturan, Dasbor - belum dicek di peramban; kandidat: tabel tanpa pembungkus gulir (aleta-bot-admin 3, kasir-otomatis 2, rekap-petugas, tautan-sipp-semua, letter-list, peta-titik-perkara, relaas-massal).
- Kelompok 3 (TV/publik): hanya ModeLayarJauh yang terpasang; ukuran per layar belum diukur di 1920/3840.
- Kelompok 4 (ekstensi): TIDAK disentuh. Mengubah `ekstensi-sipp/` memutus uji `aleta-ecourt-zip` (isi tertanam harus sama) dan butuh rilis ekstensi (naik versi + tanam), yang dilarang untuk tugas ini. Usul: rilis ekstensi terpisah.
- Tangkapan layar di `docs/uiux-v1/`: belum ada.
- tsc, lint, vitest: belum dijalankan.
