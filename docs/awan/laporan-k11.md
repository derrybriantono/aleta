# Laporan K11 - skrip hanya di halaman yang memakainya (WIP, 26 Okt 2026)

Cabang `fitur/skrip-sesuai-halaman` (dasar `origin/integrasi-rantai-26okt` f2427b6d).

## Tahap 1 (selesai, hijau) - commit f7b0072a
- `konten.js` (1,25 MB) dipecah: inti 320 KB + `konten-panel-bersama.js` 242 KB + `konten-panel-perkara.js` 610 KB + `konten-panel-daftar.js` 86 KB.
  Potongan UTUH kode lama (pembagian dari graf rujukan, bukan tebakan); satu-satunya pintu ke modul: `susunPanel`, `susunPanelDaftar`.
- `modul-malas.js` (pemuat) + izin `scripting` + penyuntikan lewat `latar.js` (daftar putih berkas). Menyuntik skrip KLASIK ke dunia terasing yang sama sehingga lingkup const/let tetap satu.
- Bukti: sidik tiap pernyataan konten.js lama (uji `k11-peta-fitur-26okt.test.ts`), rakitan ulang = konten.js lama byte demi byte, e2e Chromium sungguhan (`scripts/k11-e2e.mjs`): rupa DOM, galat, permintaan portal SAMA sebelum/sesudah.
- Ukuran JS dimuat (e2e): beranda/laporan/form/cetak SIPP 3.670 KB -> 2.742 KB (-906 KB); daftar perkara -> 3.070 KB (-586 KB); halaman perkara -> 3.594 KB (-74 KB, kode panel tetap dimuat di sana).
- Jumlah skrip: 44 -> 45 (beranda), 47 (daftar/perkara).

## Belum
Tahap 2 (jurusita/saksiscan/pihak-lengkap/kontak/penetapan-borang/tarik-satu-perkara malas) dan tahap 3 (abt.js) belum dikerjakan; uji penuh belum dijalankan.
