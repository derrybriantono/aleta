# Paket ABT `abt-titik-koma-data-30okt` - titik koma di tengah jawaban tabel tanya jawab BAS dirapikan (30 Okt 2026)

**Status: diuji di basis salinan laptop (`aps_badilag_bas29`). Server: BELUM dipasang - dipasang sesi utama.**

**Keputusan pengguna 30 Okt: DISETUJUI** - titik koma di tengah jawaban tabel tanya jawab BAS dirapikan di DATA TERSIMPAN
(";" di tengah jadi ","), dengan cadangan dan pulih. Masuk **URUTAN PASANG WAJIB** sesudah `../ket-saksi-baris-30okt` dan
`../titik-koma-30okt` (PRASYARAT memeriksa keduanya; belum terpasang = berhenti tanpa mengubah apa pun).

**PERHATIAN - paket ini MENGUBAH DATA TERSIMPAN** `abt_keterangan_saksi.jawaban` (hanya tanda baca dan spasi; huruf dan angka
diperiksa sama; bisa dipulihkan persis dari cadangan).

## Masalah
Tabel tanya jawab BAS dicetak PHP ABT APA ADANYA dari `abt_keterangan_saksi`, jadi perapian di perangkai putusan
(`titik-koma-30okt`) tidak sampai ke BAS: "tidak berhasil;karena ..." tetap tercetak di BAS sementara putusan sudah
"tidak berhasil, karena ...". Diukur di dump server 28 Okt (sesudah ket-saksi-baris): **615 jawaban** yang titik komanya
di tengah (513) atau ganda (";;", ":;", ";" di awal) di **301 perkara**.

## Isi
- `PASANG.sql`: satu transaksi `UPDATE ... SET jawaban = isian_rtf_butir_rapi(jawaban, '')` HANYA untuk jawaban yang titik
  komanya berubah oleh perapi (ujung jawaban tidak ditambah; pertanyaan tidak disentuh - 0 baris).
- `PEMICU.sql`: pemicu `abt_keterangan_saksi_satu_baris_bi/_bu` (milik ket-saksi-baris; MariaDB 5.5 hanya boleh satu pemicu per
  waktu/peristiwa) diperluas: ganti baris -> spasi tetap, lalu jawaban `isian_rtf_butir_rapi(..., '')`. Jawaban BARU dari
  penyunting ABT maupun panel ikut rapi; aturannya sama dengan perapi panel (`rapiButir`, kembar fungsi - lihat titik-koma-30okt).
- Cadangan `cadangan/jawaban-sebelum.sql` (mysqldump baris yang akan diubah) dibuat SEBELUM apa pun diubah.

## Pasang / pulih (server, root, dari folder `paket-satker`)
```
bash pasang-satker.sh   # md5 -> PRASYARAT 1|2|0|0|N -> cadangan (jumlah = N) -> PEMICU -> rapikan data -> PERIKSA DATA -> PERIKSA
bash pulih-satker.sh    # pemicu kembali ke badan ket-saksi-baris DULU, lalu jawaban dikembalikan dari cadangan bila masih hasil paket
```
PERIKSA DATA: baris cadangan | hilang | bukan hasil rapi | beda huruf/angka | pertanyaan berubah = `N|0|0|0|0`; gagal = pulih otomatis.
Pasang ulang aman (`1|0|2|0|0` = hanya PERIKSA). Bila ket-saksi-baris kelak dipulihkan, pemicunya (nama sama) ikut terhapus -
pulihkan paket ini lebih dulu.

## Hasil uji (`hasil/`)
- `uji-lokal.txt`: sidik seluruh tabel sebelum pasang = sesudah pulih (SAMA PERSIS), uji pemicu (sisip dan ubah) pada baris uji
  yang langsung dihapus, pasang lagi.
- `render-ringkasan.json`: render php56 ABT asli BAS 9780 (CG 288/2026, sidang 2) 8 -> 2, 9864 (CG 361/2026) 6 -> 2, 9536 (itsbat 66/Pdt.P/2026) 1 -> 1 titik koma di tengah; sisa = teks blangko BAS sendiri (susunan majelis, kalimat pilihan). Contoh 9780: "...adalah suami istri sah; yang menikah tahun 2013;" -> "...suami istri sah, yang menikah tahun 2013;" (sama dengan putusan).
