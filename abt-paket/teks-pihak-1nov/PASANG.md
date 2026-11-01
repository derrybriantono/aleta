# Paket ABT `abt-teks-pihak-1nov` - teks para pihak disalin apa adanya, kesimpulan UTUH di putusan (1 Nov 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama. URUTAN PASANG: KE-26, PALING AKHIR**
(sesudah 25 paket `../URUTAN-PASANG-1nov.md`; md5 dasar = keadaan sesudah ke-25 paket itu, diuji rantai `../uji-rantai-31okt`).

Keputusan pengguna 55 (1 Nov): SEMUA teks dari para pihak (gugatan, jawaban, replik, duplik, rekonvensi, kesimpulan) disalin APA ADANYA - tidak
dirapikan atau dibetulkan, kecuali baris kosong - dan kesimpulan diisi UTUH di putusan juga. Hanya blangko dan variabel milik **derry_briantono**.

## Isi

### a. Huruf pertama diturunkan SAAT CETAK (bukan di isian)
Bot kini menyimpan isian 8436/8437/9355/9491/9681/9164 persis seperti ketikan pihak (huruf awal tidak lagi diturunkan). Blangko yang
merangkainya di tengah kalimat ("yang pada pokoknya #8436#;") menurunkan HANYA huruf pertama lewat fungsi baru `isian_awal_kecil` - sisanya apa adanya
(salah ketik, spasi, tanda baca tidak disentuh). Tidak diturunkan bila kata pertama = sebutan pihak (Penggugat, Tergugat, Pemohon, Termohon, Turut,
Majelis, Hakim, Pengadilan, Kuasa - sama dengan `lcfirst` bot yang lama), bila kata itu seluruhnya huruf besar (singkatan "PNS" atau ketikan huruf
besar semua), atau satu huruf saja.

| variabel | isi |
|---|---|
| 9255 / 9256 (DIGANTI) | kesimpulan dalam kalimat (isian 8436 / 8437): `isian_rtf_kalimat_kecil`; beberapa paragraf ("sebagai berikut:" + butir) apa adanya |
| 11313 (DIGANTI) | isi eksepsi kewenangan: hanya cabang isian 9681 (diisi mesin) diturunkan; cabang 9685 (ketikan petugas) tetap |
| 12102 / 12103 / 12104 / 12105 | turunan isian 9355 (pokok jawaban ES), 9491 (pokok eksepsi ES), 9681 (eksepsi kewenangan), 9164 (tanggapan sita) berhuruf pertama kecil |

15 blangko ber-`#9355#`/`#9491#`/`#9681#`/`#9164#` terlihat memakai 12102-12105; isian asal didaftarkan di grup tersembunyi `{\*\isianasal #9355#}`
supaya tetap tampil di tabel isian ABT blangko itu. Putusan sela yang memakai isian 9685 (ketikan petugas) tidak diubah.

### b. Kesimpulan UTUH di putusan kontradiktoir perkara gugatan
| variabel | isi |
|---|---|
| 12100 / 12101 (BARU) | kalimat kesimpulan di putusan: naskah tertulis isian 12027 / 12028 UTUH ("sebagai berikut:" + naskah, butir berinden gantung) bila ada; bila tidak, frasa isian 8436 / 8437 (huruf pertama diturunkan) seperti dulu; kosong = "..." seperti dulu |

102 blangko yang memuat kalimat "yang pada pokoknya #9255#" DAN "#9256#" (kedua pihak) berganti ke `#12100#`/`#12101#`: 99 putusan kontradiktoir
(jawab-replik-duplik), 2 putusan Verzet, dan BAS Verzet ALUR 76 [5] Kesimpulan. Isian 12027/12028 didaftarkan di grup tersembunyi bila belum ada.
Dibiarkan (kalimat kesimpulan hanya "#9255#", lama): 60 putusan verstek / T tidak hadir setelah mediasi (keputusan: verstek dan permohonan tidak). Yang sudah
memuat naskah utuh sejak jawab-replik (9257/9258 = 3 putusan; 12036 = 2 putusan Itsbat Nikah Kontensius) tidak disentuh. 61 putusan kontradiktoir lain
(putusan sela, cabut sesudah jawaban, ES gugatan sederhana, izin poligami, li'an, eksepsi dikabulkan) tidak punya kalimat kesimpulan sama sekali dan TIDAK
ditambahi (kesimpulan tidak lazim pada putusan itu).

### c. Penanda butir tak rapi dari teks pihak
Fungsi `isian_rtf_penanda` (DIGANTI, dijaga md5 LAMA) mengenali juga penanda angka dengan spasi sebelum titik/kurung ("1 .Bahwa", "2 . Bahwa", "3 )"). Dulu
baris itu bukan penanda: ditempel ke baris di atasnya bila baris di atasnya belum berakhir tanda baca (judul "DALAM POKOK PERKARA" + "1 .Bahwa ..." menjadi satu
paragraf) atau jatuh sebagai paragraf biasa tanpa inden gantung. "1.Bahwa" (tanpa spasi) sudah dikenali. Teks penanda dicetak persis ("1 ." tetap "1 .")
diikuti tab. Pengaruh pada masukan nyata (`alat/banding_penanda.py`, `hasil/banding-penanda.txt`): dari 8.270 posita dan 10.246 petitum SIPP serta 16.230 isian teks
tersimpan, hanya 16 posita, 3 petitum, dan 1 isian yang memuat penanda berspasi; semuanya berubah menjadi butir bergantung ("3 .Fotocopy ..." tadinya paragraf
polos) dan penomoran daftar sesudahnya menjadi benar (dulu daftar HTML sesudah "1 ." mulai lagi dari 1, kini lanjut 2, 3, ...). Masukan tanpa pola itu: 0 yang berubah
(dijaga contoh acak 300 per sumber).

### d. Bukti: Asal Usul Anak dan BAS
| variabel | isi |
|---|---|
| 12106 | AUA putusan: klausa "menyerahkan alat bukti surat berupa:" (ada surat, atau tanpa bukti = seperti dulu) / "menyerahkan alat bukti elektronik berupa:" (hanya elektronik) |
| 12107 | AUA putusan: pengantar "Selanjutnya #7036# menyerahkan bukti elektronik berupa:" HANYA bila ada surat DAN elektronik (hanya elektronik sudah disebut di kalimat atas) |
| 12108 / 12109 | "telah cukup dengan ...": "bukti suratnya" / "bukti elektroniknya" / "bukti surat dan bukti elektroniknya" menurut bukti Penggugat/Pemohon (P) / Tergugat/Termohon (T); tanpa bukti = "bukti suratnya" seperti dulu |

- 4 putusan AUA tanpa sub-bab bukti ([01], [01a], [01c], [98]): 3 ganti per berkas. [01b] (daftar bukti satu isian 0378 gabungan, `\line`) tidak diubah.
- 192 BAS pembuktian ("menyatakan telah cukup dengan bukti suratnya"): hanya kejadian yang pihaknya pasti (daftar bukti P atau T di atasnya DAN sebutan di kalimat
  sejalan). Dilewati 2 kejadian: BAS ALUR 05 [3a] (CG dan CT) bagian Tergugat tertulis "#0046#" (salah ketik blangko, dibiarkan - dilaporkan).
  Folder BAS lama bergaris "- BAS ... -" tidak disentuh (tanpa daftar bukti pisah).

## Pasang (Git Bash, server hidup) - PALING AKHIR
```bash
cd /d/.../abt-paket/teks-pihak-1nov
rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-teks-pihak-20261101'
scp -r paket-satker/* aleta:/root/abt-teks-pihak-20261101/
ssh aleta 'cd /root/abt-teks-pihak-20261101 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-teks-pihak-20261101/pasang-satker.sh'
```
Keluaran benar:
```
PRASYARAT COCOK (3|0|0|0|1|0|0|0|4)
SIAP=313
BERKAS SIAP
CADANGAN: ...
SEMUA COCOK
UJI: 29 contoh fungsi sama dengan laptop
UJI: 13 kueri berjalan (perkara <id>)
TAMBAL=313
BERKAS COCOK
SELESAI - paket abt-teks-pihak-1nov terpasang. ...
```
Pasang ulang aman (`0|3|10|0|0|1|2|0|4`, `SUDAH=313`). PRASYARAT lain = berhenti TANPA mengubah apa pun. Arti angka: lihat komentar di `abt-teks-pihak-1nov-PRASYARAT.sql`.
Pulih (SEBELUM mem-pulih paket sebelumnya): `ssh aleta 'bash /root/abt-teks-pihak-20261101/pulih-satker.sh'` -> `PULIH COCOK (3|0|0|0|1|0|0|0|4)`.

## Hasil uji laptop (1 Nov 2026)
- Rantai 26 paket (`../uji-rantai-31okt/hasil-rantai-26.txt`, salinan baru dump 28 Okt, paket dari `git archive HEAD`): semua SELESAI, `RANTAI-KELUAR 0`.
- `sumber/uji_lokal.sh` (`hasil/uji-lokal.txt`): pasang ulang tidak mengubah apa pun; pulih = variabel, SEMUA fungsi, dan seluruh pohon RTF SAMA PERSIS dengan
  keadaan sesudah 25 paket; pasang lagi = pasang pertama; variabel paket disunting orang -> pasang menolak (`0|3|9|1|...`), variabel lama 9255 disunting -> pasang pertama
  menolak (`2|0|...`), tidak ada yang berubah.
- Banding fungsi penanda atas masukan nyata: `hasil/banding-penanda.txt` (bagian c di atas).
- Render sungguhan (renderer ABT php56 asli, `alat/driver155.py`, ringkasan `hasil/render.txt`): putusan CG kontradiktoir, Verzet, verstek, ES, eksepsi, sita, Asal Usul Anak
  (4 keadaan bukti), BAS pembuktian P/T dan itsbat (4 keadaan bukti) sebelum/sesudah. RTF dan teks: `D:/Aplikasi/aleta/tmp/w155/render/<sebelum|sesudah>/`; gambar:
  `D:/Aplikasi/aleta/tmp/w155/render/png/` (14 PNG).

## Keputusan yang perlu diperiksa pengguna
1. Pengecualian huruf awal (sebutan pihak, huruf besar semua, satu huruf) - keputusan 55 berbunyi "hanya huruf pertama"; tanpa pengecualian nama pihak di awal
   kalimat menjadi "tergugat ..." dan ketikan huruf besar menjadi "tERGUGAT ...".
2. Kalimat kesimpulan di putusan: "..., yang pada pokoknya sebagai berikut:" + naskah utuh (sama dengan 3 putusan 9257/9258).
3. Asal Usul Anak tanpa bukti sama sekali: kalimat lama ("menyerahkan alat bukti surat berupa:" tanpa daftar, "telah cukup dengan bukti suratnya") dipertahankan,
   BUKAN "siap mengajukan saksi-saksi" seperti BAS bukti-pisah, karena kalimat berikutnya menyebut jumlah saksi dan tidak dapat dipotong dengan aman.
4. Putusan tanpa kalimat kesimpulan (61 berkas, di atas) tidak ditambahi kalimat kesimpulan baru.
