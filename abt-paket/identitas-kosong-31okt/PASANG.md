# Paket ABT `abt-identitas-kosong-31okt` - identitas pihak yang datanya kosong di SIPP (31 Okt 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama. URUTAN PASANG: PALING AKHIR**
(sesudah semua paket 29-30 Okt, terutama `relaas-penetapan-30okt` karena 11205/11206 berasal dari paket itu - PRASYARAT A memeriksa
isinya persis - lalu `variabel-sehat-30okt`, lalu paket ini). Temuan pindai luas `../variabel-sehat-30okt/hasil/pindai-ringkas.txt`.

Keputusan sesi utama 31 Okt (pengguna tidur): bagian identitas yang KOSONG ditulis "..." (satu kali, labelnya tetap), agama kosong =
"Islam" (keputusan pengguna 30 Okt), tidak pernah mencetak "00 0000", koma ganda, atau label tanpa isi; nama dan alamat seperti biasa.
Alasan "..." (bukan dilewati): "Periksa sebelum cetak" dan pemeriksa sisa blangko menandai "..." sehingga petugas tahu datanya kosong.
Hanya variabel blangko **derry_briantono**; tanpa variabel baru; tanpa blangko RTF yang diubah.

## Isi

| bagian | isi |
|---|---|
| fungsi BARU `isian_rtf_identitas_kosong(teks)` | hanya REPLACE berurutan (NO SQL, DETERMINISTIC): `, 00 0000,` = tanggal kosong; `lahir , ,` -> `lahir ...,`; `lahir , ` -> `lahir ..., `; `, , agama/umur/pekerjaan/pendidikan` -> `, ..., ...`; `NIK ,` -> `NIK ...,`; `umur tahun` -> `umur ... tahun`; `agama ,` -> `agama Islam,`; `pekerjaan ,`/`pendidikan ,` -> `...`; `tempat kediaman di ,`/`;` -> `...`. Teks yang lengkap tidak berubah satu huruf pun; dirapikan dua kali = sekali |
| 11 variabel dibungkus | 3507, 3509 (pihak ke-5/6 dst), 3970, 3971 (verzet), 7047, 7048 (identitas #7024#/#7025#, ±980 blangko), 7062 (para pihak), 9230, 9231 (relaas), 11205, 11206 (relaas paket relaas-penetapan): `SELECT aps_badilag.isian_rtf_identitas_kosong(x.data) AS data FROM (<kueri lama utuh>) x`. Kueri lama tidak disunting (PULIH = isi lama persis) |

Contoh render ABT asli (4b Kewarisan [01], perkara 10006): sebelum "..., NIK , tempat dan tanggal lahir , 00 0000, agama , pekerjaan ,
pendidikan , tempat kediaman di ..." -> sesudah "..., NIK ..., tempat dan tanggal lahir ..., agama Islam, pekerjaan ..., pendidikan ...,
tempat kediaman di ...". Relaas panggilan T (10078): "umur tahun, agama Islam, pendidikan ," -> "umur ... tahun, agama Islam, pendidikan ...,".

## Pasang (Git Bash, server hidup) - PALING AKHIR

```bash
cd /d/.../abt-paket/identitas-kosong-31okt
rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-identitas-kosong-20261031'
scp -r paket-satker/* aleta:/root/abt-identitas-kosong-20261031/
ssh aleta 'cd /root/abt-identitas-kosong-20261031 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-identitas-kosong-20261031/pasang-satker.sh'
```

Keluaran benar: `PRASYARAT COCOK (11|0|0)`, `CADANGAN: ...`, `PERIKSA: SEMUA COCOK`, `PRASYARAT SESUDAH: 0|11|1`, `SELESAI`. Pasang ulang
aman (`0|11|1`). PRASYARAT lain (mis. `10|0|0` = satu variabel sudah disunting orang, atau relaas-penetapan belum terpasang) = berhenti
TANPA mengubah apa pun. Pulih: `ssh aleta 'bash /root/abt-identitas-kosong-20261031/pulih-satker.sh'` -> `PULIH COCOK` (variabel kembali
persis; fungsi dihapus hanya bila tidak dipakai variabel lain lagi).

Bangun ulang: `python sumber/bangun_paket.py <basis salinan sesudah variabel-sehat-30okt>` (fungsi: `sumber/fungsi.sql`).

## Uji (laptop, basis `aps_badilag_vs` = dump server 28 Okt + SEMUA paket 29-30 Okt + agama-belum-diubah + variabel-sehat)

- **Banding** (`../variabel-sehat-30okt/alat/banding.js`, isi baru lewat timpaKatalog, tidak ditulis) atas 292 perkara (169 sampel pindai luas +
  150 perkara 2024-2026 dengan pihak yang NIK/tanggal lahir/agama/pekerjaan kosong): galat baru 0; 793 nilai berubah di 206 perkara, SEMUANYA
  memuat bagian kosong (52 yang polanya di luar 600 huruf pertama diperiksa ulang atas teks penuh); 0 nilai sesudah yang masih memuat pola
  kosong; perkara berdata lengkap tidak berubah (`hasil/banding-ringkas.json`).
- **Siklus** (`sumber/uji_lokal.sh`, `hasil/uji-lokal.txt`): pasang `11|0|0` -> `SEMUA COCOK`; pasang ulang tanpa perubahan; pulih -> tabel
  variabel + daftar fungsi PERSIS awal; pasang lagi = pasang pertama; penjaga (7047 disunting) `10|0|0` BERHENTI tanpa perubahan.
- **Render ABT asli** php56 (`hasil/render-ringkasan.json`, tanpa nama/alamat): kewarisan [01] 10006 (6 baris cacat -> 0), CT [01] 10078
  (1 -> 0), relaas panggilan sidang pertama T 10078 (1 -> 0), BAS CG 10135 (data lengkap) PERSIS sama. Tiap baris yang berbeda = baris lama
  yang dirapikan fungsi. Ditemukan saat render: tanggal kosong ABT tercetak "00  0000" (dua spasi) -> ditambah langkah `00  0000`.
- Repo: `manajemen_surat/src/test/identitas-kosong-31okt.test.ts` (keutuhan, md5 tersyarat, pembungkus = kueri lama utuh, fungsi dijalankan
  dengan urutan REPLACE-nya atas contoh nyata, tanpa kata nama aplikasi, MariaDB 5.5, bukti banding/render, peringatan Tgl Nikah panel).

## Panel Blangko Derry: peringatan isian Tgl Nikah (ekstensi, PERLU RILIS EKSTENSI oleh sesi utama)

`ekstensi-sipp/blangko-derry-isian.js`: bila isian Tgl Nikah (blangko itsbat menulis "pada tanggal" sebelum isian itu) berisi selain
"13 Januari 1975" / "13-01-1975" / "13/01/1975", tampil peringatan pasif di bawah kotaknya (gaya `bd-peringatan` yang sudah ada, terang
dan gelap): "Tulis tanggalnya saja (tanggal, bulan, tahun). Blangko sudah menulis "pada tanggal" sebelum isian ini, ...". Tanpa klik,
tanpa mengubah isian; diperbarui saat mengetik.
