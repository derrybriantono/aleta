# Render sungguhan sebelum/sesudah paket identitas-pihak-1nov (renderer ABT php56 asli, controller CLI Uji_sela)

Salinan MILIK SENDIRI: ABT `aps_badilag_w177d` (= `aps_badilag_rantai164` sesudah 29 paket, lalu paket ke-30 dipasang), tampilan `aps_badilag_w177r`, SIPP `sipp_w177` (salinan `sipp_w164`),
aplikasi `D:/Aplikasi/aleta/tmp/w177/abt`; semua fungsi ABT yang menunjuk `SIPP.` diarahkan ke `sipp_w177` (di salinan agen lain fungsi itu membaca basis `sipp` PA Bungku). Pohon blangko = sesudah 30 paket
(sidik `9931cdd9...` = rantai agen Q). Alat: `alat/render177.py`, `alat/jalan.py`. RTF -> PDF (Word, halaman 1-2) -> PNG (Windows.Data.Pdf).
PNG (memuat NAMA PIHAK SUNGGUHAN - tidak masuk repo, tidak dikirim keluar): `D:/Aplikasi/aleta/tmp/w177/render/png/<sebelum|sesudah>-<kasus>-h<halaman>.png`; RTF utuh di `.../render/`.

| kasus | perkara | blangko | sebelum | sesudah |
|---|---|---|---|---|
| cg-acuan | 164/Pdt.G/2026 CG verstek tanpa kuasa | 1 Perceraian CG/[01] [Kabul Verstek] Cerai (Format Lengkap) (acuan) | inden acuan; tanpa umur; Penggugat "pekerjaan, pendidikan", Tergugat ";" tertebal | inden SAMA; "(27 tahun)" kedua pihak; agama-pendidikan-pekerjaan; ";" tidak tebal |
| cg-473 | 473/Pdt.G/2026 kuasa kedua pihak (contoh pengguna) | idem | Penggugat tanpa umur, Tergugat "tempat dan tanggal lahir (umur) Donggala, 16 Maret 1975 (51 tahun)", kuasa ", yang telah" | persis contoh pengguna: nama tebal di inden 1,25 cm, gantung 4,5 cm, "(44 tahun)" dan "(51 tahun)", "tanggal 30 Juli 2026 yang telah didaftarkan ..." tanpa koma, "sebagai **Penggugat**;" tidak terpotong |
| ct-kuasa | 174/Pdt.G/2026 CT, kuasa kedua pihak | 1a Perceraian CT/[01] [Kabul Verstek] ... (Format Lengkap) | Pemohon tanpa umur, Termohon "(umur)" tersisa | umur kedua pihak, kuasa utuh (Termohon: 3 advokat) |
| itsbat-2 | 262/Pdt.P/2026 itsbat nikah 2 Pemohon | 2 Itsbat Nikah/[01] [Kabul] IN | menjorok -1952 (baris pertama 1,06 cm); tanpa umur; pekerjaan-pendidikan | menjorok acuan; "(23 tahun)" dan "(26 tahun)"; tiap Pemohon satu paragraf berinden 1,25 cm |
| dk-2 | 2/Pdt.P/2026 dispensasi kawin, 2 Pemohon (orang tua) | 3 Dispensasi Kawin/[01] [Kabul] DK - (Anak P Cewek) Hamil | tertulis tangan: nama tebal dengan spasi aneh, "(umur) Lodang, 01 Juli 1988 (37 tahun)", baris pertama 1,2 cm, gantung 3,5 cm | #7047#: acuan, "(37 tahun)" tanpa "(umur)"; paragraf "Pemohon I dan Pemohon II selanjutnya ..." ikut inden |
| bas-cg | 367/Pdt.G/2026 BAS verstek sidang pertama | 1 Perceraian CG - BAS/BAS ALUR 01 [1a] | tertulis tangan, baris pertama tanpa inden, "(umur)" tersisa | #7047#/#7048#: acuan; Tergugat ghoib ("Dahulu beralamat di ... tidak diketahui") tetap wajar |
| sela-tt | 7472 putusan sela, Turut Tergugat | 97a Putusan Sela/[37] [Sela Tolak] Pemisahan Perkara | Turut Tergugat tanpa umur/pendidikan | Turut Tergugat: umur dan pendidikan ikut |

Banding teks identitas atas 34 perkara contoh (render mini `alat/buat_mini.py`: hanya #7047# melawan #7048#; `alat/banding_mini.py`): 31 SAMA persis setelah menormalkan hanya (a) umur, (b) urutan pendidikan/pekerjaan,
(c) koma sebelum "yang telah didaftarkan", (d) tulisan "(umur)", (e) letak tanda tebal; 3 BEDA, semuanya perbaikan: perkara 10089 (Tergugat III tampil), perkara 10006 (alamat tidak lagi tertulis ganda), perkara 10081 (tanggal lahir
"10 Februari 1084" - salah ketik SIPP - kini "..." seperti tanggal kosong).

## REVISI 2 Nov 2026 (keputusan 112: umur tidak perlu dalam putusan) - render ulang SESUDAH
Salinan sendiri: ABT `aps_badilag_r181` (dump server 28 Okt + 30 paket + ke-31 revisi), SIPP `sipp_w181` (salinan `sipp_w177`), tampilan `aps_badilag_w181r`, aplikasi `D:/Aplikasi/aleta/tmp/w181/abt`
(`render181.py`/`jalan181.py` = `render177.py`/`jalan.py` untuk salinan ini), pohon sesudah ke-31 revisi. Tujuh kasus yang sama dengan tabel di atas (perkara yang sama); teks diekstrak dari RTF hasil render (`rtf2txt`):

| kasus | perkara | sebelum revisi (tabel di atas) | sesudah revisi |
|---|---|---|---|
| cg-acuan | 164/Pdt.G/2026 | "(27 tahun)" kedua pihak | tanpa umur: "tempat dan tanggal lahir Sidondo, 03 Oktober 1998, agama Islam, pendidikan D1, ..." |
| cg-473 | 473/Pdt.G/2026 (kuasa kedua pihak) | "(44 tahun)" dan "(51 tahun)" | tanpa umur: "... lahir Tanah Harapan, 11 November 1981, agama Lainnya, pendidikan S1, ..." dan "... Donggala, 16 Maret 1975, agama Lainnya, pendidikan SLTA, ..."; kuasa utuh, sebutan tebal |
| ct-kuasa | 174/Pdt.G/2026 CT | umur kedua pihak | tanpa umur |
| itsbat-2 | 262/Pdt.P/2026, 2 Pemohon | "(23 tahun)" dan "(26 tahun)" | tanpa umur, inden acuan tetap |
| dk-2 | 2/Pdt.P/2026 dispensasi kawin | "(37 tahun)" | tanpa umur |
| bas-cg | 367/Pdt.G/2026 BAS verstek sidang pertama | umur | tanpa umur |
| sela-tt | 7472 putusan sela, Turut Tergugat | umur dan pendidikan | pendidikan tetap, tanpa umur |

Jumlah "(N tahun)" / "(umur)" tercetak di ketujuh hasil render: **0** (skrip `cek_umur`). PNG halaman 1 `cg-473` dilihat langsung (nama pihak SUNGGUHAN, tidak masuk repo):
`D:/Aplikasi/aleta/tmp/w181/png-id/cg-473-h1.png`, `.../itsbat-2-h1.png` (inden 1,25 cm / gantung 4,5 cm tidak berubah; hanya umur yang hilang).

## Relaas 6.2 (keputusan 134, golongan E) - render ABT php56, perkara 164/Pdt.G/2026 (perkara_id 9572), sebelum vs sesudah
`98 Relaas/[JS] 6.2. Relaas Pemberitahuan Putusan Verstek T (e-Court)` (teks identitas Tergugat, diekstrak dari RTF hasil render; NIK disamarkan):
- SEBELUM: "...tempat dan tanggal lahir Palu, 13 Maret 1998, **umur 27 tahun,** agama Islam, pekerjaan Security ( Sekolah Sukma Bangsa ), pendidikan SLTA, ..."
- SESUDAH: "...tempat dan tanggal lahir Palu, 13 Maret 1998, agama Islam, pekerjaan Security ( Sekolah Sukma Bangsa ), pendidikan SLTA, ..." (tanpa koma/kata ganda)
RTF: `D:/Aplikasi/aleta/tmp/w181/render-relaas/{sebelum,sesudah}-relaas.rtf`.

Pindai seluruh pohon sesudah ke-31 revisi+E (1.872 blangko, `hasil/sisa-umur-pohon.txt`): `(umur)`, `#0099#`, `#0103#`, `#1034#` = 0 berkas. Variabel umur pihak lain (#3116# #3126# #5027# #0107# #0171# #8427# #8440# #10122#, dan #1022# #1039# #1043# #1190#) tidak dipakai blangko mana pun. Tersisa yang BUKAN umur pihak dan dibiarkan:
umur anak/calon mempelai di dispensasi kawin (#0601# #0607# #0999# kehamilan), calon suami di Wali Adhal (#1030#, 9 blangko), umur saat menikah di itsbat (#7211# #7212#), umur saksi (#1198# dst.), dan batas usia dewasa "21/12/18/17 tahun" (20 blangko "(21 tahun)").
Golongan D (revisi 112): dua blangko `[99] BAS LAINNYA` (folder BAS lama) yang lolos dari penggantian tertulis tangan paket ini dibersihkan (4 paragraf). Golongan E (keputusan 134): relaas 6.2 (1 berkas).
