# Paket ABT `abt-perbaikan-audit-6nov` - perbaikan teks blangko dari audit 6 Nov 2026 (keputusan Derry)

**Status: dibangun dan diuji di LAPTOP atas salinan uji. Server: BELUM dipasang.** Hanya blangko pengguna **derry_briantono**: **104 berkas disunting** per potongan (312 potongan) dan **1 berkas baru**. Tanpa variabel baru, fungsi, menu, tabel, atau data perkara; tanpa kata nama aplikasi di RTF, SQL, nama berkas, atau metadata RTF. Hanya kata yang dituju berubah; kata kendali, warna, dan format di sekitarnya tetap, paragraf lain utuh.

**Urutan pasang: sesudah `a5-merah-5nov`, `a5-kelompok-5nov`, `saksi-tanya-jawab-43-5nov`, dan `prodeo-8507-5nov`.** Pulih paket ini lebih dulu bila salah satu paket itu hendak dipulihkan. md5 dasar berkas (`daftar-tambal.tsv`) = keadaan sesudah `saksi-tanya-jawab-43-5nov` (dasar bangun: pohon `pasca-r1` ditambah ketiga paket berkas itu lewat `tambal_rtf.py` masing-masing, 65 + 22 + 75 berkas cocok md5). `prodeo-8507-5nov` hanya mengubah rumus 8507, tidak menyentuh berkas.

## Isi (jumlah berkas per temuan; satu berkas dapat terkena lebih dari satu temuan)
| temuan | perbaikan | berkas |
|---|---|---|
| CT-01 | Petitum cerai talak (`1a Perceraian CT`): "Menjatuhkan talak satu *ba'in shughra* `#0047#` (`#0102#`) terhadap `#0046#` (`#0098#`)" menjadi "Memberi izin kepada `#0046#` (`#0098#`) untuk menjatuhkan talak satu *raj'i* terhadap `#0047#` (`#0102#`) di depan sidang `#8008#`" (10 berkas: [02] x3, [02b], [02c], [98] NO 8, [98e], [98f], [99c], [99d]); kalimat yang sama di pertimbangan petitum nomor 2 pada [02a] (1 berkas). Bunyi pengganti dan format miring *raj'i* disalin dari `[02] Rekonvensi` dan `[02a]` yang sudah benar | 11 |
| CT-02 | Cerai talak: "`#0047#` merupakan **suami** sah `#0046#`" menjadi "**istri** sah" (9: 8 di `1a`, 1 di `1c` [98] Cabut CT Kumulasi); "raj'i **kepada** `#0046#` di depan sidang" menjadi "raj'i **terhadap** `#0047#` di depan sidang" (8: 7 di `1a`, 1 di `1c` [02] CT Kumulasi). Berkas CG tidak disentuh (di sana `#0047#` memang suami) | 11 (9 + 8, 6 sama) |
| CT-03 | `1a` [01ab] Tolak Kurang 6 Bulan (CT): kalimat "Dikuatkan lagi bahwa `#0047#` tidak melaksanakan kewajiban nafkah lahir ... 12 (dua belas) bulan." dibuang; hadits dibuang **seluruhnya** (tiga paragraf: pengantar "Menimbang, ... perlu mengemukakan Hadits ... sebagai berikut :", teks Arab, "Artinya : ..."), supaya tidak tertinggal pengantar tanpa isi | 1 |
| CG-07 | Bukti T.1 dan T.2: "yang diajukan `#0046#`" menjadi `#0047#`, pada kalimat pengantar "terhadap bukti surat yang diajukan ..." dan kalimat "Bahwa bukti T.1 dan T.2 yang diajukan ..." (bagian bukti P.1 dan P.2 tidak berubah) | 16 |
| KW-01 | Kutipan Pasal 7 ayat (2) UU 16/2019 di DK dikoreksi: "(1), orang tua pihak pria dan/**atau** orang tua **pihak** wanita dapat **meminta** dispensasi ... sangat mendesak disertai **bukti-bukti** pendukung yang cukup" | 7 |
| KW-02 | Hanya varian tolak Cowok: frasa " karena rentan terkena kanker mulut rahim (serviks)" dihapus pada [03a] dan [03c]. Varian Cewek ([03], [03b]) tidak diubah | 2 |
| KW-07 | Itsbat kabul [01], [01b], [01d], [01e], [01f]: paragraf e-Court yang tertulis tetap dibuang (tiga butir: mengajukan lewat e-Court, menyerahkan asli surat/memeriksa identitas, didaftarkan e-Court/e-Litigasi); `#8509#` diletakkan sesudah kalimat kehadiran ("... telah hadir in person; `#8509#`"), seperti Izin Poligami; paragraf "Bahwa, majelis telah memeriksa identitas ..." **dibuang** karena `#8509#` selalu mencetak kalimat identitas (cabang terakhir rumusnya) sehingga akan tercetak dua kali. Tabel penanda tersembunyi di atasnya tetap | 5 |
| KW-08 | Itsbat: "diumumkan pada **tanggal** `#0306#` oleh" menjadi "diumumkan pada **hari** `#9100#` oleh" (`#9100#` = hari dan tanggal pengumuman dari isian `#0303#`; titik-titik bila `#0303#` kosong) | 14 |
| BK-01 | BAS ikrar [2a] (ada beban): "sesuai Putusan Nomor ... kepada `#0046#`;" menjadi `#0047#` (Pemohon membayar kepada Termohon) | 2 (`ALUR 10 ...` [2a] dan `1a Perceraian CT - BAS` [2a]) |
| BK-06 | `ALUR 10 Cerai Talak Sidang Ikrar Talak/[3]` diganti dengan isi versi `1a Perceraian CT - BAS/BAS ALUR 10 [3]` (pihak yang benar, tenggat 6 bulan dari PHS ikrar `#9216#`/`#9217#`); ditambah berkas **baru** `[4] BAS Ikrar Talak - P & T Tidak Hadir, Tunda Tenggang Waktu 6 Bulan.rtf` (salinan versi `1a`). `#1183#`/`#1327#` **tidak** dipensiunkan di paket ini | 1 diganti + 1 baru |
| AN-01 | "Pasal `#11888#` dan Pasal `#11889#`" menjadi "Pasal `#11889#` dan Pasal `#11890#`" (Pasal 308 dan 309 RBg; 171 dan 172 HIR). Dihitung ulang: **64** berkas di seluruh folder (bukan 25) | 64 |
| S-13 | DK [01d]: `#9251#Bahwa pada hari ...` diberi spasi pembatas (`#9251# Bahwa ...`). Nilai `#9251#` berakhir kata kendali `\par`; tanpa pembatas ABT menyambung `\parBahwa`, kata "Bahwa" dan pemisah paragraf hilang. Spasi di naskah dipakai sebagai pembatas oleh ABT dan oleh mesin jalur ALETA | 1 |

Rincian per potongan: `hasil/daftar-tambalan.csv`. Ringkasan: `hasil/ringkas.txt`.

## Yang SENGAJA tidak dikerjakan
- **CT-03 sisi CG** (`1 Perceraian CG` [01ab]): kalimat nafkah "hanya bila didalilkan" butuh saklar baru dan keputusan; dilewati. Teks CG tetap.
- **KW-02 varian Cewek**: tidak diubah (perintah pemilik).
- **S-11**: keputusan tanpa kode: penahan struktural dipakai di cetak final jalur ALETA ABT; tombol CETAK panel tetap tidak menahan.
- `#1183#` dan `#1327#` tidak dipensiunkan dari katalog.

## Dasar (PRASYARAT)
`A|B`, harus `9|2`: A = 9 variabel yang dirujuk ada (303, 2021, 8008, 8509, 9100, 9251, 11889, 11890, 12150; 2021 dan 12150 membuktikan paket pendahulu terpasang); B = rumus 9100 dan 8509 persis rumus dasar (md5 `f3a8d5bb5a9c8458c5176c57164ab577` dan `3140516484124dc1d95a473f18e8b0f0`). Selain itu: BERHENTI tanpa mengubah apa pun. Bila rumus 8509 atau 9100 sudah diubah orang lain, tinjau dulu KW-07/KW-08 sebelum melonggarkan angka B.
Berkas: tiap berkas harus persis md5 dasar (atau sudah md5 hasil); `[4]` tidak boleh sudah ada dengan isi lain. Satu saja tidak cocok -> `GAGAL` -> BERHENTI tanpa mengubah apa pun.

## Pasang (Git Bash, server hidup; SESUDAH keempat paket di atas)
```bash
cd /d/.../abt-paket/perbaikan-audit-6nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-perbaikan-audit-20261106'
scp -r paket-satker/* aleta:/root/abt-perbaikan-audit-20261106/
ssh aleta 'cd /root/abt-perbaikan-audit-20261106 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-perbaikan-audit-20261106/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (9|2)`, `SIAP=105`, `BERKAS SIAP`, `BARU=1 TAMBAL=104`, `BERKAS COCOK`, `SELESAI`. Pasang ulang: `SUDAH=105`.
Pulih: `ssh aleta 'bash /root/abt-perbaikan-audit-20261106/pulih-satker.sh'` -> `PULIH=105`, `BERKAS PULIH`, `PULIH COCOK`. Berkas yang disunting sesudah dipasang dibiarkan dan dilaporkan. Berkas `[4]` dipindah ke `cadangan/rtf-baru-dipulihkan/`, tidak dihapus. Tidak ada variabel yang berubah, jadi tidak ada isian petugas yang terhapus saat pulih. Tidak perlu memulai ulang apa pun. Python 2.7 di server didukung (kode `tambal_rtf.py` ditulis untuk 2.7 dan 3).

## Uji (laptop)
Salinan uji: skema `aps_badilag_w223` (salinan `aps_badilag_w206` + `keputusan-a-kerangka-4nov`, `a5-merah-5nov`, `a5-kelompok-5nov`, `prodeo-8507-5nov`; penanda tak dikenal di seluruh pohon = 0) dan `sipp_vs`.
- `hasil/uji-lokal.txt`: pasang pertama, ulang, pulih (md5 berkas dan sidik tabel variabel = awal), pasang lagi, berkas disunting -> berhenti, paket pendahulu belum terpasang -> berhenti, berkas lain bernama `[4]` -> berhenti, rumus 9100 berubah -> berhenti, disunting lalu pulih -> dibiarkan.
- `hasil/buka-word.txt`: Word 16 membuka 105 berkas sesudah dan 104 sebelum (baca saja): 0 galat.
- `hasil/render-banding.txt`: mesin variabel (`aleta_bot/services/abtMesinVariabel.js`) mengisi 105 berkas sesudah dan 104 sebelum atas satu perkara per berkas; pemeriksaan isi per temuan.
- `hasil/uji-9100.txt`: rumus `#9100#` dievaluasi mesin atas satu perkara uji: `#0303#` kosong -> titik-titik ('.... tanggal ....'); `#0303#` 2026-11-05 -> "Kamis tanggal 05 November 2026" (baris sementara di skema uji, dihapus lagi; hitungan baris 0 -> 0).
- `hasil/pindai-sesudah.txt`: kata nama aplikasi 0 di SQL, TSV (termasuk isi base64), RTF baru, 105 RTF hasil, nama berkas, metadata; deretan 10 angka atau lebih di teks 0. Satu-satunya kemunculan di folder paket: nama kontainer basis data di `pasang-satker.sh` (sama dengan paket pendahulu).

## Belum terbukti
PDF lewat LibreOffice, tampilan di Chrome/panel, dan pemasangan di server (server mati; tidak dijalankan). Render uji memakai satu perkara per berkas dari salinan SIPP uji, jadi cabang e-Court `#8509#` yang lain (kuasa, dihadiri satu pihak) belum dirender.

## Dibangun ulang
`python -B sumber/bangun_perbaikan.py <pohon derry_briantono keadaan gabungan> <folder paket>` lalu `python -B sumber/rapikan_paket.py paket-satker`. Pustaka `sumber/rtfpatch.py` memetakan huruf teks polos ke byte RTF-nya (penggantian per kata tanpa menyentuh format).
