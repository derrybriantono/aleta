# PERIKSA-PASAL W3b - blangko Derry baru gelombang 3 (pencabutan kuasa asuh, pencabutan kuasa wali, penunjukan wali, ganti rugi wali, nafkah anak oleh ibu, eksekusi, verzet)

Agen W3b, 21 Okt 2026. Paket ABT: `abt-paket/w3b-blangko-baru-kuasa-wali`. Sumber tiap bagian: `abt-paket/w3b-blangko-baru-kuasa-wali/spek/PASAL-<jenis>.md` (digabung di sini; bila berbeda, berkas di `spek/` yang menang).

Aturan yang dipakai: nomor pasal hanya dicetak bila bunyinya dibaca dari naskah di `D:/aleta-dev/kerja/referensi/_unduhan` (UU 1/1974, UU 23/2002 jo. UU 35/2014, PP 29/2019, RBg, KHI) atau dari blangko Derry yang sudah ada; ragu = tanpa nomor dan ditandai di bawah. Tidak ada putusan jenis ini di SIPP (kecuali satu perkara verzet dan tiga eksekusi), sehingga semua blangko BELUM PERNAH DIPAKAI pada perkara nyata.

## Ringkasan butir yang perlu dicek hakim

| Jenis | Butir | Catatan |
|---|---|---|
| 353 | Pasal 31 ayat (1) UU 23/2002 menyebut "permohonan"; PA memeriksa sebagai Pdt.G maupun Pdt.P | blangko menyediakan keduanya; pilihan mengikuti nomor perkara |
| 353 | Buku II 2026 dan rumusan SEMA/Kamar tentang pencabutan kuasa asuh tidak dikutip | naskah resmi belum ada di arsip |
| 355, 356 | tafsir dan cakupan, bukan nomor pasal | lihat bagian masing-masing |
| 357 | batas umur 18 tahun (UU 1/1974) lawan 21 tahun (KHI Pasal 107, 111) dicetak apa adanya; hakim memilih | |
| 357 | penjelasan Pasal 49 huruf a angka 18 dibaca dari teks di `aleta_bot/query.js`, bukan PDF resmi UU 3/2006 | cocokkan sekali |
| 357 | kalimat pengecualian "demi kepentingan anak" meniru Pasal 110 ayat (2) KHI; untuk kelalaian murni hakim mengubahnya | |
| 350 | keputusan rancangan di bagian jenis (pembagian biaya ibu/ayah, Pasal 41 huruf b UU 1/1974) | |
| eksekusi | Pasal 54 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 hanya diparafrasa (naskah tidak ada di referensi) | |
| eksekusi | Pasal 218 ayat (2) RBg di [03]: bunyinya benar, penerapannya pada eksekusi riil lain adalah penilaian hukum | |
| eksekusi | kewajiban dua saksi pada konstatering dan eksekusi riil = perintah Ketua (kebiasaan), bukan RBg | |
| verzet | Pasal 271 Rv (dipakai ulang dari 6c [98]); naskah Rv tidak ada; penerapan pada perlawanan analogi | |
| verzet | beban biaya memakai Pasal 192 ayat (1) RBg (bukan Pasal 89 UU 7/1989) sesuai contoh perkara 9321 | ubah teks biaya bila hakim ingin Pasal 89 |
| verzet | amar "Pelawan yang benar", "membatalkan", "menguatkan", "tetap dijalankan" = praktik tanpa nomor pasal | |


---

## Rujukan hukum baru - jenis 353 (pencabutan kekuasaan orang tua)

Agen W3b, 21 Okt 2026. Naskah: D:/aleta-dev/kerja/referensi/_unduhan (UU 1/1974 naskah BPK, UU 23/2002 dan UU 35/2014, PP 29/2019); penjelasan Pasal 49 huruf a di aleta_bot/query.js (teks UU 3/2006).
Kolom "Tercetak": G = putusan gugatan (6d [01], [01a], [01b], [03], [03b]), P = penetapan permohonan ([01p], [03p], [99p]), K = katalog saksi `pencabutan-kuasa-asuh.json`, V = kueri variabel ABT 3800-3819.

| Rujukan | Kutipan inti | Status | Tercetak |
|---|---|---|---|
| Pasal 47 ayat (1), (2) UU 1/1974 | "berada dibawah kekuasaan orang tuanya selama mereka tidak dicabut" | terverifikasi (uu1-1974-bpk.txt) | G, P, K |
| Pasal 45 ayat (1), (2) UU 1/1974 | "wajib memelihara dan mendidik anak-anak mereka sebaik-baiknya" | terverifikasi | G, P, K |
| Pasal 49 ayat (1) huruf a, b UU 1/1974 | "sangat melalaikan kewajibannya terhadap anaknya"; "berkelakuan buruk sekali" | terverifikasi | G, P, V (3803, 3804, 3807), K |
| Pasal 49 ayat (2) UU 1/1974 | "tetap berkewajiban untuk memberi biaya pemeliharaan kepada anak" | terverifikasi | G, P (pertimbangan dan amar), K |
| Pasal 50 ayat (1) UU 1/1974 | "tidak berada dibawah kekuasaan orang tua, berada dibawah kekuasaan wali" | terverifikasi | V (3810, hanya bila wali pengganti diisi) |
| Pasal 30 ayat (1), (2) UU 23/2002 | "kuasa asuh orang tua dapat dicabut ... melalui penetapan pengadilan" | terverifikasi (uu23-2002.txt; pasal tidak diubah UU 35/2014) | G, P, K |
| Pasal 31 ayat (1), (3) UU 23/2002 | permohonan oleh "salah satu orang tua, saudara kandung, atau keluarga sampai derajat ketiga"; penetapan "dapat menunjuk orang perseorangan atau lembaga ... menjadi wali" | terverifikasi | G (kedudukan hukum), P, V (3810), K |
| Pasal 32 UU 23/2002 | penetapan memuat: "tidak memutuskan hubungan darah", "tidak menghilangkan kewajiban ... membiayai", "batas waktu pencabutan" | terverifikasi | G, P (amar), K |
| Pasal 3, 4, 9 ayat (2), 11, 12 ayat (1) PP 29/2019 | syarat calon wali; "diajukan bersamaan dengan permohonan pencabutan kuasa asuh"; rekomendasi dinas sosial | terverifikasi (pp29-2019.txt) | V (3810, 3813 hanya bila isian terisi), K |
| Pasal 49 huruf a dan penjelasan angka 15 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 | "putusan tentang pencabutan kekuasaan orang tua" | terverifikasi (query.js baris 175-215; angka 15 = pencabutan kekuasaan orang tua) | G, P (kewenangan absolut), K |
| Pasal 89 ayat (1) UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 | biaya perkara bidang perkawinan dibebankan kepada Penggugat/Pemohon | bawaan blangko Derry (6c, 4d), tidak diubah | G, P |
| Pasal 149 ayat (1) RBg | verstek: gugatan dikabulkan "kecuali bila ... tidak mempunyai dasar hukum atau tidak beralasan" | terverifikasi (rbg-unnes.txt) | G ([03b] tolak verstek) |
| Pasal 283 RBg, Pasal 285 RBg, Pasal 171, 172, 175, 307-309 RBg, PERMA 1/2016 | beban bukti, akta otentik, syarat saksi, mediasi | bawaan blangko Derry 6c/4d (HIR/RBg terverifikasi di VERIFIKASI-HIR-RBG.md) | G, P, K |

### Perlu-verifikasi / tanpa nomor pasal
1. Pasal 31 ayat (1) UU 23/2002 menyebut "permohonan"; praktik PA memeriksa pencabutan kuasa asuh baik sebagai gugatan (Pdt.G, Tergugat = orang tua yang dicabut) maupun permohonan (Pdt.P). Blangko menyediakan keduanya; pilihan acara tetap pada nomor perkara.
2. Buku II 2026 dan rumusan SEMA/Kamar tentang pencabutan kuasa asuh TIDAK dikutip (naskah resmi belum ada di arsip).
3. Kompetensi relatif permohonan ditulis tanpa nomor pasal (mengikuti blangko 4d Hibah); pada gugatan memakai Pasal 142 ayat (1) RBg (bawaan 6c).

---

## PASAL-355 - Rujukan hukum baru jenis 355 (Pencabutan Kekuasaan Wali), agen W3b-355, 21 Okt 2026

Naskah yang dibaca ulang untuk daftar ini (D:/aleta-dev/kerja/referensi/_unduhan): uu1-1974/uu1-1974-bpk.txt (Pasal 49-54), khi/khi-pasalid.json (Pasal 107, 109, 110),
ekstra/pp29-2019.txt (Pasal 1-19), ekstra/uu35-2014.txt (Pasal 33), penjelasan Pasal 49 huruf a UU 3/2006 pada aleta_bot/query.js (21 butir; angka 16 dan 17).
Kolom "tercetak" = muncul dalam teks blangko putusan/penetapan (langsung atau lewat variabel 3835/3836/3837/3843/3844/3848/3850); "panel" = hanya katalog saksi.

| No | Rujukan | Kutipan inti (naskah) | Status | Tercetak / panel |
|---|---|---|---|---|
| 1 | Pasal 49 ayat (1) huruf a UU 1/1974 (dirujuk Pasal 53 ayat (1)) | "la sangat melalaikan kewajibannya terhadap anaknya" | terverifikasi (uu1-1974-bpk.txt) | tercetak lewat 3835-3837 (huruf A); panel dh-uu1-74-53-49 |
| 2 | Pasal 49 ayat (1) huruf b UU 1/1974 | "la berkelakuan buruk sekali" | terverifikasi | tercetak lewat 3835-3837 (huruf B); panel |
| 3 | Pasal 49 ayat (1) UU 1/1974, pihak yang meminta | "orang tua yang lain, keluarga anak dalam garis lurus keatas dan saudara kandung" | terverifikasi | tercetak (kedudukan hukum, gugatan dan permohonan) |
| 4 | Pasal 50 ayat (1) dan (2) UU 1/1974 | "berada dibawah kekuasaan wali"; "mengenai pribadi anak ... maupun harta bendanya" | terverifikasi | tercetak (dasar perwalian), 3850; panel |
| 5 | Pasal 51 ayat (2), (3), (5) UU 1/1974 | "berpikiran sehat, adil, jujur dan berkelakuan baik"; "bertanggung-jawab tentang harta benda anak" | terverifikasi | tercetak (3843 syarat wali pengganti, 3850, dasar perwalian) |
| 6 | Pasal 53 ayat (1) dan (2) UU 1/1974 | "Wali dapat dicabut dari kekuasaannya"; "ditunjuk orang lain sebagai wali" | terverifikasi | tercetak (dasar pencabutan, pertimbangan, kewenangan absolut); panel |
| 7 | Pasal 107 ayat (3) KHI | "Pengadilan Agama dapat menunjuk salah seorang kerabat untuk bertindak sebagai wali" | terverifikasi (khi-pasalid.json) | tercetak (pertimbangan hukum, semua putusan kabul/tolak); panel dh-khi-107-3 |
| 8 | Pasal 109 KHI | "pemabok, penjudi, pemboros, gila dan atau melalaikan atau menyalahgunakan hak dan wewenangnya" | terverifikasi | tercetak lewat 3835-3837 (huruf A, C, D) dan kedudukan hukum; panel |
| 9 | Pasal 110 ayat (1), (3), (4) KHI | "dibuktikan dengan pembukuan yang ditutup tiap satu tahun sekali" | terverifikasi | tercetak (dasar perwalian; 3850 bila harta anak diisi); panel |
| 10 | Pasal 17 ayat (1)-(2) huruf a-e PP 29/2019 | "melalaikan kewajiban sebagai Wali"; "tidak cakap melakukan perbuatan hukum"; "menyalahgunakan kewenangan sebagai Wali"; "Orang Tua dianggap telah mampu" | terverifikasi (pp29-2019.txt) | tercetak lewat 3835-3837 (huruf A, G, D, E, F); panel dh-pp29-17-19 |
| 11 | Pasal 18 ayat (1)-(2) PP 29/2019 | "berdasarkan rekomendasi dinas yang menyelenggarakan urusan pemerintahan di bidang sosial" | terverifikasi | tercetak bila huruf F (3835, 3836) |
| 12 | Pasal 12 ayat (1) PP 29/2019 | "menjadi bahan pertimbangan dalam penetapan Wali atau pencabutan kuasa asuh" | terverifikasi | tercetak lewat 3848 (hanya bila rekomendasi diisi); panel dh-pp29-12 |
| 13 | Pasal 19 ayat (1)-(4) PP 29/2019 | "dapat menetapkan pengembalian dan tanggung jawab kuasa asuh kepada Orang Tua" ... "atau dapat menetapkan Wali pengganti" | terverifikasi | tercetak (pertimbangan hukum; kedudukan hukum ayat (2)); 3843, 3844 |
| 14 | Pasal 3-7 PP 29/2019 (syarat wali pengganti) | "beragama sama dengan agama yang dianut Anak" (Pasal 4 ayat (1) huruf f; padanan Pasal 5, 6, 7) | terverifikasi | tercetak lewat 3843 (hanya bila wali pengganti diisi); panel dh-pp29-3-7 |
| 15 | Pasal 33 ayat (1)-(2) UU 23/2002 sebagaimana diubah UU 35/2014 | "dapat ditunjuk sebagai Wali"; "dilakukan melalui penetapan pengadilan" | terverifikasi (uu35-2014.txt) | tercetak (pertimbangan hukum, 3843); panel |
| 16 | Pasal 49 huruf a dan penjelasan angka 16 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 | "pencabutan kekuasaan wali" (angka 16) | terverifikasi (query.js; angka 16, bukan angka 11/12 pada blangko 6c) | tercetak (kewenangan absolut) |
| 17 | Penjelasan Pasal 49 huruf a angka 17 UU 3/2006 | "penunjukan orang lain sebagai wali oleh pengadilan dalam hal kekuasaan seorang wali dicabut" | terverifikasi | tercetak lewat 3843 (hanya bila wali pengganti diisi) |
| 18 | Pasal 50 ayat (1) UU 1/1974 (batas umur 18 tahun) | "belum mencapai umur 18 (delapan belas) tahun atau belum pernah melangsungkan perkawinan" | terverifikasi; KHI Pasal 107 ayat (1) menyebut 21 tahun, blangko memakai 18 tahun sesuai keputusan pengguna 17 Okt | tercetak (fakta hukum) |
| 19 | Pasal 89 ayat (1) UU 7/1989 (biaya perkara bidang perkawinan), Pasal 142 ayat (1), 149 ayat (1), 154, 283 RBg, Pasal 1865/1868/1888 KUH Perdata, PERMA 1/2016 | rujukan bawaan blangko dasar 6c/4d, TIDAK diubah | mengikuti blangko dasar (sudah dipakai Derry) | tercetak |
| 20 | Pasal 169, 171, 172, 306-309 RBg/HIR, Pasal 1905-1912 KUH Perdata | rujukan katalog saksi, salinan dari katalog perwalian.json yang sudah memuat sumbernya | terverifikasi (VERIFIKASI-HIR-RBG.md) | panel |

### Perlu-verifikasi (tafsir atau cakupan, bukan nomor pasal)
1. Penerapan huruf A dan B (UU 1/1974 Pasal 49 ayat (1) huruf a dan b) kepada WALI bertumpu pada Pasal 53 ayat (1) ("dalam hal-hal yang tersebut dalam Pasal 49"); bunyi huruf a dan b menyebut "anaknya", sehingga blangko memakai "terhadap anaknya" apa adanya dalam kutipan norma. Tafsir ini lazim, tetapi bukan bunyi eksplisit Pasal 53.
2. KHI Pasal 109 menyebut "atas permohonan kerabatnya"; naskah tidak menegaskan kerabat siapa. Blangko menulis "kerabat" tanpa menyebut kerabat wali atau anak.
3. Pasal 19 ayat (2) PP 29/2019 memberi hak mengajukan permohonan pencabutan kuasa asuh kepada orang tua atau orang/badan hukum yang akan ditunjuk sebagai wali; kedudukan hukum bagi kerabat selain itu bertumpu pada KHI Pasal 109 dan Pasal 53 jo. Pasal 49 UU 1/1974. Hakim perlu memastikan hubungan Penggugat/Pemohon pada isian 3830.
4. Jangka waktu pencabutan (isian 3839): Pasal 53 tidak menyebut waktu untuk wali (Pasal 49 ayat (1) menyebut "untuk waktu yang tertentu" bagi orang tua). Isian dibuat OPSIONAL; kosong = amar tanpa batas waktu.
5. Pasal 13 PP 29/2019 (Panitera menyampaikan salinan putusan penunjukan wali kepada dinas) tidak dicetak; bila hakim ingin memuatnya dalam amar, ditambahkan manual.
6. Buku II 2026 (ringkasan PTA Pontianak) TIDAK dipakai pada blangko maupun katalog.
7. Ketentuan UU 35/2014 yang mengatur kekerasan terhadap anak (huruf E) tidak dikutip; huruf E bertumpu hanya pada Pasal 17 ayat (2) huruf d PP 29/2019.

---

## Rujukan hukum baru - jenis 356 (penunjukan orang lain sebagai wali oleh pengadilan)

Agen W3b-356, 21 Okt 2026. Semua naskah di D:/aleta-dev/kerja/referensi/_unduhan (BPK, KHI JSON, UU 23/2002, UU 35/2014, PP 29/2019); penjelasan Pasal 49 huruf a di aleta_bot/query.js.
Kolom "Tercetak": P = tercetak di penetapan ([01p] kabul, [03p] tolak, [99p] NO), B = BAS (penjelasan hakim kepada Pemohon), K = katalog saksi (panel Susun saksi, pokok pembuktian), V = kueri variabel ABT 3872-3880.

| Rujukan | Kutipan inti | Status | Tercetak |
|---|---|---|---|
| Pasal 50 ayat (1) UU 1/1974 | "tidak berada dibawah kekuasaan orang tua, berada dibawah kekuasaan wali" | terverifikasi (uu1-1974-bpk.txt) | P, V (3877), K |
| Pasal 50 ayat (2) UU 1/1974 | "mengenai pribadi anak yang bersangkutan maupun harta bendanya" | terverifikasi | P, V (3879), K |
| Pasal 51 ayat (2) UU 1/1974 | "Wali sedapat-dapatnya diambil dari keluarga anak tersebut atau orang lain" | terverifikasi | P, K |
| Pasal 51 ayat (3)-(5) UU 1/1974 | "Wali wajib mengurus anak ... dan harta bendanya sebaik-baiknya" (ayat 3); daftar harta (4); tanggung jawab (5) | terverifikasi | P (pengingat kewajiban wali), V (3879) |
| Pasal 53 ayat (2) UU 1/1974 | "oleh Pengadilan ditunjuk orang lain sebagai wali" | terverifikasi | P (kabul, huruf D), V (3877), K |
| Pasal 107 ayat (1), (2) KHI | "Perwalian hanya terhadap anak yang belum mencapai umur 21 tahun" | terverifikasi (khi-pasalid.json) | P, K |
| Pasal 107 ayat (3) KHI | "Pengadilan Agama dapat menunjuk salah seorang kerabat untuk bertindak sebagai wali" | terverifikasi | P (kabul, huruf E), V (3877), K |
| Pasal 107 ayat (4) KHI | "Wali sedapat-dapatnya diambil dari keluarga anak tersebut atau orang lain" | terverifikasi | P, K |
| Pasal 110 KHI | kewajiban wali mengurus diri dan harta, bertanggung jawab atas harta | terverifikasi | V (3879, hanya bila ada harta atau tindakan hukum) |
| Pasal 26 ayat (2) UU 23/2002 jo. UU 35/2014 | "Dalam hal Orang Tua tidak ada, atau tidak diketahui keberadaannya" | terverifikasi (uu35-2014.txt: Pasal 26 berbunyi sebagaimana diubah) | P, V (3877), K |
| Pasal 33 ayat (1), (2) UU 23/2002 jo. UU 35/2014 | "seseorang atau badan hukum yang memenuhi persyaratan dapat ditunjuk sebagai Wali" | terverifikasi | P, V (3877), K |
| Pasal 33 ayat (3), (4) UU 23/2002 jo. UU 35/2014 | seagama dengan Anak; "wajib mengelola harta milik Anak" | terverifikasi | P, V (3879), K |
| Penjelasan Pasal 33 ayat (2) UU 23/2002 jo. UU 35/2014 | "Pengadilan Agama bagi yang beragama Islam" | terverifikasi (uu23-2002.txt, uu35-2014.txt) | P (kewenangan) |
| Pasal 1 angka 5, 6, 7 PP 29/2019 | Keluarga Anak = "sedarah dalam garis lurus ke atas sampai dengan derajat ketiga"; Saudara = kerabat menyamping; Pengadilan = pengadilan agama bagi yang beragama Islam | terverifikasi (pp29-2019.txt) | P (kewenangan), V (3874) |
| Pasal 2 PP 29/2019 | "melindungi hak dan memenuhi kebutuhan dasar Anak serta mengelola harta Anak" | terverifikasi | P (kabul), K |
| Pasal 3 ayat (1)-(4) PP 29/2019 | urutan Keluarga Anak, Saudara, orang lain, badan hukum | terverifikasi | P, V (3874), K |
| Pasal 4 ayat (1), (2) PP 29/2019 | syarat Keluarga Anak: "berumur paling rendah 30 (tiga puluh) tahun" dst. | terverifikasi | V (3873-3874), K |
| Pasal 5 ayat (1), (2) PP 29/2019 | syarat Saudara: umur paling rendah 21 tahun; persetujuan dari Anak | terverifikasi | V (3873-3874), K |
| Pasal 6 ayat (1), (2) PP 29/2019 | syarat orang lain: umur paling rendah 30 tahun; persetujuan dari Anak | terverifikasi | V (3873-3874), K |
| Pasal 7 ayat (1)-(4) PP 29/2019 | badan hukum: UPT atau lembaga kesejahteraan sosial Anak (yayasan terakreditasi) | terverifikasi | V (3874), K |
| Pasal 9 ayat (1), (4) PP 29/2019 | permohonan oleh calon Wali; dinyatakan Wali "setelah mendapatkan penetapan dari Pengadilan" | terverifikasi | P (legal standing, hukum), K |
| Pasal 9 ayat (2) PP 29/2019 | permohonan diajukan bersamaan dengan permohonan pencabutan kuasa asuh | terverifikasi | tidak dicetak; catatan: bila pencabutan diajukan bersamaan pakai blangko jenis 353 atau 355 |
| Pasal 11, 12 ayat (1), (2) huruf a PP 29/2019 | rekomendasi dinas sosial menjadi bahan pertimbangan; asesmen pekerja sosial profesional | terverifikasi | V (3878, hanya bila isian rekomendasi terisi), K |
| Pasal 13 PP 29/2019 | Panitera "wajib menyampaikan salinan penetapan/putusan" ke dinas dukcapil, dinas sosial, instansi harta peninggalan | terverifikasi | P (pertimbangan dan amar ke-3 kabul) |
| Pasal 14 ayat (1), (2) PP 29/2019 | kewajiban wali; wali wajib mendaftarkan pencatatan penunjukan dan melapor ke dinas sosial | terverifikasi | P (pengingat kewajiban wali) |
| Pasal 16 huruf c PP 29/2019 | Wali berakhir apabila "Wali meninggal dunia" | terverifikasi | V (3877, huruf E) |
| Pasal 19 ayat (1), (4), (5) PP 29/2019 | pada berakhirnya Wali seseorang atau badan hukum dapat ditunjuk; Wali pengganti; berlaku mutatis mutandis | terverifikasi | V (3877, huruf D) |
| Pasal 49 huruf a dan penjelasan angka 17 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 | "penunjukan orang lain sebagai wali oleh pengadilan dalam hal kekuasaan seorang wali dicabut"; "ditinggal kedua orang tuanya" | terverifikasi (query.js baris 175-215; teks penjelasan) | P (kewenangan), V (3877) |
| Pasal 285 RBg jo. Pasal 1870 KUH Perdata; Pasal 172 ayat (1), Pasal 308 dan 309 RBg | nilai alat bukti surat dan syarat saksi | bawaan blangko 4d Hibah [01p], tidak diubah; HIR/RBg terverifikasi di VERIFIKASI-HIR-RBG.md | P |
| Pasal 171, 169, 172 HIR / 308, 306, 309 RBg; Pasal 307-309 RBg jo. 1905-1908 KUH Perdata; Pasal 22 ayat (2) PP 9/1975 | syarat formil dan materiil kesaksian | terverifikasi (dikutip dari katalog perwalian.json yang sudah terverifikasi) | K |

### Perlu-verifikasi / tanpa nomor pasal
1. Kompetensi relatif: blangko menulis "oleh karena Pemohon bertempat kediaman di wilayah hukum <satker>" tanpa nomor pasal (mengikuti bawaan 4d Hibah). Ketentuan khusus tempat pengajuan permohonan penunjukan wali tidak ada di PP 29/2019 (naskah dibaca); kebiasaan peradilan: domisili Pemohon atau anak. Tandai untuk dicek hakim.
2. Amar ke-3 "memerintahkan Panitera ... menyampaikan salinan penetapan" mengikuti Pasal 13 PP 29/2019; bentuk amar (bukan diktum pokok) adalah praktik yang diminta sesi, bukan ketentuan pasal. Hapus butir bila hakim tidak menghendakinya.
3. Rumusan Buku II 2026 tentang penunjukan wali TIDAK dikutip (belum ada naskah resmi); tidak ada rujukan SEMA/Kamar baru yang dipakai.
4. Pasal 33 ayat (1) UU 23/2002 versi asli (orang tua "tidak cakap melakukan perbuatan hukum") TIDAK dikutip; hanya versi UU 35/2014.
5. Batas umur anak: blangko menulis 18 tahun (Pasal 50 UU 1/1974, Pasal 1 angka 3 PP 29/2019) dan KHI Pasal 107 ayat (1) 21 tahun berdampingan; keputusan satker menentukan mana yang menjadi pokok (catatan petugas di katalog).

---

## Rujukan hukum baru - jenis 357 GANTI RUGI TERHADAP WALI (agen W3b-357, 21 Okt 2026)

Berkas yang memuat: `sumber/spek_357.py` (putusan gugatan), `sumber/variabel_357.py` (variabel 3890-3919), `ekstensi-sipp/saksi-katalog/ganti-rugi-wali.json` (panel).
Semua bunyi pasal DIBACA dari naskah di `D:/aleta-dev/kerja/referensi/_unduhan/` (bukan dari ingatan). Tidak ada pasal KUHPerdata yang saya kutip (pasal KUHPerdata
yang tampak di putusan adalah paragraf bawaan berkas dasar 6c Nafkah Anak, bukan tambahan jenis ini). Tidak ada rujukan berstatus perlu-verifikasi untuk nomor pasalnya;
dua catatan kehati-hatian ada di bagian akhir.

| No | Rujukan | Kutipan inti (naskah) | Status | Tempat |
|---|---|---|---|---|
| 1 | Pasal 50 ayat (1)-(2) UU 1/1974 | "berada dibawah kekuasaan wali" ; perwalian "pribadi anak ... maupun harta bendanya" | terverifikasi: `uu1-1974/uu1-1974-bpk.txt` | tercetak (hukum inti, putusan kabul/tolak); katalog `dh-uu1-p50-51` |
| 2 | Pasal 51 ayat (3), (4), (5) UU 1/1974 | "bertanggung-jawab tentang harta benda anak" | terverifikasi: naskah BPK sama | tercetak (hukum inti; pertimbangan kabul; 3918); katalog |
| 3 | Pasal 48 jo. Pasal 52 UU 1/1974 | "tidak diperbolehkan memindahkan hak atau menggadaikan barang-barang tetap" ; Pasal 52 "berlaku juga Pasal 48" | terverifikasi: naskah BPK sama | tercetak (hukum inti 2); katalog `dh-uu1-p48-52` |
| 4 | Pasal 54 UU 1/1974 | "dapat diwajibkan untuk mengganti kerugian tersebut" (atas tuntutan anak atau keluarga anak) | terverifikasi: naskah BPK sama | tercetak (kewenangan, kedudukan hukum, hukum inti, unsur, putusan tolak); katalog `dh-uu1-p54` |
| 5 | Pasal 110 ayat (1)-(4) KHI | "mengganti kerugian yang timbul sebagai akibat kesalahan atau kelalaiannya" | terverifikasi: `khi/khi-pasalid.json` kunci 110 | tercetak (hukum inti 2; pertimbangan kabul 1-2; 3918); katalog `dh-khi-110` |
| 6 | Pasal 111 ayat (1)-(2) KHI | "Pengadilan Agama berwenang mengadili perselisihan antara wali" (setelah perwalian berakhir) | terverifikasi: khi-pasalid.json kunci 111 | tercetak (hukum inti 4); katalog `dh-khi-111-112` |
| 7 | Pasal 112 KHI | "sepanjang diperlukan untuk kepentingannya menurut kepatutan" | terverifikasi: khi-pasalid.json kunci 112 | tercetak (hukum inti 4) |
| 8 | Pasal 107 ayat (1)-(2) KHI | "hanya terhadap anak yang belum mencapai umur 21 tahun" | terverifikasi: khi-pasalid.json kunci 107 | hanya panel (katalog `dh-khi-107`); tidak tercetak |
| 9 | Pasal 33 ayat (4) UU 23/2002 sebagaimana diubah UU 35/2014 | "wajib mengelola harta milik Anak yang bersangkutan" | terverifikasi: `ekstra/uu35-2014.txt` (butir 18, Pasal 33 ayat (4)) | tercetak (hukum inti 3; 3904 bila pengembalian harta); katalog `dh-uu35-2014-33` |
| 10 | Pasal 14 ayat (1) huruf d PP 29/2019 | "mengelola harta milik Anak untuk keperluan Anak" | terverifikasi: `ekstra/pp29-2019.txt` Pasal 14 | tercetak (hukum inti 3); katalog `dh-pp29-2019-14` |
| 11 | Pasal 49 huruf a dan penjelasan angka 18 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 | "pembebanan kewajiban ganti kerugian atas harta benda anak" | terverifikasi dengan teks penjelasan di `aleta_bot/query.js` baris ~175-215 (butir 18; sumber yang ditunjuk panduan W3b) | tercetak (kewenangan absolut, semua putusan); katalog `dh-penjelasan-49-18` |
| 12 | Pasal 283 RBg | "harus membuktikan hak atau keadaan itu" | terverifikasi: `hir-rbg-bw/rbg-unnes.txt` | tercetak (putusan tolak: beban bukti Penggugat; juga paragraf beban pembuktian bawaan); katalog `dh-rbg-283` |
| 13 | Pasal 149 ayat (1) RBg | "gugatannya tidak mempunyai dasar hukum atau tidak beralasan" (pengecualian verstek) | terverifikasi: `hir-rbg-bw/rbg-unnes.txt` Pasal 149 ayat (1), dibaca 21 Okt 2026 | tercetak (putusan tolak verstek, kalimat akhir, pola jenis 353) |

Rujukan KATALOG saja yang disalin dari `nafkah-anak.json` (`dh-sebab-pengetahuan`, `dh-de-auditu`, `dh-unus-testis`, `dh-larangan-saksi`, `dh-kesesuaian-saksi`: Buku II 2013 dan
Pasal 172, 308, 309 RBg) berstatus terverifikasi di berkas asalnya; tidak saya baca ulang naskahnya (tidak ada penambahan nomor pasal baru).

### Catatan kehati-hatian (bukan nomor pasal yang meragukan)
1. Batas umur anak: UU 1/1974 Pasal 47 dan 50 memakai 18 tahun, KHI Pasal 107 ayat (1) dan Pasal 111 ayat (1) memakai 21 tahun. Putusan mencetak keduanya apa adanya
   (Pasal 50 UU 1/1974 untuk perwalian; Pasal 111 KHI untuk penyerahan harta); hakim yang memutuskan mana yang dipakai bila umur anak berada di antaranya.
2. Penjelasan Pasal 49 huruf a angka 18 dibaca dari salinan teks di kode bot, bukan dari naskah PDF resmi UU 3/2006. Angka (18) cocok dengan panduan W3b
   ("18 = ganti kerugian atas harta anak"); disarankan dicocokkan sekali dengan naskah resmi bila ada.
3. Kalimat putusan "tidak ternyata dilakukan demi kepentingan anak dan tidak pula merupakan keadaan yang tidak dapat dihindarkan" (pertimbangan kabul 2) memakai dua
   pengecualian Pasal 110 ayat (2) KHI ("menguntungkan bagi orang yang berada di bawah perwaliannya atau merupakan suatu kenyataan yang tidak dapat dihindarkan");
   untuk kasus kelalaian murni (tanpa pengalihan harta) hakim dapat mengubah kalimat itu.

---

## Rujukan hukum jenis 350 - Nafkah Anak oleh Ibu karena Ayah Tidak Mampu (agen W3b-350)

Naskah: `D:/aleta-dev/kerja/referensi/_unduhan/` (BPK = uu1-1974/uu1-1974-bpk.txt; KHI = khi/khi-pasalid.json dan khi/khi.txt; ekstra/uu23-2002.txt, ekstra/uu35-2014.txt; sema/k.txt; query.js bot).
"Tercetak" = muncul di RTF putusan; "panel" = hanya di nama/keterangan variabel.

| Rujukan | Kutipan inti | Status | Tercetak / panel |
| :--- | :--- | :--- | :--- |
| Pasal 41 huruf b UU 1/1974 | "bilamana bapak dalam kenyataan tidak dapat memenuhi kewajiban tersebut" ... "ibu ikut memikul biaya tersebut" | terverifikasi (naskah BPK, dibaca utuh) | tercetak: kewenangan, kedudukan hukum, hukum inti, pertimbangan, pembagian |
| Pasal 45 ayat (1)-(2) UU 1/1974 | "Kedua orang tua wajib memelihara dan mendidik anak-anak mereka sebaik-baiknya" | terverifikasi (BPK) | tercetak: hukum inti; pertimbangan/amar tidak menghilangkan kewajiban ayah |
| Pasal 105 huruf c KHI | "biaya pemeliharaan ditanggung oleh ayahnya" | terverifikasi (khi-pasalid.json) | tercetak: hukum inti |
| Pasal 156 huruf d KHI | "menjadi tanggungan ayah menurut kemampuannya" ... "(21 tahun)" | terverifikasi (khi.txt hasil OCR dibaca ulang; bunyi sama dengan blangko 6c) | tercetak: hukum inti, pertimbangan bagian ayah |
| Pasal 156 huruf e dan f KHI | "mengingat kemampuan ayahnya menetapkan jumlah biaya" ... "anak-anak yang tidak turut padanya" | terverifikasi (OCR dibaca ulang; sama dengan 6c) | tercetak: hukum inti, kedudukan hukum (huruf d dan f) |
| Pasal 98 ayat (3) KHI | "menunjuk salah seorang kerabat terdekat yang mampu" ... "kedua orang tuanya tidak mampu" | terverifikasi (khi-pasalid.json) | tercetak: hukum inti (dibedakan: baru berlaku bila kedua orang tua tidak mampu) |
| Pasal 26 ayat (1) huruf a dan ayat (2) UU 23/2002 jo. UU 35/2014 | "mengasuh, memelihara, mendidik, dan melindungi anak"; "beralih kepada keluarga" | terverifikasi (uu35-2014.txt, bentuk Pasal 26 sesudah perubahan) | tercetak: hukum inti, pertimbangan kepentingan terbaik anak |
| Pasal 49 huruf a + Penjelasan angka 12 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 | "ibu dapat memikul biaya pemeliharaan dan pendidikan anak" | terverifikasi (query.js baris 175-215; angka 12, bukan 11 seperti blangko 6c lama) | tercetak: kewenangan absolut (lengkap dan ringkas) |
| SEMA 3/2018 (Rumusan Kamar Agama, Hukum Keluarga huruf b) | "menggali fakta kemampuan ekonomi suami dan fakta kebutuhan dasar hidup isteri dan/atau anak" | terverifikasi (sema/k.txt); sama dengan yang sudah dicetak blangko 6c (variabel 9751/9757) | tercetak: variabel 3934 |
| SEMA 3/2015 (Rumusan Kamar Agama angka 14) | "penambahan 10% sampai dengan 20% per tahun dari jumlah yang ditetapkan" | terverifikasi (sema/k.txt). Kutipan asli berlanjut "di luar biaya pendidikan dan kesehatan"; blangko ini TIDAK mengutip bagian itu karena kebutuhan yang ditetapkan sudah mencakup pendidikan | tercetak: variabel 3934, hanya bila isian 3931 terisi dan bagian ayah > 0 |
| Buku II Tahun 2026 ("standar biaya hidup minimal setempat") | kalimat penghubung dasar kebutuhan | PERLU-VERIFIKASI: diambil dari teks blangko 6c (variabel 9753), belum dibandingkan dengan naskah Buku II | tercetak: variabel 3934, hanya bila isian 3932 terisi |
| Pasal 283 RBg (beban bukti); Pasal 149 ayat (1) RBg (verstek) | - | terverifikasi (panduan W3b; rbg-unnes.txt) | tercetak: inti tolak |
| Pasal 154 RBg, PERMA 1/2016 (perdamaian) | - | tidak baru: teks tetap blangko 6c [97] | tercetak (berkas [97]) |

Tidak ada nomor pasal atau putusan yang dikarang. Satu-satunya rujukan "perlu-verifikasi": Buku II Tahun 2026 (di atas).

### Keputusan rancangan (untuk tinjauan hakim)
1. Hakim yang memutuskan: huruf alasan ayah tidak mampu (3920), kebutuhan biaya per bulan (3923), bagian ayah (3924), kenaikan (3931). Bagian ibu = kebutuhan dikurangi bagian ayah (selisih, dihitung mesin; tidak ditebak). Isian yang bukan angka murni dianggap kosong dan tercetak titik-titik.
2. Terbilang tidak memakai variabel bertipe `terbilang`: penanda `#nnnn#` di dalam teks kueri diganti ABT dengan nilai mentah (angka) sebelum kueri jalan, sehingga terbilang di dalam kalimat bersyarat akan tercetak sebagai angka. Terbilang dihitung di dalam kueri (0 s.d. 999.999.999), diuji 30 bilangan terhadap pembanding Python.
3. Bagian ayah boleh nol: amar tetap memuat ketetapan ayah tidak mampu dan ibu memikul seluruh biaya, dengan penegasan kewajiban ayah tidak hilang (Pasal 45 ayat (2) UU 1/1974).
4. Tanpa sita jaminan (sita=False): dalil pokok jenis ini ialah ayah dalam kenyataan tidak mampu; bila ada harta yang perlu disita, perkaranya jenis 743 (nafkah anak pasca perceraian).
5. Tidak memuat nafkah lampau (madliyah), pemotongan penghasilan, maupun biaya pendidikan/kesehatan terpisah: tidak termasuk pokok jenis ini; kebutuhan anak ditetapkan sekaligus (pemeliharaan dan pendidikan).

---

## PASAL-eksekusi: rujukan hukum blangko EKSEKUSI (agen W3b, 21 Okt 2026)

Status blangko: **belum pernah dipakai** di ABT (folder "96 Eksekusi" dan "96 Eksekusi - BAS" baru; menu 250 dan 251; ALUR BAS 65; variabel 3940-3969).
Naskah RBg yang dibaca: `D:/aleta-dev/kerja/referensi/_unduhan/hir-rbg-bw/rbg-unnes.txt` (JDIH UNNES; salah ketik OCR kecil, nomor pasal dan isi terbaca jelas).
Pasal berstatus terverifikasi = bunyi dibaca langsung dari naskah itu. Kutipan di bawah tidak lebih dari 15 kata.

| Rujukan | Kutipan inti | Status | Tercetak di |
| :--- | :--- | :--- | :--- |
| Pasal 206 ayat (1) RBg | "dilakukan atas perintah dan di bawah pimpinan ketua" | terverifikasi (naskah baris 777-) | semua penetapan [01]-[06], [97], [98] (Menimbang dan Mengingat) |
| Pasal 207 ayat (1) RBg | "keengganan atau kealpaan pihak yang kalah untuk melaksanakan putusan secara sukarela" | terverifikasi | [01], [97], [98], BAS teguran (isi permohonan) |
| Pasal 207 ayat (2) RBg | "tidak melebihi delapan hari" (Ketua memanggil dan memperingatkan pihak yang kalah) | terverifikasi | [01]; variabel 3963 (bawaan 8 hari, isian bila Ketua menetapkan lebih singkat) |
| Pasal 208 RBg | "putusan hakim tidak dilaksanakan atau pihak yang kalah tidak datang menghadap setelah dipanggil" | terverifikasi; uraian dasar "untuk menyita" diperluas dari "membayar jumlah uang" menjadi "pelaksanaan putusan" (lihat catatan 1) | [02]; BAS [1], [1a], [1b] |
| Pasal 209 ayat (1)-(4) RBg | "penyitaan dilakukan oleh panitera pengadilan negeri"; pengganti ditunjuk Ketua cukup dalam perintah tertulis; berita acara dan penjelasan maksud | terverifikasi | [02]; BAS [2] |
| Pasal 210 ayat (1) RBg | "dibantu oleh dua orang saksi" yang nama, pekerjaan, tempat tinggalnya disebut dalam berita acara | terverifikasi (ayat (2) tentang umur 21 tahun TIDAK dicetak) | [02]; BAS [2] |
| Pasal 213 ayat (1)-(2) RBg | "berita penyitaan diumumkan kepada khalayak ramai" (barang tetap; kepala desa memaklumkan) | terverifikasi | [02]; BAS [2] |
| Pasal 214 ayat (1) RBg | "tidak diperbolehkan untuk memindahtangankan, membebani dengan suatu hak, atau menyewakan" | terverifikasi | [02]; BAS [2] |
| Pasal 215 ayat (1) RBg | "dilakukan dengan perantaraan kantor lelang" (atau orang cakap atas pertimbangan Ketua; penawar tertinggi) | terverifikasi | [04]; BAS [5] |
| Pasal 216 ayat (1)-(2) RBg | urutan barang yang didahulukan; "sisa barang-barangnya dikembalikan kepada pemiliknya" | terverifikasi | [04] |
| Pasal 217 ayat (1) RBg | "tidak boleh dilakukan sebelum lewat delapan hari setelah dilakukan penyitaan" (barang bergerak) | terverifikasi (ayat (2)-(4) tidak dicetak) | [04] |
| Pasal 218 ayat (2) RBg | "bila perlu dengan bantuan polisi" (pengosongan oleh yang membangkang beserta keluarganya) | bunyi terverifikasi; **penerapan pada eksekusi riil di luar barang yang dilelang adalah penilaian hukum: perlu-verifikasi** (catatan 2) | [03] (Menimbang dan Mengingat) |
| Pasal 54 UU 7/1989 jo. UU 3/2006 jo. UU 50/2009 | hukum acara perdata peradilan umum berlaku pada peradilan agama (parafrasa, tanpa kutipan) | **perlu-verifikasi**: bunyi UU 7/1989 asli tidak ada di folder referensi; UU 3/2006 (`ekstra/uu3-2006.txt`) tidak mengubah pasal ini | semua penetapan (Mengingat); tidak mengutip Pasal 103 UU 7/1989 |

### Rujukan yang SENGAJA tidak dicetak
- Pasal 259 RBg (hukuman melakukan perbuatan, dinilai dalam uang): terverifikasi bunyinya, tetapi tidak dipakai blangko mana pun; hanya cocok bila amar menghukum suatu perbuatan, bahan panel.
- Pasal 219-222 RBg (dua permohonan eksekusi terhadap satu debitur): tidak dipakai.
- Pasal 103 UU 7/1989 (tugas jurusita): bunyi tidak dibaca, tidak dikutip.

### Catatan penilaian hukum (untuk hakim/Ketua)
1. Pasal 208 RBg dalam naskah mengatur penyitaan untuk "membayar jumlah uang sebagai pelaksanaan putusan". Blangko [02] memakai rumusan "untuk pelaksanaan putusan" agar dapat dipakai juga pada objek sengketa kewarisan yang dijual lelang (perkara nyata 6326, 6952). Bila Ketua ingin rumusan naskah persis, ubah Menimbang kedua [02].
2. Pasal 218 ayat (2) RBg secara tertulis mengatur penyerahan barang yang SUDAH dilelang. [03] memakainya "sebagai pedoman" untuk pengosongan/penyerahan riil. Rumusan "bila perlu dengan bantuan polisi atau alat negara lain yang berwenang" mengikuti arahan tugas (alat negara).
3. Tanpa landasan pasal RBg (istilah dan praktik): aanmaning ([01], BAS [1]-[1b]) berlandaskan Pasal 207; **konstatering** ([06], BAS [3]) dan **non-eksekutabel** ([05]) hanya dikaitkan dengan kewenangan Ketua memimpin eksekusi (Pasal 206 ayat (1)), tanpa pasal khusus; **pencabutan permohonan eksekusi** ([98]) memakai Pasal 207 ayat (1) (eksekusi berjalan atas permohonan yang menang) tanpa pasal khusus; **dua saksi** pada konstatering dan eksekusi riil adalah perintah Ketua (kebiasaan), bukan kewajiban RBg (kewajiban dua saksi RBg hanya pada penyitaan, Pasal 210). Semua ini ditandai perlu-verifikasi terhadap Buku II/pedoman pelaksanaan eksekusi.
4. Penyebutan "Kantor Pelayanan Kekayaan Negara dan Lelang" pada [04] adalah nama instansi lelang saat ini, bukan kutipan RBg (Pasal 215 hanya menyebut "kantor lelang").
5. Satker memakai modul eksekusi SIPP (tabel perkara_eksekusi, perkara_eksekusi_detil); blangko membaca baris eksekusi TERBARU per perkara asal. Bila perkara punya lebih dari satu eksekusi, yang tercetak adalah yang terakhir diinput.

### Isi paket (16 berkas, 30 variabel)
Folder "96 Eksekusi" (penetapan Ketua): [01] teguran/aanmaning, [02] sita eksekusi, [03] perintah eksekusi riil, [04] perintah penjualan lelang, [05] non-eksekutabel, [06] konstatering, [97] dilaksanakan sukarela, [98] pencabutan permohonan eksekusi.
Folder "96 Eksekusi - BAS": [1] teguran Termohon hadir, [1a] tidak hadir setelah dipanggil patut, [1b] bersedia melaksanakan sukarela, [2] sita eksekusi (dua saksi), [3] konstatering, [4] eksekusi riil berhasil, [4a] tidak berhasil atau ditunda, [5] penyerahan hasil lelang.
Variabel 3940-3969: 21 otomatis dari SIPP (data_sql) dan 9 isian (3947 penandatangan, 3948 tanggal penetapan, 3962 jam, 3963 jangka waktu teguran, 3964 objek, 3965 saksi, 3967 uraian hasil, 3968 alasan, 3969 pernyataan Termohon). Uji: `python spek/uji_eksekusi.py`.

---

## PASAL-verzet - rujukan hukum VERZET (perlawanan atas putusan verstek), agen W3b-VERZET, 21 Okt 2026

Status jenis: **baru; dipakai 1 perkara (9321)** - satu-satunya baris `SIPP.perkara_verzet` di server (715/Pdt.G/2025/PA.Dgl, putusan verstek 24 Des 2025, pemberitahuan 30 Des 2025,
perlawanan didaftarkan 13 Jan 2026 = hari ke-14, sidang pertama 27 Jan 2026 tidak dihadiri kedua pihak, digugurkan 10 Feb 2026, status verzet 93 Gugur). Nilai status lain
(`SIPP.status_putusan` jenis_pengadilan 4, jenis_perkara 1): 62 Dikabulkan, 63 Ditolak, 64 Tidak Dapat Diterima, 65 Digugurkan, 66 Dicoret, 67 Dicabut, 85 Perdamaian, 92 Dismissal, 93 Gugur.

Naskah acuan: `D:/aleta-dev/kerja/referensi/_unduhan/hir-rbg-bw/rbg-unnes.txt` (RBg, bunyi dibaca langsung) dan `hir-pn-bengkalis.txt` (HIR, pembanding Pasal 125-129).
Catatan naskah: ayat (3) Pasal 149 RBg pada naskah UNNES menyebut tenggang "pasal 163" - itu salah ketik/OCR (maksudnya Pasal 153); rujukan silang itu TIDAK dicetak.

| # | Rujukan | Kutipan inti | Status | Tercetak / panel |
|---|---|---|---|---|
| 1 | Pasal 148 RBg | "gugatannya dinyatakan gugur dan penggugat dihukum untuk membayar biayanya" | terverifikasi (rbg-unnes.txt) | tercetak [98a] Gugur (Pelawan diperlakukan sebagai penggugat karena Pasal 153 ayat (4)) |
| 2 | Pasal 149 ayat (3) RBg | "diingatkan tentang haknya untuk mengajukan perlawanan" kepada pengadilan yang sama | terverifikasi | tercetak [01] [02] [99] (kewenangan mengadili) |
| 3 | Pasal 153 ayat (1) RBg | "dapat mengajukan perlawanan" bagi tergugat yang diputus tanpa kehadirannya | terverifikasi | tercetak kedudukan hukum [01] [02] [99]; syarat formil [99a] |
| 4 | Pasal 153 ayat (2) RBg | 14 hari setelah pemberitahuan kepada yang dikalahkan sendiri; selain itu hari kedelapan setelah teguran Pasal 207 / perintah Pasal 208 | terverifikasi | tercetak lewat variabel 3976 (kueri menghitung hari dari SIPP) dan [99] |
| 5 | Pasal 153 ayat (3) RBg | pengadilan "berwenang ... memperpanjang" tenggang menurut keadaan | terverifikasi | tercetak variabel 3976 pilihan C, [99] |
| 6 | Pasal 153 ayat (4) RBg | perlawanan "diperiksa dengan cara yang biasa" untuk gugatan perdata | terverifikasi | tercetak [01] [02] [98a] [99] |
| 7 | Pasal 153 ayat (5) RBg | pengajuan perlawanan "mencegah pelaksanaan" kecuali ditentukan lain | terverifikasi | tercetak [02] [98a] (alasan menunda pelaksanaan berakhir) |
| 8 | Pasal 153 ayat (6) RBg | pelawan diputus lagi tanpa kehadiran lalu melawan lagi: "tidak dapat diterima" | terverifikasi | tercetak [99b] |
| 9 | Pasal 154 ayat (1) RBg | ketua "berusaha mendamaikan" bila para pihak datang | terverifikasi | tercetak duduk perkara dan pertimbangan [01] [02] [99*] dan BAS |
| 10 | Pasal 192 ayat (1) RBg | "Barangsiapa dikalahkan dalam perkaranya, dihukum untuk membayar biaya perkara" | terverifikasi | tercetak biaya [01] [02] [99*] |
| 11 | Pasal 192 ayat (4) RBg | biaya yang diputus tanpa hadir tergugat tetap tanggungan tergugat kecuali tidak dipanggil patut | terverifikasi | tercetak biaya [01] [02] (penjelasan; amar biaya verstek tahap awal diserahkan ke isian 3989 / pilihan hakim) |
| 12 | Pasal 207 RBg, Pasal 208 RBg | teguran (peringatan, paling lama delapan hari) dan perintah tertulis sita | terverifikasi | tercetak variabel 3976 pilihan B |
| 13 | Pasal 283 RBg | "harus membuktikan hak atau keadaan itu" | terverifikasi | tercetak [01] [02] (sudah ada pada blangko Derry + paragraf baru pembagian beban Pelawan/Terlawan) |
| 14 | Pasal 55, 103 ayat (1)-(2) UU 7/1989 jo. UU 3/2006 jo. UU 50/2009; Pasal 145, 146 RBg | pemanggilan | paragraf blangko Derry dipakai ulang tanpa diubah (Pasal 145 dan 146 RBg terbaca di naskah; UU 7/1989 asli tidak ada di folder referensi) | tercetak [01] [02] [99*] |
| 15 | Pasal 171, 172, 175, 307, 308 RBg; Pasal 1868, 1888 KUHPerdata; Pasal 3, 5, 28 UU 10/2020 | syarat bukti | paragraf blangko Derry dipakai ulang tanpa diubah | tercetak [01] [02] |
| 16 | Pasal 271 Rv | pencabutan gugatan sebelum jawaban tanpa persetujuan; sesudah jawaban perlu persetujuan | **perlu-verifikasi**: kalimat 6c [98]/[98b] dipakai ulang, naskah Rv tidak ada di folder referensi; penerapan pada perlawanan adalah analogi karena perlawanan diperiksa sebagai gugatan biasa (Pasal 153 ayat (4)) | tercetak [98] [98b], BAS [8] [9] [9a] |

### Pernyataan tanpa pasal (praktik/doktrin) - perlu-verifikasi oleh hakim
RBg Pasal 149-153 tidak merumuskan bunyi amar bila perlawanan dikabulkan atau ditolak. Rumusan berikut adalah praktik peradilan dan TIDAK diberi nomor pasal:
- "Menyatakan Pelawan adalah Pelawan yang benar" / "Pelawan yang tidak benar".
- "Membatalkan putusan verstek ..." (kabul) dan "Menguatkan putusan verstek ..." (tolak); sesudah dibatalkan pokok perkara diadili kembali (hasil dipilih hakim: ditolak / tidak dapat diterima / amar bebas).
- "Memerintahkan agar putusan verstek ... tetap dijalankan" pada gugur / NO / cabut (mengikuti amar nyata perkara 9321 di SIPP: "Memerintahkan agar Putusan ... tetap dijalankan").
- Perlawanan dicabut = PENETAPAN; gugur / NO / kabul / tolak = PUTUSAN.
- Beban biaya perlawanan: kabul dibebankan kepada Terlawan, tolak / gugur / NO / cabut kepada Pelawan (Pasal 192 ayat (1) RBg). Pasal 89 ayat (1) UU 7/1989 (biaya perkara perkawinan dibebankan kepada Penggugat/Pemohon) TIDAK dipakai pada verzet; contoh nyata 9321 (gugur) membebankan Pelawan 140.000 - bila hakim menghendaki Pasal 89 pada verzet perkara perkawinan, ubah teks biaya.

### Batas dan keputusan hakim (bukan mesin)
- Cara pemberitahuan putusan verstek (A diterima sendiri / B tidak sendiri / C diperpanjang) = PILIHAN hakim (isian 3977); SIPP hanya menyimpan tanggal pemberitahuan (`tanggal_pemberitahuan_putusan`) dan sandi cara panggil (`ket_ketemu`: S = surat tercatat dst.), tidak menyatakan "diterima sendiri".
- Hasil pokok perkara sesudah verstek dibatalkan (huruf A/B/C) dan besar biaya perlawanan = isian hakim; dalil, petitum, jawaban, bukti, pertimbangan, fakta hukum = isian.
- Mediasi (PERMA 1/2016) TIDAK dicetak pada verzet: naskah PERMA tidak ada di folder referensi dan SIPP tidak membedakan mediasi verzet. Hanya upaya damai Pasal 154 ayat (1) RBg.

### Variabel baru (3970-3999) dan sumber data
| No | Isi | Sumber |
|---|---|---|
| 3970, 3971 | identitas Pelawan (dari #7048#) dan Terlawan (dari #7047# + #8710#), sebutan akhir "Pelawan/Terlawan semula ..." | variabel lama (REPLACE) |
| 3972 | nomor dan tanggal putusan verstek | perkara.nomor_perkara, perkara_putusan.tanggal_putusan |
| 3973, 3974 | tanggal surat dan tanggal pendaftaran perlawanan | perkara_verzet |
| 3975 | tanggal pemberitahuan putusan verstek kepada Tergugat/Termohon | perkara_putusan_pemberitahuan_putusan (pihak 2) |
| 3976 | kalimat tenggang waktu (A/B/C, dalam/lewat) | 3975, 3974, isian 3977-3979 |
| 3977-3979 | isian: pilihan cara pemberitahuan, tanggal teguran/perintah, tenggang diperpanjang | hakim |
| 3980-3984 | isian: dalil, petitum, jawaban, bukti surat Pelawan, bukti surat Terlawan | panitera/hakim |
| 3985, 3986, 3999 | isian: pertimbangan utama, sebab NO, fakta hukum | hakim |
| 3987-3990 | isian pilihan A/B/C + pertimbangan + amar bebas; 3990 amar pokok otomatis | hakim, mesin menyusun kalimat |
| 3991-3994 | biaya perlawanan: isian, angka murni, bertitik, terbilang | hakim/kasir |
| 3995-3997 | kaki putusan, nama majelis dan kehadiran, blok tanda tangan MAJELIS VERZET | perkara_hakim_pn, perkara_panitera_pn (tahapan 16), perkara_jadwal_sidang (verzet = Y) |
| 3998 | amar putusan verzet (untuk BAS pembacaan putusan) | perkara_verzet.amar_putusan_verzet |

Keterbatasan data yang tercatat:
1. Saksi: ABT menyimpan saksi menurut sisi perkara asal. Pada blangko verzet saksi PELAWAN memakai variabel sisi T (6100-6111, 6120-6122, 9264-9265) dan saksi TERLAWAN memakai sisi P (1197-1208, 5058-5060, 9259-9260). Bila perkara asal sudah memuat saksi sisi P dari sidang awal, isian itu ikut terbaca sebagai saksi Terlawan.
2. Majelis: variabel lama (#8550#-#8556#, #8500#-#8502#, #4004#, #0690#) memilih majelis menurut tanggal putusan perkara asal, sehingga majelis verzet (tahapan 16) tidak terbaca; putusan verzet memakai 3995-3997. #4004#/#0690# pada BAS tetap memakai majelis aktif (cukup untuk sebutan Ketua/Hakim).
3. Rincian biaya "Pendaftaran/Proses/Panggilan..." perkara asal tidak dicetak pada putusan verzet; diganti satu baris jumlah biaya perlawanan (3993-3994).
4. Tanggal sidang pada kaki (#0032#, #0033#, #8184#) dan jadwal tunda (#0133#, #0134#, #9400#) tetap variabel lama (mengikuti sidang yang dipilih di ABT).
5. Identitas 3970/3971 memakai tanda kutip ganda di dalam kueri (seperti 7047/7048); nama pihak yang memuat tanda kutip ganda dapat memutus kueri (kasus yang sama sudah ada pada 7048).
6. BAS dasar Derry ALUR 04 [7]/[7a] salah menulis peran penggugat pada kalimat pembuktian tergugat ("#7085# mengatakan telah siap", "saksi kedua/ketiga #7085#") dan "ajkan"; BAS verzet [4]/[4a] sudah dibetulkan (modul bersama tidak diubah).

### Hasil uji (spek/uji_verzet.py, perkara 9321)
67 uji lolos, 0 gagal: 8 putusan + 15 BAS terbangun; penanda dikenal; kueri 3970-3998 jalan atas 9321 (isian disimulasikan: tenggang A, B dalam, B lewat, B tanggal salah, C dalam, C lewat; pilihan pokok A, B, C; biaya).
