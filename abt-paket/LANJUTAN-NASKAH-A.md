# Lanjutan agen NASKAH A (keputusan Derry 182/184, 4 Nov 2026) - belum selesai

Status: BARU PENYELIDIKAN; belum ada paket, belum ada uji. Tidak ada perubahan pada blangko/kode.

## Dasar kerja (di luar repo, dapat dibuat ulang)
- Pohon dasar = pohon A3 (`D:/aleta-dev/kerja/audit-abt-4nov/pohon/derry_briantono`) + paket `audit-mekanis-4nov` + `audit-ejaan-4nov`
  (dipasang ke salinan dengan `ABT_BLANGKO=<salinan> PY=python bash pasang-satker.sh`). Hasil: `D:/Aplikasi/aleta/tmp/w206/dasar/` (1.881 RTF; PRASYARAT paket baru = md5 pohon ini).
- Alat: `abt-paket/keputusan-a-naskah-4nov/alat/` (teks.py = teks tampak via rtfpeta; kon.py = konteks regex; k10.py = klasifikasi #8555#).
  Skrip Python HARUS ditulis dengan alat Write (heredoc Bash menyusutkan garis miring).
- Pola paket: tiru `bukti-pisah-1nov` (RTF tambal + variabel INSERT + PRASYARAT/PERIKSA/PULIH) dan `audit-mekanis-4nov/sumber/bangun_paket.py` (+ rtfpeta.py, aturan.py).
- MySQL laptop: `/d/Satker Asal/Website PA Bungku/xampp/mysql/bin` (MariaDB 10.4). Basis salinan server 3 Nov = `aps_badilag_w189d` (3.007 variabel,
  fungsi lengkap). JANGAN ubah; buat salinan `aps_badilag_w206` untuk uji. Server 5.5: hindari escape di badan fungsi, tulis string lewat 0x..hex.

## Temuan penting per butir
- A6/K10: 4 berkas (CG [01a],[01ab]x2 + CT [01ab]); pemutus -> #8554# (membebani, berpendapat, menilai, berkesimpulan, mempertimbangkan,
  menjatuhkan, menolak, "pendapat #8555#", "menurut", "agar #8555# menjatuhkan", "dalam pertimbangan putusan ini perlu"). Tetap #8555#:
  menasihati, memerintahkan, memeriksa identitas, memulai pemeriksaan, mengingatkan, memberi kesempatan, "oleh #8555# dinyatakan tidak disebabkan",
  "atas pertanyaan #8555#". Tambahan di luar audit: 6 penetapan `[98] Cabut` ("dikabulkan #8555# maka perkara ... selesai") - usul ikut #8554#, perlu dicatat di laporan.
  Pemindai `alat/k10.py` sudah ada (34 pemutus di 4 berkas).
- A11/V03: tepat 106 berkas (daftar di A3/temuan.json, id A3-V03), tanpa kembaran; 0690 -> 8554, 4004 -> 8555 (hanya variabel itu).
  Termasuk `98 Relaas` (16) dan `99 PTSP` (9). BAS (ALUR*, "- BAS", "BAS ...", terhapus) dibiarkan.
- A3/K03: berkas `1 Perceraian CG/[01ab] ... Unus Testis Nullus Testis.rtf`: buang run bercetak tebal `(apabila tau gunakan baris selanjutnya tinggal copy sesuai #0053#` + ")" dan " / " sebelumnya;
  kalimat sesudahnya (warna \cf3/\cf8 = teks warna = pilihan manual) dibiarkan sebagai pilihan. Perlu keputusan bentuk akhir (lihat A5: teks merah tidak diubah).
- A4/K04: 9 varian CT Mut'ah Iddah; kalimat "angka Rp600.000,00 (enam ratus ribu rupiah) setiap bulan atau Rp20.000,00 (dua puluh ribu rupiah) setiap harinya".
  Rencana: 2 variabel data_sql BARU yang mem-parse isian #6054# (abt_data_teks no_var=6054; "sejumlah Rp1.800.000,00 (...)") -> /3 dan /90, format
  `Rp` + REPLACE(FORMAT(n,0),',','.') + `,00 (` + aps_badilag.isian_rtf_terbilang(n) + ` rupiah)`; kosong/tak terbaca -> titik-titik. Fungsi baru TIDAK perlu.
  Nomor variabel bebas di w189d: 9266-9269, 9284-9289, 9294-9299 (cek ulang bentrok dengan paket lain di worktree lain sebelum klaim).
- A9/S04: saksi T ke-3/4: variabel BARU pola 9264 (`isian_rtf_ket_saksi('#perkara_id#', (SELECT CAST(d.id ...) WHERE a.nama = "#6138#"))` untuk saksi 3 T, `#8934#` untuk saksi 4 T);
  portal: tambah `"<baru3>": "2032"`, `"<baru4>": "8942"` di `KETERANGAN_SAKSI_OTOMATIS` (manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/susun.ts) dan
  daftar `keteranganOtomatis` di ekstensi-sipp/abt-panel-blangko.js (~baris 2747); uji `saksi-itsbat-sinkron-3nov`/`k11-peta-abt-26okt` perlu disesuaikan. Varian putusan baru
  (BUAT berkas, pola `in-lupa-prosesi-3nov/berkas_rtf.py`) belum dirancang: perlu lihat varian "(3/4/5 Saksi)" cerai yang ada.
- A13: "isteri" (346, kutipan UU/KHI - menunggu); "c/q Majelis #8554#" 1 tempat (tercetak "Majelis Majelis Hakim"); "fijtelijkeground" = ejaan BENAR (jangan ubah; seragamkan variasi lain);
  isian ganda: Wasiat `#9488#`(P) `#9489#`(T), Hibah `#9804#`/`#9805#`, Wakaf `#9835#`(T) = bukti surat sama. 23 blangko memuat >1 (Wasiat [01],[03],[99a] memuat 9488+9489 dst).
  Pemindaian terakhir: tiap blangko Wasiat memuat hanya 9488/9489 (tanpa 9804), Hibah hanya 9804/9805 - jadi "ganda" mungkin hanya di panel, bukan di satu blangko; periksa ulang
  (A2/temuan.json A2-09; daftar 23 blangko di A2/isian-per-blangko.csv) sebelum mengubah apa pun.
- A2/K02 (CT Rekonvensi [02]), A8 (BAS Itsbat [01a]/[01ab] tabel tanya-jawab 5058/5059/kolom_kode_A4, padanan "2 Itsbat Nikah - BAS/BAS ALUR 11"),
  A10 ([01b] AUA pecah paragraf), E2 (#8171# di 11 blangko [01] IN): belum disentuh.
- A5: daftar 63 blangko teks merah (HTML+CSV ke D:/aleta-dev/kerja/audit-abt-4nov/A5/) belum dibuat; pemurni warna: `A3/alat/rtfmini.py` (warna_tabel, merah, urai).

## Urutan paket yang direncanakan
1. `keputusan-a-mekanis-4nov` (RTF saja): A6, A11, A3/K03, E2, ejaan A13 yang aman.
2. `keputusan-a-kerangka-4nov` (RTF + SQL variabel): A4, A9, A10, A8; 3. `keputusan-a-rekonvensi-4nov` (A2, satu berkas).
Pasang berurutan 1 -> 2 -> 3, PULIH terbalik. Tiap paket: PRASYARAT md5 (pohon dasar di atas), tambal_rtf.py, PASANG/PERIKSA/PULIH, MD5SUMS, uji vitest
`manajemen_surat/src/test/<nama>.test.ts` (jalankan berkas sasaran saja) + `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit`.
