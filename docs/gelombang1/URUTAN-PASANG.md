# Urutan pasang paket ABT gelombang 1 (U6, U2, U3, U4, U5)

Disusun 20 Okt 2026 (agen G1) dari `abt-paket/*/PASANG.md` dan skrip `pasang-satker.sh` tiap paket, diuji ulang pada cabang `fitur/g1-gabung`.
Dijalankan oleh sesi utama dari laptop (Git Bash) ke server lewat `ssh aleta`. **Semua nomor variabel baru (131 buah) tidak bertabrakan antar paket.**

Akar paket di laptop: `/d/aleta-dev/wt/g1-gabung/abt-paket` (tulis `AKAR` di bawah). Semua berkas paket diperiksa `md5sum -c MD5SUMS.txt` di cabang ini: 0 selisih
(MD5SUMS U2 dan U6 diperbaiki pada cabang ini; berkas RTF/SQL berstatus biner di git sehingga byte-nya sama dengan saat dibangun).

```bash
AKAR=/d/aleta-dev/wt/g1-gabung/abt-paket
```

## 0. Sebelum memasang (sekali)

1. **Periksa nomor kosong di server** (pemeriksaan G1 pada 20 Okt memberi 0 baris untuk semua 131 nomor, tetapi server sempat tak terjangkau; ulangi sebelum pasang). Hasil harus kosong:
   ```bash
   ssh aleta 'bash /root/lihat-jejak.sh "SELECT no_var, LEFT(nama,50) FROM aps_badilag.abt_variabel WHERE no_var BETWEEN 4100 AND 4749"'
   ```
   Cadangan cepat: salinan `D:/aleta-dev/kerja/abt_variabel.csv` (11 Sep) juga tidak memuat nomor 4100-4749. Setiap paket juga menolak sendiri bila ada nomor jatahnya yang terpakai (tidak ada yang ditulis).
2. **Cadangan penuh** tabel variabel dan pohon blangko Derry (di luar cadangan otomatis paket):
   ```bash
   ssh aleta 'mkdir -p /root/cadangan-g1-20261020 && cd /root/cadangan-g1-20261020 \
     && MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" mysqldump -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag abt_variabel > abt_variabel-sebelum.sql \
     && tar czf blangko-derry-sebelum.tgz -C /var/www/html/aps_badilag/_blangko_abt derry_briantono && ls -l'
   ```
3. Rilis ALETA (portal + bot + ekstensi) yang memuat cabang ini boleh dipasang **sebelum atau sesudah** paket: kode portal/bot mengenal nomor baru lebih dahulu tanpa efek bila variabelnya belum ada di ABT, dan variabel baru tanpa kode portal hanya tidak punya label/penanda "diisi manual".
   Yang bergantung pada rilis (bukan pada paket): gerbang isian (`aleta_bot/config/gerbang-isian.json`, `peta-fakta-variabel.json`), katalog saksi v2 di ekstensi (tanam ulang + Reload di chrome://extensions), label isian `isian-metadata.ts`.
4. Server tidak boleh sedang dipakai mencetak/menyunting blangko Derry saat paket berjalan (paket berkas menolak bila md5 blangko lama berbeda dari yang diukur; tidak ada yang diubah).

## 1. Urutan pasang

Alasan urutan: dari yang paling aman (hanya menambah baris variabel, tanpa menyentuh blangko) ke yang paling banyak menyentuh blangko lama; jatah nomor, folder, dan berkas tiap paket tidak saling beririsan (diperiksa: tidak ada berkas RTF sama di dua paket; tidak ada kode `#41xx#-#46xx#` yang dirujuk lintas paket).

| # | paket | nomor | menyentuh blangko? |
|---|---|---|---|
| 1 | u6-fakta-sinkron | 4600-4629 (29) | tidak (hanya variabel; belum dipakai blangko mana pun) |
| 2 | u2-putusan-cerai-lengkap | 4100-4150 (35) | ya: 102 blangko lama DITAMBAL per jangkar (BAS dan putusan cerai) |
| 3 | u3-itsbat-aua | 4300-4315 (14) | ya: 8 blangko BARU (tidak menimpa) |
| 4 | u4-dk-wali-perwalian | 4400-4442 (24) | ya: 3 blangko BARU + 12 blangko lama DITIMPA (penjaga md5) |
| 5 | u5-ahli-waris | 4500-4543 (29) | ya: 3 blangko lama DITIMPA (penjaga md5) |

Sesudah tiap paket baca keluaran benarnya; **bila satu paket gagal, berhenti** (paket memulihkan dirinya sendiri) dan jangan lanjut ke berikutnya sebelum sebabnya jelas.

### 1.1 u6-fakta-sinkron (hanya variabel; tanpa skrip pasang, perintah manual)

```bash
cd $AKAR/u6-fakta-sinkron
ssh aleta 'mkdir -p /root/abt-u6-20261020'
scp PASANG.sql PERIKSA.sql PULIH-HAPUS-BARU.sql MD5SUMS.txt aleta:/root/abt-u6-20261020/
ssh aleta 'cd /root/abt-u6-20261020 && md5sum -c MD5SUMS.txt | grep -v OK$'      # keluaran: hanya baris variabel.json bila tak ikut disalin; PASANG/PERIKSA/PULIH harus OK
ssh aleta 'cd /root/abt-u6-20261020 && export MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" \
  && mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag < PASANG.sql \
  && mysql -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag < PERIKSA.sql | tail -3'
```
- Benar: PASANG tanpa galat (`ERROR 1242` = ada nomor 4600-4629 terpakai, tidak ada yang ditulis); PERIKSA: semua `cocok = 1`, baris terakhir `SEMUA COCOK`.
- Pulih: `mysql ... aps_badilag < PULIH-HAPUS-BARU.sql` (hapus 4600-4699), lalu `SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4600 AND 4699` harus 0.
- Dampak ke blangko lama: tidak ada.

### 1.2 u2-putusan-cerai-lengkap (variabel 4100-4150 + 102 blangko ditambal)

```bash
cd $AKAR/u2-putusan-cerai-lengkap
ssh aleta 'mkdir -p /root/abt-u2-20261020'
scp paket-satker/* aleta:/root/abt-u2-20261020/
ssh aleta 'cd /root/abt-u2-20261020 && md5sum -c MD5SUMS.txt | grep -vc ": OK$"'      # harus 0
ssh aleta 'bash /root/abt-u2-20261020/pasang-satker.sh'
```
- Benar: `RINGKAS COCOK=...` (praperiksa), `PRASYARAT COCOK - memasang`, tabel PERIKSA semua `cocok = 1`, `SEMUA COCOK`, `RINGKAS DITAMBAL=N SUDAH=0 LEWAT=M`, `RINGKAS COCOK=0 SUDAH=N`, `SELESAI`.
  Berkas `LEWAT` = jangkar tidak ditemukan pada blangko itu: blangko itu TIDAK disentuh; laporkan daftarnya, jangan dipaksa.
- Periksa sesudah: `ssh aleta 'cat /root/abt-u2-20261020/cadangan/tambal-hasil.txt | tail'`, dan di ABT buka satu putusan cerai gugat dengan petitum nafkah anak: popup memuat isian 4100-4109.
- Pulih: `ssh aleta 'bash /root/abt-u2-20261020/pulih-satker.sh'` (kembalikan RTF dari `cadangan/`, hapus 4100-4299 yang masih berisi paket).
- Dampak ke blangko lama: **diubah di tempat** (variabel baru disisipkan pada jangkar; nilai bawaan variabel kosong = bunyi lama, sehingga putusan tanpa tuntutan identik dengan sebelumnya); cadangan utuh per berkas di `cadangan/`.
  Syarat: server memerlukan `perl` (modul MIME::Base64, tanpa Digest::MD5) dan 7 variabel lama (8505, 8527, 4001, 8530, 8554, 8602, 5114).

### 1.3 u3-itsbat-aua (variabel 4300-4315 + 8 blangko baru)

```bash
cd $AKAR/u3-itsbat-aua
ssh aleta 'mkdir -p /root/paket-abt/abt-u3-itsbat-aua'
scp -r paket-satker/* aleta:/root/paket-abt/abt-u3-itsbat-aua/
ssh aleta 'cd /root/paket-abt/abt-u3-itsbat-aua && md5sum -c MD5SUMS.txt | grep -vc ": OK$"'      # harus 0
ssh aleta 'bash /root/paket-abt/abt-u3-itsbat-aua/pasang-satker.sh'
```
- Benar: `PRASYARAT COCOK (0|105|5)`, `CADANGAN ... harus 0`, `SEMUA COCOK`, `uji perkara N: 6 kueri menjawab` (2 perkara), `PASANG=8`, `COCOK=8`, `BERKAS COCOK`, `SELESAI`.
- Pulih: `ssh aleta 'bash /root/paket-abt/abt-u3-itsbat-aua/pulih-satker.sh'` -> `PULIH=8` dan `PULIH COCOK` (berkas baru yang sudah disunting dibiarkan dan dilaporkan).
- Dampak ke blangko lama: **tidak ada yang ditimpa**. Baru: `2 Itsbat Nikah` [01d] dan [01e]; `8 Asal Usul Anak` [01a] [01b] [01c]; BAS: `2 Itsbat Nikah - BAS` ALUR 11 [1b] [1c] dan `8 Asal Usul Anak - BAS` ALUR 13 [1b].

### 1.4 u4-dk-wali-perwalian (variabel 4400-4442 + 3 blangko baru + 12 blangko lama ditimpa)

```bash
cd $AKAR/u4-dk-wali-perwalian
ssh aleta 'mkdir -p /root/abt-u4-20261020'
scp -r paket-satker/* aleta:/root/abt-u4-20261020/
ssh aleta 'cd /root/abt-u4-20261020 && md5sum -c MD5SUMS.txt | grep -v OK'      # harus kosong
ssh aleta 'bash /root/abt-u4-20261020/pasang-satker.sh'
```
- Benar: `PRASYARAT COCOK (0|0|130|0|0)`, `BERKAS SIAP` (`SIAP_TIMPA=12`), `SEMUA COCOK`, baris `uji perkara NNNN: 44xx ...`, `BUAT=3 TIMPA=12`, `BERKAS COCOK`, `SELESAI`.
- Bila `GAGAL: berkas ... sudah berubah (md5 ...)`: salah satu dari 12 blangko lama disunting sesudah 20 Okt - TIDAK ada yang diubah. Penyelesaian: `U4_ASLI=<salinan folder derry_briantono terbaru> python sumber/susun_timpa.py` lalu `python sumber/bangun_paket.py`, salin ulang paket.
- Pulih: `ssh aleta 'bash /root/abt-u4-20261020/pulih-satker.sh'` -> `PULIH COCOK` dan `BERKAS PULIH` (12 berkas lama kembali persis dari cadangan; 3 berkas baru dihapus).
- Dampak ke blangko lama: **12 ditimpa** (daftar + md5 lama/baru: `paket-satker/daftar-timpa.tsv`): DK [01] x2, [02] x2, [03], [03a], [03b], [03c]; Wali Adhal [01], [01a], [03]; Perwalian ortu kandung Kabul. Baru: `3 Dispensasi Kawin` [01c] [01d], `6 Perwalian` [01b].
- Prasyarat paket: paket DK/Perwalian/Wali Adhal terbaru sudah terpasang (md5 blangko lama dicocokkan; beda = berhenti tanpa mengubah).

### 1.5 u5-ahli-waris (variabel 4500-4543 + 3 blangko lama ditimpa)

```bash
cd $AKAR/u5-ahli-waris
ssh aleta 'mkdir -p /root/abt-u5-20261020/rtf'
scp paket-satker/abt-u5-*.sql paket-satker/*.sh paket-satker/MD5SUMS.txt aleta:/root/abt-u5-20261020/
scp paket-satker/rtf/*.rtf aleta:/root/abt-u5-20261020/rtf/
ssh aleta 'cd /root/abt-u5-20261020 && md5sum -c MD5SUMS.txt'      # semua OK
ssh aleta 'bash /root/abt-u5-20261020/pasang-satker.sh'
```
- Benar: `PRASYARAT COCOK - memasang`, tabel PERIKSA cocok = 1 di 30 baris, `SEMUA COCOK`, tiga `ls -l` blangko (pemilik apache apache), `SELESAI`.
- Bila skrip menolak karena md5 blangko satker sudah berbeda dari yang diukur 20 Okt: ambil RTF terbaru dari server, jalankan `python -I alat/tambal_rtf.py <folder-rtf-terbaru> <keluar>` lalu `python -I alat/bangun_paket.py` (setelah mengganti `asli-server-20okt/`).
- Pulih: `ssh aleta 'bash /root/abt-u5-20261020/pulih-satker.sh'` (hapus 4500-4599 dan kembalikan 3 RTF dari `cadangan/`).
- Dampak ke blangko lama: **3 ditimpa** di `9 Penetapan Ahli Waris`: [01], [01b], [01c] (sebelum: bunyi mati "tidak mempunyai anak angkat", "tidak meninggalkan wasiat apa pun" dst. kini lewat variabel dengan nilai bawaan = bunyi lama; [01b] juga dilengkapi 9700-9704 dan 9718).

## 2. Pemeriksaan akhir (sesudah kelima paket)

```bash
ssh aleta 'bash /root/lihat-jejak.sh "SELECT COUNT(*) AS baru FROM aps_badilag.abt_variabel WHERE no_var BETWEEN 4100 AND 4749"'   # harapan: 131
ssh aleta 'bash /root/lihat-jejak.sh "SELECT COUNT(*) FROM aps_badilag.abt_variabel"'                                              # harapan: 1767 + 131 = 1898
```
Lalu uji tangan di ABT (tiap paket punya daftar uji di PASANG.md-nya): satu putusan cerai gugat dengan petitum nafkah anak (U2), satu itsbat nikah baru dengan [01d] (U3), satu DK `[01c]` (U4), satu penetapan ahli waris `[01b]` (U5), dan satu BAS cerai yang memuat jawaban saksi baru; terakhir Reload ekstensi supaya katalog saksi v2 dan pohon blangko termuat.

## 3. Pulih menyeluruh

Pulihkan dalam urutan TERBALIK (u5, u4, u3, u2, u6) dengan `pulih-satker.sh` masing-masing (u6: `PULIH-HAPUS-BARU.sql`). Bila ada yang tidak memulihkan, cadangan penuh di `/root/cadangan-g1-20261020`:
`mysql ... aps_badilag < abt_variabel-sebelum.sql` memuat ulang tabel variabel (hanya bila `DELETE FROM abt_variabel WHERE no_var BETWEEN 4100 AND 4749` dijalankan lebih dulu), dan `tar xzf blangko-derry-sebelum.tgz -C /var/www/html/aps_badilag/_blangko_abt` mengembalikan pohon blangko (periksa pemilik `apache:apache`).

## 4. Catatan penting

- Server berkas sistem: `python` 2.7, `perl` tanpa Digest::MD5, DB SIPP bernama `SIPP`, DB ABT `aps_badilag` (MariaDB 5.5): skrip paket sudah menyesuaikan; jangan menyalin paket lewat editor (hex literal harus utuh).
- Penafian isi hukum: RTF dan pertimbangan otomatis memuat rujukan pasal yang sebagian belum terverifikasi; hakim memeriksa `docs/gelombang1/PERIKSA-PASAL-HAKIM.md` (bagian A) sebelum paket dipakai untuk perkara nyata.
- Rilis ALETA yang menyertai: bot membawa gerbang baru (`gerbang-isian.json`, 109 kode terukur) sehingga isian pengisi U1-U5 yang belum terukur tetap berupa saran "ragu - periksa".
