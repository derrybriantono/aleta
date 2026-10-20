# Hasil render php56 lokal - paket W3a (21 Okt 2026)

Renderer `Abt_model::variabel_library` (php 5.6.40) atas SALINAN aplikasi ABT (`D:\Aplikasi\aleta\tmp\w3a\abt-app`, tanpa menyentuh aplikasi/basis asli) yang menunjuk basis sementara `aps_badilag_w3r`
(22 tabel ABT salinan `aps_badilag_w2a` + 154 variabel paket dipasang dengan PASANG.sql; fungsi `isian_rtf_*` dari `aps_badilag_u2`). Perkara dibaca dari SIPP lokal `sipp_donggala` (s.d. ±9 Okt).
Perintah: `python abt-paket/w3a-blangko-baru-perkawinan/alat/render_w3a.py <perkara_id> <berkas.rtf> [keluar.rtf]` (env `W3A_ABT`; parameter ke-4 fungsi `render` = urutan sidang `d`).

Perkara nyata keenam jenis tidak ada (343: 1 perkara salah jenis), jadi tiap blangko dirender atas perkara serumpun TANPA isian petugas (titik-titik `...` yang tersisa = isian petugas yang memang belum diisi pada salinan lokal; kolom kedudukan/jenis kelamin Penggugat kosong pada sebagian perkara uji sehingga kueri sengaja tidak menebak).

| blangko | perkara uji | hasil | token `#nnnn#` tersisa | galat |
|---|---|---|---|---|
| 5c Penolakan Perkawinan [01] | 4184 (343) | OK | 0 | tidak |
| 5c Penolakan Perkawinan [03] | 4184 | OK | 0 | tidak |
| 5d Perkawinan Campuran [01] | 9817 | OK | 0 | tidak |
| 3a Izin Kawin [01], [01b] | 9817 | OK | 0 | tidak |
| 8a Pengesahan Anak [01], [01a] | 10090 | OK | 0 | tidak |
| 1e Kelalaian Kewajiban [01], [01b] | 10222 | OK | 0 | tidak |
| 1f Hak Bekas Istri [01], [02] | 10212 | OK | 0 | tidak |
| BAS ALUR 60 Penolakan [1] | 9817, sidang 3 | OK | 0 | tidak |
| BAS ALUR 61 Perkawinan Campuran [1a] | 9817, sidang 3 | OK | 0 | tidak |
| BAS ALUR 63 Pengesahan Anak [1] | 10090, sidang 4 | OK | 0 | tidak |
| BAS ALUR 64 Kelalaian - Sidang 1 (tunda panggil T) | 10090, sidang 4 | OK | 0 | tidak |
| BAS ALUR 65 Hak Bekas Istri - Sidang 2 (verstek) | 10090, sidang 4 | OK | 0 | tidak |
| BAS salinan ALUR 04 [6] di 1e (pembuktian P) | 10090, sidang 4 | OK | 0 | tidak |
| BAS ALUR 62 Izin Kawin [1] | 9817 | OK | 0 | tidak |
| Relaas [JS] 12.1 (Pegawai Pencatat Nikah) | 4184 | OK | 0 | tidak |

Catatan: BAS permohonan memuat `#9003#` yang membaca urutan sidang (`?d=`); tanpa parameter itu (perkara tanpa jadwal sidang) ABT sendiri mengeluarkan galat SQL - perilaku ABT yang sama pada BAS lama, bukan akibat paket.
Waktu render 30-190 detik per berkas pada laptop yang sedang menjalankan uji penuh dan beberapa agen. Keluaran teks: `D:/aleta-dev/kerja/w3a/render/*.txt`.
Tidak dirender (jumlah variasi): 150 berkas lain; semuanya lolos `periksa_isi.py` (token ada, tanpa kata ALETA/jenis lain) dan kerangkanya diturunkan dari berkas Derry yang sama.
