# Paket ABT `abt-bas-halaman-1nov` - nomor halaman di kaki halaman BAS (keputusan pengguna 71, 1 Nov 2026)

**Status: dibangun dan diuji di LAPTOP. Server: BELUM dipasang. URUTAN: KE-27, PALING AKHIR - sesudah `teks-pihak-1nov`**
(lihat `../URUTAN-PASANG-1nov.md`). Hanya blangko **derry_briantono**; tidak ada variabel/menu/data yang diubah.
Dibangun deterministik: `python sumber/bangun_paket.py <_blangko_abt sesudah 26 paket> paket-satker hasil`.

## Isi
Keputusan 71: BAS diberi nomor halaman RUNUT dari BAS sidang pertama sampai BAS putus. Bagian blangko-nya: kaki halaman BAS harus memuat field
PAGE. Dari 1.119 blangko di folder `<jenis> - BAS` (98b Berkas Perkara dan 98c Court Calendar bukan BAS, tidak disentuh):

| keadaan | jumlah | tindakan |
|---|---|---|
| kaki halaman sudah memuat field PAGE (mis. BAS ALUR 02 [1a]) | 510 | dibiarkan |
| kaki halaman ada tetapi kosong / hanya kotak teks kosong | 585 | field PAGE disisipkan tepat sebelum `\par` terakhir tiap kaki (semua bagian), didahului `\qr` |
| tanpa kaki halaman (tanpa pemisah bagian) | 24 | satu `{\footer ...}` disisipkan sebelum `\pard` pertama sesudah `\sectd` |

Gaya = gaya BAS Derry yang sudah bernomor: rata KANAN bawah, 12 pt, huruf judul "BERITA ACARA" (`\fN` dari run judul). Teks lain, isian `#kode#`,
pemisah bagian, dan nomor tetap `\pgnstarts` di blangko TIDAK diubah: nomor halaman awal tiap BAS (halaman terakhir BAS sebelumnya + 1) dan
bagian sesudah bukti (halaman Z + jumlah halaman bukti + 1) diatur PORTAL saat cetak/unduh/unggah - lihat
`manajemen_surat/src/server/modules/aleta-ecourt/bas-halaman/`. Blangko yang dicetak langsung dari ABT (tanpa panel) tetap bernomor sesuai
blangko.

Daftar berkas: `paket-satker/daftar-tambal.tsv` (kode, berkas, md5 lama, md5 baru); potongan: `paket-satker/tambal.tsv`; yang dilewati:
`hasil/lewat.tsv`.

## Pasang / pulih (server, root)
```bash
ssh aleta 'mkdir -p /root/abt-bas-halaman-20261101'; scp -r paket-satker/* aleta:/root/abt-bas-halaman-20261101/
ssh aleta 'bash /root/abt-bas-halaman-20261101/pasang-satker.sh'   # PRASYARAT COCOK (SIAP=609) -> TAMBAL=609 -> BERKAS COCOK -> SELESAI
ssh aleta 'bash /root/abt-bas-halaman-20261101/pulih-satker.sh'    # PULIH=609 -> BERKAS PULIH -> PULIH COCOK
```
- PRASYARAT: tiap berkas md5-nya persis keadaan sesudah 26 paket (atau sudah terpasang). Satu saja berbeda -> GAGAL, TIDAK ada yang diubah.
- PASANG: berkas lama disalin ke `cadangan/rtf-lama/<kode>.rtf` (md5 diperiksa) sebelum ditimpa; satu gagal = semua dikembalikan.
- PERIKSA: semua berkas md5 = md5 baru ("BERKAS COCOK"); tidak cocok = PULIH otomatis.
- PULIH: berkas dikembalikan HANYA bila isinya masih persis isi paket (yang sudah disunting orang dibiarkan dan dilaporkan). Tanpa hapus
  permanen. Pulihkan paket ini SEBELUM paket sebelumnya.

## Uji (laptop)
- `hasil/uji-lokal.txt` (`sumber/uji_lokal.sh` atas salinan pohon sesudah 26 paket): pasang, pasang ulang (tidak mengubah apa pun), pulih
  (= pohon dasar persis), pasang lagi (= pasang pertama), penjaga (berkas disunting -> pulih membiarkan; berkas dasar disunting -> pasang menolak
  tanpa mengubah apa pun).
- Uji rantai 27 paket: `../uji-rantai-31okt/rantai.sh` (hasil `../uji-rantai-31okt/hasil-rantai-27.txt`).
- Render: `hasil/render.txt` - BAS sungguhan sesudah paket, dicetak berurutan lewat jalur portal (nomor halaman runut) dan dirender Word.
- Penjaga isi paket: `manajemen_surat/src/test/bas-halaman-runut-1nov.test.ts` (bagian D).
