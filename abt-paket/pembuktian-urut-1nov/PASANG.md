# Paket ABT `abt-pembuktian-urut-1nov` - tanggal/hari pembuktian menurut URUTAN TAHAP pembuktian (1 Nov 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama. URUTAN PASANG: SESUDAH
`tanggal-agenda-31okt`** (PRASYARAT memeriksa 4 variabel ini persis hasil paket itu; tidak ada paket lain di
`../URUTAN-PASANG-31okt.md` yang menyentuh 2111/7119/2112/7121).

Keputusan pengguna 1 Nov (butir 52, MENGGANTI butir 29-30): pembuktian selalu diawali Penggugat/Pemohon; "pembuktian lanjutan"
melanjutkan pihak yang sedang membuktikan; agenda pembuktian tanpa sebutan pihak SESUDAH pembuktian Penggugat selesai = pembuktian
Tergugat/Termohon; satu tahap bisa beberapa hari sidang (semuanya satu tahap, tanggalnya = sidang pertama tahap itu).
Hanya variabel blangko **derry_briantono**; tanpa variabel baru, tanpa fungsi, tanpa blangko RTF yang diubah.

## Isi - 4 variabel (hanya syarat agenda cabang JADWAL SIDANG; cabang Court Calendar tidak diubah dan tetap lebih dulu)

| variabel | isi | sidang pertama tahap yang ... |
|---|---|---|
| 2111 / 7119 | Tanggal / Hari Pembuktian #0046# | agenda pembuktian Penggugat/Pemohon TEGAS, atau pembuktian tanpa sebutan pihak yang BUKAN sesudah Penggugat selesai (selalu, bila permohonan Pdt.P) |
| 2112 / 7121 | Tanggal / Hari Pembuktian #0047# | agenda pembuktian Tergugat/Termohon TEGAS; atau (Pdt.G) alasan ditunda/keterangan sidang itu menyebut Tergugat SUDAH mulai ("Pembuktian Lanjutan Termohon", "termohon mengajukan bukti"); atau (Pdt.G) pembuktian tanpa sebutan pihak sesudah Penggugat selesai |

"Penggugat selesai" sebelum sidang itu dibaca dari sidang sebelumnya (sesudah pembuktian dimulai): agenda tegas pembuktian Tergugat,
agenda kesimpulan (bukan agenda gabungan berkata bukti), alasan ditunda / keterangan yang menyebut pembuktian Tergugat, kesimpulan,
Penggugat mencukupkan bukti ("telah mencukupkan alat buktinya", "pemohon cukup bukti", "tidak mengajukan lagi bukti"; "belum cukup
bukti" BUKAN). Pola tegas kini menerima spasi ganda, "untuk" ("Pembuktian untuk Termohon"), dan singkatan "P"/"T" ("Pembuktian lanjutan
P dan pembuktian T"). "pembuktian dan panggil tergugat" tetap BUKAN pembuktian Tergugat (keputusan 29).

Pola POSIX = satu sumber `aleta_bot/services/tahapPembuktianService.js` (bot memakai yang sama untuk usulan BAS ALUR 04);
`sumber/bangun_paket.py` membacanya langsung. REGEXP hanya bentuk POSIX (tanpa `\b`, MariaDB 5.5).

## Ukuran (sipp_2810 = dump server 28 Okt, `alat/banding.js`)

| | perkara | sama terisi | sama kosong | BARU terisi | berubah | galat | kueri = mesin bot (tanpa Court Calendar) |
|---|---|---|---|---|---|---|---|
| 2111/7119 sejak 2025 | 1.917 | 330 | 1.587 | 0 | 0 | 0 | 1.868/1.868 |
| 2112/7121 sejak 2025 | 1.917 | 33 | 1.884 | 0 | 0 | 0 | 1.899/1.899 |
| 2111/7119 semua | 10.278 | 1.315 | 8.963 | 0 | 0 | 0 | 10.107/10.107 |
| 2112 semua | 10.278 | 130 | 10.141 | 5 | 2 | 0 | 10.237/10.237 |

Yang berubah (2112): 178/Pdt.G/2017 baru 12-09-2017 ("Pembuktian untuk Tergugat" sesudah alasan tunda "Menghadirkan saksi-saksi
Tergugat"), 117/Pdt.G/2018 baru 01-08-2018 ("Pembuktian untuk Termohon"), 347/Pdt.G/2018 baru 20-02-2019 ("Pembuktian untuk Penggugat dan
Tergugat"), 134/Pdt.G/2020 baru 04-08-2020 ("Pembuktian lanjutan P dan pembuktian T"), 35/Pdt.G/2021 baru 09-02-2021 (alasan tunda
"Pembuktian Lanjutan Termohon"), 61/Pdt.G/2018 24-04 -> 17-04-2018 dan 67/Pdt.G/2020 27-05 -> 20-05-2020 (Termohon/Tergugat sudah mulai
di sidang itu menurut alasan tunda). Hari (7121) berubah hanya pada 5 yang baru terisi. Perkara 2025+ tidak ada yang berubah (agenda
pembuktian Tergugat di SIPP satker umumnya ditulis tegas; perkara e-Court memakai Court Calendar).

## Pasang (Git Bash, server hidup) - SESUDAH tanggal-agenda-31okt

```bash
cd /d/.../abt-paket/pembuktian-urut-1nov
rm -rf paket-satker/cadangan
ssh aleta 'mkdir -p /root/abt-pembuktian-urut-20261101'
scp -r paket-satker/* aleta:/root/abt-pembuktian-urut-20261101/
ssh aleta 'cd /root/abt-pembuktian-urut-20261101 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-pembuktian-urut-20261101/pasang-satker.sh'
```

Keluaran benar: `PRASYARAT COCOK (4|0)`, `CADANGAN: ...`, `PERIKSA: SEMUA COCOK`, `PRASYARAT SESUDAH: 0|4`, `SELESAI`. Pasang ulang aman
(`0|4`). PRASYARAT lain (mis. `3|0` = satu variabel sudah disunting orang, atau `0|0` = tanggal-agenda-31okt belum terpasang) = berhenti
TANPA mengubah apa pun. Pulih: `ssh aleta 'bash /root/abt-pembuktian-urut-20261101/pulih-satker.sh'` -> `PULIH COCOK` (kembali persis
ke hasil tanggal-agenda-31okt).

Uji laptop (`sumber/uji_lokal.sh`, basis milik sendiri `aps_badilag_w153` = abt_variabel `aps_badilag_rantai152` sesudah rantai penuh):
pasang, pasang ulang (tidak mengubah apa pun), pulih (= keadaan awal persis seluruh tabel), pasang lagi (= pasang pertama), penjaga
(2112 disunting -> `3|0`, tidak ada yang berubah) - `hasil/uji-lokal.txt`.

Bangun ulang: `python sumber/bangun_paket.py <basis salinan sesudah rantai penuh>`; banding: `NODE_PATH=<node_modules bot> node
alat/banding.js sipp_2810 2025-01-01 hasil/banding-2025.json`.
