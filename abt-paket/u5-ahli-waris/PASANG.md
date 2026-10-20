# Paket ABT "u5-ahli-waris" - penetapan ahli waris / P3HP (blangko derry_briantono, folder "9 Penetapan Ahli Waris")

Disusun 20 Okt 2026 (agen U5). **Diuji di MariaDB lokal DAN kueri variabel dijalankan (SELECT saja) di server 5.5.68 dengan hasil sama persis. BELUM dipasang di server** - dipasang sesi utama.

## Isi
| berkas | isi |
|---|---|
| `paket-satker/abt-u5-PASANG.sql` | prasyarat (jatah 4500-4599 kosong, gagal keras bila tidak) + 29 INSERT dalam satu transaksi. Tidak ada UPDATE/DELETE: variabel lama tidak disentuh. |
| `paket-satker/abt-u5-PERIKSA.sql` | panjang + MD5 (kueri dan nama) tiap baris; baris terakhir `SEMUA COCOK` |
| `paket-satker/abt-u5-PULIH-HAPUS-BARU.sql` | `DELETE ... BETWEEN 4500 AND 4599` |
| `paket-satker/rtf/01.rtf, 01b.rtf, 01c.rtf` | tiga blangko `[01]`, `[01b]`, `[01c]` folder `9 Penetapan Ahli Waris` yang sudah ditambal |
| `paket-satker/pasang-satker.sh`, `pulih-satker.sh` | jalankan DI SERVER dari folder paket (cadang -> pasang -> periksa -> ganti RTF; gagal = pulih sendiri) |
| `paket-satker/MD5SUMS.txt` | md5 seluruh berkas paket |
| `asli-server-20okt/` | tiga RTF asli server yang diukur 20 Okt (md5 = syarat skrip pasang) |
| `katalog-v1/` | katalog saksi sebelum versi 2 (pembanding uji) |
| `salinan-server-20okt/` | salinan kueri 9707/9708/9768/9769/9770 dari server (acuan hitungan bagian) |
| `alat/` | pembangun dan penguji: `variabel.py`+`bukti.py` (definisi), `tambal_rtf.py`, `bangun_paket.py`, `katalog_v2.py`, `uji_lokal.js`, `uji_server.js` (SELECT saja), `uji_paket_lokal.js`, `banding_faraid.js` |

## Variabel baru (4500-4599, semua Derry, tanpa kata ALETA)
Isian (data_teks, semua opsional - kosong = bunyi lama blangko): 4500 tujuan, 4502 anak angkat, 4505 sikap terhadap anak angkat (pilihan hakim, 1 = wasiat wajibah dalam amar), 4507 wasiat, 4510 kerabat tidak beragama Islam, 4513 keadaan perkawinan (pilihan hakim: 1 berpisah belum cerai, 2 sudah bercerai), 4515 bagian ahli waris (P3HP, keputusan hakim), 4520 harta bersama, 4534 pembatasan penggunaan penetapan (pilihan hakim), 4540/4541 ahli waris pengganti dari saudara (saudara yang meninggal lebih dahulu dan anaknya).
Otomatis (data_sql): 4501 tujuan; 4503, 4508, 4511 kalimat keterangan saksi dan fakta (anak angkat, wasiat, agama); 4504, 4506 anak angkat (pertimbangan Pasal 171 huruf h dan c, 209 ayat (2) KHI; amar); 4509 wasiat (Pasal 171 f, 175, 195); 4512 kerabat beda agama; 4514 perkawinan (Pasal 171 huruf c); 4516, 4517 amar dan pertimbangan bagian; 4521 harta bersama (Pasal 96 ayat (1), 171 e); 4530 analisis bukti surat per jenis dari daftar 8132; 4531, 4532 amar dan pertimbangan "Menyatakan ... meninggal dunia" (hanya bila petitum SIPP memuatnya); 4535 amar pembatasan; 4542, 4543 pertimbangan dan kalimat susunan ahli waris pengganti saudara (Pasal 185).

## Tambalan RTF (anchor harus ditemukan tepat sekali; bila tidak, skrip tidak menulis apa pun)
- Kalimat saksi/fakta yang dulu tertulis mati ("tidak mempunyai anak angkat", "tidak meninggalkan wasiat apa pun", "seluruh ahli waris ... beragama Islam", "untuk mengurus harta peninggalan") -> `#4503#`, `#4508#`, `#4511#`, `#4501#` (nilai bawaan = bunyi lama).
- Tiga paragraf bukti (KTP P.1, KK P.2, bukti lainnya) -> satu `#4530#` (daftar 8132 kosong = bunyi lama).
- Pertimbangan: `#4532#` (kematian pewaris), `#4514# #4512# #4504# #4509# #4521#` sesudah syarat ahli waris, `#4542# #4517#` sesudah `#9769#`/`#9706#`, satu paragraf baru Pasal 175 KHI.
- Amar: `#4531#` sesudah butir mengabulkan; `#4506# #4516# #4535#` sesudah `#9707#`; `#4543#` sesudah `#9768#`/`#9770#` ([01c] saja).
- `{\*\isianasal ...}` ditambah kode isian baru; `[01b]` juga dilengkapi 9700-9704, 9718 (sebelumnya hilang dari daftar).

## Cara pasang di server (Git Bash di laptop)
```bash
cd /d/aleta-dev/wt/u5-ahli-waris/abt-paket/u5-ahli-waris
ssh aleta 'mkdir -p /root/abt-u5-20261020/rtf'
scp paket-satker/abt-u5-*.sql paket-satker/*.sh paket-satker/MD5SUMS.txt aleta:/root/abt-u5-20261020/
scp paket-satker/rtf/*.rtf aleta:/root/abt-u5-20261020/rtf/
ssh aleta 'cd /root/abt-u5-20261020 && md5sum -c MD5SUMS.txt'      # semua OK
ssh aleta 'bash /root/abt-u5-20261020/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK - memasang`, tabel PERIKSA cocok = 1 di 30 baris, `SEMUA COCOK`, tiga `ls -l` blangko (apache apache), `SELESAI`.
Bila skrip menolak karena md5 blangko satker sudah berbeda dari yang diukur 20 Okt (ada paket lain menyentuh folder ini): ambil RTF terbaru dari server ke satu folder, jalankan
`python -I alat/tambal_rtf.py <folder-rtf-terbaru> <keluar>`, lalu `python -I alat/bangun_paket.py` setelah mengganti `asli-server-20okt/` - skrip pasang membaca md5 baru sendiri.
Pulih: `ssh aleta 'bash /root/abt-u5-20261020/pulih-satker.sh'` (hapus 4500-4599 + kembalikan 3 RTF dari `cadangan/`).

## Yang HARUS disusul sesudah pasang
1. Tanam ulang ekstensi (`saksi-katalog-data.js` berubah) dan pasang portal/bot (susun.ts, petunjuk-s5.ts, pengisi `isiOtomatisS5/ahliWarisLanjut.js`, `faraid.js`, pembaca jawaban saksi).
2. Nomor 4500-4599 sudah diperiksa kosong di `aps_badilag.abt_variabel` server 20 Okt; blangko BAS PAW tidak berubah.
