# Ringkasan uji paket abt-bas-tanya-jawab-29okt (laptop, 29-30 Okt 2026)

## Prioritas (SIPP salinan server 28 Okt, putus 29 Okt 2024 - 28 Okt 2026; `alat/peringkat.sql`, lengkap `peringkat-sipp-2th.tsv`)

| jenis x status (verstek, jumlah sidang) | perkara | blangko Derry yang dipakai | keadaan sebelum paket |
|---|---|---|---|
| Cerai Gugat kabul verstek, 2 sidang | 668 | BAS ALUR 02 [2]-[2c]; putusan [01] Format Lengkap | sudah tanya-jawab (patokan) |
| Itsbat nikah kabul, 1 sidang | 298 | BAS ALUR 11 [1]/[1a]; putusan 2 Itsbat Nikah [01]-[01e] | **BAS & putusan tertulis mati** -> diperbaiki |
| Cerai Gugat kabul verstek, 3+ sidang | 172 | BAS ALUR 03 [3]-[3c]; putusan [01] | sudah |
| Cerai Talak kabul verstek, 2 sidang | 126 | BAS ALUR 02 CT; putusan CT [01], [01a] ex officio | [01a] memakai #8511#/#8512# -> diperbaiki; BAS 3-5 saksi #6122# -> #5060# |
| Cerai Gugat kabul kontradiktoir, 3+ | 58 | BAS ALUR 04 [6]/[7], ALUR 05 [3]/[3a], ALUR 06; putusan [02]/[02a]/[02b]/[02c], [01c] | ALUR 05 [3]/[3a] dan putusan [02]* tertulis mati -> diperbaiki |
| Cerai Gugat kabul verstek, **1 sidang** | 53 | BAS ALUR 01 [1a] (CT: [1b]); putusan [01] | **BAS tertulis mati** -> diperbaiki |
| Itsbat kabul 2 sidang / 3+ | 52 / 8 | BAS ALUR 17; putusan [01]... | BAS sudah; putusan diperbaiki |
| Cerai dicabut / gugur | 48+26+21+... | ALUR 07/08 | tanpa pemeriksaan saksi |
| Dispensasi kawin kabul | 18+7 | BAS ALUR 12 (8 berkas); putusan DK (10) | **semua tertulis mati** -> diperbaiki |
| Cerai Gugat NO kontradiktoir | 16 | putusan [98] NO 8 | tertulis mati -> diperbaiki |
| P3HP kabul | 13+8 | BAS 9 - BAS (sudah); putusan PAW [01]/[01b]/[01c] | putusan diperbaiki |
| Perwalian kabul | 12+8 | BAS 6 - BAS (sudah); putusan 3 berkas | putusan diperbaiki |
| Asal usul anak, pengangkatan anak, kumulasi itsbat/hak asuh, itsbat kontensius | <10 | putusan | diperbaiki |
| Jenis lain (harta bersama, kewarisan, wasiat, hibah, wakaf, poligami, pembatalan, ES, 1e-6h, 8a, 9c, 96a) | sedikit | paket w2a/w2b/w3a/w3b | sudah tanya-jawab sejak dibangun |

## Hasil

- 94 berkas diubah (35 BAS, 59 putusan): TABEL-KERAS 36 blok, SUMPAH-KERAS 32, BUTIR-KERAS 148, BUTIR-LINE 2, DAFTAR-ISIAN 3, GANTI-6122 19 (`isi-paket.json`, `../paket-satker/daftar-berkas.tsv`).
- `alat/verifikasi.py` (94 berkas): 0 tidak cocok - baris teks yang hilang hanya baris blok saksi, baris baru hanya penanda variabel/kalimat sumpah patokan; kurung RTF seimbang; tanpa kata nama aplikasi. Diuji di atas pohon SESUDAH paket prodeo (bangun-ulang): amar/biaya/rincian prodeo tidak tersentuh.
- `alat/cek_semua.py` atas SELURUH 1.681 blangko aktif sesudah paket: **0** saksi yang identitasnya tercetak tanpa diikuti variabel tanya-jawab; 0 blangko aktif yang masih memakai 2555-2558/8486/8487/8511/8512.
- Siklus pasang laptop (`sumber/uji_lokal.sh`, basis `aps_badilag_bas29` = salinan dump server 28 Okt): PRASYARAT `17|5|4|1|1`; pasang 94 COCOK -> DITAMBAL 94 -> SUDAH 94; pasang ulang tanpa tulis; pulih `PULIH COCOK` (sidik pohon kembali persis `02936c3bdad2`); gagal-1 satu berkas disunting -> `LEWAT=1`, BERHENTI, tidak ada yang berubah; gagal-2 basis tanpa 9259 -> prasyarat `16|5|3|0|0` BERHENTI; pasang lagi = sidik sama (`55fc1e24b357`); pulih lagi COCOK.
- Render php56 ABT asli (`alat/render_uji.py`, `render-ringkasan.json`; BAS dirender pada sidang pemeriksaan saksi `?d=`): 13 render x 2, **0 penanda #kode# tersisa** sebelum maupun sesudah.
  - 367/Pdt.G/2026 (CG verstek 1 sidang), BAS ALUR 01 [1a]: sebelum 34 "pertanyaan" dari isian (mis. tempat nikah dari isian, "Kepada Saksi;", sumpah Islam untuk saksi kedua yang beragama Protestan); sesudah 22 tanya-jawab = **sama persis** dengan BAS patokan ALUR 02 [2] pada perkara yang sama (58 baris bagian saksi, 22 tanya), sumpah saksi kedua menurut agamanya.
  - 208/Pdt.P/2026 (Itsbat kabul 1 sidang): BAS [1] sesudah = [1b] tanya-jawab (133 baris, 38 tanya = 19+19 baris tersimpan); putusan [01] sebelum 0 butir dari tanya-jawab (semua dari isian), sesudah 36 butir "- Bahwa" = 38 jawaban BAS dikurangi 2 kalimat penutup (paket x6) -> BAS dan putusan sinkron.
  - Dispensasi kawin 190/Pdt.P/2026: BAS 39 tanya (= 19+20 tersimpan), putusan 37 butir (= 39 - 2 penutup).
  - Cerai kontradiktoir 498/Pdt.G/2026 (BAS ALUR 05 [3a], putusan [02]), P3HP 185/Pdt.P/2026, perwalian 188/Pdt.P/2026: tanpa penanda tersisa; putusan membaca jawaban tanya-jawab.

### Simulasi tambahan seperti pengguna (30 Okt pagi; 11 render, berkas tak diubah dirender sekali)
Perkara: 627/Pdt.G/2026 (CG verstek 2 sidang, BAS ALUR 02 [2] + putusan [01] patokan), 270/Pdt.G/2025 (cerai talak P & T hadir: BAS ALUR 05 [3a] diubah, putusan [02] CT-F diubah, [02] Rekonvensi tidak diubah), 173/Pdt.P/2026 (wali adhal: BAS ALUR 19 [2], putusan [01]), 252/Pdt.G/2024 (izin poligami: BAS ALUR 04 [6], putusan [01]), 7/Pdt.P/2024 (perkara lain-lain 369: BAS ALUR 18 [2], putusan pengangkatan anak [01] diubah). Harta bersama/kewarisan: tidak ada perkara bertanya-jawab saksi di dump server (tidak dirender).
Yang dicek tiap naskah: penanda #kode# tersisa, baris ganda berurutan, isian kosong "..." di bagian saksi, bentuk tanya-jawab di BAS, butir "Bahwa" dari tanya-jawab di putusan, dan sinkron BAS<->putusan (`alat/sinkron.py`: tiap jawaban BAS dinormalkan seperti fungsi putusan lalu dicari di butir putusan).
- 24 render (13 + 11): **0 penanda tersisa, 0 baris ganda**.
- Putusan cerai talak [02] 270/Pdt.G/2025: sebelum 20 isian "..." di keterangan saksi (keterangan rekaan dari isian yang tidak diisi), sesudah 0; 24 butir dari tanya-jawab.
- BAS ALUR 05 [3a] 270/Pdt.G/2025: sebelum 56 "pertanyaan" tertulis (37 isian "..."), sesudah 34 tanya-jawab sungguhan; 7 "..." tersisa = identitas/sumpah saksi Termohon yang memang tidak ada di perkara itu (sama seperti patokan bila saksi tidak ada).
- Sinkron BAS<->putusan (jawaban BAS ada di putusan): CG verstek 1x 20/20, Itsbat 36/36, DK 37/37, CG kontradiktoir 30/30, wali adhal 22/22; cerai talak 22/24 dan izin poligami 24/28 - SELISIHNYA karena kata terpotong oleh fungsi putusan ("mengetahuinya, yang" -> "mengetahuinyang", "Iya, saya" -> "isaksi"): diperbaiki paket pasangan `ket-saksi-kata-30okt` (dirender ulang dengan fungsi baru: cerai talak 24/24, izin poligami "isaksi" -> "saksi"; sisa 2 selisih izin poligami = salah ketik data "Yangsaya" dan normalisasi alat ukur).
- Temuan lain (di luar keterangan saksi, tidak diubah): daftar bukti surat `#9955#` tercetak bernomor ganda "1. 1. Fotokopi ..." pada BAS ALUR 01 [1a] dan putusan [01] (627/367 Pdt.G); bukti kedua tanpa nomor pada itsbat 208/Pdt.P/2026; jawaban saksi yang diketik dengan ganti baris tergabung tanpa spasi di sel tabel BAS ABT (perilaku PHP ABT `kolom_kode_A4`).

Teks render lengkap (memuat data perkara, tidak masuk repo): `D:/Aplikasi/aleta/tmp/bas29/render/`.
