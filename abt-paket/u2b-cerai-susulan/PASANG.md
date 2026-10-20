# Paket susulan ABT "u2b-cerai-susulan" (agen W2b-U2b, 21 Okt 2026)

Menambal blangko Derry yang DILEWATI paket gelombang 1 `u2-putusan-cerai-lengkap` (terpasang 20 Okt 22.32; 31 baris `LEWAT` di
`/root/abt-u2-20261020/cadangan/tambal-hasil.txt`). HANYA blangko Derry; tanpa kata aplikasi di ABT. **Tidak memasang/mengubah variabel**
(4100-4150 sudah terpasang, 35 buah; hanya dibaca). **Laptop: teruji pada salinan RTF terbaru dari server. Satker: BELUM dipasang** (dipasang sesi utama).

## Temuan: apa yang sebenarnya terjadi pada 31 baris LEWAT

RTF terbaru diambil dari server (tar lewat ssh dari `/var/www/html/aps_badilag/_blangko_abt/derry_briantono`, 339 berkas folder perceraian,
md5 semuanya di `data/pohon-asli-md5.tsv`) dan dicocokkan dengan daftar paket u2. Penyebabnya BUKAN satu hal, dan sebagian besar bukan
"jangkar 0 kali di berkas yang ada":

| penyebab | jumlah | kode u2 | keadaan sekarang |
|---|---|---|---|
| Jalur lama sudah tidak ada: BAS dipindah ke folder berpasangan `<jenis> - BAS` (menu berpasangan 15 Okt) dan `[01aa] ... IN + CG` diganti dua berkas "Format Lengkap". Pengganti SUDAH ditambal paket u2 sendiri (`#4138#`, 3 jangkar untuk Format Lengkap) | 28 | T005-T016, T043-T054, T090-T091, T092-T093 | **tidak perlu ditambal lagi** (md5 pengganti = md5 hasil u2) |
| Jalur lama tidak ada, berkasnya `[2a] BAS Ikrar Talak - P & T Hadir, Ada Beban` | 1 | T055 | tidak ditambal (lihat di bawah) |
| `[2a] BAS Ikrar Talak - P & T Hadir, Ada Beban` sudah ditulis ulang (Ikrar Talak Derry 15 Okt): blok titik-titik beban sudah diganti `#6054#` nafkah iddah, `#6055#` mut'ah, `#6071#` nafkah anak; jangkar blok lama 0 kali (diharapkan 2) | 2 | T089, T102 | **tidak ditambal** |

Tetapi pemeriksaan ulang seluruh pohon terbaru dengan aturan u2 yang SAMA (`bangun_rtf.aturan`) menemukan **12 berkas yang memang belum
bertambal dan tidak pernah masuk daftar u2** (folder `ALUR 02/03/06 ...` tidak ada di salinan laptop penyusun u2): BAS "Saksi dan Putusan"
verstek/kontradiktoir yang amarnya berakhir di `#8505#`. Isinya sama persis (md5 sama) dengan salinannya di folder `- BAS` SEBELUM ditambal u2,
sehingga **hasil tambalnya bermd5 sama dengan salinan yang sudah ditambal u2** (6518c9d3..., b967db25..., dst.): bukti kesetaraan.
Paket ini menambal 12 berkas itu: `#8505#` -> `#4138##8505#` (variabel 4138 "amar akibat perceraian lengkap").
Tanpa tuntutan akibat perceraian di petitum dan tanpa pilihan majelis, 4138 keluar KOSONG: blangko tampil persis seperti sebelumnya.

## Isi paket

- `paket-satker/rtf-daftar-tambal.tsv`, `rtf-tambal.tsv`: 12 tambalan (kode S001-S012; jalur, md5 lama, md5 baru, jangkar base64).
- `paket-satker/tambal-rtf.pl`: periksa | pasang | pulih DENGAN PENJAGA md5 (lihat bawah). Satu implementasi yang sama diuji di laptop (perl 5.36 Git Bash) dan dipakai di server (perl 5.16).
- `paket-satker/abt-u2b-PRASYARAT.sql`: hanya SELECT, harus menjawab `35|1|1` (variabel 4100-4150 ada 35, 4138 berjenis `data_sql`, 8505 ada).
- `paket-satker/pasang-satker.sh`, `pulih-satker.sh`, `MD5SUMS.txt`.
- `alat/bangun_u2b.py` (penyusun dari pohon server), `bangun_rtf.py` + `rtf2txt.py` (pustaka salinan u2), `tulis_tabel.py`.
- `data/tidak-ditambal.tsv` (31 baris u2 + keadaan), `data/pohon-asli-md5.tsv`, `contoh/sebelum-sesudah.md`, `PERIKSA-PASAL.md`.

Penjaga (pola u2/u4): berkas HANYA diubah bila md5-nya di server persis md5 yang diperiksa (`md5_lama`), semua jangkar tepat sekali, dan
hasil tambal di memori bermd5 `md5_baru`; setelah ditulis dibaca ulang dan dicocokkan (tak cocok = dikembalikan dari cadangan). Satu berkas saja
beda = `pasang-satker.sh` GAGAL sebelum menulis apa pun. Cadangan utuh per berkas di `cadangan/rtf-lama/<kode>.rtf` (md5 cadangan diperiksa
sebelum menulis; cadangan lama tidak pernah ditimpa). Idempoten: md5 = hasil paket berarti `SUDAH`. Pulih: hanya berkas yang md5-nya masih persis hasil paket.


## Pasang di satker (Git Bash, server hidup; sesi utama)

```bash
cd /d/aleta-dev/wt/w2b-keluarga-lain/abt-paket/u2b-cerai-susulan
ssh aleta 'mkdir -p /root/abt-u2b-20261021'
scp paket-satker/* aleta:/root/abt-u2b-20261021/
ssh aleta 'cd /root/abt-u2b-20261021 && md5sum -c MD5SUMS.txt'
ssh aleta 'bash /root/abt-u2b-20261021/pasang-satker.sh'
```

Keluaran benar (berurutan): `PRASYARAT COCOK (35|1|1)`, `== 1. praperiksa` dengan 12 baris `COCOK` lalu `RINGKAS COCOK=12 SUDAH=0 LEWAT=0`,
`== 2. tambal` dengan 12 baris `DITAMBAL` (ekornya `RINGKAS DITAMBAL=12 SUDAH=0 LEWAT=0`), `== 3. periksa ulang` berakhir `RINGKAS COCOK=0 SUDAH=12 LEWAT=0`, lalu `SELESAI`.
Dijalankan lagi sesudah terpasang: `GAGAL: paket ini sudah pernah dipasang` (aman). Bila praperiksa bukan `COCOK=12 SUDAH=0 LEWAT=0`: GAGAL tanpa mengubah
apa pun; baris `LEWAT` menyebut sebabnya (md5 beda = blangko diubah sesudah paket ini disusun; ambil ulang pohon terbaru lalu jalankan ulang `alat/bangun_u2b.py`).

Pulih: `ssh aleta 'bash /root/abt-u2b-20261021/pulih-satker.sh'` menghasilkan 12 baris `DIPULIHKAN` dan `RINGKAS PULIH=12 DILEWATI=0`. Berkas yang sudah disunting
sesudah ditambal dibiarkan (`DILEWATI`). Paket ini tidak menyentuh `abt_variabel`, jadi tidak ada SQL pulih.

Laptop (uji tanpa server): `ABT_LOKAL=1 ABT_BLANGKO=<salinan derry_briantono> bash pasang-satker.sh`, lalu `bash pulih-satker.sh` dengan `ABT_BLANGKO` yang sama.

## Uji tangan di satker

1. Menu `ALUR 02 Cerai Verstek 2 Sidang` -> `[2] BAS 2 ... Saksi dan Putusan Verstek (2 Saksi)` pada perkara cerai gugat verstek tanpa tuntutan akibat cerai:
   keluaran sama dengan sebelumnya (butir amar biaya perkara saja).
2. Perkara verstek yang petitumnya memuat nafkah anak/hak asuh dan keputusannya sudah dipilih di popup Blangko Derry (isian 4100-4105):
   butir amar akibat perceraian muncul tepat sebelum butir biaya perkara; belum dipilih = kalimat `[PERIKSA: ...]` (menahan unggah), sama seperti pada salinan di folder `- BAS`.
3. `ALUR 06 ... [3c]` (T tidak hadir setelah mediasi, 5 saksi) sama.

## Tidak ditambal (dan alasannya)

- `[2a] BAS Ikrar Talak - P & T Hadir, Ada Beban` (`1a Perceraian CT - BAS/` dan `ALUR 10 .../`; T055, T089, T102): blangko sudah memuat angka beban lewat `#6054#`, `#6055#`, `#6071#`
  (terisi dari petitum SIPP). Mengganti dengan `#4150#` justru mengosongkan angka itu menjadi titik-titik bila keputusan 4100-4105 belum dipilih, jadi TIDAK dipaksa.
  Variabel 4150 tetap terpasang untuk dipakai bila diputuskan mengganti (satu tambalan: dua blok `#6054#..#6071#` menjadi `#4150#`).
- `ALUR 01 .../[1a] [1b] BAS ... Putus Verstek di Sidang Pertama`: amar tertulis tetap (MENGADILI 1.-4. tanpa `#8505#`), tidak ada jangkar yang pasti dan penomoran butir
  tidak dapat disisipi tanpa menulis ulang amar; di luar 31 baris itu dan tidak dipaksa.
- Putusan/BAS non-kabul (tolak, cabut, gugur, NO), folder `1d`, rekonvensi, BAS kumulasi hak asuh: dikecualikan aturan u2 (sudah punya amar sendiri atau tidak memerlukan akibat perceraian).
- Catatan: folder `ALUR xx` adalah salinan menu. Bila suatu paket/menu kemudian menyalin ulang dari sumber lama, jalankan ulang paket ini (idempoten) atau susun ulang dengan `alat/bangun_u2b.py`.

Dasar hukum: tidak ada rujukan baru (variabel 4138 dan teks blangko tidak diubah); lihat `PERIKSA-PASAL.md`.

## Rincian (dibangkitkan oleh `alat/tulis_tabel.py`)

### A. Berkas yang DITAMBAL paket ini (12)

| kode | folder / berkas | jangkar | penanda disisipkan | md5 server sebelum | md5 sesudah tambal | setara dengan |
|---|---|---|---|---|---|---|
| S001 | `ALUR 02 Cerai Verstek 2 Sidang` / `[2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf` | `#8505#` (1x) | `#4138#` sebelum `#8505#` | `216861ae91023691b5dafa52dec93db3` | `6518c9d343802f1433ee855039af1ccc` | T005, T043 |
| S002 | `ALUR 02 Cerai Verstek 2 Sidang` / `[2a] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi).rtf` | `#8505#` (1x) | `#4138#` sebelum `#8505#` | `2fa43e1c0fe460e69e5db4f717d6482f` | `b967db252f923196761afbe218f7566f` | T006, T044 |
| S003 | `ALUR 02 Cerai Verstek 2 Sidang` / `[2b] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (4 Saksi).rtf` | `#8505#` (1x) | `#4138#` sebelum `#8505#` | `6046cd0f5d0fc4d66d2e24ed9e1ddaba` | `cf5d9613312018bf7b1ed17aecdece8f` | T007, T045 |
| S004 | `ALUR 02 Cerai Verstek 2 Sidang` / `[2c] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi).rtf` | `#8505#` (1x) | `#4138#` sebelum `#8505#` | `35eb968d1894d14168aafc3c69535461` | `7eb4011b273170fed65f157eb0139de2` | T008, T046 |
| S005 | `ALUR 03 Cerai Verstek 3 Sidang atau Lebih` / `[3] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf` | `#8505#` (1x) | `#4138#` sebelum `#8505#` | `216861ae91023691b5dafa52dec93db3` | `6518c9d343802f1433ee855039af1ccc` | T009, T047 |
| S006 | `ALUR 03 Cerai Verstek 3 Sidang atau Lebih` / `[3a] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi).rtf` | `#8505#` (1x) | `#4138#` sebelum `#8505#` | `2fa43e1c0fe460e69e5db4f717d6482f` | `b967db252f923196761afbe218f7566f` | T010, T048 |
| S007 | `ALUR 03 Cerai Verstek 3 Sidang atau Lebih` / `[3b] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (4 Saksi).rtf` | `#8505#` (1x) | `#4138#` sebelum `#8505#` | `6046cd0f5d0fc4d66d2e24ed9e1ddaba` | `cf5d9613312018bf7b1ed17aecdece8f` | T011, T049 |
| S008 | `ALUR 03 Cerai Verstek 3 Sidang atau Lebih` / `[3c] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi).rtf` | `#8505#` (1x) | `#4138#` sebelum `#8505#` | `35eb968d1894d14168aafc3c69535461` | `7eb4011b273170fed65f157eb0139de2` | T012, T050 |
| S009 | `ALUR 06 Cerai T Hadir Mediasi lalu Tidak Hadir` / `[3] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (2 Saksi).rtf` | `#8505#` (1x) | `#4138#` sebelum `#8505#` | `142190aa4f173df37797c29c39fd4258` | `fe4248ddd3ac3ae88e4b48076c30d050` | T013, T051 |
| S010 | `ALUR 06 Cerai T Hadir Mediasi lalu Tidak Hadir` / `[3a] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (3 Saksi).rtf` | `#8505#` (1x) | `#4138#` sebelum `#8505#` | `c2958f7be4af933c544c1fb05128e709` | `1df4eaf98e6ad8be04e7996e73a79f61` | T014, T052 |
| S011 | `ALUR 06 Cerai T Hadir Mediasi lalu Tidak Hadir` / `[3b] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (4 Saksi).rtf` | `#8505#` (1x) | `#4138#` sebelum `#8505#` | `e46a70d938ddd04c246f95be3cf67932` | `2cf81f4ad68bbe4ccf97a74408fb4fe1` | T015, T053 |
| S012 | `ALUR 06 Cerai T Hadir Mediasi lalu Tidak Hadir` / `[3c] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (5 Saksi).rtf` | `#8505#` (1x) | `#4138#` sebelum `#8505#` | `8edd3470d90923090591120305544a17` | `86020e3fd4c2005209f13533b90fc219` | T016, T054 |

### B. 31 berkas yang dilewati paket u2 (baris LEWAT di tambal-hasil.txt)

| kode u2 | jalur yang dicari paket u2 | keadaan di server | md5 pengganti sekarang |
|---|---|---|---|
| T005 | `1 Perceraian CG/BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `6518c9d343802f1433ee855039af1ccc` |
| T006 | `1 Perceraian CG/BAS ALUR 02 [2a] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `b967db252f923196761afbe218f7566f` |
| T007 | `1 Perceraian CG/BAS ALUR 02 [2b] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (4 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `cf5d9613312018bf7b1ed17aecdece8f` |
| T008 | `1 Perceraian CG/BAS ALUR 02 [2c] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `7eb4011b273170fed65f157eb0139de2` |
| T009 | `1 Perceraian CG/BAS ALUR 03 [3] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `6518c9d343802f1433ee855039af1ccc` |
| T010 | `1 Perceraian CG/BAS ALUR 03 [3a] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `b967db252f923196761afbe218f7566f` |
| T011 | `1 Perceraian CG/BAS ALUR 03 [3b] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (4 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `cf5d9613312018bf7b1ed17aecdece8f` |
| T012 | `1 Perceraian CG/BAS ALUR 03 [3c] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `7eb4011b273170fed65f157eb0139de2` |
| T013 | `1 Perceraian CG/BAS ALUR 06 [3] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (2 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `fe4248ddd3ac3ae88e4b48076c30d050` |
| T014 | `1 Perceraian CG/BAS ALUR 06 [3a] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (3 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `1df4eaf98e6ad8be04e7996e73a79f61` |
| T015 | `1 Perceraian CG/BAS ALUR 06 [3b] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (4 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `2cf81f4ad68bbe4ccf97a74408fb4fe1` |
| T016 | `1 Perceraian CG/BAS ALUR 06 [3c] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (5 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `86020e3fd4c2005209f13533b90fc219` |
| T043 | `1a Perceraian CT/BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `6518c9d343802f1433ee855039af1ccc` |
| T044 | `1a Perceraian CT/BAS ALUR 02 [2a] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `b967db252f923196761afbe218f7566f` |
| T045 | `1a Perceraian CT/BAS ALUR 02 [2b] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (4 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `cf5d9613312018bf7b1ed17aecdece8f` |
| T046 | `1a Perceraian CT/BAS ALUR 02 [2c] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `7eb4011b273170fed65f157eb0139de2` |
| T047 | `1a Perceraian CT/BAS ALUR 03 [3] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `6518c9d343802f1433ee855039af1ccc` |
| T048 | `1a Perceraian CT/BAS ALUR 03 [3a] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (3 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `b967db252f923196761afbe218f7566f` |
| T049 | `1a Perceraian CT/BAS ALUR 03 [3b] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (4 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `cf5d9613312018bf7b1ed17aecdece8f` |
| T050 | `1a Perceraian CT/BAS ALUR 03 [3c] BAS Terakhir P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (5 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `7eb4011b273170fed65f157eb0139de2` |
| T051 | `1a Perceraian CT/BAS ALUR 06 [3] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (2 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `fe4248ddd3ac3ae88e4b48076c30d050` |
| T052 | `1a Perceraian CT/BAS ALUR 06 [3a] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (3 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `1df4eaf98e6ad8be04e7996e73a79f61` |
| T053 | `1a Perceraian CT/BAS ALUR 06 [3b] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (4 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `2cf81f4ad68bbe4ccf97a74408fb4fe1` |
| T054 | `1a Perceraian CT/BAS ALUR 06 [3c] BAS 3 P Hadir & T Tidak Hadir - Saksi dan Putusan (5 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `86020e3fd4c2005209f13533b90fc219` |
| T055 | `1a Perceraian CT/BAS ALUR 10 [2a] BAS Ikrar Talak - P & T Hadir, Ada Beban.rtf` | TIDAK ADA: jalur lama sudah tidak ada; isinya = [2a] Ikrar (lihat baris T089/T102): tidak ditambal | `-` |
| T089 | `1a Perceraian CT - BAS/BAS ALUR 10 [2a] BAS Ikrar Talak - P & T Hadir, Ada Beban.rtf` | TIDAK DITAMBAL: blangko sudah ditulis ulang: blok titik-titik beban diganti #6054# (nafkah iddah), #6055# (mut'ah), #6071# (nafkah anak); jangkar blok lama 0 kali (diharapkan 2). Memasang #4150# akan mengganti angka terisi dengan titik-titik bila keputusan 4100-4105 belum dipilih. | `d2fcbcd83a1bcc69f7f3ef3eca0bdf39` |
| T090 | `1c Perceraian Kumulasi Itsbat Nikah/BAS ALUR 36 Cerai Kumulasi IN - Sidang Terakhir - Saksi dan Putusan Verstek (2 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `f2690b007f31b52bd7b5bc9cd031237f` |
| T091 | `1c Perceraian Kumulasi Itsbat Nikah/BAS ALUR 36 Cerai Kumulasi IN - Sidang Terakhir - Saksi dan Putusan Verstek (3 Saksi).rtf` | DIPINDAH: jalur lama sudah tidak ada (menu berpasangan "<jenis> - BAS"); pengganti: sudah memuat #4138# (ditambal paket u2) | `347b8668ef146e8cfcf82c6d8b72b799` |
| T092 | `1c Perceraian Kumulasi Itsbat Nikah/[01aa] [Kabul Verstek] IN + CG - B & F.rtf` | DIGANTI: berkas tidak ada di server (md5 lama tidak cocok dengan berkas mana pun); blangko kumulasi kini dua berkas "Format Lengkap" yang sudah ditambal paket u2 (3 jangkar) | `7fb963604ceca3853135fde7e05d0275` |
| T093 | `1c Perceraian Kumulasi Itsbat Nikah/[01aa] [Kabul Verstek] IN + CG - F.rtf` | DIGANTI: berkas tidak ada di server (md5 lama tidak cocok dengan berkas mana pun); blangko kumulasi kini dua berkas "Format Lengkap" yang sudah ditambal paket u2 (3 jangkar) | `7fb963604ceca3853135fde7e05d0275` |
| T102 | `ALUR 10 Cerai Talak Sidang Ikrar Talak/[2a] BAS Ikrar Talak - P & T Hadir, Ada Beban.rtf` | TIDAK DITAMBAL: blangko sudah ditulis ulang: blok titik-titik beban diganti #6054# (nafkah iddah), #6055# (mut'ah), #6071# (nafkah anak); jangkar blok lama 0 kali (diharapkan 2). Memasang #4150# akan mengganti angka terisi dengan titik-titik bila keputusan 4100-4105 belum dipilih. | `d2fcbcd83a1bcc69f7f3ef3eca0bdf39` |
