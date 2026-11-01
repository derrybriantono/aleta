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
