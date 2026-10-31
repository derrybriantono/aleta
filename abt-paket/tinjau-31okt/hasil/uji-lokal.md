# Uji lokal paket tinjau-31okt (31 Okt 2`0|17|0|16|2` + `SUDAH=99`; `PULIH COCOK (0|0|16|0|2)`26)

Basis: salinan `aps_badilag_t`0|17|0|16|2` + `SUDAH=99`; `PULIH COCOK (0|0|16|0|2)`5` + pohon `D:/Aplikasi/aleta/tmp/t45/blangko` = keadaan SESUDAH rantai 18 paket (salinan `/d/r`,
`aps_badilag_rantai`), SIPP `sipp_g6`. Renderer php56 ABT asli (`alat/render_t`0|17|0|16|2` + `SUDAH=99`; `PULIH COCOK (0|0|16|0|2)`5.py`), Word -> PDF (`alat/rtf_ke_pdf.ps1`), PDF -> PNG
(`alat/pdf_ke_png.ps1`, Windows.Data.Pdf).

| uji | hasil |
|---|---|
| pasang | `PRASYARAT COCOK (`0|17|0|16|2` + `SUDAH=99`; `PULIH COCOK (0|0|16|0|2)`\|0\|15\|0\|2)`, `SIAP=99`, `SEMUA COCOK`, `TAMBAL=99`, `BERKAS COCOK`, `SELESAI` |
| pasang ulang / pulih / pasang lagi | `0|17|0|16|2` + `SUDAH=99`; `PULIH COCOK (0|0|16|0|2)`\|4\|0\|15\|2` + `SUDAH=98`; `PULIH COCOK (0\|0\|15\|0\|2)`; pasang lagi `TAMBAL=99` |
| Donggala - SEMUA perkara | pembangun membuktikan (assert): padanan diisi nilai RBg = teks sesudah pembakuan (22) persis; kueri: padanan RBg = kueri lama persis |
| Donggala - render nyata 1`0|17|0|16|2` + `SUDAH=99`; `PULIH COCOK (0|0|16|0|2)`1 blangko (95+ berkas yang ditambal + pemakai 11 kueri yang diubah) | lihat `banding-t45.json`: tidak ada perbedaan selain (22) RBg baku, (21) ayat (2), (23) butir "-" |
| (23) cetakan Word | itsbat kontensius 225/Pdt.P/2`0|17|0|16|2` + `SUDAH=99`; `PULIH COCOK (0|0|16|0|2)`26 hal. 10: tiap "bahwa" berikutnya di baris sendiri, "-" di kiri, teks lurus (inden gantung), spasi 1,5 sama dengan paragraf lain, paragraf "Menimbang" berikutnya kembali normal; poligami 376/Pdt.G/2025 hal. 7 (kueri 4864): butir "-" berinden gantung. Kesalahan yang ditemukan saat melihat PDF dan diperbaiki: (a) properti paragraf terpotong (`\s` dari `\sl360`) -> spasi tunggal; (b) butir tengah kembali ke inden paragraf karena `\par` penutup di kelompok `{...}` lain; (c) butir dari kueri sama sebabnya; (d) "Pasal 144ayat (1)" karena ABT memangkas spasi tepi hasil variabel |
| (21) | #11218# dan 7`0|17|0|16|2` + `SUDAH=99`; `PULIH COCOK (0|0|16|0|2)`06/7008: "dalam tenggang waktu 14 (empat belas) hari ... Pasal 153 ayat (2) RBg"; blangko 96a Verzet (ayat (1) = hak perlawanan) tidak diubah |
| tanggal-agenda-31okt (w1`0|17|0|16|2` + `SUDAH=99`; `PULIH COCOK (0|0|16|0|2)`7) sesudah paket ini | 198/Pdt.G/2026 (tanpa Court Calendar, jawab-menjawab di jadwal SIPP): BAS ALUR 04 [2] tabel agenda Jawaban 08 Mei 2026, Replik 12 Mei, Duplik 18 Mei, Pembuktian Penggugat 19 Mei, Kesimpulan 02 Juni 2026; putusan CG [02]: "jawabannya ... tanggal 08 Mei 2026", replik 12 Mei, duplik 18 Mei |
| uji rantai penuh dari dump 28 Okt (21 paket, `../uji-rantai-31okt/hasil-rantai.txt`) | semua SELESAI 31 Okt `0|17|0|16|2` + `SUDAH=99`; `PULIH COCOK (0|0|16|0|2)`7.36-07.46; tinjau-31okt `PRASYARAT COCOK (0|0|16|0|2)`, `TAMBAL=99`, `BERKAS COCOK` |
| eksekusi (blok 12000-12012) | render ABT asli 96 Eksekusi [01] [02] [03] [04]: Donggala identik; simulasi satker HIR (cabang PA.Dgl = HIR lalu dikembalikan): "Pasal 195 ayat (1), Pasal 197 ayat (1), Pasal 197 ayat (2) sampai dengan ayat (5), Pasal 197 ayat (6), Pasal 198, dan Pasal 199 ayat (1) HIR"; lelang "Pasal 200 ayat (1)/(4) dan ayat (5)/(6) HIR"; riil "Pasal 200 ayat (11) HIR"; aanmaning "Pasal 196 HIR"; 0 penanda tersisa |
| render ulang sesudah eksekusi dan "- Bahwa" kapital | 104 blangko: 15 sama persis, 89 hanya ubahan yang dimaksud, 0 beda lain; rantai penuh 21 paket SELESAI 31 Okt 09.33 |
