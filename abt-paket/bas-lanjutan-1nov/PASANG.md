# Paket ABT `abt-bas-lanjutan-1nov` - kalimat "sidang ini merupakan lanjutan dari sidang tanggal ..." dibuang dari BAS (keputusan pengguna 82, 1 Nov 2026)

**Status: dibangun dan diuji di LAPTOP. Server: BELUM dipasang. URUTAN: KE-28, PALING AKHIR - sesudah `bas-halaman-1nov`**
(lihat `../URUTAN-PASANG-1nov.md`). Hanya blangko **derry_briantono**; tidak ada variabel/menu/data yang diubah.
Dibangun deterministik: `python sumber/bangun_paket.py <_blangko_abt sesudah 27 paket> paket-satker hasil`.

## Masalah dan sumbernya
BAS sidang lanjutan memuat, tepat sesudah identitas para pihak, satu paragraf `#5404# #8562#` (21 blangko: `#5404# #8562# #8563#`):

- `#5404#` = "Susunan majelis yang bersidang sama dengan sidang yang lalu;" (atau kalimat pergantian majelis bila ada).
- `#8562#` = **variabel 8562** "SIDANG SEBELUMNYA untuk BAS LANJUTAN" (dibangun paket riwayat sidang A3): "Sidang ini merupakan lanjutan dari
  sidang tanggal 23 Juli 2026; pada sidang tersebut Penggugat dan Tergugat hadir sendiri di persidangan, kemudian sidang ditunda sampai
  dengan hari ini untuk Pembuktian Lanjutan;".
- Paragraf blangko memakai inden gantung (`\fi-2127 \li2127`, salinan dari paragraf identitas pihak), sehingga kalimat panjang itu tercetak
  dengan baris-baris berikutnya menjorok jauh dan paragraf tampak janggal (contoh: perkara 350/Pdt.G/2026, BAS [7] Pembuktian Tergugat).

## Isi
| keadaan paragraf `#5404# #8562#` | jumlah | tindakan |
|---|---|---|
| inden gantung (`\fi-2127 \li2127 \lin2127`) | 189 | " #8562#" dibuang; inden diganti inden baris pertama paragraf sesudahnya (567/850), kiri 0 |
| tanpa inden baris pertama (`\li0`) | 421 | " #8562#" dibuang; ditambah `\fi` sama dengan paragraf sesudahnya (567/709), kiri 0 |
| sudah inden baris pertama biasa (567) | 66 | hanya " #8562#" dibuang |
| berkas di folder `terhapus` (1 berkas) | 0 | tidak disentuh (bukan blangko yang dipakai) |

Total **676 blangko BAS** (semua jenis perkara: Cerai Gugat/Talak, Itsbat, Kewarisan, Harta Bersama, Hak Asuh, Ekonomi Syariah, Verzet, Putusan
Sela, dsb., termasuk folder alur lama `- BAS CONTRA PERCERAIAN -`, `- BAS VERSTEK PERCERAIAN -`, `ALUR 0x ...`). Daftar: `paket-satker/daftar-tambal.tsv`
(kode, berkas, md5 lama, md5 baru); potongan: `paket-satker/tambal.tsv`; jenis tiap berkas: `hasil/jenis.tsv`.

**Variabel 8562 sendiri TIDAK diubah**: tidak ada variabel lain/blangko non-BAS/kode portal yang memakai `#8562#` (diperiksa di 1.880 blangko Derry
dan seluruh kueri `abt_variabel`), jadi cukup pemakaiannya di BAS yang dihapus. Bila kelak kalimat itu diinginkan kembali, tambahkan `#8562#`
lagi di blangko; variabelnya tetap ada. Paragraf `#5404#` sendiri (variabel 5404) tidak diubah. Bila ada blangko yang memakai `#8563#` (kalimat
mediasi, 21 blangko "Laporan Mediasi"), `#8563#` tetap ada di paragraf yang sama sesudah `#5404#`.

Yang SENGAJA tidak disentuh: 99 blangko BAS yang menulis "Susunan majelis yang bersidang sama dengan sidang yang lalu;" sebagai teks biasa
(bukan `#5404#`, tanpa `#8562#`) - tidak memuat kalimat yang dibuang. Paragraf-paragraf itu juga berinden gantung (-2127 pada 48, -4800 pada 51) tetapi hanya sebaris,
sehingga tampak rata kiri; mengubahnya di luar permintaan (usulan ke pengguna: samakan juga).

## Pasang / pulih (server, root)
```bash
ssh aleta 'mkdir -p /root/abt-bas-lanjutan-20261101'; scp -r paket-satker/* aleta:/root/abt-bas-lanjutan-20261101/
ssh aleta 'bash /root/abt-bas-lanjutan-20261101/pasang-satker.sh'   # PRASYARAT COCOK (SIAP=676) -> TAMBAL=676 -> BERKAS COCOK -> SELESAI
ssh aleta 'bash /root/abt-bas-lanjutan-20261101/pulih-satker.sh'    # PULIH=676 -> BERKAS PULIH -> PULIH COCOK
```
- PRASYARAT: tiap berkas md5-nya persis keadaan sesudah 27 paket (atau sudah terpasang). Satu saja berbeda -> GAGAL, TIDAK ada yang diubah.
- PASANG: berkas lama disalin ke `cadangan/rtf-lama/<kode>.rtf` (md5 diperiksa) sebelum ditimpa; satu gagal = semua dikembalikan.
- PERIKSA: semua berkas md5 = md5 baru ("BERKAS COCOK"); tidak cocok = PULIH otomatis.
- PULIH: berkas dikembalikan HANYA bila isinya masih persis isi paket (yang sudah disunting orang dibiarkan dan dilaporkan). Tanpa hapus
  permanen. Pulihkan paket ini SEBELUM paket sebelumnya.

## Uji (laptop)
- `hasil/uji-lokal.txt` (`sumber/uji_lokal.sh` atas salinan pohon sesudah 27 paket): pasang, pasang ulang (tidak mengubah apa pun), pulih
  (= pohon dasar persis), pasang lagi (= pasang pertama), penjaga (berkas disunting -> pulih membiarkan; berkas dasar disunting -> pasang menolak
  tanpa mengubah apa pun).
- Uji rantai 28 paket: `../uji-rantai-31okt/rantai.sh` (hasil `../uji-rantai-31okt/hasil-rantai-28.txt`).
- Render sungguhan (renderer ABT php56): `alat/render163.py`, hasil `hasil/render.txt`; PNG sebelum/sesudah di `D:/Aplikasi/aleta/tmp/w163/render/`.
- Penjaga isi paket: `manajemen_surat/src/test/paket-bas-lanjutan-1nov.test.ts`.
