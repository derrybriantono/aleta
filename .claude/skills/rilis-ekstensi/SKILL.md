---
name: rilis-ekstensi
description: Merilis ekstensi Chrome ALETA (ekstensi-sipp) dengan urutan yang benar - versi, catatan, tanam ke portal, salin ke folder Chrome, tsc, uji penuh - lalu menyiapkan commit. Pakai setiap kali berkas di ekstensi-sipp/ berubah dan siap dirilis, atau saat pengguna berkata "rilis", "tanam", "naikkan versi ekstensi", "salin ke Chrome".
---

# Rilis ekstensi ALETA

Satu rilis = tujuh langkah berurutan. Skrip `manajemen_surat/scripts/rilis-ekstensi.mjs`
menempuh langkah 1–6 dan **berhenti pada yang pertama merah**; langkah 7 (commit)
tetap oleh orang, sebab pesan commit menjelaskan *sebab*, dan sebab tidak dapat
disusun dari diff.

## Kapan dipakai

- Berkas apa pun di `ekstensi-sipp/` berubah dan akan di-commit.
- **Sesudah suntingan TERAKHIR** - bukan di tengah. Menanam lalu menyunting lagi
  meninggalkan portal dengan isi yang berbeda dari folder; uji
  "menanam ulang menghasilkan berkas yang sama persis" akan menangkapnya, dan
  itu satu putaran uji penuh yang terbuang.

## Urutan yang dijalankan skrip

```bash
cd manajemen_surat && node scripts/rilis-ekstensi.mjs
```

| # | Langkah | Yang dijaga |
|---|---|---|
| 1 | Baca versi manifest, tertanam, catatan | ketiganya terbaca |
| 2 | Versi manifest = entri teratas `catatan-ekstensi.ts` | uji repo menuntut ini; catatan yang tertinggal berbohong tentang apa yang berjalan |
| 3 | `susun-ekstensi.mjs` | bila isi berubah tanpa versi naik, skrip itu **menolak** - naikkan versinya, jangan paksa |
| 4 | Salin ke `D:\Download File\ekstensi-sipp` | Chrome memuat dari folder itu, **bukan repo** |
| 5 | `tsc --noEmit` | kode keluar dibaca **langsung**, bukan lewat pipa |
| 6 | `periksa-uji.mjs` penuh | habis-waktu dibedakan dari salah-hasil |
| 7 | Ringkasan | pengingat Reload + catatan peladen |

Sebelum menulis apa pun: `node scripts/rilis-ekstensi.mjs --periksa` (langkah 1–2 saja).

## Sebelum menjalankan skrip - yang harus SUDAH dikerjakan

1. **Naikkan `version`** di `ekstensi-sipp/manifest.json` (patch bila perbaikan,
   minor bila kemampuan baru). Chrome membandingkan nomor versi, bukan isi.
2. **Tambahkan entri catatan** di puncak `CATATAN_EKSTENSI` pada
   `manajemen_surat/src/lib/catatan-ekstensi.ts`: `versi`, `dirilis` (WITA,
   `+08:00`), `judul`, `butir[]` - berbahasa Indonesia, menjelaskan SEBAB,
   bukan hanya apa.
3. Uji baru untuk perilaku baru sudah ditulis dan lulus sendirian.

## Sesudah skrip hijau

1. Tulis pesan commit **berbahasa Indonesia**: baris pertama `feat:`/`fix:` +
   ringkasan; badan menjelaskan sebab dan keputusan; akhiri dengan
   `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Simpan ke berkas
   di `D:\aleta-dev\kerja\pesan-commit-<versi>.txt` lalu `git commit -F`.
2. Minta pengguna **tekan Reload** di `chrome://extensions` - ekstensi unpacked
   tidak memperbarui dirinya.
3. Akhiri jawaban dengan **catatan pengingat pemasangan peladen** (memori
   `tugas-server-ekstensi-1-123`) selama peladen belum terpasang - ini aturan
   tetap pengguna.
4. Perbarui memori itu bila rilis ini menambah langkah yang harus diperiksa di
   peladen.

## Aturan yang tidak boleh dilanggar

- **Jangan sentuh C:** di luar `C:\aleta\` (C: = SSD 128 GB) - skrip sudah
  mengalihkan `TMP`, `TEMP`, `npm_config_cache` ke D:. Jangan jalankan vitest/npm
  dengan lingkungan bawaan. Pengecualian (disetujui 17 Okt): bila dijalankan dari
  salinan kerja SSD `C:\aleta\kerja`, skrip memakai `C:\aleta\tmp` (atau env
  `ALETA_UJI_TMP`). Sisa C: wajib minimal 10 GB.
- **Jangan naikkan `APP_VERSION`** portal (2.15.0) - itu keputusan lintas sesi
  (memori `versi-pc-android-harus-sama`). Versi ekstensi terpisah dari versi
  portal.
- **Jangan `ALETA_TANAM_PAKSA=1`** sebagai jalan pintas. Ia hanya untuk menanam
  ulang isi yang **tidak berubah**. Isi berubah = versi naik.
- **Jangan commit bila langkah 6 merah** - lihat memori
  `jalankan-uji-penuh-sebelum-commit`: penjaga menyisir teks mentah, suntingan
  kecil di satu berkas mematahkan penjaga di berkas lain.
- Skrip regex/backslash ditulis lewat Write, bukan heredoc Bash (memori
  `bash-tool-menyusutkan-tanda-miring`).

## Bila langkah 3 menolak

Pesannya: "Isi ekstensi berubah, tetapi versinya masih X". Jawabannya bukan
memaksa, melainkan: naikkan versi → tambah entri catatan → jalankan lagi.
Satu-satunya pengecualian: isi sungguh tidak berubah dan yang dibutuhkan hanya
menanam ulang (mis. `ekstensi-berkas.ts` tertinggal) - barulah
`ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs`, dan sebutkan alasannya.

## Bila langkah 5 merah di `.next/`

Berkas tipe bikinan Next.js (`.next/dev/types/*.ts`) kadang rusak terpotong
(dev server mati di tengah tulis, atau pembersihan disk). Folder itu tidak
dilacak git dan dibuat ulang sendiri: `rm -rf manajemen_surat/.next/dev/types`,
lalu ulangi. Galat di `src/` adalah galat sungguhan.
