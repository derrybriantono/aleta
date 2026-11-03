# Lanjutan panel keputusan A (4 Nov) - WIP, belum selesai

## Sudah dikerjakan (belum dikomit-uji penuh, belum tsc/lint)
- A1 pratinjau cepat: bot `isiBlangko` param `segar` (lewati ingatan 60 dtk) + `kosong[].status` di abtMesinVariabel.js;
  portal route.ts POST (blangko.isi segar, balas `galat`/`jumlahGalat`/`mesinGalat`); ekstensi blangko-derry-isian.js
  `ambilRtfPratinjau` (mesin ALETA -> bila galat jatuh ke ABT lama dgn pesan jelas, batas 6 mnt via abt-klien.js `cetak({batasMs})`),
  `bersihkanNaskahKeluaran` diekstrak dari ambilRtfBaru; Cetak/naskah latar tetap ABT (S.prat.rtf tidak diisi mesin cepat).
- A7: `FOLDER_DERRY_TANPA_MENU` (19 folder) di lib/tugas-blangko.ts, disaring di indeksDerry route.ts.
- A12: lib/variabel-titik-kalimat.ts (6 variabel), GET `?titik=1` di route.ts, `periksaTitikVariabel` di isian.js,
  butir `titikvariabel` di blangko-derry-periksa.js (peringatan lunak, bahan `titikVariabel`).
- B4: kasir portal (kasir-jurnal.tsx + lib/kasir-jurnal.ts: peringatanTarifKasir, ketTarifKasir); Banggai Laut "72.11": 40500
  ditambah di kasirTarifAlamat.js; uji kasir-tarif-alamat-3nov.test.ts 29 hijau (Labuan, Banggai Laut, luar Sulteng >=3 riwayat terverifikasi).

## Hasil uji terakhir (14 berkas sasaran): 299 hijau, 1 merah
- blangko-derry-susun-16okt.test.ts "masukan salah dijawab 400...": melarang `export async function POST|PUT|DELETE` di
  blangko-derry/route.ts (penjaga baca-saja). Solusi: pindahkan POST pratinjau ke rute baru `blangko-derry/pratinjau/route.ts`
  (salin `jenisBolehSesi` ke berkas pembantu, JANGAN ubah teks PERAN_TIRUAN di route.ts karena dijaga uji lain), atau
  perbarui penjaga dengan sadar. Jalankan lagi + sesuaikan URL `API_BLANGKO` -> `${API_BLANGKO}/pratinjau` di naskahDariMesinAleta (isian.js).

## Sisa
1. Perbaiki merah di atas. 2. Tulis uji baru `blangko-derry-pratinjau-4nov.test.ts` (rute: segar:true tanpa `tes`, hak peran, galat -> jumlahGalat;
   indeks tanpa 19 folder; titik=1; klien: pratinjau tidak mengisi S.prat.rtf, jalur cadangan ABT + batas 6 mnt; periksa.js titikvariabel).
3. tsc (`NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit`) + lint berkas diubah. 4. Jalankan lagi uji sasaran
   (cetak-cepat-27okt, tes-putusan-*, blangko-derry-*, g1-cegah-salah-30okt, perbaikan-1203-17okt, fix-abt-blangko-hak-rute-17okt, cetak-kotak-acuan-26okt, q2-mesin-variabel-abt).
5. panel.css tidak diubah (tidak perlu). Tidak ada berkas ekstensi baru (susun-ekstensi tak perlu diubah).
