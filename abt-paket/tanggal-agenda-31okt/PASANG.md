# Paket ABT `abt-tanggal-agenda-31okt` - tanggal jawaban/replik/duplik/kesimpulan/pembuktian dari jadwal sidang (31 Okt 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama. URUTAN PASANG: PALING AKHIR**
(sesudah semua paket di `../URUTAN-PASANG-31okt.md`; tidak satu pun paket itu menyentuh 14 variabel ini - PRASYARAT memeriksa isinya persis).

Keputusan pengguna 31 Okt (butir 25): bila Court Calendar e-Court/SIPP tidak memuat agendanya (perkara biasa), tanggal jawaban, replik,
duplik, kesimpulan, dan pembuktian diambil dari JADWAL SIDANG SIPP (agenda sidang yang memuat kata itu). Hanya variabel blangko
**derry_briantono** (dipakai 25-219 blangko Derry tiap variabel); tanpa variabel baru, tanpa fungsi, tanpa blangko RTF yang diubah.

## Isi - 14 variabel

| variabel | isi | agenda jadwal sidang (huruf kecil) |
|---|---|---|
| 7111 / 7115 | Tanggal / Hari Jawaban | memuat `jawab`, tanpa `rekonvensi` |
| 7112 / 7116 | Tanggal / Hari Replik | `replik`, bukan `replik rekonvensi` |
| 7113 / 7117 | Tanggal / Hari Duplik | `duplik`, bukan `duplik rekonvensi` |
| 7114 / 7118 | Tanggal / Hari Duplik Rekonvensi | `duplik rekonvensi` |
| 8438 / 7122 | Tanggal / Hari Kesimpulan | `kesimpulan` |
| 2111 / 7119 | Tanggal / Hari Pembuktian #0046# | `bukti`/`saksi`, kecuali yang KHUSUS pihak kedua ("pembuktian tergugat", "saksi termohon"); "pembuktian" tanpa sebutan pihak = pihak pertama (yang membuktikan lebih dulu, termasuk perkara verstek) |
| 2112 / 7121 | Tanggal / Hari Pembuktian #0047# | `bukti`/`saksi` TEPAT diikuti Tergugat/Termohon (juga "pembuktian penggugat dan tergugat"); "pembuktian dan panggil tergugat" BUKAN |

Bentuk kueri baru: (1) cabang Court Calendar lama, disalin UTUH dan dijalankan lebih dulu; (2) bila Court Calendar tidak memuat agenda
itu: sidang PERTAMA di `perkara_jadwal_sidang` yang agendanya cocok (`ORDER BY tanggal_sidang, id LIMIT 1`; hari = DAYOFWEEK yang sama);
(3) baris kosong bila keduanya tidak ada. REGEXP hanya bentuk POSIX (MariaDB 5.5).

## Ukuran (sipp_2810 = dump server 28 Okt, 1.917 perkara terdaftar sejak 1 Jan 2025, `alat/banding.js`)

| variabel | sama terisi | sama kosong | BARU terisi | berubah (Court Calendar) | galat |
|---|---|---|---|---|---|
| jawaban 7111/7115 | 92 | 1.821 | 4 | 0 | 0 |
| replik 7112/7116 | 90 | 1.824 | 3 | 0 | 0 |
| duplik 7113/7117 | 90 | 1.824 | 3 | 0 | 0 |
| duplik rekonvensi 7114/7118 | 11 | 1.904 | 2 | 0 | 0 |
| kesimpulan 8438/7122 | 100 | 1.705 | 112 | 0 | 0 |
| pembuktian #0046# 2111/7119 | 49 | 1.587 | 281 | 0 | 0 |
| pembuktian #0047# 2112/7121 | 18 | 1.884 | 15 | 0 | 0 |

Perkara yang Court Calendar-nya terisi TIDAK berubah satu pun. Kecocokan aturan agenda dengan Court Calendar pada perkara cerai yang
memuat keduanya (tanggal sidang pertama berjadwal = salah satu tanggal rencana Court Calendar): jawaban 112/116, kesimpulan 79/82,
pembuktian #0046# 83/104 (selisih = sidang ditunda; jadwal sidang = tanggal sungguhan). Contoh baru terisi (dicocokkan dengan agenda):
8381 pembuktian 27 Feb 2025 ("Pembuktian"), 8392 kesimpulan 12 Feb 2025 ("Pemeriksaan, kesimpulan, musyawarah majelis, pembacaan
putusan"), 8749 pembuktian #0047# 29 Jul 2025 ("pembuktian Tergugat"), 9143 duplik rekonvensi 21 Nov 2025.

## Pasang (Git Bash, server hidup) - PALING AKHIR

```bash
cd /d/.../abt-paket/tanggal-agenda-31okt
rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-tanggal-agenda-20261031'
scp -r paket-satker/* aleta:/root/abt-tanggal-agenda-20261031/
ssh aleta 'cd /root/abt-tanggal-agenda-20261031 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-tanggal-agenda-20261031/pasang-satker.sh'
```

Keluaran benar: `PRASYARAT COCOK (14|0)`, `CADANGAN: ...`, `PERIKSA: SEMUA COCOK`, `PRASYARAT SESUDAH: 0|14`, `SELESAI`. Pasang ulang
aman (`0|14`). PRASYARAT lain (mis. `13|0` = satu variabel sudah disunting orang) = berhenti TANPA mengubah apa pun.
Pulih: `ssh aleta 'bash /root/abt-tanggal-agenda-20261031/pulih-satker.sh'` -> `PULIH COCOK` (variabel kembali persis).

Uji laptop (`sumber/uji_lokal.sh`, basis milik sendiri `aps_badilag_w147` = abt_variabel `aps_badilag_rantai` sesudah rantai penuh):
pasang, pasang ulang (tidak mengubah apa pun), pulih (= keadaan awal persis seluruh tabel), pasang lagi (= pasang pertama), penjaga
(7111 disunting -> `13|0`, tidak ada yang berubah) - `hasil/uji-lokal.txt`.

Bangun ulang: `python sumber/bangun_paket.py <basis salinan sesudah rantai penuh>`; banding: `NODE_PATH=<node_modules bot> node
alat/banding.js sipp_2810 2025-01-01 hasil/banding-2025.json`.
