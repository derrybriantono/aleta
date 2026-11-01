# Render sungguhan (renderer ABT php56 asli, `alat/render164.py`) sebelum/sesudah paket ke-29

Basis: ABT `aps_badilag_w164d` (dump server 28 Okt + 28 paket; sesudah = + paket ini), SIPP `sipp_w164`, RTF -> PDF lewat Microsoft Word, PDF -> PNG.
PNG: `D:/Aplikasi/aleta/tmp/w164/render/<sebelum|sesudah>-<kasus>-h<halaman>.png` dan `.../render5404/`. (Data perkara nyata - TIDAK masuk repo.)

| kasus | perkara/sidang | blangko | hasil |
|---|---|---|---|
| `cg-saksi` | 10184 / 2 | CG BAS ALUR 02 [2] Saksi dan Putusan Verstek (2 Saksi) | tabel "Kepada Penggugat / Apakah ada perubahan ..." berformat ABT (sebelum: tanpa "- ", kolom 4400/8800); saksi `#5058#` (patokan) sama persis: halaman 1 vs 3 |
| `ct-saksi` | 8668 / 1 | CT BAS ALUR 05 [3a] Pembuktian P dan T | tanya jawab pihak melalui Ketua berformat ABT; bagian Tergugat memakai #0047# (89-B1) |
| `cg-3a` | 10015 / 3 | CG BAS ALUR 05 [3a] Pembuktian P dan T | gambar `sebelum-cg-3a-h12.png` vs `sesudah-cg-3a-h12.png`: "Penggugat menyatakan telah cukup / kesempatan kepada Tergugat ... diajukan oleh Penggugat / Penggugat mengajukan 2 orang saksi / saksi Penggugat yang pertama" menjadi Tergugat / Penggugat atas bukti Tergugat / Tergugat / Tergugat |
| `poligami-saksi` | 7883 / 2 | Izin Poligami BAS ALUR 04 [6] Pembuktian P | tabel pihak bertanya berformat ABT |
| `walad-saksi` | 9817 / 2 | Wali Adhal BAS ALUR 19 (2 Saksi) | patokan BENAR (hanya variabel): tidak berubah |
| `itsbat-saksi` | 10041 / 1 | Itsbat BAS ALUR 11 [1] | tabel berformat ABT |
| `dk-majelis` | 10008 / 2 | Dispensasi Kawin BAS ALUR 12 [1] (Hakim Tunggal bertanya kepada anak/orang tua) | `sebelum-dk-majelis-h4.png` (kolom beda lebar, teks menjorok, tanpa "- ") vs `sesudah-dk-majelis-h4.png` (seperti tangkapan layar Derry) |
| `cg-verstek-1x` | 9870 / 1 | CG BAS ALUR 01 [1a] | tabel berformat ABT |
| `cg-mediasi` | 10015 / 1 | CG BAS ALUR 04 [1] Mediasi | tabel bergaris "Apakah saudara Tergugat bersedia ... e-Court? / Saya bersedia;" menjadi ABT tanpa garis (`sesudah-cg-mediasi-h2.png`) |
| `m5404-hp` | 9382 / 2 (54/Pdt.G/2026) | CT BAS ALUR 04 [7] | #5404# sebelum: "sama" (tidak terdeteksi), sesudah: Hakim + PP berganti lengkap (`render5404/sebelum-m5404-hp-h1.png` vs `sesudah-m5404-hp-h1.png`) |
| `m5404-h` | 9384 / 2 | sama | hakim berganti |
| `m5404-sama` | 9384 / 3 | sama | "Susunan majelis yang bersidang sama dengan sidang yang lalu;" (tetap) |

Pembanding bentuk benar = tangkapan layar Derry (`51ca2d31-image.jpg`): `sesudah-cg-saksi-h3.png` (tanya jawab saksi dari variabel ABT) dan tabel hasil paket ini tampil sama.
Bentuk SALAH ("1. Tanya: ... / Jawab: ...", `18beed0a-image.jpg`): TIDAK dihasilkan blangko, variabel, fungsi isian RTF, bot, portal, maupun ekstensi mana pun (diperiksa: `grep` seluruh kode + 1.880 RTF + 70 fungsi basis ABT + kueri 12.000-an variabel);
bentuk itu berasal dari kerangka rekaan di luar kode ALETA.
