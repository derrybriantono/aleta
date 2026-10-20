# Paket ABT `u6-fakta-sinkron` - keterangan saksi dan alat bukti BAS dibaca putusan (agen U6, 20 Okt 2026)

Menambah **29 variabel kueri BARU** (nomor 4600-4629, jatah U6 4600-4699) ke `aps_badilag.abt_variabel`. Tidak mengubah satu pun baris lama, tidak menyentuh RTF/blangko; blangko putusan (U2-U5) yang ingin memakainya cukup menaruh penanda `#46xx#`.
Semuanya berlaku untuk jenis perkara apa pun dan hanya MEMBACA apa yang sudah disimpan di BAS (`abt_keterangan_saksi`, isian alat bukti 1214 / 9911 / 1262), jadi duduk perkara dan pertimbangan memakai keterangan saksi dan bukti yang SAMA dengan BAS.

## Urutan pasang (di server, oleh sesi utama)

1. CADANG: `mysqldump aps_badilag abt_variabel > abt_variabel-sebelum-u6.sql` (berjaga-jaga; paket hanya menambah baris).
2. PASANG: `mysql --default-character-set=latin1 aps_badilag < PASANG.sql` (satu transaksi; berhenti keras `ERROR 1242` bila ada nomor 4600-4629 yang sudah terpakai; tidak ada yang ditulis).
3. PERIKSA: `mysql aps_badilag < PERIKSA.sql` - setiap baris `cocok = 1`, baris terakhir `SEMUA COCOK`.
4. Gagal -> PULIH: `mysql aps_badilag < PULIH-HAPUS-BARU.sql` (menghapus 29 baris baru).

Diuji lokal (`node scripts/isi-sipp-abt/uji-paket-u6.cjs`): 29 kueri berjalan tanpa galat atas perkara nyata; PASANG menambah 29 baris, PERIKSA = SEMUA COCOK, PASANG ulang ditolak (ERROR 1242, jumlah baris tetap), PULIH mengembalikan jumlah semula. Pada 20 Okt 2026 nomor 4600-4699 belum terpakai di ABT server.

## Isi

| nomor | nilai | pemakaian di putusan |
| --- | --- | --- |
| 4600 / 4601 | jumlah saksi Penggugat-Pemohon / Tergugat-Termohon yang diperiksa (angka) | syarat minimal dua saksi, pilihan kalimat |
| 4602 / 4603 | jumlah itu dalam angka dan terbilang: `2 (dua)` / `tidak ada` | "telah mengajukan ... orang saksi" |
| 4604 / 4605 | nama saksi P / T, `A dan B` | duduk perkara |
| 4606 / 4607 | hubungan saksi dengan pihak, `Adik Kandung Penggugat dan ...` | uraian saksi, pertimbangan saksi keluarga |
| 4608 | ada keterangan saksi tersimpan: `ya` / `tidak` | syarat cabang kalimat |
| 4609 | jumlah sidang pemeriksaan saksi | |
| 4610 pernikahan, 4611 tempat tinggal bersama, 4612 anak, 4613 penyebab perselisihan, 4614 pisah rumah, 4615 nafkah, 4616 upaya damai, 4617 harta dan benda, 4618 kematian dan ahli waris | kutipan ringkas jawaban semua saksi atas pertanyaan pokok itu: `Nama saksi: jawaban; Nama saksi: jawaban` (<= 900 huruf; lengkapnya tetap `#2021#` dst.) | pertimbangan per dalil: bukti saksi untuk pokok itu |
| 4620 / 4621 | jumlah bukti surat P / T (dari tanda P.n / T.n pada isian alat bukti) | "mengajukan alat bukti surat P.1 dan P.2" |
| 4622 / 4623 | `P.1 sampai dengan P.2`, `P.1`, atau kosong; T sama | |
| 4624 | bukti P memuat akta nikah: `ya`/`tidak`; 4625 memuat KTP; 4626 Kartu Keluarga; 4627 akta kelahiran; 4628 akta cerai atau kematian; 4629 bukti T memuat akta nikah | cabang pertimbangan P.1 (identitas) / P.2 (nikah) |

Catatan: bila tidak ada data, variabel menghasilkan kosong/NULL (ABT menampilkan "..."), tidak pernah teks karangan. Batas teks: `group_concat_max_len` bawaan MariaDB 5.5 ialah 1024; variabel 4610-4618 dipotong di 900 huruf sehingga aman.

## Berkas

| berkas | isi |
| --- | --- |
| `PASANG.sql`, `PERIKSA.sql`, `PULIH-HAPUS-BARU.sql` | skrip pemasangan (teks heksadesimal; jangan disunting) |
| `variabel.json` | isi variabel dalam bentuk terbaca (nomor, nama, kueri) |
| `alat/susun-paket.py` | pembangkit paket (ubah di sini, lalu jalankan ulang) |
| `MD5SUMS.txt` | md5 berkas paket |
