# Paket ABT `abt-prodeo-panggilan-29okt` - biaya perkara prodeo/nol, amar biaya seragam, tanggal panggilan sebanyak relaas (29-30 Okt 2026)

**Status: teruji di ABT LAPTOP (basis sendiri `aps_badilag_pp29` = dump server 28 Okt 15.44, SIPP `sipp_2810`; pohon blangko = PERKIRAAN SERVER, lihat "Dasar"), BELUM dipasang di server - dipasang sesi utama saat server hidup. URUTAN: paket ini DULU, lalu `bas-tanya-jawab-29okt` (w124).**
Hanya blangko `derry_briantono` dan variabel pekerjaan Derry (`modifier = admin`); tidak ada variabel bawaan ABT yang diubah (bawaan 0279/6060/6063/0312/0281/1090/1164/1101/0155/2050 hanya DIBACA lewat variabel cermin baru). Tidak ada kata aplikasi di apa pun yang masuk ABT.

## Permintaan dan keputusan pengguna (Derry)
29 Okt: (1) perkara prodeo / tanpa biaya - walau register memuat redaksi + meterai Rp20.000 - putusan memuat 0 rupiah; amar "Membebankan biaya perkara kepada DIPA ..." tanpa apa pun sesudahnya; rincian Rp0,00 dengan kurung "(nihil)". (2) Tanggal panggilan di duduk perkara/pertimbangan sebanyak panggilan (dulu "tanggal 26 Oktober 2026 dan 26 Oktober 2026").
30 Okt 05.46: (1) amar prodeo PERSIS "Membebankan biaya perkara kepada DIPA Pengadilan Agama <satker> Tahun <tahun>" (tanpa "negara, melalui"); (2) tahun = tahun PENDAFTARAN (#0191#); (3) "Menghukum ... membayar biaya perkara" (ekonomi syariah, coret, dsb.) dan perdamaian #9354# ikut: prodeo -> kalimat DIPA, bukan prodeo -> nominal benar (bukan "Rp290,00"); (4) amar biaya IKRAR sama di semua tempat (penetapan ikrar ABT, amar yang ditulis ke SIPP, kutipan BAS ikrar): "Membebankan biaya perkara kepada Pemohon sejumlah Rp<angka>,00 (<terbilang> rupiah)"; biaya Rp0 bukan prodeo: "Membebankan biaya perkara kepada Pemohon" tanpa "sejumlah"; prodeo: "... kepada DIPA Pengadilan Agama <satker> Tahun <tahun daftar>"; (5) tanggal panggilan semua Tergugat; (6) rincian biaya verzet otomatis. Sesi utama 30 Okt: #5223# (meterai) tidak boleh GALAT bila satu perkara punya dua baris meterai.

## Sebab
- **Tanggal ganda**: `tanggal #1077# dan tanggal #0120#` (Termohon/Tergugat) / `tanggal #1076# dan tanggal #0118#` (Pemohon/Penggugat) = relaas PERTAMA (MIN) dan TERAKHIR (MAX). Satu panggilan -> tanggal sama dua kali; tiga atau lebih -> yang di tengah hilang; hanya pihak peringkat 1; ikut relaas IKRAR sesudah putusan (perkara 8477: "31 Januari 2025 dan 09 Mei 2025"). Ada di 8508 (verstek), 8547 (gugur) dan langsung di RTF (14 tempat di 9 putusan).
- **Prodeo**: RTF `#8505# (#0155# #7095#)` -> "... DIPA ... Tahun 2026 (dua puluh ribu Nihil)"; #0143# selalu memuat redaksi #0281# (bawaan "10000.00") + meterai #5223# (10000); rincian memakai variabel bawaan apa adanya.
- **Nominal terpotong**: kalimat RTF `Rp#8504#,00`: ABT memformat ulang nilai #8504# "290.000" (is_numeric dan memuat "0.00") menjadi "290" -> "Rp290,00" (399 perkara). Sama untuk #3993# verzet.

## Aturan yang dipakai
- **Penanda prodeo** = `perkara.prodeo = 1` (sama dengan 8505, 8507, 8527, 7095, 11112, 5802; 124 perkara). `id_pembiayaan = 2` dan `ecourt_prodeo` tidak dipakai supaya amar, duduk perkara (8507) dan pertimbangan (8527) selalu sepakat.
- **Amar prodeo** = cabang prodeo #8505#: "Membebankan biaya perkara kepada DIPA #8008# Tahun #0191#" + tanda baca blangko; satker dari #8008# (SIPP NamaPN), tahun dari #0191# (tahun pendaftaran) - tidak ada nama satker/tahun tetap. Semua amar tertulis langsung (Membebankan/Menghukum, perdamaian, ikrar, verzet) memakai teks yang sama.
- **Rincian prodeo**: semua pos tetap tercetak "Rp 0,00", jumlah "Rp 0,00", kurung "(nihil)". Rincian berbiaya NOL (ikrar/verzet bukan prodeo) juga "(nihil)".
- **Biaya nol** (ikrar #1101#, verzet #3992#): amar tanpa "sejumlah Rp0,00 ( rupiah)".
- **Tanggal panggilan** = semua tanggal relaas berbeda di sisi itu (semua pihak), urut, bukan sidang ikrar, sampai tanggal putusan: "A", "A dan B", "A, B, dan C" (PUEBI); "..." bila belum ada; semua cara panggil (e-Court `E`, surat tercatat, ghaib) ikut; cabang ghaib 8508/8547 tetap #7063#.
- **Meterai (#5223#)**: satu putusan = satu meterai = baris meterai PERTAMA (`ORDER BY tanggal_transaksi, id LIMIT 1`). Dulu subkueri tanpa batas: perkara dengan dua baris meterai (hanya 9321 - verzet: meterai putusan asal 24 Des 2025 + putusan perlawanan 10 Feb 2026) GALAT dan SELURUH cetakan ABT berhenti. Meterai kedua sudah terhitung di biaya verzet #3992#. Jumlah meterai di SIPP: 6.000 (5.567 baris), 10.000 (4.450), 12.000 (71), 0 (5) - satu baris per perkara kecuali 9321.
- **Biaya verzet (#3992#)**: isian #3991# tetap didahulukan; kosong = jumlah biaya KELUAR SIPP sejak `perkara_verzet.tanggal_pendaftaran_verzet` (semua jenis biaya keluar kecuali "Pengembalian Sisa Panjar" 151). Perkara 9321: Rp150.000 = tambahan panjar Rp250.000 - sisa Rp100.000.

## Isi
- **Fungsi baru** `isian_rtf_terbilang(n)` (NO SQL, MariaDB 5.5) = `TemplateHelper::Terbilang` ABT (487.139 angka, beda 0 melawan PHP 5.6; `alat/uji_terbilang.py`).
- **38 variabel baru** (`paket-satker/nomor-baru.txt`, blok 11120-11199, semula kosong): 11120/11121 tanggal relaas; 11122 amar `#8505#` lengkap; 11123/11124/11145 kurung jumlah rincian biasa/ikrar/verzet; 11130-11144 cermin pos rincian (prodeo 0); 11150-11166 amar tertulis langsung, 17 bentuk kalimat (nomor TETAP di `sumber/varian-nomor.tsv`: 11150-11159 sama dengan commit 43aa9450, 11160 perdamaian #9354#, 11161/11162 verzet Pelawan/Terlawan, 11163-11166 "Menghukum #0046#/#0047#/#7036#/#7037#"). 11152 (penetapan ikrar [90]/[90a]/[92]/[92a]) kini berbunyi keputusan 30 Okt butir 4.
  Nama variabel tidak memuat penanda selain #0046#/#0047#: ABT MERENDER nama variabel tiap cetak (`data_variabel_detil`: `'nama' => variabel($nama)`) - penanda #8505# di nama membuat verzet 9321 GALAT (#5223#).
- **6 variabel Derry diubah** (bersyarat md5, `nomor-ubah.txt`): 8505 (cabang prodeo tanpa "negara, melalui"), 3992 (verzet otomatis), 5223 (meterai: baris PERTAMA, lihat Aturan), 8508, 8547, 8600 (tanggal panggilan).
- **856 blangko RTF ditimpa** (`daftar-timpa.tsv`, `timpa.tgz` md5 `e00008e848bd071fa9903b4a47dc11ca`), `sumber/tambal_rtf.py`: penanda jangkar diganti di tempat, huruf tampak lain di rentang aturan dihapus, kata kendali/kurawal tidak disentuh, tiap berkas diperiksa ulang. Aturan: A 625, A2 4, AV 217, R 3.720, RJ 540, P1-P4 14.

## Dasar (md5) - pohon PERKIRAAN SERVER
Dasar = `D:/Aplikasi/aleta/tmp/bas29/dasar2/derry_briantono` (disusun agen BAS, w124 `alat/susun_dasar.py` SEMUA=1): salinan server w82 + paket terpasang sesudahnya alamat-ganda-26okt, sampul-daftar-isi-26okt, pihak-urut-ecourt-27okt, court-calendar-28okt, blangko-ikrar-92-28okt (1.784 berkas). Commit 43aa9450 masih memakai w82 tanpa alamat-ganda/pihak-urut (352 md5 lama tidak akan cocok) - SUDAH diperbaiki.
**Hubungan dengan paket BAS (w124)**: 840 berkas yang sama dengan bangun-ulang agen BAS (`D:/Aplikasi/aleta/tmp/bas29/pr`) ber-md5 lama sama 840/840; 772 di antaranya ber-md5 BARU sama persis. Yang berbeda: 68 berkas (aturan baru 30 Okt: Menghukum, perdamaian, verzet) + 16 berkas baru ditimpa - **0 di antaranya dipakai paket BAS** (`perl tambal-rtf.pl periksa` paket BAS atas pohon sesudah paket ini: `COCOK=94 LEWAT=0`).

## Ukuran (laptop, `alat/banding.js`, lama `aps_badilag_2810` vs baru `aps_badilag_pp29`)
1.889 perkara (124 prodeo + 1.794 putus 2025-2026), galat baru 0 (galat lama 3 = perkara 9321: dua baris meterai, #5223# subkueri; kini 0). Meterai/jumlah (#5223#|#0143#|#0155#) bukan prodeo: identik kecuali 9321 (GALAT -> meterai 10.000, jumlah 219.000 "dua ratus sembilan belas ribu"; jumlah itu memakai variabel bawaan pos biaya yang menghitung juga biaya tahap perlawanan - hanya perkara verzet ini). Hitungan: `hasil/banding-ringkasan.json`.
- **Prodeo 124/124** berubah ke bentuk prodeo di semua potongan (amar, rincian, ikrar, verzet, 17 amar tertulis).
- **Bukan prodeo**: amar `#8505#` dan rincian identik kecuali 1 (9321). Beda disengaja: 399 nominal `#8504#` kini utuh ("Rp290,00" -> "Rp290.000,00"; amar A2 dan Menghukum/Membebankan ber-#8504#); 467 ikrar biaya 0 ("sejumlah Rp0,00 ( rupiah)" -> tanpa, rincian "(nihil)"); penetapan ikrar (11152) semua perkara berbunyi baru; 8600 3+ tanggal: koma sebelum "dan"; verzet 9321 kini Rp150.000.
- **Tanggal panggilan Tergugat (1.794 putus)**: 218 satu, 879 dua, 172 tiga, 35 empat, 10 lima+, 480 tanpa relaas; **195 perkara dulu ganda**. 8508/8547 di luar tanggal identik (sampel 262).
- **Simulasi seperti pengguna** (`alat/simulasi_render.py`, renderer php56 ABT asli atas SIPP simulasi `sipp_pp29v` = tampilan baca-saja `sipp_2810` dengan prodeo DIPAKSA untuk perkara tanpa contoh prodeo; `hasil/simulasi-ringkasan.json`): prodeo CG verstek 9558, prodeo CT verstek + ikrar 10083 (paksa), bukan prodeo 10187/10077, ikrar Rp0 211, ES Menghukum dan perdamaian 8781 (paksa) / 8780, verzet 9321 (bukan prodeo dan paksa prodeo), coret 10187, BAS gugur prodeo 9247.
- **Siklus** (`ABT_LOKAL=1`, pohon perkiraan server): pasang (`PRASYARAT COCOK (0|0|6|0|1)`, `SIAP_TIMPA=856`, `SEMUA COCOK`, uji kueri 10 perkara x 44 variabel 0 galat, `TIMPA=856`, `BERKAS COCOK`) -> pulih (`PULIH COCOK`, sidik jari 2.677 variabel = dump server, 856/856 blangko kembali md5 lama) -> pasang lagi. Jalur gagal (diuji pada versi sebelumnya): blangko disunting -> berhenti tanpa mengubah; variabel disunting -> prasyarat berhenti.

## Pasang (Git Bash, server hidup)
```bash
cd /d/aleta-dev/wt/w125/abt-paket/prodeo-panggilan-29okt      # atau folder repo hasil gabung
ssh aleta 'mkdir -p /root/abt-prodeo-panggilan-20261029'
scp -r paket-satker/* aleta:/root/abt-prodeo-panggilan-20261029/
ssh aleta 'cd /root/abt-prodeo-panggilan-20261029 && md5sum -c MD5SUMS.txt | grep -v OK'      # harus kosong
ssh aleta 'bash /root/abt-prodeo-panggilan-20261029/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|6|0|1)`, `SIAP_TIMPA=856`, `BERKAS SIAP`, `CADANGAN: ...`, `SEMUA COCOK`, baris `uji kueri perkara NNNN: 44 variabel jalan, 0 galat`, `TIMPA=856`, `COCOK=856`, `BERKAS COCOK`, `SELESAI`. Lalu paket BAS (w124). Pulih: `pulih-satker.sh` (baris akhir `PULIH COCOK`; pulihkan paket BAS lebih dulu).
**Bila `BERKAS TIDAK SIAP`**: tidak ada yang diubah. Bangun ulang dari blangko server: `ssh aleta 'tar czf - -C /var/www/html/aps_badilag/_blangko_abt derry_briantono' > derry.tgz`, ekstrak ke folder pendek, `python sumber/bangun_paket.py aps_badilag_2810 <folder>/derry_briantono`, lalu bangun ulang paket BAS di atasnya; atau `TANPA_RTF=1` = fungsi + variabel saja.

## Kode ALETA (amar ikrar yang ditulis ke SIPP)
`aleta_bot/services/ikrarTalakService.js` (`butirBiayaIkrar`): bukan prodeo "Membebankan biaya perkara kepada Pemohon sejumlah Rp14.500,00 (empat belas ribu lima ratus rupiah)"; biaya 0 "Membebankan biaya perkara kepada Pemohon"; prodeo "Membebankan biaya perkara kepada DIPA Pengadilan Agama Donggala Tahun 2026" (nama dari SIPP `sys_config` NamaPN, tahun dari `perkara.tanggal_pendaftaran`; tidak terbaca = ditolak, tidak dikarang). BAS ikrar mengutip amar SIPP (#2063# `perkara_ikrar_talak.amar_ikrar_talak`), jadi ikut sama tanpa ubahan RTF. Amar yang sudah diketik petugas tidak ditimpa.

## Rancangan (BELUM dipasang - menunggu keputusan pengguna): pertimbangan prodeo 8527 disamakan dengan amar
Cabang prodeo 8527 kini: "... maka biaya perkara dibebankan kepada negara melalui DIPA #8008# Tahun Anggaran #0191##8185#".
Usulan (satu potongan, bersyarat md5 8527 seperti 8505): "... maka biaya perkara dibebankan kepada DIPA #8008# Tahun #0191##8185#" -> tercetak "... maka biaya perkara dibebankan kepada DIPA Pengadilan Agama Donggala Tahun 2026". Cabang bukan prodeo tidak berubah. Petitum #0139# ("... kepada negara melalui DIPA ...", permohonan pihak di duduk perkara) dibiarkan. Bila disetujui: tambah ke `UBAH` di `sumber/isi_variabel.py` (`8527: [('kepada negara melalui DIPA #8008# Tahun Anggaran #0191#', 'kepada DIPA #8008# Tahun #0191#', 1)]`), bangun ulang - RTF tidak berubah.

## Bangun ulang
`python sumber/bangun_paket.py [basis ABT] [akar RTF]` (bawaan `aps_badilag_2810`, pohon perkiraan server di atas); deterministik. Uji: `npx vitest run src/test/prodeo-panggilan-29okt.test.ts`; bot: `node aleta_bot/scripts/verify-ikrar-talak.js`.
