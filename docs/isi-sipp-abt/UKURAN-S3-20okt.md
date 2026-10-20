# Ukuran isian otomatis cerai gugat, cerai talak, ikrar dan itsbat nikah (agen S3, 20 Okt 2026)

Berkas mesin: `UKURAN-S3-20okt.json`. Cara ukur: `node scripts/isi-sipp-abt/ukur-isi-otomatis-20okt.cjs [--akar <salinan tag>] --maks 80` - memanggil rute bot `/abt/usulan` sungguhan dengan sumber yang sama seperti panel Blangko Derry, memutuskan nasib tiap usulan dengan `isi-sipp-bersama.js` (tulis / saran / lewati) atas perkara terdaftar 2026 di salinan lokal sipp_donggala (hanya SELECT). Berkas e-Court (gugatan, KTP, bukti, jawab-menjawab) tidak terbaca lokal sehingga isian yang hanya bergantung padanya dihitung `ecourt`.

Kelas: **otomatis** = ditulis sendiri (pasti/cukup); **ragu** = hanya saran 'yakin: ragu - periksa'; **ecourt** = bergantung berkas e-Court; **manual** = tanda 'diisi manual' + alasan; **opsional** = Isian tambahan (bila ada); **kosong** = celah tanpa pengisi dan tanpa tanda.

## Ringkasan (persen dari seluruh isian x perkara x kategori)

| Cakupan | Keadaan | otomatis | ragu | e-Court | manual | opsional | kosong |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Semua isian | sebelum | 20.1 | 11.5 | 19.8 | 0 | 0 | 48.6 |
| Semua isian | sesudah | 21.6 | 16.9 | 19.2 | 41.8 | 0.5 | 0 |
| Isian umum (perkara biasa) | sebelum | 58.1 | 19.2 | 5.6 | 0 | 0 | 17.1 |
| Isian umum (perkara biasa) | sesudah | 58.1 | 31.2 | 5.6 | 5.1 | 0 | 0 |

'Semua isian' mencakup isian khas satu skenario (tolak, cabut, nafkah, pasangan meninggal ...) yang pada perkara biasa tidak muncul, jadi 'manual' besar di sana. 'Isian umum' (ada di sedikitnya 40% blangko kategorinya) menggambarkan perkara biasa.

## Per jenis dan kategori blangko

| Jenis | Kategori | Isian | Sebelum o/r/e/m/k | Sesudah o/r/e/m/op/k |
| --- | --- | ---: | --- | --- |
| Itsbat Nikah (voluntair) (80 perkara) | bas | 21 | 58.2/4.8/14.4/0/22.6 | 58.2/9.4/14.4/13.2/4.8/0 |
| Itsbat Nikah (voluntair) (80 perkara) | putusan | 37 | 33.1/0.2/8.2/0/58.5 | 33.1/5.5/8.2/53.2/0/0 |
| Itsbat Nikah (voluntair) (80 perkara) | relaas | 7 | 42.7/14.3/0/0/43 | 42.7/14.3/0/43/0/0 |
| Cerai Talak (80 perkara) | bas | 20 | 18.9/23.8/20.6/0/36.8 | 19.1/33.1/20.3/27.4/0/0.1 |
| Cerai Talak (80 perkara) | putusan | 46 | 6.2/14.3/35.1/0/44.4 | 9.4/20.6/32.7/37.2/0/0.1 |
| Cerai Talak (80 perkara) | ikrar | 2 | 26.3/0/0/0/73.8 | 26.3/0/0/73.8/0/0 |
| Cerai Talak (80 perkara) | relaas | 3 | 0/0/0/0/100 | 0/0/0/100/0/0 |
| Cerai Talak (80 perkara) | ptsp | 1 | 0/0/0/0/100 | 1.3/0/0/98.8/0/0 |
| Cerai Gugat (80 perkara) | bas | 26 | 15.2/19.1/23.3/0/42.4 | 18.5/26.4/23.1/31.9/0/0 |
| Cerai Gugat (80 perkara) | putusan | 43 | 6.9/13.7/21.1/0/58.3 | 8.9/18.2/20.9/52/0/0 |
| Cerai Gugat (80 perkara) | relaas | 3 | 0/0/0/0/100 | 0/0/0/100/0/0 |
| Itsbat Nikah (kontensius) (9 perkara) | bas | 13 | 22.2/7.7/38.5/0/31.6 | 22.2/7.7/38.5/31.6/0/0 |
| Itsbat Nikah (kontensius) (9 perkara) | putusan | 47 | 29.6/10.4/14.9/0/45.2 | 29.6/10.4/14.9/45.2/0/0 |
| Itsbat Nikah (kontensius) (9 perkara) | relaas | 3 | 0/0/0/0/100 | 0/0/0/100/0/0 |

## Kalibrasi atas isian petugas di ABT (data nyata, baca saja)

| Isian | Sumber | Pembanding | Sama | Persen | Tingkat |
| --- | --- | ---: | ---: | ---: | --- |
| 7035 | posita (siapaPergiPosita) vs isian petugas ABT | 374 | 286 | 89.9 | ragu |
| 8503 | posita: huruf F (perselisihan) + B (pisah >= 24 bulan) vs isian petugas | 359 | 217 | 60.4 | ragu |
| 7211/7212 | tanggal lahir SIPP - tanggal nikah, tahun penuh | 511 | 404 | 79.1 | ragu |
| 0007 | jumlah baris tab Anak SIPP vs isian petugas | 29 | 28 | 96.6 | cukup |
| 1081 | perkara_penetapan_kembali_ikrar vs isian petugas | 1 | 1 | 100 | cukup |
| 0709/0711 | jenis perkara (ibu/bapak kandung) vs isian petugas | 4 | 4 | 100 | cukup |

Catatan: 8503 - semua huruf dari posita hanya 33% persis (112 dari 338); A/C/D dari posita saja berlebihan; 7211/7212 - selisih satu tahun karena posita membulatkan umur; selisih tahun kalender hanya cocok 59%.

