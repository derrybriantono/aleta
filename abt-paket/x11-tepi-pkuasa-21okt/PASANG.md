# Paket ABT `abt-x11-tepi-pkuasa-21okt` - hapus penutup saksi di 7 perkara tepi + dua BAS "P (Kuasa)" (21 Okt 2026)

**Status: teruji di ABT LAPTOP (pasang, pasang ulang, pulih, pasang lagi; isi tabel dan md5 berkas kembali SAMA persis sesudah pulih) dan semua angka sasaran dikonfirmasi BACA SAJA di server (MariaDB 5.5) dengan fungsi x6/x7 yang sudah terpasang. Server: BELUM dipasang - dipasang sesi utama (sesudah x6 dan x7).**

Keputusan pengguna 21 Okt: (a) 7 perkara tanpa catatan Minutasi yang x7 lewati (proses terakhir 293/296) ikut dibersihkan; (c) dua BAS "P (Kuasa)" non-Derry boleh disunting "asal pakai kuasa"; (b) pembersihan itu harus otomatis ke depan -> KODE bot, bukan paket (di bawah).

## Isi paket

1. **(a) HAPUS** dari `aps_badilag.abt_keterangan_saksi` baris yang jawabannya SELURUHNYA kalimat penutup (`isian_rtf_penutup(jawaban, pertanyaan) = 1`, x6; "tidak sanggup lagi" ikut pertanyaan) pada perkara yang ada di `SIPP.perkara` dan **tanpa baris `perkara_proses` proses 220 (Minutasi)** - proses terakhir berapa pun (x7 membatasi `< 220`). Perkara yang punya catatan Minutasi tidak disentuh. Cadangan lengkap: `cadangan/baris-dihapus.sql` (INSERT IGNORE per baris, semua kolom), `id-hapus.txt`, `per-perkara-sebelum.tsv` / `-sesudah.tsv`.
2. **(c) RTF**: `berita_acara_sidang/1 BAS Pertama Standar/` `01-b. BAS Pertama P (Kuasa) Tidak Hadir ... PKuasanya ...rtf` dan `01-c. BAS Pertama P (Kuasa) Hadir ... Tunda Panggil T.PA.Mj.rtf` (di server masing-masing satu salinan): "surat kuasa khusus tanggal #0207# ... nomor #0197# tanggal #0184#" -> `#0184#` (satu-satunya, = tanggal surat kuasa yang tercetak dua kali) diganti `#0111#` (tgl register SIPP), logika skrip x10 `alat/usulan_rtf_pkuasa.py`. Panjang berkas sama; md5 sebelum/sesudah dikunci di `rtf-md5.txt` (`c64698d8... -> 58703bde...`, `3d3ad23d... -> be3ce1b8...`); berkas yang md5/jumlah penandanya tak persis = GAGAL sebelum menulis apa pun; ditulis ke berkas yang sama (`cat >`, pemilik/izin tetap); cadangan berkas di `cadangan/rtf/*.sebelum-x11`.
3. Tidak ada `abt_variabel`, blangko Derry, fungsi, menu, atau SIPP yang disentuh. Tanpa kata merek ke DB. Tanpa variabel baru.

## PRASYARAT yang diharapkan

`1|1|2|1` = A x6 terpasang (1) \| B `isian_rtf_penutup` ada (1) \| C tabel SIPP `perkara` dan `perkara_proses` (2) \| D x7 terpasang (`isian_rtf_keterangan` memakai penyaring) (1). **SUDAH dijalankan baca saja di server: `1|1|2|1`.**
Pasang ulang aman (RTF sudah diubah dikenali lewat md5 sesudah; baris: MODE tanpa kandidat = hanya PERIKSA).

## Angka (server, baca saja, 21 Okt 2026 sesudah x7)

| | |
|---|---|
| seluruh baris keterangan saksi (T) | 69.375 |
| baris di perkara tanpa catatan Minutasi (R) | 1.136 |
| **baris penutup yang dihapus (C)** | **17 di 7 perkara** |
| berkas RTF diubah | 2 |

Per perkara (perkara_id; baris -> penutup): 9825 (48 -> 3), 9878 (82 -> 4), 9941 (30 -> 2), 9975 (28 -> 2), 9991 (30 -> 2), 10000 (28 -> 2), 10010 (28 -> 2). Sesudah: baris 69.358 (T-17) = 1.119 di perkara tanpa catatan; per perkara baris - penutup. `DAFTAR.sql` sungguhan di server = 17 id, identik dengan aturan JS.
Keluaran pasang yang benar: `PRASYARAT (1|1|2|1)`, `RTF: perlu diubah=2 sudah-diubah=0`, `SEBELUM: seluruh baris=69375; baris di perkara tanpa catatan Minutasi=1136; baris penutup yang dihapus=17`, `CADANGAN: ... (baris dihapus tercadang: 17; perkara: 7; berkas RTF: 2)`, `HAPUS: 17 baris dihapus (diharapkan 17)`, `RTF: 2 berkas diubah`, `PERIKSA: 1 butir cocok - SEMUA COCOK`, `SESUDAH: seluruh baris=69358; ...=1119; baris penutup=0`.

## Pasang (Git Bash, server hidup; SETELAH x6 dan x7)

```bash
cd /d/aleta-dev/wt/w47/abt-paket/x11-tepi-pkuasa-21okt     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-x11-20261021'
scp -r paket-satker/* aleta:/root/abt-x11-20261021/
ssh aleta 'cd /root/abt-x11-20261021 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-x11-20261021/pasang-satker.sh'
```
Pulih: `ssh aleta 'bash /root/abt-x11-20261021/pulih-satker.sh'` (`BARIS: ... ada-sekarang=17`, `RTF: kembali=2`, `PULIH COCOK`). Gagal sesudah CADANGAN = pulih otomatis. Tidak perlu memulai ulang apa pun.

## Hasil uji laptop (`sumber/uji_lokal.sh`)

Basis `aps_badilag_x11` = sampel server SESUDAH x7 (6.077 baris), 20 fungsi persis server + x6 + x7; `sipp_x11` = status perkara server; salinan dua BAS server. PASANG: `1|1|2|1`, `SEBELUM 6077|1136|17`, `HAPUS 17 (diharapkan 17)`, RTF 2 berkas, PERIKSA cocok, `SESUDAH 6060|1119|0`; **id terhapus = harapan JS (17 sama)**; perkara bercatatan Minutasi tak berubah; md5 RTF sesudah = kunci paket, berkas lain di folder yang sama utuh. Pasang ulang: RTF `sudah-diubah=2`, tak ada yang berubah. PULIH: `BARIS tercadang=17 dikembalikan=17`, `RTF kembali=2`, `PULIH COCOK`; **isi tabel dan md5 berkas SAMA persis dengan awal**. Pasang lagi: sama dengan pasang pertama.

## (b) Otomatis ke depan - KODE bot (bukan paket)

`aleta_bot/services/bersihPenutupSaksiService.js`:
- **Kapan**: cron harian bot **05.40** (`app.js`; dilewati di mode kembaran; matikan dengan `ALETA_BERSIH_PENUTUP_OTOMATIS=0`) dan rute internal `POST /abt/bersih-penutup-saksi { perkaraId?, kering? }` (bisa dipanggil ALETA kapan saja per perkara, mis. sesudah membaca/menyimpan keterangan saksi).
- **Apa**: membaca baris `abt_keterangan_saksi` yang mungkin penutup, memutuskan dengan `adalahKalimatPenutupSaksi(jawaban, pertanyaan)` (aturan yang sama dengan x6/x7; jawaban dibaca dari byte asli ABT), lalu menyisakan hanya perkara yang ada di SIPP dan TANPA `perkara_proses` 220. Yang sudah punya catatan Minutasi tidak pernah disentuh. Baris keterangan perkara tidak disentuh (yang dihapus hanya yang seluruhnya penutup; tiap penghapusan juga memeriksa md5 jawaban: baris yang diubah petugas sejak dibaca tidak dihapus).
- **Cadangan**: sebelum menghapus, SEMUA baris kandidat ditulis lengkap (teks sebagai HEX byte-asli) ke `reports/cadangan-penutup-saksi/penutup-saksi-<tanggal-jam>.jsonl` - folder `reports` sudah di-mount ke `/var/www/html/aleta-data/reports` di server (tidak hilang saat wadah dibuat ulang; `ALETA_BERSIH_PENUTUP_DIR` untuk folder lain). Jumlah baris dibaca ulang; kurang dari seharusnya = tidak ada yang dihapus. Tidak ada yang ditulis ke tabel SIPP/ABT selain penghapusan itu; tak ada kata merek di DB.
- **Pulih**: `POST /abt/pulih-penutup-saksi { berkas: "penutup-saksi-....jsonl", kering? }` -> INSERT IGNORE persis dari berkas (yang sudah ada tidak ditimpa).
- Terdaftar di `JALUR_TULIS_SIPP` (`penjagaTandaSipp.js`); uji `bersih-penutup-saksi-otomatis-21okt.test.ts` (kolam MySQL ditiru: hanya perkara belum minutasi, penutup utuh, "tidak sanggup lagi" ikut pertanyaan, perkara tak ada di SIPP tak disentuh, cadangan lebih dulu, pulih persis, mode kering, baris yang berubah di sela tidak dihapus).
- Cron memakai kolam ABT/SIPP bot yang sama (`db_config5`/`db_config`), sehingga di mode kembaran tulisan dialihkan penjaga kembaran seperti tulisan lain. Perlu bot terpasang ulang (versi portal/bot) agar cron aktif.

## Yang TIDAK diubah

1. Perkara dengan catatan Minutasi (arsip = putusan/BAS bertanda tangan).
2. Berkas BAS lain; hanya dua BAS P (Kuasa) di atas (`#0184#` tetap di 200 blangko lain sebagai tanggal surat kuasa).
