# Paket ABT `abt-a5-merah-5nov` - teks merah A5 dan penetapan `[98] Cabut` (keputusan Derry, 5 Nov 2026)

**Status: dibangun dan diuji di LAPTOP atas salinan uji. Server: BELUM dipasang.** Hanya blangko pengguna **derry_briantono** (65 berkas, 406 potongan) dan 9 isian baru untuk blangko itu.
Tanpa fungsi, menu, tabel, atau data perkara; tanpa kata nama aplikasi. Dibangun dengan `sumber/bangun_a5.py` atas `daftar-teks-merah.csv` (911 baris, 63 berkas).

**Urutan pasang: sesudah `keputusan-a-rekonvensi-4nov`.** Pulih paket ini lebih dulu bila paket lama hendak dipulihkan.

## Isi
| golongan | keputusan | ubahan | baris | berkas |
|---|---|---|---|---|
| hitamkan | warna merah hilang, kata tetap | kendali warna dihapus dari grup token itu | 293 | 36 |
| isian pilihan | bergaris miring jadi isian pilihan | variabel baru; lihat tabel isian | 29 | 23 |
| isian bagian kosong | bagian kosong jadi isian | 8 dikerjakan; 8 batal, lihat "Batal" | 8 dari 16 | 7 |
| buang catatan kerja | catatan dalam kurung dibuang dari cetakan | grup dibuang; bila satu paragraf penuh, penutup paragrafnya ikut | 33 | 14 |
| `[98] Cabut` | `#8555#` jadi `#8554#` bila nyambung | satu kalimat per berkas | 6 | 6 |

Merah per berkas sesudah: `hasil/merah-per-berkas.tsv`. Rincian per baris: `hasil/daftar-tambalan.csv`. Baris daftar: 911 -> 548 tetap merah (540 "hitamkan atau isian" + 8 batal).

## Isian (variabel `data_teks`, bukan fungsi)
| kode | untuk | pilihan bawaan | baris |
|---|---|---|---|
| `#9284#` | Lurah/Kepala Desa, BAS ALUR 09 [2] NO alamat salah | Lurah; Kepala Desa | 22 berkas |
| `#9285#` | `#0046# I/II` yang masih terikat, IN [99] | I; II | 3 |
| `#9286#` | `#0046# I/II` pasangannya, IN [99] | II; I | 1 |
| `#9287#` | laki-laki/perempuan dan pria/wanita, IN [99] | laki-laki; perempuan | 2 |
| `#9288#` | suami/istri terdahulu, IN [99] | suami; istri | 1 |
| `#9289#` | "Dalil mengenai `_`", CT [02] [02b] [02c], Kumulasi CT | kosong | 4 |
| `#9294#` | "tidak hadir ... /berada di `_`", IN [03] | tidak hadir acara pernikahan para `#0046#`; berada di `_` | 1 |
| `#9295#`, `#9296#` | "lahir tanggal `_ (_ tahun)`", Perwalian Tolak Primer | `_ (_ tahun)` | 2 |
| `#9683#` (lama) | kalimat "terikat ... telah bercerai ... `_`", IN [99] | isian yang sudah ada | 1 |

Keputusan teknis yang perlu diketahui:
- Lurah/Kepala Desa memakai isian baru, bukan `#3506#` "Lurah / Kades". Diuji: `#3506#` kosong tanpa tanda bila alamat tidak memuat Desa/Kelurahan (407 dari 5.969 alamat Tergugat di salinan), membawa keterangan lain dari alamat, dan tidak dapat disunting di popup.
- "pria/wanita" (baris 840) memakai `#9287#` yang sama dengan "laki-laki/perempuan" supaya satu jawaban tidak diisi dua kali, sehingga cetaknya "laki-laki"/"perempuan".
- Nomor 9284-9289 dan 9294-9296: kosong di salinan server 3 Nov dan di semua cabang kerja, tidak dipakai berkas mana pun (diperiksa 5 Nov). Bila bentrok, PRASYARAT berhenti.
- Isian pilihan muncul di popup ABT sebagai baris bawaan. Panel Blangko Derry hanya menampilkan pilihan bila ada label di tabel ramah portal, jadi di sana tampil sebagai isian teks + saran; belum ditambahkan karena di luar paket.

## Batal (dibiarkan merah)
8 baris `...` berusulan "isian" (`1 Perceraian CG` [02], [02a], [02b], [02c], Kumulasi; `1c` CG [02]; `1d` [02], [02b]): semuanya tanda potongan di tengah kutipan kitab Arab sebelum "Artinya:", bukan bagian kosong (pengecualian di `deteksi-sisa-blangko-unggah-17okt`). Pembangun memeriksa huruf Arab sebelum tanda itu.
Tidak ada catatan kerja yang batal: 33 baris hanya tiga bunyi, `(PERTIMBANGAN APABILA SAKSI HANYA MENGETAHUI PISAH TAPI TIDAK MELIHAT LANGSUNG APA MASALAHNYA);` 24, `(APABILA SUAMI TIDAK BEKERJA/MALAS)` 8, `(ANAK 1 PERSATU P NYA)` 1.

## `[98] Cabut`
Keenam berkas diubah (`hasil/daftar-tambalan.csv`). Kalimat sebelum dan sesudah berurusan dengan pemeriksaan permohonan, dan penutup berkas sudah berbunyi "rapat musyawarah Majelis Hakim". Hasil render sesudah:
| berkas | bunyi akhir (render ABT) |
|---|---|
| `2 Itsbat Nikah/[98] [Cabut] IN` (hakim tunggal) | Menimbang bahwa oleh karena permohonan Pemohon untuk mencabut permohonannya dikabulkan Hakim maka perkara tersebut dinyatakan telah selesai; |
| `5b .../[98] [Cabut] Pencegahan Perkawinan` | ... permohonan Pemohon untuk mencabut permohonannya dikabulkan Majelis Hakim maka perkara tersebut dinyatakan telah selesai; |
| `6 Perwalian/[98] [Cabut] Perwalian` | sama dengan baris di atas |
| `9 .../[98] [Cabut] PAW` | ... permohonan para Pemohon untuk mencabut permohonannya dikabulkan Majelis Hakim maka perkara tersebut dinyatakan telah selesai; |
| `9a .../[98] [Cabut] Pengangkatan Anak` | sama dengan baris Pencegahan |
| `9b .../[98] [Cabut] Permohonan` | sama dengan baris Pencegahan |
`#8555#` lain di enam berkas itu (memerintahkan hadir, menasihati) tetap.

## Yang SENGAJA tidak diubah
- 540 baris "hitamkan atau isian" (45 kelompok untuk keputusan Derry: `D:/aleta-dev/kerja/audit-abt-4nov/A5/kelompok-540.html`).
- 4 blangko baru `[02] ... (3 Saksi T)` dan `(4 Saksi T)` lahir sesudah daftar: masih memuat merah yang sama (73/44 baris) dan catatan kerja yang sama. Di luar daftar.
- 200 berkas lain di pohon memuat 2.960 token merah di luar daftar A5 (termasuk 4 di atas); daftar A5 hanya memakai 63 berkas A3-K05.

## Catatan akibat keputusan
- 163 dari 293 baris hitamkan berada di tengah kalimat yang tetap merah (mis. variabel `#8554#`, "dan", "uz" dari kata "Juz"), jadi kalimat itu tampak belang sampai 540 baris diputuskan. Huruf satu aksara tidak ada di daftar dan tetap merah ("J" dari "Juz").
- Catatan kerja penanda syarat hilang dari cetakan; kalimat yang disyaratkan tetap merah (kelompok 2, 7, 15).
- Salah ketik lama yang terlihat, tidak diubah: `#0046##` di kelompok 15 tercetak dengan tanda pagar; "bahwa dalam `#0047#` dalam persidangan" di kelompok 25.

## Dasar md5 (PRASYARAT)
Keadaan server SESUDAH `keputusan-a-rekonvensi-4nov` (terpasang 4 Nov 10.38 menurut catatan; server mati, tidak dapat dibaca langsung). Pohon `audit-abt-4nov/pohon` adalah keadaan 3 Nov dan **belum** mencerminkan paket 4 Nov: md5-nya = `md5_lama` rantai paket. Dasar bangun: `D:/Aplikasi/aleta/tmp/w206/pasca-r1` = pohon + audit-mekanis + audit-ejaan + keputusan-a-mekanis + kerangka + rekonvensi; 1.881 md5 cocok rantai itu + 4 blangko baru, dan isi daftar cocok token demi token di 63 berkas.
15 dari 65 berkas berdasar md5 `keputusan-a-mekanis-4nov`. Satu berkas beda atau nomor variabel berisi lain -> `GAGAL` -> BERHENTI tanpa mengubah apa pun (diuji).

## Pasang (Git Bash, server hidup; SESUDAH `keputusan-a-rekonvensi-4nov`)
```bash
cd /d/.../abt-paket/a5-merah-5nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-a5-merah-20261105'
scp -r paket-satker/* aleta:/root/abt-a5-merah-20261105/
ssh aleta 'cd /root/abt-a5-merah-20261105 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-a5-merah-20261105/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|2)`, `SIAP=65`, `BERKAS SIAP`, `PERIKSA: SEMUA COCOK`, `TAMBAL=65`, `BERKAS COCOK`, `SELESAI`. Pasang ulang: `PRASYARAT COCOK (0|9|2)`, `SUDAH=65`.
Pulih: `ssh aleta 'bash /root/abt-a5-merah-20261105/pulih-satker.sh'` -> `PULIH=65`, `BERKAS PULIH`, `PULIH COCOK (0|0|2)`. Berkas/variabel yang disunting sesudah dipasang dibiarkan dan dilaporkan. **Perhatian:** isian yang sudah disimpan petugas untuk 9 variabel baru ikut terhapus saat pulih (`abt_data_teks` ON DELETE CASCADE). Tidak perlu memulai ulang apa pun.

## Uji (laptop)
- `hasil/uji-lokal.txt`: pasang, ulang, pulih (md5 berkas + tabel variabel = awal), pasang lagi, berkas disunting -> berhenti, berkas sebelum keputusan-a-mekanis -> berhenti, nomor bentrok -> berhenti, disunting lalu pulih -> dibiarkan.
- `hasil/pindai-sesudah.txt` (`sumber/pindai_sesudah.py`, lepas dari pembangun): merah sesudah = baris yang harus tetap merah, bunyi dan urutan sama; beda kata hanya baris isian/buang; kurung seimbang. GAGAL 0.
- `hasil/buka-word.txt`: Word 16 membuka 65 berkas sesudah + 65 sebelum, 0 galat; 4 berkas berkurang 1 halaman karena catatan kerja hilang.
- `hasil/render-banding.txt` (`alat/uji_render.py`, render ABT asli php56, salinan `vs30/abt` + `aps_badilag_vs` + `sipp_vs`): 65 berkas sebelum/sesudah, sisa `#NNNN#` 0; beda kata hanya yang dimaksud, `...` bertambah hanya pada isian baru yang belum diisi.
- `hasil/isian-terisi.txt` (`alat/uji_isian.py`): nilai rekaan di semua isian tercetak hitam di kalimatnya.
- `aps_badilag_vs` lebih tua dari server: selama uji variabel dan fungsinya disamakan dengan salinan server 3 Nov + paket kerangka (`alat/siap_vs.py`), lalu dikembalikan dengan sidik sama. Jenis tanpa perkara di salinan (Hibah, Wakaf, jenis anak) memakai perkara cerai sebagai pengganti (`PETA` di `alat/uji_render.py`).
- Belum terbukti: pemasangan di MariaDB 5.5 sungguhan (SQL hanya INSERT heks, tanpa escape dan tanpa fungsi); tampilan di panel portal.
- Penjaga repo: `manajemen_surat/src/test/a5-merah-5nov.test.ts`.
