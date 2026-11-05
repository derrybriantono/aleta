# Paket ABT `abt-saksi-tanya-jawab-43-5nov` - isian tanya jawab saksi di blangko yang belum memilikinya (keputusan Derry 172/184, 5 Nov 2026)

**Status: dibangun dan diuji di LAPTOP atas salinan uji. Server: BELUM dipasang.** Hanya blangko pengguna **derry_briantono** (75 berkas, 196 potongan). Tanpa variabel baru, fungsi, menu, tabel, atau data; tanpa kata nama aplikasi. **Teks tercetak tidak berubah.**

**Urutan pasang: sesudah `a5-kelompok-5nov`.** Pulih paket ini lebih dulu bila paket itu hendak dipulihkan.

## Masalah
Blangko ini mencetak keterangan saksi lewat `#9259#`-`#9267#` (fungsi atas `abt_keterangan_saksi`, sumber yang sama dengan tanya jawab), tetapi tidak memuat variabel `tanya_jawab` saksinya. Akibatnya isian "Keterangan Saksi N" tidak ada di tabel ABT blangko itu. Putusan Format Lengkap sudah memuatnya di grup tersembunyi `{\*\isianasal #2021# #2022#}`. Sejak 1.205.66 panel Blangko Derry menautkannya lewat kode (`KETERANGAN_SAKSI_OTOMATIS`), tetapi tabel ABT belum.

## Perbaikan
Tepat sebelum tiap penanda keterangan disisipkan `{\*\isianasal #NNNN#}` menurut pasangan: 9259->2021, 9260->2022, 9261->2031, 9262->8920, 9263->8932, 9264->2023, 9265->2024, 9266->2032, 9267->8942. Grup `\*` tidak tercetak.

## Jumlah: bukan 43
Catatan 3 Nov menyebut 43 ("44 dari 302" di `saksi-itsbat-sinkron-3nov.test.ts`) tanpa daftar berkas; angka itu tidak dapat diulang. Pohon sekarang: 307 blangko memuat `#9259#`-`#9267#`.
| keadaan | berkas |
|---|---|
| sudah lengkap | 232 |
| tanpa satu pun variabel tanya jawab | 65 |
| sebagian kurang (saksi T) | 10 |

Kekurangannya sama, jadi 75 berkas dikerjakan: 40 non-cerai (Itsbat 12 + Kontensius 3, DK 10, AUA 5, Perwalian 3, PAW 3, ES 2, HB 1, Pengangkatan Anak 1) dan 35 cerai (CG 12, CT 10, Kumulasi Itsbat 10, Kumulasi Hak Asuh 3). Rincian: `hasil/daftar-tambalan.csv`.

## Dilewati
Berkas yang memuat identitas saksi tetapi tanpa `#9259#`-`#9267#` dan tanpa variabel tanya jawab: 12, tidak disentuh.
- `2 Itsbat Nikah/[99aa]` 2 berkas: potongan pertimbangan, tanpa bagian keterangan saksi.
- 10 berkas folder arsip: `ALUR 01` [1a] [1b], `ALUR 05` [3] [3a], `ALUR 11` [1] [1a], `ALUR 12` [1] [1a] [2] [2a]. Folder `ALUR*` tidak disentuh, sama seperti `bas-tanya-jawab-29okt`.

## Dasar md5 (PRASYARAT)
md5 = keadaan sesudah `a5-kelompok-5nov` (18 berkas), `a5-merah-5nov`, atau keputusan-a-rekonvensi untuk berkas lain. SQL baca saja: 9 variabel tanya jawab + `12150` dari a5-kelompok harus ada (10). Satu berkas beda atau variabel kurang -> `GAGAL` -> BERHENTI tanpa mengubah apa pun.

## Pasang (Git Bash, server hidup; SESUDAH `a5-kelompok-5nov`)
```bash
cd /d/.../abt-paket/saksi-tanya-jawab-43-5nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-saksi-tj-20261105'
scp -r paket-satker/* aleta:/root/abt-saksi-tj-20261105/
ssh aleta 'cd /root/abt-saksi-tj-20261105 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-saksi-tj-20261105/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (10)`, `SIAP=75`, `BERKAS SIAP`, `TAMBAL=75`, `BERKAS COCOK`, `SELESAI`. Pasang ulang: `SUDAH=75`. Pulih: `ssh aleta 'bash /root/abt-saksi-tj-20261105/pulih-satker.sh'` -> `PULIH=75`, `BERKAS PULIH`, `PULIH COCOK`.

## Uji (laptop)
- `hasil/uji-lokal.txt`: pasang, ulang, pulih (sidik = awal), pasang lagi, berkas disunting -> berhenti, a5-kelompok belum terpasang -> berhenti, disunting lalu pulih -> dibiarkan.
- `hasil/pindai-sesudah.txt` (lepas dari pembangun): teks tampak dan merah sama per paragraf, penanda bertambah hanya pasangannya, sisa blangko aktif yang kurang 0.
- `hasil/buka-word.txt`: Word 16 membuka 75 berkas, 0 galat.
- `hasil/render-banding.txt` (render ABT asli, salinan `vs30/abt` + `aps_badilag_vs` + `sipp_vs`): 75 berkas sebelum/sesudah, teks sama, sisa `#NNNN#` 0, kurung hasil seimbang. Beberapa berkas juga atas perkara cerai yang punya baris `abt_keterangan_saksi`.
- Jenis tanpa perkara di salinan memakai perkara pengganti (`alat/uji_render.py`).
- Belum terbukti: tampilan tabel isian di layar ABT dan penyuntingan keterangan lewat tabel itu pada blangko ini; MariaDB 5.5 (hanya SELECT `COUNT`).
- Penjaga repo: `manajemen_surat/src/test/saksi-tanya-jawab-43-5nov.test.ts`.
