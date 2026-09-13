---
name: periksa-uji
description: Menjalankan rangkaian uji penuh portal ALETA (3.100+ uji) dan MEMBEDAKAN berkas yang habis waktu dari yang salah hasil - yang habis waktu dijalankan ulang sendirian, yang salah hasil tidak pernah diulang. Pakai sebelum commit, saat pengguna berkata "jalankan uji", "cek hijau", "kenapa merah", atau saat rangkaian penuh melaporkan gagal.
---

# Periksa uji ALETA

```bash
cd manajemen_surat && node scripts/periksa-uji.mjs
```

Keluaran ke `D:\aleta-dev\kerja\hasil-vitest-<waktu>.txt` (bukan Temp - Temp
pernah dibersihkan bersama scratchpad, lihat memori
`bersihkan-temp-menghapus-scratchpad`).

## Kenapa perlu triase, bukan sekadar "vitest run"

Mesin pengembangan memikul MariaDB, Postgres, dan bot; dengan tiga utas
berjalan berbarengan sebagian berkas **habis waktu** - `arsip-cadangan`
(300 detik) yang paling sering, juga `aleta-blocked-account`,
`jlf-bas-qa-service`, `aleta-bot-riwayat-pesan`. Dijalankan **sendirian**,
berkas yang sama lulus dalam hitungan detik.

Membaca "3 gagal" lalu berhenti berarti dua kesalahan: menahan commit yang
sehat, atau lama-lama terbiasa mengabaikan angka merah sampai kegagalan
sungguhan ikut terlewat.

## Yang dikerjakan skrip

1. Rangkaian penuh, `--reporter=basic --poolOptions.threads.maxThreads=3`.
2. Baca berkas yang `FAIL`; pisahkan **habis waktu** (`timed out in Nms`,
   `Hook timed out`, `Timeout calling "fetch"`) dari **salah hasil**.
3. Yang **salah hasil → MERAH, berhenti**. Tidak diulang: uji yang hasilnya
   salah tidak akan benar dengan kesempatan kedua, dan mengulanginya
   menyamarkan cacat sebagai kebetulan.
4. Yang habis waktu dijalankan ulang **sendirian**. Hijau → beban mesin, bukan
   cacat. Masih merah → cacat sungguhan.

Kode keluar: `0` hijau · `1` merah · `2` habis waktu belum diulang (`--tanpa-ulang`).

## Cara membaca hasilnya untuk pengguna

Laporkan **apa adanya**, dua angka terpisah:

> Rangkaian penuh: N lulus, M habis waktu (beban mesin), K salah hasil.
> Yang habis waktu dijalankan ulang sendirian: lulus/gagal.

Jangan menulis "hijau" bila ada salah hasil, dan jangan menulis "gagal" untuk
yang habis waktu lalu lulus sendirian - sebutkan keduanya.

## Aturan

- **Jangan sentuh C:** - skrip mengalihkan `TMP`, `TEMP`, `npm_config_cache` ke D:.
- Jalankan **sesudah suntingan terakhir**, bukan di tengah (memori
  `jalankan-uji-penuh-sebelum-commit`): penjaga menyisir teks mentah berkas
  ekstensi; komentar pun dapat mematahkannya.
- Bila keluaran log terbaca "Binary file matches" oleh grep, ada bita NUL di
  dalamnya - skrip sudah membuangnya; bila membaca manual pakai `tr -d '\000'`.
- Berkas tertentu saja: `node scripts/periksa-uji.mjs --berkas src/test/a.test.ts`.
