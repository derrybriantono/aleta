# Paket ABT `abt-keputusan-a-mekanis-4nov` - keputusan Derry 182/184 (4 Nov 2026), bagian ubahan teks blangko saja

**Status: dibangun dan diuji di LAPTOP. Server: BELUM dipasang.** Hanya blangko pengguna **derry_briantono** (151 berkas, 505 potongan).
Tanpa variabel, menu, fungsi, tabel, atau data yang diubah; tanpa kata nama aplikasi. Dibangun dengan `sumber/bangun_mekanis.py`
(pemetaan teks tampak -> bita RTF, pola `audit-mekanis-4nov`).

**Urutan pasang: `ijab-yang-menikahkan-3nov` -> `audit-mekanis-4nov` -> `audit-ejaan-4nov` -> paket ini -> `keputusan-a-kerangka-4nov` -> `keputusan-a-rekonvensi-4nov`.**

## Isi
| kode | keputusan | ubahan | kali | berkas |
|---|---|---|---|---|
| A6 (K10) | pertimbangan/pendapat/putusan memakai `#8554#` (majelis); memimpin sidang tetap `#8555#` | `#8555#` + kata kerja pemutus (membebani, berpendapat, menilai, berkesimpulan, memberi pertimbangan, mengemukakan, mempertimbangkan, menjatuhkan, menolak; "pendapat/menurut/agar/dipertimbangkan oleh #8555#") -> `#8554#` | 35 | 4 putusan CG/CT |
| A11 (V03) | putusan/penetapan non-BAS tidak boleh membaca majelis aktif | `#0690#` -> `#8554#` (188), `#4004#` -> `#8555#` (57), hanya 106 berkas `sumber/daftar-v03.txt` (termasuk `98 Relaas` 16 dan `99 PTSP` 9); BAS/ALUR/terhapus dibiarkan | 245 | 106 |
| A3 (K03) | catatan kerja dibuang, kalimat sesudahnya jadi pilihan | `/ (apabila tau gunakan baris selanjutnya tinggal copy sesuai #0053#)` dibuang; kalimat alternatif ("sejak ... unus testis nullus testis ...") menjadi paragraf sendiri (`\par`) agar dapat dipilih/dihapus; warna tidak diubah | 1 | 1 |
| E2 | fakta tujuan itsbat pakai isian | `Bahwa tujuan ... mengajukan itsbat nikah adalah untuk mendapatkan Buku Nikah;` -> `... adalah untuk #8171#;` | 6 | 6 |
| A13 | ejaan baku | `isteri`/`isterinya`/`Isteri` -> `istri`/`istrinya`/`Istri` HANYA di kalimat buatan blangko | 217 | 39 |
| A13 | `c/q Majelis #8554#` (tercetak "Majelis Majelis Hakim") -> `c/q #8554#` | | 1 | 1 |

## Contoh sebelum/sesudah (render Word rekaan, majelis)
- A6: "oleh karena itu **Ketua Majelis** tetap membebani Pemohon" -> "oleh karena itu **Majelis Hakim** tetap membebani Pemohon"; "**Ketua Majelis** berpendapat bahwa" -> "**Majelis Hakim** berpendapat bahwa";
  "agar **Ketua Majelis** menjatuhkan talak" -> "agar **Majelis Hakim** menjatuhkan talak". Tetap: "**Ketua Majelis** telah menasihati ...", "telah memerintahkan ... hadir", "telah memeriksa identitas".
  Hakim tunggal: tampilan tidak berubah ("Hakim" = "Hakim").
- A3: "...dan harus dikesampingkan **/ (apabila tau gunakan baris selanjutnya tinggal copy sesuai gugatan)** sejak ..." -> "...dan harus dikesampingkan" + paragraf baru "sejak ... unus testis nullus testis ...".
- E2: "adalah untuk **mendapatkan Buku Nikah**;" -> "adalah untuk **pengurusan akta kelahiran anak dan keperluan lainnya**;" (nilai isian #8171# rekaan; bawaan isian "pengurusan ...... dan keperluan lainnya").
- A13: "sebagai suami **isteri**," -> "sebagai suami **istri**,"; "mantan **isteri**" -> "mantan **istri**"; "kepada **isterinya**" -> "kepada **istrinya**"; "c/q **Majelis Majelis Hakim**" -> "c/q **Majelis Hakim**".

## Yang SENGAJA tidak diubah
- **Penetapan `[98] Cabut`** ("... dikabulkan `#8555#` maka perkara tersebut dinyatakan telah selesai"; 6 berkas: IN, Pencegahan Perkawinan, Perwalian, PAW, Pengangkatan Anak, Permohonan Umum): menunggu keputusan Derry (apakah juga `#8554#`). Dihitung di `hasil/pindai-sesudah.txt` (6 -> 6).
- **`isteri` di kutipan**: 135 kali tetap (Al-Muwatha', penjelasan UU 1/1974 & PP 9/1975, kaidah putusan MA, lafal ikrar "saya menjatuhkan talak ... terhadap isteri saya", KHI Pasal 149/152, terjemah kitab, PP 10/1983, hadis, PERMA 5/2019, kutipan UU/KHI harta bawaan). Daftar: `sumber/isteri-konteks.txt` (indeks yang dibiarkan ada di `sumber/bangun_mekanis.py`).
- **`fijtelijkeground`** (3 kali): ejaan benar menurut Derry, tidak diubah (tidak ada variasi lain; `rechtsgrond` 21 kali tidak terkait).
- **Ketua Majelis yang memimpin sidang** di 4 putusan (18 `#8555#` tersisa): menasihati, memerintahkan hadir, memeriksa identitas, memulai pemeriksaan, mengingatkan, memberi kesempatan, "atas pertanyaan", "oleh `#8555#` dinyatakan tidak disebabkan alasan yang sah".

Catatan jumlah: E2 disebut Derry "11 blangko [01] IN"; di pohon hanya **6** berkas yang memuat kalimat itu (`2 Itsbat Nikah/[01] [01a] [01b] [01d] [01e] [01f]`; tidak ada di `terhapus/`). `2a Itsbat Nikah Kontensius` sudah memakai `#8171#`.
Berkas kembar persis: tidak ada kelompok yang hanya sebagian tersentuh (diperiksa).

## Dasar md5 (PRASYARAT)
Keadaan server SESUDAH tiga paket di atas. Pohon uji: `D:/aleta-dev/kerja/audit-abt-4nov/pohon` + `audit-mekanis-4nov` + `audit-ejaan-4nov` (dibangun ulang di laptop dengan skrip paket masing-masing). Bila satu saja dari 151 berkas berbeda (atau salah satu paket
di atas belum terpasang) -> `GAGAL ... bukan dasar ...` -> `BERKAS TIDAK SIAP` -> BERHENTI tanpa mengubah apa pun (diuji, butir 5 dan 6).

## Pasang (Git Bash, server hidup; SESUDAH `audit-ejaan-4nov` `SELESAI`)
```bash
cd /d/.../abt-paket/keputusan-a-mekanis-4nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-keputusan-a-mekanis-20261104'
scp -r paket-satker/* aleta:/root/abt-keputusan-a-mekanis-20261104/
ssh aleta 'cd /root/abt-keputusan-a-mekanis-20261104 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-keputusan-a-mekanis-20261104/pasang-satker.sh'
```
Keluaran benar: `SIAP=151`, `BERKAS SIAP`, `PRASYARAT COCOK`, `TAMBAL=151`, `BERKAS COCOK`, `SELESAI`. Pasang ulang: `SUDAH=151 ... SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-keputusan-a-mekanis-20261104/pulih-satker.sh'` -> `PULIH=151`, `BERKAS PULIH`, `PULIH COCOK` (berkas yang disunting sesudah dipasang
dibiarkan dan dilaporkan). Pulihkan paket `keputusan-a-kerangka-4nov`/`keputusan-a-rekonvensi-4nov` DULU bila sudah terpasang. Tidak perlu memulai ulang apa pun.

## Uji (laptop)
- `hasil/uji-lokal.txt` (`U=<salinan> SEBELUM_EJAAN=<pohon ijab+mekanis> bash sumber/uji_lokal.sh <pohon dasar>`): pasang, pasang ulang (sidik tetap), pulih (sidik = awal), pasang lagi,
  md5 berbeda -> berhenti tanpa ubahan, audit-ejaan belum terpasang (`GAGAL=122`) -> berhenti tanpa ubahan, disunting lalu pulih -> dibiarkan.
- `hasil/pindai-sesudah.txt`: pola lama = 0 (kecuali yang disengaja di atas).
- Render Word rekaan (nama rekaan; majelis dan hakim tunggal; sebelum/sesudah) 8 blangko mencakup semua jenis ubahan: `D:/Aplikasi/aleta/tmp/w206/bukti-m1/` (`banding.txt`).
  Jumlah halaman sama di semua pasangan; beda kata hanya kata yang dimaksud (sisa beda = bentuk huruf Arab dari pdftotext).
- Penjaga repo: `manajemen_surat/src/test/keputusan-a-mekanis-4nov.test.ts`.
