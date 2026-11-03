# Paket ABT `abt-ijab-yang-menikahkan-3nov` - ijab diucapkan oleh yang menikahkan (3 Nov 2026, keputusan Derry 18.00 butir 3)

**Status: dibangun dan diuji di LAPTOP. Server: BELUM dipasang** (server kantor mati 3 Nov malam). Hanya blangko pengguna
**derry_briantono** (5 berkas). Tanpa variabel, menu, fungsi, tabel, atau data yang diubah. Tanpa kata nama aplikasi.

## Masalah
Fakta hukum dan pertimbangan penetapan Itsbat Nikah Kabul berbunyi "Wali Nikah #0046# II mengucapkan ijab dan #0046# I mengucapkan
kabul sesaat setelah Wali Nikah #0046# II mengucapkan ijab ...". Salah bila yang menikahkan bukan wali nasab (imam desa, penghulu,
wakil wali) - padahal butir 4 putusan yang sama menyebut "yang menikahkan para #0046# adalah #8087#", dan katalog saksi BAS
menjawab "ijab diucapkan oleh #8087# ...".

## Bunyi lama -> baru (11 kalimat)
| | lama | baru |
|---|---|---|
| fakta (butir 7) dan pertimbangan "fakta para #0046# melangsungkan perkawinan ..." | `Wali Nikah #0046# II mengucapkan ijab dan #0046# I mengucapkan kabul sesaat setelah Wali Nikah #0046# II mengucapkan ijab tanpa ada jeda waktu terlalu lama` | `#8087# selaku yang menikahkan mengucapkan ijab dan #0046# I mengucapkan kabul sesaat setelah ijab diucapkan tanpa ada jeda waktu terlalu lama` |
| pertimbangan Pasal 27 KHI ([01d], [01e]) | `fakta bahwa Wali Nikah #0046# II mengucapkan ijab dan #0046# I mengucapkan kabul sesaat setelah ijab diucapkan` | `fakta bahwa #8087# selaku yang menikahkan mengucapkan ijab dan #0046# I mengucapkan kabul sesaat setelah ijab diucapkan` |
| [01e] (satu pemohon) | sama, dengan "Wali Nikah mempelai perempuan" / "mempelai laki-laki" | `#8087# selaku yang menikahkan mengucapkan ijab dan mempelai laki-laki ...` |

Benar untuk dua keadaan: #8087# = wali nasab itu sendiri ("Bahwa Ayah Kandung Pemohon II selaku yang menikahkan mengucapkan ijab ...")
dan #8087# = orang lain ("Bahwa Imam Desa ... selaku yang menikahkan mengucapkan ijab ..."). Kalimat wali nikah (#1046#/#1217#) di
fakta lain tidak berubah. #8087# sudah ada di tabel kelima blangko (tidak menambah baris isian).

## Cakupan (dicari di SELURUH 1.881 blangko derry_briantono keadaan server 3 Nov 15.20)
| kode | berkas `derry_briantono/2 Itsbat Nikah/` | kalimat |
|---|---|---|
| I001 | `[01] [Kabul] IN.rtf` | 2 (fakta 7, pertimbangan) |
| I002 | `[01a] [Kabul] IN - Syahadah Al Istifadhah.rtf` | 1 (pertimbangan) |
| I003 | `[01b] [Kabul] IN Itsbat Terpadu.rtf` | 2 |
| I004 | `[01d] [Kabul] IN - Format Lengkap Rukun dan Syarat per Unsur.rtf` | 3 (+ pertimbangan Pasal 27 KHI) |
| I005 | `[01e] [Kabul] IN - Satu Pemohon (Pasangan Meninggal, Voluntair).rtf` | 3 |

Tidak memuat kalimat itu (diperiksa, tidak disentuh): `[01f]` (sudah ditulis ulang paket in-lupa-prosesi), `[03]`/`[03a]`-`[03c]`,
`1c Perceraian Kumulasi Itsbat Nikah` (12 berkas: hanya Pasal 14 KHI / "disaksikan banyak orang"), `2a Itsbat Nikah Kontensius`
(5 berkas: "wali nikah (#1217#), ... yang menikahkan #8087#" - sudah benar), Asal Usul Anak `[01a]`/`[01c]`, Pengesahan Anak `[01]`.
`sumber/bangun_paket.py` BERHENTI bila kalimat lama ada di berkas lain.

## Dasar md5 (PRASYARAT)
Keadaan server 3 Nov 15.20 = cadangan `D:/aleta-dev/cadangan-db/aplikasi-20261102-185007/blangko-derry-briantono.tar.gz` + paket
`saksi-rapi-3nov` (tambal, 301 berkas) + `in-lupa-prosesi-3nov` ([01f] baru). md5 dasar kelima berkas = md5 sesudah saksi-rapi
(dijaga uji). `tambal_rtf.py cek`: satu saja berkas berbeda -> `BERKAS TIDAK SIAP` -> paket BERHENTI, tidak ada yang diubah.

## Pasang (Git Bash, server hidup)
```bash
cd /d/.../abt-paket/ijab-yang-menikahkan-3nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-ijab-yang-menikahkan-20261103'
scp -r paket-satker/* aleta:/root/abt-ijab-yang-menikahkan-20261103/
ssh aleta 'cd /root/abt-ijab-yang-menikahkan-20261103 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-ijab-yang-menikahkan-20261103/pasang-satker.sh'
```
Keluaran benar: `SIAP=5`, `BERKAS SIAP`, `PRASYARAT COCOK`, `TAMBAL=5`, `BERKAS COCOK`, `SELESAI`. Pasang ulang: `SUDAH=5 ... SELESAI`
(tidak mengubah apa pun). Bila `GAGAL ... md5 ... bukan dasar ...`: blangko server sudah berubah sejak 15.20 - jangan dipaksa; bangun
ulang paket atas blangko server terbaru (`python sumber/bangun_paket.py <_blangko_abt> paket-satker`, lalu MD5SUMS dan uji).
Pulih: `ssh aleta 'bash /root/abt-ijab-yang-menikahkan-20261103/pulih-satker.sh'` -> `PULIH=5`, `BERKAS PULIH`, `PULIH COCOK`
(berkas yang disunting sesudah dipasang dibiarkan dan dilaporkan). Tidak perlu memulai ulang apa pun.

## Uji (laptop)
- `hasil/uji-lokal.txt` (`bash sumber/uji_lokal.sh <pohon keadaan server>`): pasang, pasang ulang (sidik tetap), pulih (sidik = awal),
  pasang lagi, md5 berbeda -> berhenti tanpa ubahan, disunting lalu pulih -> dibiarkan.
- Penjaga repo: `manajemen_surat/src/test/ijab-yang-menikahkan-3nov.test.ts`.
- Render REKAAN [01] IN (Word -> PDF -> PNG, halaman 12 = fakta 7): `D:/aleta-dev/kerja/saksi-itsbat-3nov/bukti/ijab-{sebelum,sesudah-imam,sesudah-wali}-penetapan-01-IN*`
  (`bukti_ijab.py`, `pdf_png.ps1` di folder yang sama).
