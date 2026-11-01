# Paket ABT `abt-bukti-pisah-1nov` - bukti surat dan bukti elektronik dicetak TERPISAH (1 Nov 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama. URUTAN PASANG: KE-24, PALING AKHIR**
(sesudah 23 paket `../URUTAN-PASANG-31okt.md`; md5 dasar = keadaan sesudah ke-23 paket itu, diuji rantai `../uji-rantai-31okt`).

Dasar: commit `d1ace5ec` (blok 12040-12049, sasaran `docs/arahan/awan-T11-blangko-sasaran.tsv` = 397 blangko yang memuat `#11170#`-`#11177#`),
rencana `D:/aleta-dev/kerja/rencana-1-nov-bukti-zcross-merah.md` bagian 1. Hanya blangko dan variabel milik **derry_briantono**.

## Cara kerja (tanpa mengubah ekstensi / isian)
Isian bukti yang sudah ada (9955, 1214, 9911, 9958, 8131, 8132, 0378, 9956 - satu daftar gabungan surat + elektronik) TIDAK diubah. Variabel baru
adalah TURUNAN (`data_sql`) yang memecah isian itu menurut jenis baris: baris yang memuat "bukti elektronik tersebut" = elektronik (aturan sama
dengan `pisahBuktiElektronik` ekstensi), baris lain = surat, baris lanjutan ikut baris sebelumnya. Jadi panel, ABT, dan penyuntingan manual tetap
bekerja seperti dulu dan hasil cetak langsung terpisah. Fungsi baru: `isian_bukti_baris`, `isian_bukti_sumber`, `isian_bukti_rtf`.
`isian_bukti_sumber` memilih isian P yang terisi dan PALING BARU disimpan di antara (9955, 1214, 9958, 8131, 8132, 0378, 9956), T = 9911.

| nomor | isi |
|---|---|
| 12040 / 12045 | daftar bukti SURAT saja P / T (bernomor 1. 2. ... lewat `isian_rtf_bukti`; kosong = tidak tercetak) |
| 12041 / 12046 | daftar bukti ELEKTRONIK saja P / T (nomor mulai 1 lagi di daftarnya sendiri; tanda P.3 dst. tetap) |
| 12042 / 12047 | klausa BAS ". Selanjutnya #7085# / #7086# menyerahkan bukti surat berupa :" (bila tidak ada bukti surat: titik) |
| 12043 / 12048 | pengantar BAS "Selanjutnya #7085# / #7086# menyerahkan bukti elektronik berupa:" (tak tercetak bila tidak ada) |
| 12044 / 12049 | judul sub-bab putusan "A. Bukti Surat:" (tak tercetak bila tidak ada bukti surat) |
| 12050-12076 | varian menurut blangko: frasa "alat bukti surat/elektronik dan saksi-saksi" (a, b, c), klausa & pengantar menurut sebutan pihak di blangko (#0046#, #4046#, #7036#, "para #0046#", "#0046# I dan #0046# II", ...), judul "A. Surat:" dst., judul "B. Bukti Elektronik:", huruf sub-bab Saksi (A/B/C menurut sub-bab bukti yang ada) |

## Blangko RTF (395 berkas, `paket-satker/daftar-tambal.tsv`, rincian `hasil/ubahan.tsv`)
- **BAS pembuktian (201 daftar)**: kalimat pengantar yang sudah ada tetap kata demi kata; hanya "alat bukti surat dan saksi-saksi" dan klausa
  "menyerahkan bukti surat berupa:" menjadi variabel bersyarat. Daftar surat tetap di paragraf lama; sesudahnya paragraf pengantar elektronik
  (berformat sama dengan kalimat pengantar) lalu daftar elektronik (berformat sama dengan daftar surat). Tanda SC Z (paragraf sesudah daftar)
  jatuh sesudah daftar TERAKHIR. Tanpa bukti surat: "... siap mengajukan alat bukti elektronik dan saksi-saksi." Tanpa bukti: "... siap mengajukan saksi-saksi."
- **Putusan (270 daftar)**: judul "A. Bukti Surat:" / "A. Surat:" menjadi variabel, sub-bab "B. Bukti Elektronik:" disisipkan sesudah daftar surat, huruf
  sub-bab Saksi menurut yang ada (A/B/C). 8 putusan tanpa judul sub-bab (AUA): daftar elektronik didahului pengantar.
- **Format paragraf tidak diubah**: paragraf lama dijadikan "pembawa" (kendali paragraf dan huruf persis, tanpa `\par` penutup); nilai variabel
  menutup paragraf dengan `\par`, sehingga bagian kosong TIDAK meninggalkan paragraf kosong. Daftar-butir Word pada judul sub-bab diganti huruf ketikan.
- **Dibiarkan**: 2 putusan Harta Bersama (4 daftar) yang sudah punya sub-bab "B. Bukti Elektronik:" sendiri (isian 9951). Variabel lama 11170-11177 tidak diubah.

## Pasang (Git Bash, server hidup) - PALING AKHIR
```bash
cd /d/.../abt-paket/bukti-pisah-1nov
rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-bukti-pisah-20261101'
scp -r paket-satker/* aleta:/root/abt-bukti-pisah-20261101/
ssh aleta 'cd /root/abt-bukti-pisah-20261101 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-bukti-pisah-20261101/pasang-satker.sh'
```
Keluaran benar:
```
PRASYARAT COCOK (0|0|0|3|0)
SIAP=395
BERKAS SIAP
SEMUA COCOK
UJI: 20 contoh fungsi sama dengan laptop
UJI: 37 kueri berjalan (perkara <id>)
TAMBAL=395
BERKAS COCOK
SELESAI - paket abt-bukti-pisah-1nov terpasang. ...
```
Pasang ulang aman (`0|37|3|3|0`, `SUDAH=395`). PRASYARAT lain = berhenti TANPA mengubah apa pun. Pulih: `ssh aleta 'bash /root/abt-bukti-pisah-20261101/pulih-satker.sh'` -> `PULIH COCOK`.

## Hasil uji laptop (1 Nov 2026)
- Uji rantai 24 paket (`../uji-rantai-31okt/hasil-rantai-24.txt`, salinan baru dump 28 Okt, paket dari `git archive HEAD`): semua SELESAI, `RANTAI-KELUAR 0`.
- `sumber/uji_lokal.sh` (`hasil/uji-lokal.txt`): pasang ulang tidak mengubah apa pun; pulih = variabel, fungsi, dan seluruh pohon RTF SAMA PERSIS dengan
  sebelum paket; pasang lagi = pasang pertama; variabel paket disunting orang -> pasang menolak tanpa mengubah apa pun.
- Render sungguhan (renderer ABT php56 asli, `alat/driver.py`): 13 blangko (6 BAS + 7 putusan; CG, CT-folder IN, DK, perwalian, AUA, PAW) x 4 keadaan
  (surat saja, elektronik saja, keduanya, tanpa bukti) x sebelum/sesudah. Keadaan "surat saja": 6 BAS teks persis sama dengan sebelum; putusan sama
  kecuali huruf "A."/"B." yang dulu otomatis daftar-butir Word kini diketik (`hasil/banding-keadaan.txt`). Gambar: `D:/Aplikasi/aleta/tmp/w152/render/png/`.
- Yang TIDAK tersentuh: kalimat statis lain di blangko ("telah cukup dengan bukti suratnya", AUA "menyerahkan alat bukti surat berupa:") tetap apa adanya.

## Keputusan yang perlu diperiksa pengguna
1. Huruf sub-bab putusan mengikuti blangko yang ada (A./B./C. kapital dengan titik dua), bukan "a. Bukti Surat/Tertulis" huruf kecil di rencana.
2. Daftar elektronik bernomor 1. 2. lagi (terpisah dari daftar surat); tanda bukti (P.3, P.4) tetap melanjutkan.
3. Bila semua isian bukti kosong (belum pernah diisi), BAS mencetak "siap mengajukan saksi-saksi." (dulu "1. ..." sebagai pengingat titik-titik).
4. Dua varian ejaan lama ("berupa :" dengan spasi) dipertahankan per blangko.
