# Rencana variabel tanya-jawab kesimpulan (G2) - disiapkan 26 Okt 2026, BELUM dipasang

Keputusan Derry 26 Okt 2026: siapkan rancangan dan paket saja, jangan pasang ke ABT mana pun. Tidak ada blangko (RTF) yang diubah, tidak ada baris `abt_variabel` yang ditulis di ABT server maupun ABT laptop. Satu-satunya yang dijalankan di laptop: paket diuji di basis sementara `y1_uji_tmp` (lalu dibuang), dengan empat baris saudara disalin lewat SELECT dari `aps_badilag` laptop.

## Yang disiapkan

Paket: `abt-paket/y1-kesimpulan-tanya-jawab-26okt/` (`paket-satker/` berisi PASANG, PERIKSA, PULIH, skrip pasang dan pulih, MD5SUMS; `alat/bangun_paket.py` membangunnya).

| Kode | Nama variabel | Fungsi | Disalin dari |
| :--- | :--- | :--- | :--- |
| 4950 | `Kesimpulan Lisan #0046#` | penyunting tanya-jawab kesimpulan Penggugat/Pemohon (referensi 0098) | 6113 `Replik Lisan #0046#` |
| 4951 | `Kesimpulan Lisan #0047#` | penyunting kesimpulan Tergugat/Termohon (referensi 0102) | 6112 `Jawaban Lisan #0047#` |
| 4952 | `Keterangan Kesimpulan Lisan #0046#` | bentuk tampil/cetak di blangko (multi_sidang `keterangan`) | 2019 `Keterangan Replik Lisan #0046#` |
| 4953 | `Keterangan Kesimpulan Lisan #0047#` | bentuk tampil/cetak di blangko | 2018 `Keterangan Jawaban Lisan #0047#` |

Barisnya DISALIN dari saudaranya (`INSERT ... SELECT`) dengan hanya `no_var`, `nama`, dan `modified` yang diganti. Semua kolom lain (tipe `tanya_jawab`, referensi, `multi_sidang` `tanyajawab`/`keterangan`, `locked` 1, NULL atau kosong) persis kebiasaan ABT, jadi tidak ada tebakan tentang kolom. Jatah kode: **4950-4959** (4954-4959 cadangan, tidak dipakai).

Penamaan sengaja mengikuti aturan yang sudah dibaca ALETA: `kunciTanyaJawab` (portal) menghasilkan kunci `kesimpulan lisan 0046` / `0047` untuk penyunting dan pasangannya "Keterangan ..." untuk tampilan, dan ekstensi (`blangko-derry-isian.js`, `POLA_KUNCI_KESIMPULAN = /^kesimpulan\b.*\b(0046|0047)\b/`) mencari penyunting kesimpulan dari kunci itu, bukan dari kode tetap. Jadi begitu variabelnya ada DAN blangko memuatnya, penulisan otomatis kesimpulan (saklar Fitur Satker "Kesimpulan para pihak ditulis otomatis ke tanya-jawab") langsung bekerja tanpa mengubah kode ALETA. Uji `rencana-variabel-kesimpulan-26okt` menjaga kesepadanan nama dan kunci ini.

## Kode tidak bentrok (dicek 26 Okt)

- Kamus awal 1.287 variabel (`kamus-variabel-awal.json`, kode 1 sampai 11117): tak satu pun 4950-4959.
- Semua paket di `abt-paket/` (INSERT `abt_variabel`): jatah yang diklaim 4100-4299, 4300-4399, 4400-4499, 4500-4599, 4600-4699, 4750-4849, 4850-4949; 4950-4959 tidak diklaim siapa pun (uji membaca seluruh berkas PASANG).
- ABT laptop (`aps_badilag`, SELECT saja): di rentang 4900-5010 hanya 5001-5010 yang terpakai; tidak ada variabel bernama "Kesimpulan Lisan" (yang ada: 2011, 7122, 8436, 8437, 8438, 8813).
- Server SIPP/ABT 192.168.10.10 TIDAK dijangkau. Pada waktu pasang, PRASYARAT di `PASANG.sql` berhenti keras (tanpa menulis apa pun) bila jatah sudah terpakai, bila ada variabel lain bernama sama, atau bila keempat variabel saudara tidak persis seperti yang diukur (nama, tipe, referensi, multi_sidang).

## Hasil uji di laptop (basis sementara, MariaDB 10.4.28)

Urutan yang dijalankan: salin 4 saudara -> PRASYARAT cocok -> PASANG (4 baris) -> PERIKSA (4 baris cocok, "SEMUA COCOK") -> PASANG kedua berhenti (`ER_SUBQUERY_NO_1_ROW`, tetap 4 baris) -> PULIH (4 baris terhapus, sisa 0) -> PASANG dengan saudara yang diubah (referensi 999) berhenti, 0 baris baru. Basis sementara dibuang. Kolom hasil identik dengan saudaranya (`referensi` 0098/0102 zerofill, `multi_sidang`, `locked` 1). Sintaks skrip diperiksa `bash -n`.

Belum diuji: MariaDB 5.5.68 server (yang dipakai hanya konstruksi yang ada di 5.5: INSERT...SELECT, `<=>`, MD5, UNION; tetap perlu satu kali jalan PRASYARAT sebagai SELECT di server), dan ABT sungguhan (php56 laptop tidak menyala pada pengujian ini, port 8056 mati).

## Temuan tentang cara ABT menyimpan (penting bagi keputusan blangko)

`abt_keterangan_saksi` berkunci `(perkara_id, sidang_id, saksi_id, urutan_pertanyaan)`, bukan nomor variabel. Penyunting tanya-jawab (`tanyajawab_perkara_edit?no_var=...&c=<perkara>&d=<sidang>`) memakai variabel hanya untuk menentukan siapa (lewat `referensi`) dan sidang mana (`d`). Akibatnya:

1. Variabel baru tidak membutuhkan perubahan PHP ABT menurut pembacaan klien ekstensi (`abt-klien.js` memanggil rute yang sama dengan 6112), tetapi ini HARUS dibuktikan di ABT (daftar ukur di bawah).
2. Penyunting Replik (6113) dan Kesimpulan (4950) untuk Penggugat pada SIDANG YANG SAMA menunjukkan dan mengubah baris yang sama. Itu sama dengan hubungan Jawaban (6112) dan Duplik (6114) sekarang. Aman selama kesimpulan disampaikan di sidang beragenda kesimpulan sendiri (cara kerja G2: ekstensi hanya menulis ke sidang yang agendanya memuat "kesimpulan"). Bila Derry sering menggabung "jawab menjawab dan kesimpulan" dalam satu sidang, kesimpulan akan bercampur dengan replik/duplik di sidang itu; itu batas ABT, bukan batas paket.

## Yang masih keputusan Derry (tidak dikerjakan)

Blangko mana yang memakai `#4952#` / `#4953#`. Tanpa penanda di RTF, panel Blangko Derry tidak menampilkan penyunting kesimpulan (panel hanya menyusun isian dari penanda yang ada di RTF). Calon (semua milik `derry_briantono`, hari ini memakai `#8436#`/`#8437#` satu kalimat): `1 Perceraian CG/[02] [Kabul] CG - F`, `[02a] [Kabul] CG - T Tidak Hadir Setelah Mediasi - F`, `1a Perceraian CT/[02] [Kabul] CT - F`, `[02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak)`, `[02a] [Kabul] CT - T Tidak Hadir Setelah Mediasi - F`. Usulan perilaku yang paling aman: pertahankan `#8436#`/`#8437#` sebagai bunyi bawaan, dan hanya bila penyunting 4950/4951 berisi, cetak `#4952#`/`#4953#` sebagai pengganti (variabel SQL pembungkus perlu dirancang bersama paket blangko; paket y1 sengaja tidak menyentuhnya). Wajib mencadangkan RTF sebelum menambal dan hanya menyentuh blangko `derry_briantono`.

## Yang perlu diukur di ABT sungguhan sebelum dipasang

1. Di ABT (laptop dulu): buka `tanyajawab_perkara_edit?no_var=4950&c=<perkara uji>&d=<sidang>` setelah paket dipasang di BASIS UJI (bukan `aps_badilag`) dan pastikan editor terbuka, menampilkan pihak yang benar (Penggugat untuk 4950, Tergugat untuk 4951), menyimpan, dan baris muncul di `abt_keterangan_saksi` dengan `saksi_id` pihak itu.
2. Blangko uji (salinan, di basis uji) dengan `#4952#` / `#4953#`: pastikan tercetak seperti `#2019#`/`#2018#` (daftar butir, format baris, kalimat penutup tersaring bila x6 terpasang).
3. Server (baca saja): jalankan PRASYARAT sebagai SELECT, dan `SELECT no_var FROM abt_variabel WHERE no_var BETWEEN 4950 AND 4959` harus kosong; `SELECT * FROM abt_variabel WHERE no_var IN (6112,6113,2018,2019)` harus persis seperti di laptop (nama, referensi 98/102, multi_sidang).
4. Ukur berapa sidang beragenda "kesimpulan" yang agendanya digabung dengan jawab-menjawab (bila banyak, bahas batas pada bagian temuan di atas).

## Cara pasang (nanti, oleh sesi utama, setelah keputusan Derry dan pengukuran di atas)

```bash
cd /d/aleta-dev/wt/w80/abt-paket/y1-kesimpulan-tanya-jawab-26okt     # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-y1-20261026'
scp -r paket-satker/* aleta:/root/abt-y1-20261026/
ssh aleta 'cd /root/abt-y1-20261026 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-y1-20261026/pasang-satker.sh'
```

Keluaran benar: `CADANGAN: ...`, `PRASYARAT COCOK - memasang`, empat baris `cocok = 1`, `SEMUA COCOK`, `SELESAI`. Pulih: `bash /root/abt-y1-20261026/pulih-satker.sh` (`sisa_baris_baru` 0). Cadangan: `mysqldump` seluruh `abt_variabel` ke folder `cadangan/` sebelum menulis. Hanya tabel `abt_variabel` yang disentuh, hanya empat baris baru.
