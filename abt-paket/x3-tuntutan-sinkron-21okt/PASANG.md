# Paket ABT `abt-x3-tuntutan-sinkron-21okt` - tuntutan akibat perceraian yang diminta posita/petitum (21 Okt 2026)

**Status: teruji di ABT LAPTOP (PRASYARAT, pasang, PERIKSA, pasang ulang, pulih, pasang lagi; sidik jari tabel kembali sama dengan server) dan di renderer php56 ABT asli; PRASYARAT dan seluruh 26 kueri baru/diubah dijalankan BACA SAJA di server (MariaDB 5.5): 0 galat. Server: BELUM dipasang - dipasang sesi utama.**

Hanya tabel `abt_variabel` yang disentuh: **1 variabel baru** (`3400`) dan **25 baris diubah** (variabel paket u2). Tidak ada blangko (RTF), folder, menu, atau isian tersimpan per perkara yang diubah. `modifier` = `admin`, tanpa kata nama aplikasi; teks ASCII.

## Masalah yang diperbaiki

Temuan pengguna 21 Okt: putusan cerai verstek tanpa tuntutan mut'ah/nafkah iddah/madliyah tetap memuat bagian tuntutan itu. Sebab di ABT: 25 variabel paket u2 (pertimbangan dan amar akibat perceraian, pemicu 4140-4145, daftar 4146) membawa SALINAN pembaca petitum yang sama, dan tiga polanya menyala atas NAMA PIHAK:

| tuntutan | pola lama | salah nyala terukur (2.269 putusan CG/CT 2023-2026 di server) |
|---|---|---|
| nafkah iddah | `iddah\|idah` | 7 perkara: Azidah, Rosidah, Holidah, Nurzaidah, Nurfaidah, Zulkaidah, Saidah |
| mut'ah | `mut[^a-z]{0,4}ah` | 2 perkara: Mutahir, Mutaher |
| madliyah | `madli\|madhi\|mahdhi\|lampau\|yang lalu\|terhutang` | 1 perkara: Pramadhika (dan "mahar terhutang" bukan madliyah) |

Akibatnya putusan mencetak `[PERIKSA: petitum menuntut nafkah iddah; pilih keputusan majelis ...]` (dan panel menampilkan isian nafkah iddah) padahal petitum tidak memintanya.

Pola baru (kata berdiri sendiri; nafkah iddah didahului nafkah/biaya/uang/masa/selama/membayar/tunggu paling jauh 40 huruf tanpa titik koma):

- nafkah iddah `(nafkah|biaya|uang|masa|selama|membayar|tunggu)[^;]{0,40}[^a-z](iddah|idah|eddah)([^a-z]|$)`
- mut'ah `(^|[^a-z])muth?[^a-z]{0,6}ah([^a-z]|$)`
- madliyah `(^|[^a-z])(madl?iy*ah|madhiy*ah|mahdhiy*ah)|nafkah[^;]{0,30}(lampau|yang lalu|terhutang|terutang|tertunggak|yang belum dibayar|yang tidak dibayar)`

Pola hak asuh, nafkah anak, harta bersama TIDAK diubah (0 salah nyala terukur).

## Isi

| butir | isi |
|---|---|
| UBAH 25 baris | `4110`-`4119`, `4130`-`4134`, `4138`, `4139`, `4140`-`4146`, `4150`: hanya tiga potongan pola di atas (tiap potongan tepat sekali per variabel; dijaga `sumber/variabel_def.py`). Teks pertimbangan/amar, rujukan pasal, nomor amar tidak berubah. |
| BARU `3400` | `data_sql` "TUNTUTAN AKIBAT PERCERAIAN: KEADAAN DAN KUTIPAN PETITUM" - satu baris per tuntutan `4140|ya|<kutipan petitum>`, `4142|tidak|`, atau `...|ragu|petitum di SIPP kosong`. Benderanya dihitung dengan pola yang SAMA PERSIS dengan 4140-4145 sesudah paket (satu sumber). TIDAK dipakai blangko mana pun; dibaca panel Blangko Derry untuk menampilkan status tiap tuntutan beserta kutipannya. Nomor 3400 bebas di server (21 Okt), di luar jatah u2 4100-4299 (PULIH u2 menghapus jatah itu), dan tidak dipakai paket x1/x2 maupun paket lain di `D:/aleta-dev/wt/*/abt-paket` dan `D:/aleta-dev/kerja`. |

Berkas `paket-satker/`: `...-PRASYARAT.sql`, `...-PASANG.sql`, `...-PERIKSA.sql`, `...-PULIH.sql`, `pasang-satker.sh`, `pulih-satker.sh`, `nomor-baru.txt`, `nomor-ubah.txt`, `perkara-uji.txt`, `uji-kueri.tsv`, `MD5SUMS.txt`. Dibangun ulang dengan `VAR_SERVER_HEX=D:/Aplikasi/aleta/tmp/tuntutan24/lab/var_server_hex.tsv python sumber/bangun_paket.py` (salinan HEX `abt_variabel` server 21 Okt, 2.440 baris, di luar repo; untuk memasang cukup `paket-satker/`).

## PRASYARAT yang diharapkan (server, baca saja, 21 Okt 2026)

`0|0|25|0|13|0` = A nomor baru berisi lain (0) | B nomor baru sudah persis paket (0) | C dari 25 baris yang diubah, yang masih isi LAMA (25) | D yang sudah isi BARU (0) | E dari 13 variabel lama yang dirujuk, yang ada (13) | F baris diubah yang isinya bukan lama bukan baru (0).
Pasang ulang: `0|1|0|25|13|0`. Angka lain = berhenti, tidak ada yang diubah.
SUDAH dijalankan baca saja di server: `0|0|25|0|13|0`.

## Pasang (Git Bash, server hidup)

```bash
cd /d/aleta-dev/wt/tuntutan24/abt-paket/x3-tuntutan-sinkron-21okt     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-x3-20261021'
scp -r paket-satker/* aleta:/root/abt-x3-20261021/
ssh aleta 'cd /root/abt-x3-20261021 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-x3-20261021/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|25|0|13|0)`, `CADANGAN: ... (25 baris lama)`, `SEMUA COCOK`, delapan baris `uji perkara NNNN: 26 kueri jalan; berisi: ...`, `SELESAI`.
Pulih: `ssh aleta 'bash /root/abt-x3-20261021/pulih-satker.sh'` (baris terakhir `PULIH COCOK`). Gagal sesudah PASANG = pulih otomatis. Tidak perlu memulai ulang apa pun (ABT membaca `abt_variabel` setiap cetak).
Urutan dengan paket lain: bebas (x1 dan x2 sudah terpasang 21 Okt; tidak ada nomor yang sama). Bila paket u2 dibangun/dipasang ulang dari sumbernya, pasang x3 lagi sesudahnya (PRASYARAT akan menolak bila isi u2 berbeda).

## Hasil uji (21 Okt 2026)

- **ABT laptop** (`sumber/uji_lokal.sh semua`; DB `aps_badilag_x3` = salinan PERSIS `abt_variabel` server, 2.440 baris): PRASYARAT `0|0|25|0|13|0` -> pasang (1 tambah, 25 ubah) -> PERIKSA `SEMUA COCOK` -> pasang ulang `0|1|0|25|13|0` (sidik jari sama) -> PULIH `PULIH COCOK`, sidik jari seluruh tabel kembali SAMA dengan server -> PRASYARAT lagi `0|0|25|0|13|0` -> pasang lagi `SEMUA COCOK`. Uji kueri: 8 perkara x 26 kueri, 0 galat.
- **Server, baca saja**: PRASYARAT `0|0|25|0|13|0`; 26 kueri (3400 + 25 diubah, rujukan `#NNNN#` diganti X) atas 561/Pdt.G/2025 dan 260/Pdt.G/2023: 0 galat; pola lama vs baru dijalankan atas 2.269 putusan CG/CT (`alat/ukur_pola_server.sql`, `alat/ukur_metrik.py`, hasil `hasil/ukur-deteksi-petitum-vs-amar.json`).
- **Ukur deteksi atas putusan sungguhan** (2.269 putusan CG/CT 2023-2026; "D" = pola menyala, "A" = amar memuat tuntutan itu):

  | tuntutan | D & A | D tanpa A (lama -> baru) | salah nyala atas nama (lama -> baru) | A tanpa D (rekonvensi lisan / kesepakatan / ditetapkan majelis) |
  |---|---|---|---|---|
  | hak asuh | 35 | 19 -> 19 (semua tuntutan sungguhan: ditolak, NO, dicabut) | 0 -> 0 | 11 / 15 / 53 |
  | nafkah anak | 11 | 5 -> 5 (semua sungguhan) | 0 -> 0 | 19 / 8 / 25 |
  | nafkah iddah | 1 | 10 -> 3 (3 sungguhan) | 7 -> 0 | 22 / 5 / 19 |
  | mut'ah | 1 | 5 -> 3 (3 sungguhan) | 2 -> 0 | 19 / 6 / 17 |
  | madliyah | 2 | 3 -> 2 (2 sungguhan) | 1 -> 0 | 15 / 1 / 8 |
  | harta bersama | 0 | 0 | 0 | 1 / 3 / 1 |

  Ketepatan pola baru atas yang menyala: 100% (semua kasus "D tanpa A" dibaca satu per satu: tuntutan sungguhan yang ditolak/dicabut/NO atau petitum Pemohon cerai talak yang menawarkan mut'ah/iddah dengan jumlah kosong). Tidak ada tuntutan tercatat di petitum SIPP yang terlewat (pencarian kata longgar - "idd", "mut", "madl/madh", "lampau", "harta", "asuh" - atas 2.269 petitum: semua kandidat yang tidak menyala ternyata nama pihak atau keterangan posita). Kolom terakhir TIDAK dapat dibaca dari SIPP (rekonvensi lisan tidak tercatat di `perkara_rekonvensi`, kesepakatan mediasi, atau ditetapkan majelis tanpa tuntutan) - itulah sebabnya panel menyediakan saklar "Tetapkan karena jabatan" (hakim saja) dan isian keputusan yang sudah dipilih selalu tampil.
- **Renderer php56 ABT asli** (`alat/render_x3.py`, blangko server `[01] [Kabul Verstek] Cerai (Format Lengkap)` CG/CT dan varian Mut'ah Iddah; isian uji ditulis ke ABT laptop lalu dikembalikan; ringkasan `hasil/render-ringkasan.json`):

  | skenario | [PERIKSA] tuntutan sebelum -> sesudah | amar | nomor amar |
  |---|---|---|---|
  | CG cerai saja, nama Penggugat memuat "idah" | nafkah iddah -> TIDAK ADA | tanpa tuntutan | 1-4 urut |
  | CT tanpa tuntutan, nama Termohon memuat "idah" | nafkah iddah -> TIDAK ADA | tanpa tuntutan | 1-4 urut |
  | CG menuntut nafkah anak, iddah, mut'ah, madliyah - belum dipilih | 4 -> 4 (benar: diminta) | - | 1-4 urut |
  | CG nafkah anak + iddah dikabulkan, mut'ah + madliyah ditolak | - | nafkah anak, nafkah iddah, menolak selebihnya | 1-7 urut |
  | CT mut'ah + iddah karena jabatan (tidak diminta) | - | mut'ah + iddah ex officio | 1-5 urut |
  | CT menuntut mut'ah + iddah - belum / sudah dipilih | 2 (benar) / - | mut'ah + iddah | 1-4 / 1-5 urut |
  | CT varian Mut'ah Iddah | - | mut'ah + iddah | 1-5 urut |

  Semua: 0 butir amar kosong, 0 penanda `#NNNN#` tersisa, jumlah paragraf kosong ganda sama dengan sebelum paket. `[PERIKSA]` lain yang tetap ada = SEMA 1/2022 lama pisah rumah (isian 9944/0246 belum diisi pada data uji) dan kenaikan nafkah anak (9741 kosong) - bukan bagian paket ini.
  Rig lokal memakai 20 fungsi `aps_badilag.isian_rtf_*` dari server (dibaca `mysql.proc`, dibuat di ABT laptop).

## Yang TIDAK diubah (dan alasannya)

1. Blangko yang punya akibat perceraian sendiri (varian CT Mut'ah Iddah `#4139#` + 6054/6055 tertulis langsung, `[01a]` CT ex officio, `[02]` Rekonvensi CT, CG `[01d]`/`[02c]` kumulasi nafkah istri `#9716#`/`#9717#`, folder `1d` kumulasi hak asuh): teks tetapnya tidak disentuh. `#9716#`/`#9717#` sudah bersyarat (tuntutan yang isiannya kosong tidak tercetak); panel kini menyembunyikan isian tuntutan yang tidak diminta, jadi madliyah yang tidak diminta tidak terisi dan tidak tercetak. Tuntutan hak asuh/nafkah anak yang DIMINTA tetapi memilih varian Mut'ah Iddah belum tercetak - lihat rencana di laporan.
2. `3760`-`3779` (Hak Bekas Istri, jenis 351) memuat pola sejenis; 0 perkara jenis 351 di server - masuk rencana perluasan.
3. Rekonvensi lisan yang tidak dicatat di SIPP tidak dapat dibaca mesin; hakim memakai saklar karena jabatan / memilih keputusan.
