# Urutan pasang paket ABT gelombang 2 (W2b): keluarga dan lain-lain + susulan cerai

Disusun 21 Okt 2026 (agen induk W2b). Dijalankan sesi utama dari laptop (Git Bash) ke server lewat `ssh aleta`. Paket W2a (kebendaan) dan W3 punya berkas sendiri; jatah nomor W2b 4850-4949 tidak beririsan dengan paket gelombang 1 (4100-4150, 4300-4315, 4400-4442, 4500-4543, 4600-4629).

| # | paket | nomor | menyentuh blangko? | prasyarat (baca saja) |
|---|---|---|---|---|
| 1 | `abt-paket/u2b-cerai-susulan` | tidak ada variabel baru | ya: 12 BAS cerai (ALUR 02/03/06 "Saksi dan Putusan") ditambal `#4138#` per jangkar, penjaga md5 | `35\|1\|1` (variabel 4100-4150 ada 35, 4138 data_sql, 8505 ada) |
| 2 | `abt-paket/w2b-keluarga-lain` | 4850-4949 (70 dipakai) | ya: 14 blangko BARU + 31 blangko lama DITIMPA (penjaga md5) | `0\|0\|204\|0\|0` |

Urutan 1 dan 2 boleh dibalik (tidak ada berkas atau variabel yang sama). Syarat: paket u2 (4100-4150) sudah terpasang (sudah, 20 Okt 22.32).
Setiap paket menolak sendiri (tanpa menulis apa pun) bila prasyarat atau md5 berkas lama tidak cocok, dan memulihkan dirinya bila gagal sesudah mulai menulis.

## 0. Sebelum memasang

```bash
ssh aleta 'bash /root/lihat-jejak.sh "SELECT COUNT(*) FROM aps_badilag.abt_variabel WHERE no_var BETWEEN 4850 AND 4949"'     # harus 0
ssh aleta 'mkdir -p /root/cadangan-w2b-20261021 && cd /root/cadangan-w2b-20261021 \
  && MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" mysqldump -h 127.0.0.1 -u root --default-character-set=latin1 aps_badilag abt_variabel > abt_variabel-sebelum.sql \
  && tar czf blangko-derry-sebelum.tgz -C /var/www/html/aps_badilag/_blangko_abt derry_briantono && ls -l'
```
Server tidak boleh sedang dipakai mencetak/menyunting blangko Derry saat paket berjalan.

## 1. u2b-cerai-susulan

```bash
cd $AKAR/abt-paket/u2b-cerai-susulan
ssh aleta 'mkdir -p /root/abt-u2b-20261021' && scp -r paket-satker/* aleta:/root/abt-u2b-20261021/
ssh aleta 'cd /root/abt-u2b-20261021 && md5sum -c MD5SUMS.txt | grep -vc ": OK$"'      # 0
ssh aleta 'bash /root/abt-u2b-20261021/pasang-satker.sh'
```
Benar: `RINGKAS COCOK=12 SUDAH=0 LEWAT=0`, `DITAMBAL=12`, `COCOK=0 SUDAH=12`, `SELESAI`. Pulih: `pulih-satker.sh`. Rinci: `abt-paket/u2b-cerai-susulan/PASANG.md`.

## 2. w2b-keluarga-lain

Lihat `abt-paket/w2b-keluarga-lain/PASANG.md` (perintah, keluaran benar, pulih, uji tangan). Ringkas:

```bash
cd $AKAR/abt-paket/w2b-keluarga-lain
ssh aleta 'mkdir -p /root/abt-w2b-20261021' && scp -r paket-satker/* aleta:/root/abt-w2b-20261021/
ssh aleta 'cd /root/abt-w2b-20261021 && md5sum -c MD5SUMS.txt | grep -vc ": OK$"'      # 0
ssh aleta 'bash /root/abt-w2b-20261021/pasang-satker.sh'
```
Benar: `PRASYARAT COCOK (0|0|204|0|0)`, `SIAP_TIMPA=31`, `SEMUA COCOK`, 17 blok `uji perkara`, `BUAT=14 TIMPA=31`, `COCOK=45`, `BERKAS COCOK`, `SELESAI`.

## 3. Bergantung pada rilis (bukan pada paket)

Katalog saksi v2 sembilan jenis (ekstensi), peta fakta (+26 fakta) dan `belumTerukur` (+26 kode) di `aleta_bot/config`, pengisi `isiOtomatisW2b/{poligami,anak,lain}.js` + tiga sambungan sempit, entri `isian-metadata.ts` (isian manual/opsional). Saat menggabung dengan cabang W2a/W3: `ekstensi-sipp/saksi-katalog-data.js` dan `aleta_bot/config/*.json` hampir pasti konflik; selesaikan dengan
`node manajemen_surat/scripts/susun-saksi-katalog.mjs` dan `node abt-paket/w2b-keluarga-lain/alat/gabung_config.cjs --tulis` (idempoten).

## 4. Uji tangan di satker (sesudah pasang)

1. Buka perkara izin poligami (mis. 252/Pdt.G/2024 atau 376/Pdt.G/2025): panel Blangko Derry menampilkan varian baru `[01a]`/`[01b]`/`[03a]`/`[03b]`; pilih varian sesuai kehadiran Termohon; kalimat `[PERIKSA ...]` muncul bila isian 4851 (alasan keberatan) kosong pada varian keberatan.
2. Perkara pengangkatan anak (mis. salah satu dari 6 perkara 369 2019-2025): `[01] Kabul` memuat pertimbangan PP 54/2007; `[PERIKSA ...]` pada 4918 bila umur Pemohon I di luar 30-55.
3. Perkara hak asuh/penguasaan/nafkah anak: isian baru 4884-4905 kosong = blangko tampil seperti sebelumnya (kecuali kalimat umur anak dan kewenangan relatif).
4. Permohonan umum: blangko `[01] Kabul` / `[03] Tolak` baru; jenis permohonan, dasar kewenangan, fakta dan amar pokok adalah isian hakim.
