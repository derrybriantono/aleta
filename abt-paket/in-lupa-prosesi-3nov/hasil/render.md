# Render [01f] sebelum dipasang (3 Nov 2026, laptop)

## 1. Renderer ABT php56 asli (Uji_sela, alat `alat/render194.py` -> `D:/Aplikasi/aleta/tmp/w180/alat/render180.py`)
Salinan milik agen w180: ABT `aps_badilag_w180d` (= server sesudah 31 paket), tampilan `aps_badilag_w180r`, SIPP `sipp_w180`; perkara itsbat
laptop 10041 (208/Pdt.P/2026), sidang 1. Hasil (RTF memuat data perkara laptop: TIDAK masuk repo) `D:/Aplikasi/aleta/tmp/w194/render/`:

| blangko | bita | penanda mentah | kata aplikasi |
|---|---|---|---|
| [01] [Kabul] IN | 237.572 | 0 | 0 |
| [01f] [Kabul] IN Kabul (Hadir Tapi Lupa Prosesi Nikah) | 239.569 | 0 | 0 |

Beda teks [01] -> [01f] HANYA butir fakta 3-11 (jadi 3-9), paragraf pertimbangan pengganti, dan terjemahan I'anat kedua. `#8554#` terisi
"Majelis Hakim" pada perkara laptop itu (majelis di SIPP) - sama dengan [01]; pada perkara hakim tunggal terisi "Hakim". `#0007#` terisi
"telah dikaruniai seorang anak".

## 2. Render REKAAN -> PDF (alat `alat/render_rekaan.js`, mesin variabel ALETA, baca saja)
Kerangka perkara 10041 laptop, SEMUA isian bermuatan data orang/perkara ditimpa nilai rekaan (nama, saksi, identitas, posita, nomor
"123/Pdt.P/2026/PA.Rkn", hakim/PP rekaan, `#8554#` = "Hakim"); nama/alamat pihak dan saksi, hakim, panitera, dan nomor asli dicari di hasil:
**bocor 0**, penanda mentah 0, galat 0. Isian kosong ([01] dan [01f] sama persis, keadaan basis laptop): `#11122# #11123# #12040# #12041#
#12070# #12073# #12075# #1358#`.
RTF -> PDF lewat Word: `D:/Aplikasi/aleta/tmp/w194/rekaan/rekaan-01f.pdf` (14 halaman), PNG per halaman `rekaan-01f-h<n>.png`.
Diperiksa mata (h8-h10): daftar fakta bernomor 1-9 urut otomatis, paragraf Menimbang Arial 12 rata kanan-kiri menjorok sama dengan [01],
gambar Arab I'anatut Thalibin dan Bughyatul Mustarsyidin tampil utuh rata kanan, urutan kata kanan-ke-kiri benar, "Artinya :" menjorok gantung miring.
