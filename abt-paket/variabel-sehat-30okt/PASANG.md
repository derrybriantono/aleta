# Paket ABT `abt-variabel-sehat-30okt` - perbaikan variabel yang terbukti bermasalah (30-31 Okt 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama. URUTAN PASANG: PALING AKHIR**
(sesudah semua paket 29-30 Okt: prodeo-panggilan-29okt, bas-tanya-jawab-29okt, bas-itsbat-varian-30okt, bukti-nomor-30okt,
ket-saksi-kata-30okt, ket-saksi-baris-30okt, titik-koma-30okt, titik-koma-data-30okt, alasan-belum-dipilih-30okt, relaas-penetapan-30okt,
sampul-rapi-30okt, sela-ps-30okt, dan agama-belum-diubah-30okt cabang g1-cegah-salah). Tidak satu pun paket itu mengubah 4303/9292/9293,
jadi urutannya sebenarnya bebas; PRASYARAT memeriksa md5 isi variabel = keadaan sesudah semuanya (sama dengan dump server 28 Okt untuk
ketiga variabel ini).

Permintaan Derry 30 Okt 23.30: "perbaiki semua variabel yang bermasalah (kalau tidak ada, tidak usah diperbaiki variabelnya)".
Hanya variabel yang dipakai blangko **derry_briantono**. Tanpa variabel baru (blok 11950-11999 TIDAK dipakai), tanpa blangko RTF yang diubah.

## Isi (3 variabel, hanya bagian yang salah)

| variabel | masalah (render ABT asli, sebelum) | sesudah |
|---|---|---|
| 4303 ITSBAT: PERTIMBANGAN DASAR PASAL 7 AYAT (3) KHI (blangko `2 Itsbat Nikah/[01d]`, `[01e]`) | isian Tgl Nikah (5197) diketik "pada hari Sabtu, 18 Oktober 2025" / "13 Januari 1975;" / "10 Januari 2001," -> "terjadi pada **pada** hari Sabtu ...", "terjadi pada 13 Januari 1975**; .** Jika ...", "2001**,.** Jika" | di keempat tempat #5197# dalam variabel: awalan "pada " dibuang, titik/koma/titik koma di ujung isian dibuang. "terjadi pada hari Sabtu, 18 Oktober 2025. Jika ..." Isian kosong tetap seperti dulu. |
| 9292 / 9293 ALAMAT #0046# / #0047# DENGAN KODE POS DI UJUNG (amplop relaas `98 Relaas/[JS] 8.1.1, 8.2.1, 8.3.1` / pihak II) | alamat SIPP berisi "Domisili Eletronik: email" atau "Domisili Eleketronik:email" (salah ketik) tidak dikenali sebagai batas domisili elektronik -> "... Sulawesi Tengah. Domisili Eletronik:**, Kode Pos 94356.** email" | batas dikenali dari "domisili el": "... Sulawesi Tengah, Kode Pos 94356. Domisili Eletronik: email" (sama dengan alamat yang ejaannya benar) |

## Pasang (Git Bash, server hidup) - SESUDAH semua paket 29-30 Okt

```bash
cd /d/.../abt-paket/variabel-sehat-30okt               # folder repo hasil gabung
rm -rf paket-satker/cadangan                            # cadangan uji laptop (bila ada) jangan ikut tersalin
ssh aleta 'mkdir -p /root/abt-variabel-sehat-20261031'
scp -r paket-satker/* aleta:/root/abt-variabel-sehat-20261031/
ssh aleta 'cd /root/abt-variabel-sehat-20261031 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-variabel-sehat-20261031/pasang-satker.sh'
```

Keluaran benar: `PRASYARAT COCOK (3|0)`, `CADANGAN: ...`, `PERIKSA: SEMUA COCOK`, `PRASYARAT SESUDAH: 0|3 (harus 0|3)`, `SELESAI`.
Pasang ulang aman (`PRASYARAT COCOK (0|3)`, hanya PERIKSA). PRASYARAT lain (mis. `2|0` = satu variabel sudah disunting orang) = berhenti
TANPA mengubah apa pun. Pulih: `ssh aleta 'bash /root/abt-variabel-sehat-20261031/pulih-satker.sh'` -> `PULIH COCOK` (hanya baris yang
masih persis hasil paket; suntingan sesudahnya dibiarkan). Tidak perlu memulai ulang apa pun.

Bangun ulang (deterministik): `python sumber/bangun_paket.py <basis salinan sesudah semua paket 29-30 Okt>` (laptop: `aps_badilag_vs`).

## Uji

- **Pindai luas** (`hasil/pindai-ringkas.txt`): 1.856 penanda blangko Derry aktif (1.822 dihitung, 1.352 milik derry_briantono) x 169 perkara
  (semua jenis x alur yang ada: CG, CT, itsbat, waris, HB, DK, P3HP, perwalian, asal usul anak, wali adhal, poligami, ekonomi syariah, wasiat,
  lain-lain; putus/berjalan, verstek/kontradiktoir, prodeo, pihak banyak, kuasa, e-Court, ghaib, delegasi, ikrar, eksekusi, sela, mediasi
  berhasil/gagal, verzet, banding, cabut) = 178.237 nilai lewat mesin variabel bot (baca saja), ditambah SEMUA 1.822 variabel atas 3 perkara.
  Galat SQL 0 (satu-satunya = rantai waktu habis saat 4 pindai paralel; sendirian dan di render ABT asli terisi benar), penanda tersisa 0,
  bunyi galat 0, angka terpotong 0, tanggal salah 0, sangat lambat 0 (215 catatan > 5 dtk saat paralel diukur ulang sendirian: terlama 3,6 dtk).
- **Banding** (`alat/banding.js`, isi baru lewat timpaKatalog, tidak ditulis) atas 686 perkara (sampel + semua perkara berisian Tgl Nikah + semua
  beralamat "domisili"): galat baru 0; 4303 berubah 43 (semuanya hanya "pada " / "; " / "," / "." di sekitar isian Tgl Nikah), 9292 berubah 41
  (semuanya hanya letak ", Kode Pos NNNNN" terhadap "Domisili ..."), 9293 berubah 0 (tidak ada alamat pihak II dengan salah ketik itu di data).
- **Siklus laptop** (`sumber/uji_lokal.sh`, `hasil/uji-lokal.txt`): pasang `3|0` -> `SEMUA COCOK`; pasang ulang tanpa perubahan; pulih ->
  seluruh tabel variabel PERSIS awal; pasang lagi = pasang pertama; penjaga (9292 disunting) `2|0` BERHENTI tanpa perubahan.
- **Render ABT asli** php56 (`alat/render.py`, `hasil/render-ringkasan.json`, 7 naskah sebelum/sesudah): itsbat [01d] 10089 dan 10092, [01e] 10166
  (cacat hilang, satu-satunya beda di naskah = bagian itu); amplop 8.1.1 9880 dan 8.2.1 10224 (kode pos sebelum domisili elektronik); amplop
  8.1.1/8.1.2 10008 (alamat biasa) TIDAK berubah. 0 sisa penanda.
- Repo: `manajemen_surat/src/test/variabel-sehat-30okt.test.ts` (keutuhan, md5 tersyarat, hanya bagian dimaksud, tanpa kata nama aplikasi,
  MariaDB 5.5, bukti render).

## Temuan yang SENGAJA tidak diubah (lihat `hasil/pindai-ringkas.txt`)

1. **Identitas pihak yang datanya kosong di SIPP** (7047, 7048, 3507, 3509, 3970, 3971, 7062, 9230, 9231, 11205, 11206; dipakai ±980 blangko):
   render ABT asli "Zaitun binti ..., NIK , tempat dan tanggal lahir , 00 0000, agama , pekerjaan , pendidikan , tempat kediaman di ...".
   BERMASALAH, tetapi pembentuknya fungsi bersama (`isian_rtf_pihak_identitas`) + 11 variabel, dua di antaranya baru dari paket
   relaas-penetapan-30okt -> DIKERJAKAN di paket tersendiri `../identitas-kosong-31okt` (keputusan sesi utama 31 Okt: bagian kosong
   ditulis "...", agama kosong = Islam), dipasang SESUDAH paket ini.
2. **Data ketikan, bukan rumus**: "para Para Pemohon" (tanya-jawab saksi tersimpan begitu), posita/petitum/amar dengan kata berulang, alamat SIPP
   "Kabupaten Donggala., Provinsi" (titik sesudah singkatan "Kec. Palu Tim., Kota" juga sah, jadi ".," tidak bisa dibuang otomatis), isian 5227
   berakhir koma di 8528 (variabel itu juga diubah paket alasan-belum-dipilih/agama-belum-diubah - tidak disentuh), blangko itsbat yang menulis
   "pada tanggal #5197#" sendiri (teks blangko, bukan variabel: "pada tanggal pada Rabu ...").
3. **Bukan masalah**: istilah tetap sela/intervensi (Penggugat/Tergugat Intervensi), tahun lahir 1970, nama daerah "Toli Toli"/"Tojo Una Una".
4. Variabel yang SELALU kosong: ditinjau agen G6 (cabang g6-perluasan) - tidak diduplikasi.
