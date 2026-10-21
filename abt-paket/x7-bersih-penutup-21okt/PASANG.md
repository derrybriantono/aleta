# Paket ABT `abt-x7-bersih-penutup-21okt` - bersihkan kalimat penutup saksi yang TERSIMPAN (perkara belum minutasi) (21 Okt 2026)

**Status: teruji di ABT LAPTOP (PRASYARAT, pasang, PERIKSA, pasang ulang, pulih, PRASYARAT, pasang lagi; isi tabel sesudah pulih sama persis dengan awal) dan semua angka sasaran dikonfirmasi BACA SAJA di server (MariaDB 5.5) memakai fungsi x6 yang SUDAH terpasang di sana: PRASYARAT server = `1|1|2|1|0`, HITUNG `69427|914|52`, DAFTAR 52 id identik dengan aturan JS, PERKARA 27 perkara. Server: x7 BELUM dipasang - dipasang sesi utama.**

Keputusan pengguna: isian tersimpan yang masih memuat kalimat penutup saksi dibersihkan otomatis, kecuali perkara yang sudah minutasi (arsipnya harus sama dengan putusan/BAS yang ditandatangani).

## Yang dilakukan (dan yang tidak)

1. **HAPUS** dari `aps_badilag.abt_keterangan_saksi` baris yang jawabannya **SELURUHNYA** kalimat penutup - `isian_rtf_penutup(jawaban, pertanyaan) = 1` dari paket x6 (pola bot; "tidak sanggup lagi" mengikuti pertanyaan, keputusan 17 Okt) - **hanya untuk perkara BELUM minutasi**.
2. **Belum minutasi** = perkara ada di `SIPP.perkara` dengan `proses_terakhir_id < 220` (Minutasi) **dan** tanpa baris `perkara_proses` `proses_id = 220`. Kolom `perkara_putusan.tanggal_minutasi` TIDAK dipakai: terisi untuk 10.125 dari 10.125 putusan (kolom mati, = tanggal putusan). Perkara yang tak punya catatan Minutasi tetapi sudah lewat tahap itu (293 Penetapan Hari Sidang Ikrar Talak, 296 Pembuatan Akta Cerai) sengaja TIDAK disentuh.
3. **Cadangan lengkap** baris yang dihapus: `cadangan/baris-dihapus.sql` (mysqldump `--insert-ignore --complete-insert` per baris, semua kolom), `cadangan/id-hapus.txt`, `cadangan/per-perkara-sebelum.tsv` / `per-perkara-sesudah.tsv` (perkara_id, jumlah baris), `cadangan/fungsi-sebelum.sql`. PULIH mengembalikan persis (INSERT IGNORE: yang sudah ada tidak ditimpa).
4. **Jawaban lisan** (`isian_rtf_keterangan`, variabel 9252-9254 JAWABAN/REPLIK/DUPLIK RAPI, tabel `abt_keterangan_terdakwa`) kini juga melewati baris yang seluruhnya penutup (fungsi diganti; nama dan tanda tangan sama; md5 definisi lama `9b005e64...`). Datanya TIDAK dihapus: 6 baris penutup di tabel itu semuanya di perkara yang sudah minutasi.
5. Tidak ada baris `abt_variabel`, blangko (RTF), menu, `abt_data_teks`, atau SIPP yang diubah. Tidak ada variabel baru. `modifier` tak ada yang ditulis. Tanpa kata nama aplikasi ke DB.
6. **Baris keterangan perkara tidak disentuh**: DELETE hanya `id` yang ada di DAFTAR **dan** yang masih memenuhi syarat belum-minutasi + penutup-utuh saat dihapus; jumlah yang terhapus harus sama dengan daftar atau semua dipulihkan.

## Angka (server, baca saja, 21 Okt 2026)

| | |
|---|---|
| seluruh baris `abt_keterangan_saksi` (T) | 69.427 |
| baris di perkara belum minutasi (R) | 914 |
| **baris penutup yang akan dihapus (C)** | **52 di 27 perkara** |
| - proses 200 Persidangan (belum putus) | 25 perkara / 48 baris |
| - proses 210 Putusan, belum minutasi | 1 perkara / 2 baris |
| - proses 218 Pemberitahuan Putusan, belum minutasi | 1 perkara / 2 baris |
| tepi: tanpa catatan 220 tapi proses 293/296 (tidak disentuh) | 7 perkara / 17 baris |
| perkara sudah minutasi (tidak disentuh) | 4.265 baris penutup di 2.023 perkara |

Angka per perkara (perkara_id saja; baris sebelum -> penutup dihapus -> sesudah): `hasil/per-perkara-harapan.tsv` (27 perkara; jumlah 848 -> -52 -> 796). Paket server menulis padanannya sendiri di `cadangan/per-perkara-*.tsv`.
Hasil kueri baca-saja di server (T, R, C versi id aturan-JS, perkara C, tepi): `69427 | 914 | 52 | 27 | 17`; HITUNG.sql/DAFTAR.sql/PERKARA.sql sungguhan (dengan fungsi x6 terpasang) di server: `69427|914|52`, 52 id (= daftar JS), 27 perkara (daftar di atas).
Bukti x6 di server: HITUNG x6 (kelompok saksi yang keluaran `isian_rtf_ket_saksi`-nya memuat butir penutup) = **0** (sebelum x6: 4.179 dari 4.789).

## PRASYARAT yang diharapkan

`1|1|2|1|0` = A paket x6 terpasang (`isian_rtf_ket_saksi` memanggil penyaring) (1) \| B `isian_rtf_penutup` ada (1) \| C tabel SIPP `perkara` dan `perkara_proses` ada (2) \| D `isian_rtf_keterangan` masih tepat versi I3 - md5 definisi (1) \| E sudah memakai penyaring (0).
Pasang ulang: `1|1|2|0|1`. Selain itu berhenti dan tidak ada yang diubah (mis. `0|0|2|1|0` = x6 belum terpasang).
Keluaran pasang yang benar di server: `MODE BARU (SIPP=<nama basis SIPP>)`, `SEBELUM: seluruh baris=69427; baris di perkara belum minutasi=914; baris penutup yang dihapus=52` (angka dapat bergeser bila ada isian baru sejak 21 Okt), `CADANGAN: ... (baris dihapus tercadang: 52; perkara: 27)`, `HAPUS: 52 baris dihapus (diharapkan 52)`, `PERIKSA: 5 butir cocok - SEMUA COCOK`, `SESUDAH: seluruh baris=69375; baris di perkara belum minutasi=862; baris penutup=0`, `SELESAI`.

## Pasang (Git Bash, server hidup; SETELAH x6)

```bash
cd /d/aleta-dev/wt/w35/abt-paket/x7-bersih-penutup-21okt     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-x7-20261021'
scp -r paket-satker/* aleta:/root/abt-x7-20261021/
ssh aleta 'cd /root/abt-x7-20261021 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-x7-20261021/pasang-satker.sh'
```
Nama basis SIPP dibaca skrip dari wadah bot (`SIPP_DB` bila diberikan). Pulih: `ssh aleta 'bash /root/abt-x7-20261021/pulih-satker.sh'` (baris terakhir `PULIH COCOK`; `BARIS: tercadang=52 ... ada-sekarang=52`). Gagal sesudah CADANGAN = pulih otomatis. Pasang ulang aman (MODE ULANG; menghapus lagi hanya baris penutup BARU di perkara belum minutasi, dengan cadangan baru bertanda waktu).

## Hasil uji (21 Okt 2026) - `hasil/ringkasan-uji.json`

- **Siklus ABT laptop** (`sumber/uji_lokal.sh`; basis `aps_badilag_x7` = sampel 215 perkara / 6.129 baris + terdakwa penuh + 20 fungsi persis server + x6; `sipp_x7` = status perkara server): PRASYARAT `1|1|2|1|0` -> pasang (`SEBELUM 6129|914|52` -> `HAPUS 52 (diharapkan 52)`, PERIKSA 5 butir cocok, `SESUDAH 6077|862|0`; **id yang terhapus = id harapan aturan JS (52 sama)**; sidik jari perkara minutasi dan tabel terdakwa TIDAK berubah) -> pasang ulang (`1|1|2|0|1`, MODE ULANG, cocok, sidik sama) -> PULIH (`BARIS tercadang=52 dikembalikan=52`, `PULIH COCOK`; **sidik jari tabel kembali SAMA persis dengan awal**, md5 fungsi `9b005e64...` = server) -> PRASYARAT `1|1|2|1|0` -> pasang lagi (sidik sama dengan pasang pertama). Dua percobaan awal gagal karena kesalahan skrip (PRASYARAT: penggantian nama basis ikut mengubah pembanding md5; PERIKSA: tanda kutip pada label) dan diperbaiki; saat PERIKSA gagal, pulih otomatis memulihkan.
- **isian_rtf_keterangan baru vs lama**: 109 kelompok (perkara+pihak) data terdakwa nyata - keluaran sama persis atas tabel tanpa baris penutup.
- Uji statis `bersih-penutup-x7-21okt.test.ts` (paket tidak basi, syarat belum-minutasi di semua kueri, satu DELETE yang dibatasi id + syarat, cadangan sebelum hapus, INSERT IGNORE, ASCII, tanpa kata merek).

## Jalur blangko Derry lain? (diperiksa, 21 Okt)

Pindai 1.753 RTF blangko Derry (salinan server 21 Okt pagi; tujuan tersembunyi `isianasal` tidak dihitung): **564** mencetak keterangan saksi tersimpan:
- **243** lewat variabel SQL 9259-9265 (`isian_rtf_ket_saksi`) - ditutup x6. **0** blangko Derry yang mencetak variabel "Keterangan Saksi N" tanya_jawab bawaan (2021 dst.; PHP `list_keterangan`, tak tersaring) di teks yang tercetak: mereka hanya muncul di tujuan tersembunyi. Variabel Tergugat saksi ke-3/4 (2032, 8942) tidak punya padanan SQL tetapi juga tidak dipakai blangko Derry mana pun.
- **321** adalah BAS dengan tabel tanya-jawab `TanyaJwb Saksi N` (5058-5060, 6120-6122, 8921, 8931, 8941, 6124; dicetak PHP `kolom_kode_A4`, baris penutup ikut tercetak). Ini jalur yang masih "kelewatan" bila x6 sudah terpasang: SQL tidak dapat menyaringnya. Ditutup oleh **x7 (data perkara berjalan dibersihkan)** dan oleh pembersih ekstensi panel (x6, `bersihkanPenutupTabelRtf`); perkara yang sudah minutasi tetap memuat barisnya di ABT (arsip).
- **12** memakai kutipan ringkas BAS (4608-4618, 4848, 4849): disaring oleh kata topik pada kolom pertanyaan; diukur 0 pertanyaan penutup yang cocok dengan pola topik mana pun - tidak perlu ditutup.
- `abt_data_teks` (isian teks per perkara): 0 baris memuat salinan kalimat penutup. Templat tanya jawab (`abt_tanyajawab_template`, 398 baris) membawa "Sudah cukup;" - bukan isian perkara; yang menyalinnya sudah disaring ekstensi (x6).
- Jawaban lisan 9252-9254 (`isian_rtf_keterangan`): ditutup di paket ini.

Sesudah x6 terpasang, blangko Derry putusan (9259-9265) tidak mencetak penutup walau data tersimpan masih memuatnya (terbukti atas keluaran php56 ABT asli di x6). Bila pengguna melihat penutup di blangko Derry SEBELUM x6 terpasang di server, itu sebabnya; sesudahnya, kemungkinan sisa hanya BAS dari data perkara yang sudah minutasi.

## Yang TIDAK diubah (dan alasannya)

1. Perkara sudah minutasi dan tepi 293/296: arsip harus sama dengan putusan/BAS yang ditandatangani (4.265 + 17 baris).
2. Baris yang hanya SEBAGIAN penutup: nol di data nyata (69.427 baris); tidak ada yang perlu dipotong.
3. Templat tanya jawab: bukan isian perkara.
