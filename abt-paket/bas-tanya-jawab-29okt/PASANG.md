# Paket ABT `abt-bas-tanya-jawab-29okt` - keterangan saksi BAS dan putusan Derry dari TANYA-JAWAB saksi ABT (29-30 Okt 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama. URUTAN: paket `prodeo-panggilan-29okt` DULU, lalu paket ini.**

Hanya blangko RTF pengguna **derry_briantono** (folder menu aktif; folder arsip `ALUR*`, `- BAS * -`, `terhapus` tidak disentuh). **Tidak ada baris basis data yang diubah** (tidak ada variabel/fungsi/menu baru). Tanpa kata nama aplikasi.

## Masalah dan patokan

Permintaan Derry: BAS dan putusan yang memuat keterangan saksi harus berbentuk **tanya-jawab saksi ABT** (kolom tanya kiri - jawab kanan, isian `abt_keterangan_saksi`), bukan kalimat keterangan yang sudah jadi dari isian lain.

- **Patokan BAS** = `1 Perceraian CG - BAS/BAS ALUR 02 [2] ... Saksi dan Putusan Verstek (2 Saksi)` (dan semua BAS pembuktian ALUR 02/03/04/06): identitas `#1197#...`, sumpah `menurut tata cara agama #1199#` + `"#7029#";`, pengantar `#0690# mengajukan pertanyaan kepada saksi sebagai berikut:`, lalu **satu paragraf `#5058#`** (TanyaJwb Saksi 1 P; `#5059#` saksi 2 P, `#5060#`/`#6124#`/`#8931#` saksi 3-5 P, `#6120#`/`#6121#`/`#8921#`/`#8941#` saksi 1-4 T).
- **Patokan putusan** = `1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap)`: identitas saksi lalu **satu paragraf `#9259#`** (`#9260#`... `#9265#`) = fungsi `isian_rtf_ket_saksi` atas `abt_keterangan_saksi` yang SAMA dengan tanya-jawab BAS (disimpan ABT per NAMA saksi: 5058 dan 9259 sama-sama menunjuk saksi `#1197#`). Jadi **BAS dan putusan perkara yang sama membaca sumber yang sama**: saksi sama, urutan sama (`ORDER BY id`), pokok jawaban sama; putusan = jawaban tanya-jawab dalam bentuk "- Bahwa ..." (tanpa kalimat penutup, paket x6).

Yang salah (diukur atas seluruh 1.681 berkas aktif pohon server perkiraan):
1. **BAS dengan tabel tanya-jawab TERTULIS MATI** dari isian (`#1241#`, `#5127#`, `#2555#` "pernah melihat", `#2557#` "berapa kali", `#0650#` saksi nikah, `#1001#` mahar, ...): jawaban yang dicetak bukan jawaban saksi di persidangan. Contoh: `BAS ALUR 01 [1a]` CG / `[1b]` CT **sidang 1 kali verstek**, `BAS ALUR 11 [1]`/`[1a]` **Itsbat kabul 1x sidang**, `BAS ALUR 05 [3]`/`[3a]` kontradiktoir lisan, `BAS ALUR 12` dispensasi kawin. Juga lafal sumpah tertulis "agama Islam dibawah Al-Qur'an" (padahal patokan per agama: pada perkara uji 367/Pdt.G/2026 saksi kedua beragama Protestan).
2. **Putusan dengan butir "- Bahwa ..." TERTULIS MATI** dari isian (atau variabel kalimat jadi `#8511#`/`#8512#` "KETERANGAN SAKSI I P (OTOMATIS)" dari alasan cerai): putusan kontradiktoir cerai `[02]...`, NO `[98]/[99b]` kontradiktoir, verstek `[01a]` Qabla, `[01ab]` Tolak, CT `[01a]` ex officio, kumulasi itsbat/hak asuh `[02]`, **seluruh putusan Itsbat** `2 Itsbat Nikah` (11), itsbat kontensius (3), DK (10), perwalian (3), asal usul anak (5), P3HP (3), pengangkatan anak (1).
3. BAS yang memakai `#6122#` untuk saksi 3 **Penggugat/Pemohon** (`#6132#`): 6122 bernama "TanyaJwb Saksi 3 T" tetapi referensinya 6132, jadi datanya = 5060 (patokan). Disamakan ke `#5060#` agar penyunting tanya-jawab ABT tidak menamai saksi P sebagai saksi T (cetakan tidak berubah).

## Perubahan: 94 berkas (35 BAS, 59 putusan) (rinci per berkas: `paket-satker/daftar-berkas.tsv`, `hasil/isi-paket.json`)

| aturan | ganti | jumlah |
|---|---|---|
| BAS tabel tertulis mati (TABEL-KERAS) | baris tabel antara pengantar "pertanyaan kepada saksi ... sebagai berikut:" dan kalimat sesudahnya -> satu paragraf `#5058#`/`#5059#`/`#6120#`/`#6121#` (gaya paragraf pengantar, tanpa inden baris pertama) | 36 blok |
| BAS sumpah tertulis mati (SUMPAH-KERAS) | "agama Islam dibawah Al-Qur'an" + lafal Islam -> `agama #1199#` + `"#7029#";` (saksi 2 P `#1205#`/`#7030#`, 1 T `#6102#`/`#7031#`, 2 T `#6108#`/`#7032#`) persis patokan | 32 |
| putusan butir tertulis mati (BUTIR-KERAS / BUTIR-LINE) | butir "- Bahwa ..." sesudah identitas saksi -> satu paragraf `#9259#`/`#9260#`/`#9264#`/`#9265#` (gaya butir pertama, tanpa daftar bernomor) | 148 + 2 (paragraf ber-\line) |
| daftar isian (DAFTAR-ISIAN) | `#2555# #2556# #2557# #2558#` yang tinggal di baris daftar isian (3 berkas) dibuang agar petugas tidak diminta mengisi "berapa kali melihat" yang tidak tercetak | 3 |
| GANTI-6122 | `#6122#` sesudah identitas saksi 3 P -> `#5060#` | 19 |

TIDAK diubah: identitas saksi, kalimat penutup pemeriksaan saksi, kehadiran pihak, pertimbangan hukum (penilaian hakim atas fakta - tetap dari isian/variabel pertimbangan seperti `#8528#`), amar/biaya/rincian/tanggal panggilan (bagian paket prodeo). Teks di luar blok saksi diperiksa sama persis (alat/verifikasi.py: baris yang hilang hanya baris blok saksi, baris baru hanya penanda variabel/kalimat sumpah patokan).

## Dasar (md5) - WAJIB dibaca sebelum pasang

Server mati malam ini; md5 blangko server tidak bisa dibaca. Dasar paket = **pohon server perkiraan** sesudah paket prodeo:
1. `D:/Aplikasi/aleta/tmp/w82/rtf/derry_briantono` (salinan server, isi = keadaan 21 Okt: x4 sudah, alamat-ganda/pihak-urut BELUM) - semua folder termasuk arsip;
2. ditambah paket terpasang sesudahnya, urut pasang, dengan penjaga md5 paketnya sendiri (`alat/susun_dasar.py`): alamat-ganda-26okt (116 COCOK), sampul-daftar-isi-26okt (21), pihak-urut-ecourt-27okt (382 COCOK), court-calendar-28okt (2), blangko-ikrar-92-28okt (2); **0 LEWAT, 0 beda**. Dicocokkan juga dengan salinan server 20 Okt 22.33 (`D:/aleta-dev/kerja/w3a/asli`, md5 339 berkas = daftar u2b) + semua paket 20-28 Okt: 1.675 dari 1.681 berkas aktif sama (6 amplop `98 Relaas` lebih baru di w82);
3. ditambah **paket prodeo-panggilan-29okt yang DIBANGUN ULANG atas pohon itu** (lihat di bawah) - 840 berkas.

PRASYARAT RTF = `tambal-rtf.pl periksa`: **setiap** berkas harus md5 persis `md5_lama` (`rtf-daftar-tambal.tsv`); satu saja beda -> `pasang-satker.sh` BERHENTI tanpa mengubah apa pun.

### Temuan penting untuk paket prodeo (commit 43aa9450)

Dasar paket prodeo (`w82`) belum memuat tambalan **alamat-ganda-26okt** dan **pihak-urut-ecourt-27okt** yang SUDAH terpasang di server: **352 dari 840** `md5_lama` di `daftar-timpa.tsv` prodeo (86 alamat-ganda, 266 pihak-urut) tidak akan cocok dengan server -> prodeo akan berhenti `BERKAS TIDAK SIAP`, dan bila dipaksa akan MENGHAPUS tambalan dua paket itu. Sudah dibangun ulang (salinan, tanpa menyentuh w125) `sumber/bangun_paket.py aps_badilag_2810 <pohon perkiraan>`: SQL prodeo (PASANG/FUNGSI/PERIKSA/PRASYARAT/PULIH, nomor-baru, uji-kueri) **identik byte**; hanya `daftar-timpa.tsv`/`timpa.tgz` berbeda (360 baris), dan kini `md5_lama` 840/840 = pohon perkiraan. Hasil: `D:/Aplikasi/aleta/tmp/bas29/pr/abt-paket/prodeo-panggilan-29okt/paket-satker/` (`timpa.tgz` md5 `981c03c2...`, `daftar-timpa.tsv` md5 `df7bd7ff...`). **Paket ini (bas-tanya-jawab) memakai hasil prodeo bangun-ulang itu sebagai dasar**: dengan prodeo versi 43aa9450 yang lama, 29 berkas paket ini akan LEWAT.

**Ketergantungan pada RTF prodeo:** 86 dari 94 berkas paket ini juga ditimpa prodeo; `md5_lama` paket ini = md5 HASIL prodeo bangun-ulang di atas. Bila RTF prodeo berubah lagi (agen prodeo diminta mengubah variabel saja; bila ternyata RTF juga berubah), paket ini harus dibangun ulang atas pohon sesudah prodeo: `python sumber/bangun_paket.py <pohon sesudah prodeo>/derry_briantono` (deterministik; blok saksi tidak bersinggungan dengan amar/biaya/rincian/tanggal panggilan, terbukti `alat/verifikasi.py` 94/94 di atas pohon sesudah prodeo), lalu perbarui MD5SUMS.txt. 8 berkas sisanya (BAS ALUR 05 [3]/[3a] CG & CT, BAS ALUR 12 DK [1at]/[1t]/[2at]/[2t]) tidak disentuh prodeo.

## Pasang (Git Bash, server hidup) - SESUDAH prodeo

```bash
cd /d/.../abt-paket/bas-tanya-jawab-29okt          # folder repo hasil gabung
rm -rf paket-satker/cadangan                        # cadangan uji laptop JANGAN ikut tersalin
ssh aleta 'mkdir -p /root/abt-bas-tanya-jawab-20261030'
scp -r paket-satker/* aleta:/root/abt-bas-tanya-jawab-20261030/
ssh aleta 'cd /root/abt-bas-tanya-jawab-20261030 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-bas-tanya-jawab-20261030/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (17|5|4|1|1)`, `PRAPERIKSA RTF: RINGKAS COCOK=94 SUDAH=0 LEWAT=0`, `RINGKAS DITAMBAL=94 SUDAH=0 LEWAT=0`, `PERIKSA RTF: RINGKAS COCOK=0 SUDAH=94 LEWAT=0`, `TANPA KATA NAMA APLIKASI`, `SELESAI`. Pasang ulang: `PASANG ULANG ...`, `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-bas-tanya-jawab-20261030/pulih-satker.sh'` (akhir `PULIH COCOK`; berkas yang disunting sesudah dipasang dibiarkan dan dilaporkan). Tidak perlu memulai ulang apa pun.

PRASYARAT SQL `17|5|4|1|1` = 17 variabel yang dirujuk ada | 5058/5059/5060/6120/6121 tanya_jawab bermodus tanyajawab berreferensi nama saksi yang benar | 9259/9260/9264/9265 memanggil `isian_rtf_ket_saksi` | fungsi ada | fungsi memakai penyaring penutup x6 (0 = hanya info). Diukur di `aps_badilag_2810` (dump server 28 Okt 15.44) = `17|5|4|1|1`.

**Bila PRAPERIKSA RTF ada LEWAT** (blangko server berubah sejak dasar ini): tidak ada yang diubah. Bangun ulang dari pohon server: `ssh aleta 'tar czf - -C /var/www/html/aps_badilag/_blangko_abt derry_briantono' > derry.tgz`, ekstrak ke folder pendek (mis. `D:/b30`), lalu `python sumber/bangun_paket.py D:/b30/derry_briantono` (deterministik; menulis `paket-satker/rtf-*.tsv`, `daftar-berkas.tsv`, `nomor-dirujuk.txt`), periksa `python alat/verifikasi.py` setelah `python sumber/terapkan_pohon.py <pohon> <keluar>`, perbarui `MD5SUMS.txt` (`md5sum` atas berkas paket-satker kecuali cadangan), salin ulang.

## Hasil uji

Lihat `hasil/ringkasan-uji.md` (siklus pasang/pulih laptop, verifikasi teks, pemeriksaan menyeluruh, render php56 ABT asli sebelum/sesudah atas perkara nyata).

## Yang perlu diputuskan pengguna

0. **Perubahan cara kerja (penting):** BAS/putusan yang dulu tertulis mati mengisi sendiri "keterangan" dari isian; sesudah paket, keterangan saksi HARUS diisi di tanya-jawab ABT (atau lewat Blangko Derry "Set pertanyaan saksi"/Susun saksi ekstensi). Diukur di SIPP+ABT salinan 28 Okt (putus Mei-Okt 2026, dikabulkan/ditolak/NO): Itsbat nikah **15 dari 109** perkara punya tanya-jawab tersimpan (selebihnya memakai BAS tertulis mati); cerai gugat 313/319, cerai talak 58/61, DK 8/9, P3HP 7/8, perwalian 6/6. Untuk itsbat lama yang dicetak ulang dengan blangko baru, keterangan saksi akan tampil `...` sampai tanya-jawabnya diisi. Pada BAS, tanya-jawab ABT per SIDANG: isi pada sidang pemeriksaan saksi.

1. `2 Itsbat Nikah - BAS/BAS ALUR 11 [1]` sesudah paket ISINYA SAMA dengan `[1b] ... Tanya Jawab dari Katalog Saksi` (paket u3); begitu juga `[1a]` = `[1c]`. Usul: varian `[1b]`/`[1c]` disingkirkan ke `terhapus` (tidak dilakukan paket ini).
2. Pertimbangan hukum putusan (mis. "saksi-saksi #0046# telah memberikan keterangan ... a) sejak #0222# ...") tetap dari isian/variabel pertimbangan, bukan kutipan tanya-jawab - itu penilaian hakim; bila ingin dikaitkan ke tanya-jawab, perlu variabel ringkasan baru (`4610`-`4618` "kutipan ringkas" sudah ada tetapi belum dipakai).
3. Isian lama "berapa kali melihat" (`2557`/`2558`), "pernah melihat" (`2555`/`2556`), `8511`/`8512` tidak dipakai lagi oleh blangko Derry aktif (variabelnya dibiarkan; bawaan pekerjaan Derry `modifier=admin`).
