# PASAL-verzet - rujukan hukum VERZET (perlawanan atas putusan verstek), agen W3b-VERZET, 21 Okt 2026

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

## Pernyataan tanpa pasal (praktik/doktrin) - perlu-verifikasi oleh hakim
RBg Pasal 149-153 tidak merumuskan bunyi amar bila perlawanan dikabulkan atau ditolak. Rumusan berikut adalah praktik peradilan dan TIDAK diberi nomor pasal:
- "Menyatakan Pelawan adalah Pelawan yang benar" / "Pelawan yang tidak benar".
- "Membatalkan putusan verstek ..." (kabul) dan "Menguatkan putusan verstek ..." (tolak); sesudah dibatalkan pokok perkara diadili kembali (hasil dipilih hakim: ditolak / tidak dapat diterima / amar bebas).
- "Memerintahkan agar putusan verstek ... tetap dijalankan" pada gugur / NO / cabut (mengikuti amar nyata perkara 9321 di SIPP: "Memerintahkan agar Putusan ... tetap dijalankan").
- Perlawanan dicabut = PENETAPAN; gugur / NO / kabul / tolak = PUTUSAN.
- Beban biaya perlawanan: kabul dibebankan kepada Terlawan, tolak / gugur / NO / cabut kepada Pelawan (Pasal 192 ayat (1) RBg). Pasal 89 ayat (1) UU 7/1989 (biaya perkara perkawinan dibebankan kepada Penggugat/Pemohon) TIDAK dipakai pada verzet; contoh nyata 9321 (gugur) membebankan Pelawan 140.000 - bila hakim menghendaki Pasal 89 pada verzet perkara perkawinan, ubah teks biaya.

## Batas dan keputusan hakim (bukan mesin)
- Cara pemberitahuan putusan verstek (A diterima sendiri / B tidak sendiri / C diperpanjang) = PILIHAN hakim (isian 3977); SIPP hanya menyimpan tanggal pemberitahuan (`tanggal_pemberitahuan_putusan`) dan sandi cara panggil (`ket_ketemu`: S = surat tercatat dst.), tidak menyatakan "diterima sendiri".
- Hasil pokok perkara sesudah verstek dibatalkan (huruf A/B/C) dan besar biaya perlawanan = isian hakim; dalil, petitum, jawaban, bukti, pertimbangan, fakta hukum = isian.
- Mediasi (PERMA 1/2016) TIDAK dicetak pada verzet: naskah PERMA tidak ada di folder referensi dan SIPP tidak membedakan mediasi verzet. Hanya upaya damai Pasal 154 ayat (1) RBg.

## Variabel baru (3970-3999) dan sumber data
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

## Hasil uji (spek/uji_verzet.py, perkara 9321)
67 uji lolos, 0 gagal: 8 putusan + 15 BAS terbangun; penanda dikenal; kueri 3970-3998 jalan atas 9321 (isian disimulasikan: tenggang A, B dalam, B lewat, B tanggal salah, C dalam, C lewat; pilihan pokok A, B, C; biaya).
