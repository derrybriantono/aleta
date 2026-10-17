# Keadaan pekerjaan UI/UX semua layar (agen V1)

Branch: `fitur/v1-uiux-semua-layar` (dari `integrasi-1205-1`, tag rilis-1.205.1).

## Sudah dikerjakan
Kelompok 1 - komponen bersama (`manajemen_surat/src`):
- `app/globals.css`
  - Huruf akar naik di layar sangat lebar: >=2200px 19px, >=2800px 23px, >=3400px 27px. Di bawah 2200px tidak berubah.
  - `html.aleta-layar-jauh`: huruf akar `max(16px, min(1.04vw, 1.85vh))` untuk televisi.
  - Perangkat sentuh: tombol/select min 2.5rem; kolom isian 16px di <=767px (cegah zoom iOS).
  - Tablet dan HP (<=1023px): anak grid di `main` boleh menyusut (`min-width: 0`), sel `td/th` di `main` dibatasi `max-width` 22rem (16rem di <=767px). Desktop tidak berubah.
  - Kata panjang dipatahkan di HP; utilitas `.aleta-tabel-gulir`.
  - Kerangka e-Court (`[data-lebar-ecourt]`) melebar dalam rem di >=2200px; kelas di `lib/jadwal-sidang-2okt.ts` tidak diubah (uji menjaga string persisnya).
- `components/layout/portal-shell-v2.tsx`: lebar isi `max-w-[100rem]`, sidebar dalam rem, laci HP `100dvh`, menu notifikasi tidak melebihi layar, ikon pencarian cepat untuk HP (sebelumnya pencarian tersembunyi di HP).
- `components/ui/tabs.tsx` (tab dapat digulir di bawah lg), `components/ui/dropdown-menu.tsx` (batas lebar/tinggi terhadap layar).
- Dialog tanpa batas tinggi diberi `max-h-[calc(100dvh-2rem)] overflow-y-auto`: database-admin-panel, surat/[id], jlf-variable-review-page, jlf-quick-workbench, aleta-bot-dashboard; `90vh` jadi `90dvh` di aleta-bot-admin dan aleta-ecourt-sidang.
- Kartu masuk (`app/login/page.tsx`) dalam rem agar ikut membesar di 4K.

Kelompok 2 - halaman utama:
- Tabel yang belum punya pembungkus gulir kini dibungkus `aleta-tabel-gulir`: aleta-bot-admin (3), kasir-otomatis (2), rekap-petugas (1), tautan-sipp-semua (1); peta-titik-perkara: `overflow-y-auto` jadi `overflow-auto`.
- Telaah Jadwal Sidang, Status Perkara, Mediasi, Kasir, BAS, Blangko, SKP, Pengaturan, Dasbor: semua tabelnya sudah punya pembungkus gulir dan tak ada grid tanpa awalan responsif, jadi yang berlaku di sana adalah aturan bersama di atas. Tabel Jadwal Sidang sudah punya mode ringkas dan `min-w-0` di xl; tidak diubah (terlalu rawan, diuji banyak berkas). Tabel jadi kartu di HP TIDAK dibuat; yang dipakai gulir ke samping.
- Tabel cetak (cetak-relaas, cetak-jadwal, cetak-riwayat, status-perkara-cetak) sengaja tidak disentuh.

Kelompok 3 - layar TV/publik: `components/layout/mode-layar-jauh.tsx` dipasang di antrian-layar, antrian-ruang, antrian-tampil, sidang-ruang.

Uji: `src/test/uiux-semua-layar.test.tsx` (17 uji).

## Hasil pemeriksaan
- `tsc --noEmit`: bersih (kode keluar 0).
- ESLint pada 21 berkas yang diubah: 13 galat, SEMUA lama dan di baris yang tidak disentuh (peta-titik-perkara set-state-in-effect, aleta-ecourt-sidang preserve-manual-memoization, aleta-bot-admin set-state-in-effect). `lint-jangan-bertambah` merah karena utang lama di berkas lain yang tak disentuh (baseline basi di tag 1.205.1).
- Vitest (sasaran, maxWorkers=1, 3 berkas sekali jalan): uiux-semua-layar, login-page, rekap-petugas-tampilan, kasir-otomatis, kasir-jurnal, lebar-kolom-antrian-jam, tata-letak-antrian-sidang, tampilan-antrian-sidang, antrian-sidang-tampilan, layar-antrian-jaga-hidup, peta-kanvas-lebar, jadwal-sidang-1okt, jadwal-sidang-2okt, button-wiring, peta-perkara-layar, antrian-tampilan, antrian-disidang-ruang, antrian-dua-belas-butir, antrian-sidang-lima-permintaan, jadwal-sidang-tampilan, aleta-bot-template-query-suggestion: semua hijau. Uji penuh TIDAK dijalankan.

## Belum / tidak dikerjakan
- Tangkapan layar di `docs/uiux-v1/`: dilewati atas perintah koordinator (dev server dan peramban terlalu berat). Pengecekan di layar asli (390, 820, 1366, 1920, 3840) dilakukan sesi utama.
- Panel dan widget ekstensi (`ekstensi-sipp/`): tidak disentuh, sesuai perintah. Perlu rilis ekstensi terpisah (naik versi + tanam).
- node_modules di worktree adalah junction ke checkout utama (bukan bagian commit).

## Yang perlu diperiksa di layar asli
- Skala huruf >=2200px: tabel Jadwal Sidang dan kerangka e-Court.
- Batas `max-width` sel tabel di tablet/HP: kolom yang dulu lebar (nama, alamat, pesan) kini membungkus; periksa tidak ada kolom penting yang jadi terlalu sempit.
- `min-width: 0` pada anak grid di tablet/HP: periksa tidak ada kartu yang isinya meluap keluar.
- Tombol/select min 2.5rem di layar sentuh: baris tombol kecil di tabel bisa lebih tinggi.
- Dropdown kini bisa digulir (`overflow-y-auto`): periksa bayangan/fokus item.
- ModeLayarJauh di 1920x1080: huruf akar 20px; periksa antrian-layar tidak melewati tinggi layar.
