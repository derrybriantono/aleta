# Render sungguhan sebelum/sesudah paket ke-32 `kaidah-fikih-2nov` (renderer ABT php56 asli, controller CLI Uji_sela)

Salinan MILIK SENDIRI: ABT `aps_badilag_w180d` (= `aps_badilag_rantai177`, sesudah 31 paket; fungsi `SIPP.` diarahkan ke `sipp_w180`), tampilan `aps_badilag_w180r`,
SIPP `sipp_w180` (salinan `sipp_w177`), aplikasi `D:/Aplikasi/aleta/tmp/w180/abt`. Pohon sebelum = sesudah 31 paket (sidik `19ee866e...`), sesudah = + paket ini.
Alat: `alat/render180.py`, `alat/jalan180.py` (13 kasus), `alat/banding_render.py` (beda teks), `alat/format_paragraf.ps1` (format paragraf di Word),
`alat/halaman_png.ps1` (halaman -> PDF -> PNG). RTF/PNG memuat NAMA PIHAK SUNGGUHAN - tidak masuk repo, tidak dikirim keluar:
`D:/Aplikasi/aleta/tmp/w180/render/<sebelum|sesudah>-<kasus>.rtf`, PNG `D:/Aplikasi/aleta/tmp/w180/render/png2/sesudah-<kasus>-h<halaman>-h1.png`.

## Beda teks (13 kasus, 12 jenis): HANYA paragraf kaidah yang bertambah; tidak ada paragraf lain yang berubah/hilang

| kasus | perkara / blangko | paragraf | ditambah | dibuang/diganti | PNG |
|---|---|---|---|---|---|
| bukti-kewarisan | 656/Pdt.G/2026 / 4b Kewarisan [03b] Tolak Verstek | 300 -> 303 | Al Muhadzdzab (pengantar + Arab + Artinya, "Majelis Hakim", "Penggugat", "gugatannya") | 0 | h24 |
| shulhu-hb | 506/Pdt.G/2026 / 4a Harta Bersama [97] Akta Perdamaian | 55 -> 61 | An-Nisa 128 + HR at-Tirmidzi 1352 (dua Arab + dua Artinya) | 0 | h3 |
| nisa32-hb | 506/Pdt.G/2026 / 4a HB [01b] Kabul Verstek | 130 -> 132 | An-Nisa 32 | 0 | - |
| ianat-itsbat | 262/Pdt.P/2026 / 2a IN Kontensius [03b] Tolak Verstek | 107 -> 110 | I'anatuth Thalibin ("Hakim" - hakim tunggal ikut berkas) | 0 | h8 |
| nisa7-paw | 230/Pdt.P/2026 / 9 PAW [01b] | 170 -> 172 | An-Nisa 7 | 0 | - |
| tasharruf-wali | 224/Pdt.P/2026 / 6 Perwalian [01b] | 136 -> 139 | kaidah tasharruful imam | 0 | h13 |
| firasy-aua | 221/Pdt.P/2026 / 8 Asal Usul Anak [01] | 129 -> 131 | al-walad lil firasy | 0 | h12 |
| ahzab-angkat | 152/Pdt.P/2025 / 9a Pengangkatan Anak [01] (sisip di dalam grup run Word) | 119 -> 121 | al-Ahzab 5 | 0 | (Word menolak ekspor PDF berkas ini - SEBELUM paket pun sama; format diperiksa lewat Word: lihat bawah) |
| poligami-01b | 376/Pdt.G/2025 / 5 Izin Poligami [01b] | 114 -> 114 | - | 1 kalimat diganti: "... Pasal 5 ayat (1) huruf b UU 1/1974 jo. Pasal 55 ayat (2), Pasal 57, Pasal 58 ayat (1) huruf b Kompilasi Hukum Islam jo. Pasal 5 ayat (1) huruf c Undang-Undang Nomor 1 Tahun 1974 dan Pasal 59 ..." | h9 |
| nisa3-tolak | 376/Pdt.G/2025 / 5 Izin Poligami [03] Tolak | 97 -> 98 | An-Nisa 3 | 0 | - |
| hadhanah | 695/Pdt.G/2026 / 6a Hak Asuh [01b] Kabul Verstek | 109 -> 111 | hadits Abdullah bin Amr | 0 | h8 |
| nafkah-anak | 695/Pdt.G/2026 / 6c Nafkah Anak [01b] | 105 -> 108 | al Hawi al Kabir (Arab + Artinya) | 0 | h8 |
| nisa19-kelalaian | 695/Pdt.G/2026 / 1e Kelalaian Kewajiban [01b] | 111 -> 112 | An-Nisa 19 | 0 | - |

Di semua tambahan, penanda #8554#/#0046#/#0053# terisi (0 penanda tersisa); tidak satu pun kalimat lama berubah selain kalimat Izin Poligami [01b].
Kasus memakai perkara yang jenisnya tidak selalu sama dengan blangko (renderer hanya mengisi variabel) - yang diuji adalah letak, format, dan isi paragraf sisipan.

## Format di Word (`alat/format_paragraf.ps1`, rata 3 = kanan-kiri, 2 = kanan; fi/li dalam pt)
- Paragraf "Menimbang" sisipan = paragraf jangkar: Arial 12 pt, rata kanan-kiri, baris pertama menjorok 36 pt (1,27 cm).
- Paragraf Arab: rata kanan, Times New Roman 20 pt tebal (sama dengan teks Arab blangko Derry yang sudah ada, `\fs40 \b1`); urutan kata kanan-ke-kiri benar (PNG).
- "Artinya :" menjorok gantung 49,9 pt, isi miring di dalam tanda petik (seperti blangko Derry).
- Paragraf sesudah sisipan tetap seperti sebelum paket (diperiksa pada pengangkatan anak, kewarisan, akta perdamaian HB, hak asuh, nafkah anak).
- Pengangkatan Anak [01]: dua paragraf sesudah titik sisip memang 10 pt sejak SEBELUM paket (bawaan berkas); sisipan memakai format teks jangkar (Arial 12 pt).

## Waktu render
php56 CLI, 13 berkas: sebelum 52,8 dtk, sesudah 54,5 dtk (4,1-4,2 dtk per berkas) - paket hanya menambah teks tetap tanpa variabel/kueri baru, tidak ada beban tambahan.
