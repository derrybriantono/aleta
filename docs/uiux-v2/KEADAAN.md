# Keadaan pekerjaan V2: panel ekstensi untuk laptop kecil sampai TV

Branch: `fitur/v2-panel-ekstensi` (dari a4ff5fff, rilis 1.205.5). Versi ekstensi TIDAK dinaikkan; sesi utama yang merilis.

## Cara mengukur
`docs/uiux-v2/tangkap.mjs` menjalankan `panel-alat.js` + `konten.js` / `abt.js` / `checklist.js` SUNGGUHAN di jsdom (tanpa dev server Next),
menyalin DOM-nya ke Chromium headless bersama `panel.css`, lalu mengukur pada 1280, 1366, 1920, 2560, 3840 (replika halaman SIPP
statis, tanpa data perkara). `tangkap-popup.mjs` mengukur popup pada zoom 100/125/150% (jendela popup Chrome 800x600 DIP).
Dijalankan dari `manajemen_surat/`: `node ../docs/uiux-v2/tangkap.mjs sipp|abt|widget|portal` (env `FOTO=1`, `KELUAR=<folder>`).

## Yang diubah
- `panel.css` blok "V2 LAYAR" (di akhir berkas) + dua `@media (min-width: 1100px)` jadi 900px:
  - `--aleta-v2-oto` (pengali layar 1 / 1.19 / 1.44 / 1.69 di 2200 / 2800 / 3400px), `--aleta-v2-lebar` (panel berlabuh SIPP:
    30vw jepit 340-440px di laptop, 470 / 560 / 680 / 800px di layar lebar), `--aleta-v2-mengambang`.
  - Panel SIPP berlabuh: lebar `min(lebar tersimpan atau bawaan layar, 55vw)`, halaman SIPP menyempit (tidak tertutup), mulai 900px
    (zoom 125% di laptop 1366 = 1093px tadinya jatuh ke panel mengambang yang menutupi borang). Portal letak "samping" ikut.
  - Bilah tab SIPP di bawah 1500px: satu baris yang dapat digulir; tab terpilih digulir ke tengah (`t7GulirTabKeTampak`, konten.js).
  - Kepala panel SIPP sempit: lampu SIPP/ALETA/e-Court turun ke baris kedua (sebelumnya tertimpa tombol).
  - Kepala bagian berlebar penuh `box-sizing: border-box` (tombol "Susun"/"Baca ulang" di panel ABT sebelumnya terpotong ~20px).
  - Panel ABT UI Baru: `min-width` tidak lebih dari 36% layar di laptop (tadinya 560px tetap), dikali pengali di layar besar.
- `panel-alat.js`: huruf = pilihan petugas x pengali layar (di bawah 2200px nilainya tetap angka polos, jadi tampilan Lama identik);
  dipasang ulang saat jendela berubah ukuran. Ukuran bawaan panel mengambang: 420px di bawah 1500px (tadinya min 520px), 520-760px
  dikali pengali di atasnya (`alatPengaliLayar`).
- `checklist.js` (widget kiri bawah + draf H-7): lebar, tinggi, lencana, tombol kepala dikali pengali; tetap `max-width: 100vw - 24px`.
- `popup.html`: kepala menempel saat digulir, tanpa gulir ke samping, merapat di jendela pendek (zoom 125-150%).
- Tidak ada tombol, tab, atau aksi yang disembunyikan atau dihapus (dijaga `uiux-v2-panel-ekstensi.test.ts`).

## Bersinggungan dengan SAKSI-A (blok "Susun saksi" di abt.js)
`abt.js` TIDAK diubah sama sekali. Satu-satunya sentuhan: `panel.css`, `#aleta-panel-abt[data-sore] .aleta-sore-kerja-kepala { flex-wrap: wrap }`
dan `.aleta-lipat-kepala { box-sizing: border-box; max-width: 100% }` (di blok V2). Bila SAKSI-A menambah tombol di kepala bagian itu,
tombolnya ikut membungkus; tidak perlu penggabungan kode.

## Keputusan lama yang disentuh
- 12 Okt "ukuran bawaan panel mengambang 520-760px": di bawah 1500px kini 420px, di atas 2200px dikali pengali. Uji
  `checklist-posisi-panel-12okt.test.ts` (tabel ukuran) disesuaikan; ukuran yang sudah ditarik petugas tidak disentuh.
- Uji `ekstensi-ptsp-5okt.test.ts` "layar sempit": 1000px -> 800px sebab ambang berlabuh turun dari 1100 ke 900px.

## Belum / batas
- Panel ABT dan panel mengambang lain tetap MENGAMBANG (bukan berlabuh); lebarnya dapat ditarik dan posisi/ukurannya tersimpan per
  aplikasi (`posisiPanelAbt` dkk., sudah ada). Hanya panel SIPP UI Baru dan portal letak "samping" yang menyempitkan halaman.
- Ikon, jarak, dan tinggi tombol berpiksel tetap di dalam panel belum ikut pengali (hanya huruf, lebar panel, dan widget).
- Widget yang DIBENTANGKAN petugas (checklist + kehadiran + draf H-7) di layar 1280-1366 menutupi kolom kiri halaman (tingginya sampai
  100vh - 96px, boleh digulir); bawaannya terlipat (lencana 48px).
- Tangkapan dari replika: tata letak SIPP/ABT asli (kolom, tombol Simpan) perlu dicek di Chrome kantor.
