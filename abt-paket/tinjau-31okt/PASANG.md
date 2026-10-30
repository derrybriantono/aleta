# Paket ABT `abt-tinjau-31okt` - jawaban pengguna 31 Okt atas pertanyaan G6 (hukum acara, titik koma)

**Status: dibangun dan diuji di LAPTOP. Server: BELUM dipasang. URUTAN: sesudah `identitas-kosong-31okt`, sebelum `bukti-8529-31okt` dan
`tanggal-agenda-31okt`** (lihat `../URUTAN-PASANG-31okt.md`). Hanya pengguna **derry_briantono**. Dasar md5 = keadaan SESUDAH 18 paket rantai.
Dibangun deterministik: `python sumber/bangun_paket.py <_blangko_abt sesudah rantai> <basis ABT> [<nama basis salinan>]`
(memakai mesin `../hir-rbg-30okt/sumber`).

| no | jawaban pengguna | isi paket |
|---|---|---|
| 18 | banding Jawa-Madura = Pasal 7 ayat (1) UU 20/1947 | BARU `#11896#` (`Pasal 199 ayat (1) RBg` / `Pasal 7 ayat (1) Undang-Undang Nomor 20 Tahun 1947 tentang Peradilan Ulangan`); `#11217#` memakainya |
| 19 | 288 RBg -> pasal KUHPerdata yang isinya sama | **Pasal 1875 KUHPerdata** - isi dicocokkan: RBg 288 "akta di bawah tangan ... yang diakui ... bukti yang lengkap terhadap mereka yang menandatanganinya serta para ahli waris ... seperti suatu akta otentik (KUHperd. 1875.)" = KUHPerdata 1875 (tulisan di bawah tangan yang diakui = bukti sempurna seperti akta otentik bagi penanda tangan, ahli waris, penerima hak; wikisource Buku Keempat). BARU `#11897#`; 2 blangko HB + 6 kueri bukti (4807, 4808, 4829, 4830, 4833, 4834) |
| 20 | 718 = 390 HIR; 144 (1) = "Pasal 120 HIR"; eksekusi 197/200 | `#11898#` nomor 718/390 (11 rujukan blangko + 7006/7008/7169/11208); `#11899#` " ayat (1)" / "" (2 rujukan `Pasal 144 ayat (1) RBg` -> HIR "Pasal 120 HIR"). **Eksekusi 208-210, 216-218 (dan 215 yang baru terbaca sesudah dibakukan) BELUM**: blok nomor yang diberikan (11850-11899) habis - perlu +-12 nomor; tetap RBg |
| 21 | tenggang verzet 14 hari = 153 ayat (2) | `#11218#` dan kalimat relaas 7006/7008 (`... dalam tenggang waktu 14 (empat belas) hari ... sebagaimana telah ditetapkan dalam Pasal 153 ayat (2) RBg`; HIR 129 ayat (2)). Blangko 96a Verzet yang menyebut ayat (1) untuk HAK perlawanan ("tergugat yang perkaranya diputus tanpa kehadirannya ... dapat mengajukan perlawanan") TIDAK diubah - memang ayat (1) |
| 22 | bakukan jadi "RBg" | 20 `R.Bg.`, 10 `Rbg`, 13 nama panjang "Reglemen Acara Hukum untuk Daerah Luar Jawa dan Madura (RBg)" -> `RBg`, lalu yang pasti ikut padanan (37 rujukan baru) |
| 23 | ";" di tengah pertimbangan -> baris baru berbutir "-" | 132 "...; bahwa ..." di 63 blangko: ";" tetap di akhir butir, butir berikutnya paragraf baru `\pard ... \fi-284 \li<li+1004> \tx<..> -\tab bahwa ...` (gaya paragraf asal dipertahankan: rata, spasi, gaya); properti dipasang lagi sebelum `\par` penutup dan paragraf sesudahnya dipastikan kembali ke gaya asal. Kueri 4303 (itsbat Pasal 7 ayat (3) KHI), 4308 (wali), 4864 (poligami) sama; paragraf `<br>` sesudah butir di 4303 dikembalikan ke gaya pertimbangan. Kutipan pasal berhuruf (a)...; (b)... TIDAK diubah |
| 24 | biarkan 7078/7110/7153/7005 | tidak diubah |

Keputusan sementara (23): butir pertama = kalimat pembuka paragraf ("Menimbang, bahwa ...;") tetap di baris paragraf; butir "-" mulai dari
"bahwa" kedua dan seterusnya.

Pasang / pulih (server, root): `bash pasang-satker.sh` -> `PRASYARAT COCOK (0|0|15|0|2)`, `SIAP=95`, `SEMUA COCOK`, `TAMBAL=95`,
`BERKAS COCOK`, `SELESAI`. Pulih: `bash pulih-satker.sh` -> `PULIH COCOK (0|0|15|0|2)`. Hasil uji: `hasil/uji-lokal.md`.
