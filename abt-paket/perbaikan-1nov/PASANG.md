# Paket ABT `abt-perbaikan-1nov` - tundaan pada variabel pembuktian + 5 perbaikan dasar hukum di 14 blangko (keputusan pengguna 89-B2/73 dan 92, 1 Nov 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama. URUTAN: KE-30, PALING AKHIR - sesudah
`tanya-jawab-format-1nov`** (lihat `../URUTAN-PASANG-1nov.md`). Hanya blangko dan variabel **derry_briantono**; tanpa variabel/menu/fungsi baru.
md5 dasar = keadaan sesudah ke-29 paket. Dibangun deterministik: `python sumber/bangun_paket.py <basis ABT sesudah 29 paket> <_blangko_abt sesudah 29 paket>`.

## A. Tanggal/hari pembuktian memakai aturan TUNDAAN (keputusan 89-B2/73) - 4 variabel

Paket `pembuktian-urut-1nov` (ke-22) menetapkan tahap pembuktian dari agenda sidang dan tanda "Penggugat selesai". Keputusan sesudahnya: tahap
pembuktian ditentukan DULU dari **alasan ditunda sidang sebelumnya** (tundaan = agenda yang ditetapkan untuk sidang berikutnya), sama seperti sisi
bot (`aleta_bot/services/tahapPembuktianService.js`, commit ddf15a3a di cabang saksi-perbaikan; salinan acuan: `alat/tahapPembuktianService-ddf15a3a.js`).

| variabel | isi | yang berubah |
|---|---|---|
| 2111 / 7119 | Tanggal / Hari Pembuktian #0046# (Penggugat/Pemohon) | syarat sidang pembuktian Penggugat |
| 2112 / 7121 | Tanggal / Hari Pembuktian #0047# (Tergugat/Termohon) | syarat sidang pembuktian Tergugat |

Aturan (sidang j; h = sidang tepat sebelumnya menurut tanggal_sidang, id):
1. j adalah sidang pembuktian bila agenda menyebut bukti/saksi, ATAU agenda BUKAN tahap lain (jawab, replik, duplik, kesimpulan, putus,
   musyawarah, mediasi, ikrar, pembacaan, sela, damai) dan tundaan h menyebut pembuktian berpihak ("sidang lanjutan" biasa yang tundaannya
   "Pembuktian Penggugat" = sidang pembuktian).
2. Sisi j: agenda tegas dulu (sama seperti paket ke-22); lalu tundaan h: "pembuktian Tergugat/Termohon" saja -> Tergugat; "pembuktian lanjutan
   Penggugat"/"saksi Pemohon" saja -> Penggugat; "Penggugat dan Tergugat" -> keduanya; tanpa sebutan pihak (atau keduanya terpisah) -> aturan tahap
   keputusan 52 (diawali Penggugat; sesudah Penggugat selesai = Tergugat). Tanda "Tergugat sudah mulai" di alasan ditunda/keterangan j tetap menambah Tergugat.
3. "Penggugat selesai" (untuk aturan 52) kini juga dipicu sidang pembuktian karena tundaan Tergugat. Cabang Court Calendar TIDAK diubah (tetap lebih dulu).

Ringan di MariaDB/MySQL 5.5: sidang sebelumnya dicari SEKALI per baris lewat `LEFT JOIN ... ON h.id = (SELECT ... ORDER BY tanggal_sidang DESC, id DESC LIMIT 1)`
(satu pencarian berindeks perkara_id), bukan subkueri yang diulang tiap pemakaian; pemeriksaan murah (regex kolom baris itu sendiri) lebih dulu daripada yang
mencari sidang lain; tanpa `REGEXP_REPLACE`, `\b`, atau CURDATE(). Ukuran kueri 20,7-23,2 KB.

### Ukuran atas SIPP (sipp_2810 = dump server 28 Okt, `alat/banding.js`, hasil lengkap `hasil/banding-semua.json`, `hasil/banding-2025.json`)

| | perkara | sama terisi | sama kosong | BARU terisi | berubah | galat | = mesin bot (tanpa Court Calendar) |
|---|---|---|---|---|---|---|---|
| 2111 semua | 10.278 | 1.309 | 8.926 | 37 | 6 | 0 | 10.107/10.107 |
| 7119 semua | 10.278 | 1.315 | 8.926 | 37 | 0 (hari sama) | 0 | 10.107/10.107 |
| 2112 semua | 10.278 | 136 | 10.128 | 13 | 1 | 0 | 10.237/10.237 |
| 7121 semua | 10.278 | 137 | 10.128 | 13 | 0 (hari sama) | 0 | 10.237/10.237 |
| 2111/7119 sejak 2025 | 1.917 | 330 | 1.586 | 1 (433/Pdt.G/2025: 25-08-2025) | 0 | 0 | 1.868/1.868 |
| 2112/7121 sejak 2025 | 1.917 | 33 | 1.884 | 0 | 0 | 0 | 1.899/1.899 |

Yang berubah (2111, lama -> baru): 245/Pdt.G/2017 16-01-2018 -> 05-12-2017 (tundaan "Pembuktian Pemohon"), 240/Pdt.G/2018 12-12 -> 28-11-2018,
27/Pdt.G/2020 dan 50/Pdt.G/2020 01-04 -> 18-03-2020, 134/Pdt.G/2020 07-07 -> 14-07-2020 (tundaan 30-06 "Untuk Pembuktian Termohon" membuat sidang 07-07 milik
Tergugat: 2112 04-08 -> 07-07-2020), 206/Pdt.G/2021 12-07 -> 21-06-2021. Kueri = keluaran bot ddf15a3a untuk SEMUA perkara yang tidak memakai Court Calendar
(selisih 0) - bot dan ABT kini menetapkan tahap yang sama.

Catatan data 134/Pdt.G/2020: tundaan sidang 30-06-2020 berbunyi "Untuk Pembuktian Termohon" sedangkan alasan ditunda sidang 07-07 berbunyi "Tambahan alat bukti Pemohon". Menurut aturan tundaan
(tundaan lebih dulu) sidang 07-07 menjadi sidang Termohon dan pembuktian Pemohon baru mulai 14-07 - tanggal Termohon (07-07) lebih awal daripada tanggal Pemohon (14-07). Itu mengikuti data SIPP
(dan sama dengan keluaran bot); bila hakim menilai itu keliru, yang diubah adalah isian tundaan di SIPP.

Waktu kueri (median per eksekusi, 40 eksekusi, salinan SIPP laptop MariaDB 10.4 yang sedang sibuk, `alat/waktu_kueri.js`, `hasil/waktu-kueri.jsonl`): perkara 1-3 sidang 12-26 ms (lama 5-18 ms);
perkara terpanjang (22 sidang) 29-49 ms (lama 10-17 ms). Render dokumen sungguhan tidak melambat melebihi fluktuasi laptop - `hasil/render.md`.

## B. 5 perbaikan dasar hukum di 14 blangko (keputusan 92) - kata saja

Spesifikasi persis: `hasil/spesifikasi-perbaikan-blangko-1nov.tsv` (dari `manajemen_surat/scripts/rak-peraturan/hasil/perbaikan-blangko-1nov.tsv`; md5 14 berkas
dicek ulang terhadap dasar 29 paket: SEMUA cocok). Potongan RTF terpecah tidak disentuh selain kata yang diganti.

| temuan | berkas | perubahan |
|---|---|---|
| 1 KHI Pasal 7 ayat (4) tidak berhuruf | 7 blangko Itsbat Nikah Kontensius (`2a`: [01], [01b], [01c], [03], [03b], [99a], [99b]) | "Pasal 7 ayat (4) huruf a Kompilasi Hukum Islam" -> "Pasal 7 ayat (4) Kompilasi Hukum Islam" |
| 2 KHI Pasal 58 ayat (1) hanya huruf a dan b | 1 Izin Poligami [01b] (Termohon Keberatan, Pasal 59 KHI) | "huruf b dan huruf c dan Pasal 59" -> "huruf b dan Pasal 59" |
| 3 Pasal 35 UU 1/1974 dikutip dengan bunyi ayat (2) | 1 Harta Bersama [01] E-Court | "ayat (1)" -> "ayat (2)"; kutipan memakai bunyi naskah ("suami dan isteri", "diperoleh", koma sesudah "warisan", "dibawah") |
| 4 bunyi Pasal 7 ayat (1) UU 1/1974 jo. UU 16/2019 | 1 Itsbat Nikah [99] Dibawah Umur | "jika pihak pria dan wanita sudah mencapai usia 19 tahun" -> "apabila pria dan wanita sudah mencapai umur 19 (sembilan belas) tahun" (hanya kutipan bertanda petik; parafrasa tanpa petik dibiarkan) |
| 5 Pasal 1 UU 35/2014 berbutir angka | 4 Dispensasi Kawin ([03], [03a], [03b], [03c]) | "Pasal 1 Ayat 1" -> "Pasal 1 angka 1" (hanya kata "Ayat" di run yang terpecah) |

Total **14 blangko, 15 potongan** (`paket-satker/daftar-tambal.tsv`, `tambal.tsv`). Pemindaian seluruh pohon: frasa yang sama TIDAK ada di blangko lain (`hasil/sisa-frasa.tsv`).

## Pasang / pulih (server, root; SESUDAH tanya-jawab-format-1nov)
```bash
cd /d/.../abt-paket/perbaikan-1nov && rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-perbaikan-20261101'; scp -r paket-satker/* aleta:/root/abt-perbaikan-20261101/
ssh aleta 'cd /root/abt-perbaikan-20261101 && md5sum -c MD5SUMS.txt | grep -v OK'      # harus kosong
ssh aleta 'bash /root/abt-perbaikan-20261101/pasang-satker.sh'
ssh aleta 'bash /root/abt-perbaikan-20261101/pulih-satker.sh'                            # PULIH COCOK (4|0)
```
Keluaran benar:
```
PRASYARAT COCOK (4|0)
BERKAS SIAP
CADANGAN: ... (baris variabel: 4)
SEMUA COCOK
UJI contoh 1: perkara <id> tundaan Pembuktian Tergugat -> Tanggal Pembuktian Tergugat <tanggal> (sidang tundaan <tanggal>)
UJI contoh 2: perkara <id> -> keempat variabel menjawab tanpa galat
TAMBAL=14
BERKAS COCOK
SELESAI - paket abt-perbaikan-1nov terpasang. ...
```
- PRASYARAT: 4 variabel persis hasil pembuktian-urut-1nov dan 14 berkas persis md5 dasar (atau sudah terpasang: `0|4`, `SUDAH=14`). Satu saja berbeda -> berhenti TANPA mengubah apa pun.
- PASANG: variabel dalam satu transaksi (tiap UPDATE dijaga md5); berkas lama disalin ke `cadangan/rtf-lama/<kode>.rtf` (md5 diperiksa) sebelum ditimpa; PERIKSA variabel
  dan berkas; UJI kueri di server (baca saja, MariaDB 5.5 menolak sintaks asing -> otomatis PULIH). Gagal di tahap mana pun = variabel dan berkas dikembalikan.
- PULIH: tiap variabel/berkas dikembalikan HANYA bila isinya masih persis isi paket (yang sudah disunting orang dibiarkan dan dilaporkan); tanpa hapus permanen.
  Pulihkan paket ini SEBELUM paket sebelumnya.

## Uji (laptop)
- `hasil/uji-lokal.txt` (`sumber/uji_lokal.sh`, salinan pohon sesudah 29 paket + `aps_badilag_w174` = abt_variabel sesudah 29 paket): pasang, pasang ulang (tidak mengubah apa pun),
  pulih (= pohon DAN seluruh variabel sama persis dengan dasar), pasang lagi (= pasang pertama), penjaga berkas (disunting -> pulih membiarkan; dasar disunting -> pasang menolak),
  penjaga variabel (2112 disunting -> `3|0`, tidak ada yang berubah).
- Uji rantai 30 paket: `../uji-rantai-31okt/rantai.sh` -> `../uji-rantai-31okt/hasil-rantai-30.txt`.
- Render sungguhan (renderer ABT php56, `alat/render174.py`): `hasil/render.md`; PNG di `D:/Aplikasi/aleta/tmp/w174/render/` (memuat nama pihak sungguhan: TIDAK masuk repo, TIDAK dikirim keluar).
- Penjaga isi paket: `manajemen_surat/src/test/paket-perbaikan-1nov.test.ts`.
