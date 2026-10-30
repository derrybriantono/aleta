# Paket ABT `abt-relaas-penetapan-30okt` - relaas/pemberitahuan dan penetapan PTSP blangko Derry (30 Okt 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama.**
Hanya blangko `derry_briantono` folder **98 Relaas** dan **99 PTSP** (25 berkas) + **15 variabel BARU** (blok 11200-11214).
**Tidak ada variabel lama yang diubah** (variabel lama yang keliru dibiarkan - sebagian dipakai salinan blangko di luar Derry
`_ikrar_talak`, 7006/7008 terkunci - blangko Derry dialihkan ke nomor baru). Tanpa kata nama aplikasi, tanpa nama satker tertulis mati.

## Urutan pasang (server)
1. `prodeo-panggilan-29okt` (versi bangun ulang atas pohon server perkiraan) -> 2. `bas-tanya-jawab-29okt` -> 3. `ket-saksi-kata-30okt` -> **4. paket ini**.
Tumpang-tindih: **tidak ada**. Ketiga paket itu tidak menyentuh folder 98 Relaas / 99 PTSP (diperiksa: `daftar-timpa.tsv` prodeo w125 dan
bangun ulang `D:/Aplikasi/aleta/tmp/bas29/pr`, `daftar-berkas.tsv` / `rtf-daftar-tambal.tsv` BAS, ket-saksi-kata hanya fungsi), tidak memakai
nomor 11200-11219 (prodeo 11120-11166), dan tidak mengubah variabel/fungsi yang dirujuk paket ini. Jadi md5 dasar 25 berkas paket ini =
pohon server perkiraan sebelum maupun sesudah ketiganya, dan PRASYARAT-nya tidak bergantung urutan; urutan di atas tetap dipakai.

## Dasar
- Basis ABT: `aps_badilag_2810` (dump server 28 Okt 15.44): kueri lama 7100 7108 7109 7006 7008 9564 9565 (pengganti diturunkan
  darinya, tiap penggantian harus ditemukan tepat sekali) dan bukti blok 11200-11219 kosong.
- Pohon RTF: `D:/Aplikasi/aleta/tmp/bas29/dasar3/derry_briantono` = salinan server w82 + paket alamat-ganda-26okt, sampul-daftar-isi-26okt,
  pihak-urut-ecourt-27okt, court-calendar-28okt, blangko-ikrar-92-28okt (disusun agen BAS dengan `alat/susun_dasar.py`, penjaga md5 tiap paket).
- PRASYARAT `A|B|C|D` = blok 11200-11219 berisi lain (0) | sudah persis paket (0 / 15) | 37 variabel yang dirujuk ADA | 7 variabel asal
  persis dasar. Benar: `0|0|37|7` (pertama) atau `0|15|37|7` (ulang). RTF: tiap berkas harus md5 persis `md5_lama` (`daftar-timpa.tsv`),
  satu saja beda -> berhenti tanpa mengubah apa pun.

## Inventaris blangko Derry yang bukan putusan/BAS (`hasil/inventaris.json`, 374 variabel berbeda)
| folder | jumlah | isi |
|---|---:|---|
| 98 Relaas | 29 | panggilan sidang pertama/lanjutan P & T (4), mediasi (2), pencegahan/penolakan/izin kawin - pihak didengar (5), pemberitahuan putusan P & T (2), permohonan bantuan delegasi (1), P dan T satu berkas (1), panggilan ikrar (1), e-Court: panggilan P/T, PBT verstek T, ikrar (4), amplop + bukti surat tercatat (7), pengumuman itsbat 1/2 pemohon (2) |
| 99 PTSP | 29 | PMH-PHS gabungan, PPP, PJS, PMH, PHS, PHS sita kabul/tolak, PMH-PHS ikrar, PHS ikrar, PHS ikrar lanjutan, penetapan mediator (11); ceklist (3); sampul (15) |
| 98b Berkas Perkara - BAS | 3 | daftar isi berkas |
| 98c Court Calendar - BAS | 2 | penetapan / perubahan jadwal persidangan |
| 97 Sita | 2 | putusan sela sita kabul/tolak |
| 96 Eksekusi | 8 | aanmaning, sita eksekusi, eksekusi riil, lelang, non-eksekutabel, konstatering, sukarela, cabut |
| folder jenis perkara | 5 + 36 + 14 | penetapan ikrar [90]/[90a]/[91]/[92]/[92a], penetapan/putusan coret panjar habis, akta perdamaian [97] (bagian amar biaya/rincian = paket prodeo) |

## Simulasi seperti pengguna (renderer php56 ABT asli, `alat/render.py`)
Salinan ABT CLI `D:/Aplikasi/aleta/tmp/rp30/abt` (controller `Uji_rp`, meniru `views/abt/preview.php`), basis `aps_badilag_rp30`
(= dump server, fungsi diarahkan ke salinan SIPP) dan `aps_badilag_rp30b` (= paket terpasang), SIPP `sipp_2810` lalu salinan sendiri
`sipp_rp30` (render memanggil `perkara_jadwal_sidang_reorder`). Teks dibaca seperti di kertas (`alat/rtfteks.py`: tulisan putih/tersembunyi
dibuang, kotak teks ikut) lalu dipindai (`alat/periksa_keluaran.py`) dan dibaca.
- Perkara: 10163 610/Pdt.G/2026 (CG verstek e-Court), 10083 537/Pdt.G/2026 (CT verstek + ikrar), 10077 531/Pdt.G/2026 (CT berkuasa + ikrar),
  10155 602/Pdt.G/2026 (kewarisan 3 P x 3 T + turut tergugat, berkuasa), 9870 367/Pdt.G/2026 (CG ghaib), 10246 675/Pdt.G/2026 (CG prodeo),
  10227 658/Pdt.G/2026 (mediasi), 10275/10274 261-260/Pdt.P/2026 (itsbat 2 pemohon), 10191 231/Pdt.P/2026 (DK), 7900 265/Pdt.G/2024
  (delegasi + eksekusi), 6952 491/Pdt.G/2022 (eksekusi), 10025/9806 (harta bersama, sita), 10225 656/Pdt.G/2026 (25 penggugat, kuasa).
- Render LAMA: 239 (224 lingkup utama + 15 penetapan ikrar/coret/perdamaian), 0 galat render. Render BARU: 114 (25 berkas yang diubah
  x perkara yang sama), 0 galat render, 0 sisa `#NNNN#`. Beda teks lama-baru: `hasil/beda-render.txt` (114 berkas, semua beda = aturan di bawah).

## Isi perbaikan (`hasil/isi-paket.json`)
| kode | blangko | sebelum (contoh nyata) | sesudah |
|---|---|---|---|
| K1 | 0.P 0.T 2.P 2.T 3.b 4 | baris "," sendirian di atas "Jurusita," (e-Court: `#7078#`/`#7110#` kosong; bukan e-Court ",,") | koma dibuang (variabel sudah berkoma) |
| K2/11204, 11214 | 0.T 1.P 1.T 2.T 3.b 11.x 12.1 13.1 / 4 | "Tanggal 21 Agustus 2026yang didaftarkan ..." (nilai ABT di-`trim`, spasi tak bisa diawalkan) | `#1064##7100#` -> `#11204#` = "21 Agustus 2026 yang didaftarkan ...;" / "...;"; relaas ikrar `#11214#` dengan PHS ikrar |
| K2/11205 | 0.P 1.P 2.P 3.b 4 | "Dela Safitri binti Rustam.J NIK 72..." | koma sesudah nama; "Pemohon I"/"Penggugat I" hanya bila lebih dari satu |
| K2/11206 | 0.T 1.T 2.T 3.b 4 | "agama Islam" tertulis mati (130 perkara Tergugat bukan Islam/kosong) | agama SIPP `#0020#` (kosong = "..."); "Tergugat I" bila lebih dari satu |
| K2/11207 | 2.P | "Penggugat dapat mengajukan perlawanan (verzet) ... Pasal 153 ayat (1) RBg"; e-Court selalu "Surat Tercatat"; cabang "melalui Bupati karena Tergugat ghaib" untuk Penggugat | "banding ... Pasal 199 ayat (1) RBg"; e-Court = domisili elektronik (kuasa) bila terdaftar, selain itu surat tercatat; cabang Bupati dibuang |
| K2/11208 | 2.T | dasar banding (kontradiktoir) tetap "Pasal 153 ayat (1) RBg" | `#11211#`: verzet = Pasal 153 ayat (1), banding = Pasal 199 ayat (1) RBg; e-Court = `#11212#` (domisili elektronik / surat tercatat) |
| K2/11209-11210 | 0.x 1.x 3.b 4 11.1 | relaas yang dikirim kepada KUASA tidak terbaca -> "Pada hari ini ..... tanggal ....." (380 baris relaas kuasa P, 26 kuasa T) | relaas pihak ATAU kuasanya (313 sidang P, 15 sidang T berubah) |
| K3 | 2.P | nama Penggugat tercetak sebagai penanda tangan walau e-Court (tidak ada yang menandatangani) | `#7153#` (kosong bila e-Court, nama bila bukan) seperti 0.P |
| K4 | 4 | panggilan ikrar "atas perintah ... Tanggal 24 Agustus 2026" (= PHS pokok) | `#1099#` tanggal PHS ikrar (904 perkara ikrar) |
| K5 | 5.1 5.2 7 | "Donggala, 21 Agustus 2026" = tanggal PENUNJUKAN JURUSITA (`#0180#`), juga pada relaas Oktober | `#11200#`/`#11201#` = tanggal relaas sidang itu (pihak atau kuasa), belum tercatat = titik-titik |
| K6 | 6.2 | "umur 28, ...", "alamat email  sebagai Termohon" (email kosong), tanggal putusan dari `#1278#` (minutasi), "Melawan", "kediaman Termohon" tertulis mati (cerai gugat) | "umur 28 tahun", `#8811#` (kalimat domisili hanya bila ada), `#1069#`, "Lawan", `#0047#` |
| K7 | 3.a | "Kepada Yth. Ketua Pengadilan Agama Donggala, Provinsi Sulawesi Tengah / di Provinsi Sulawesi Tengah" (`#1066#`/`#1167#` potongan alamat Tergugat) | `#11202#`/`#11203#` = PA tujuan dari SIPP `delegasi_keluar` ("Pengadilan Agama Palu" / "Palu"), belum dicatat = titik-titik |
| P1 | @0 @2 @2a @2b | PHS "Ketua Majelis ... membaca Penetapan **Ketua Majelis** Nomor ..." | "membaca Penetapan `#7051#` `#8008#`" (Ketua/Wakil/Plh. Ketua Pengadilan yang menetapkan PMH) |
| P2 | @0 @0a @0b @3 | "Tahun 2009 Tentang", "Nomor 7 tahun 2022", "Tahun 2009. Peraturan", "Tentang Penetapan" | "tentang", "Tahun", koma |

## Banding lama vs baru
- **Render php56 contoh**: 114 berkas lama/baru (atas); 161 perkara (sampel acak 150 + 11 perkara wakil) x 12 pasangan variabel, 0 galat render, 0 beda di luar jenis yang dimaksud
  (`alat/banding.py`, `alat/ringkas_banding.py`): lihat `hasil/banding-ringkasan.json` - galat baru 0, semua beda masuk jenis yang dimaksud.
- **SEMUA perkara (10.278)**: tiap kueri baru dijalankan untuk tiap perkara (penanda bersarang = 0): 154.170 kueri, 0 galat
  (`hasil/uji-semua-perkara.txt`); jumlah perkara yang berubah per aturan dihitung langsung dari datanya (`alat/hitung_beda_sql.py`,
  `hasil/hitung-beda-semua-perkara.json`): 2.695 e-Court ber-PHS (spasi), 5.836 gugatan (koma), 12 + 429 (nomor I), 130 + 49 (agama/nomor I
  Tergugat), 4.365 putus verstek (upaya hukum Penggugat), 5.789 putus bukan verstek (dasar banding), 26 (cabang Bupati), 313 + 15 sidang
  (relaas kuasa), 904 (PHS ikrar), 406 (PA tujuan delegasi).

## Siklus di laptop (`ABT_LOKAL=1`, basis `aps_badilag_rp30b`, blangko salinan)
pasang `PRASYARAT COCOK (0|0|37|7)`, `SIAP_TIMPA=25`, `SEMUA COCOK`, uji kueri 9 perkara x 15 variabel 0 galat, `TIMPA=25 COCOK=25 BERKAS COCOK`
-> pasang ulang `0|15|37|7`, `SUDAH=25` -> pulih `KEMBALI=25 BERKAS PULIH`, `PULIH COCOK`, md5 25 blangko = awal, CHECKSUM abt_variabel = dump
server -> pasang lagi. Jalur gagal: satu blangko disunting (1 bait) -> `BERKAS TIDAK SIAP ... TIDAK ada yang diubah`, blok variabel tetap kosong.

## Pasang (Git Bash, server hidup) - SESUDAH tiga paket di atas
```bash
cd /d/.../abt-paket/relaas-penetapan-30okt                 # folder repo hasil gabung
rm -rf paket-satker/cadangan paket-satker/timpa             # sisa uji laptop JANGAN ikut tersalin
ssh aleta 'mkdir -p /root/abt-relaas-penetapan-20261030'
scp -r paket-satker/* aleta:/root/abt-relaas-penetapan-20261030/
ssh aleta 'cd /root/abt-relaas-penetapan-20261030 && md5sum -c MD5SUMS.txt | grep -v OK'     # harus kosong
ssh aleta 'bash /root/abt-relaas-penetapan-20261030/pasang-satker.sh'
```
Keluaran benar: `PRASYARAT COCOK (0|0|37|7)`, `SIAP_TIMPA=25`, `BERKAS SIAP`, `CADANGAN: ...`, `SEMUA COCOK`, baris `uji kueri perkara NNNN: 15 variabel
jalan, 0 galat`, `TIMPA=25`, `COCOK=25`, `BERKAS COCOK`, `SELESAI`. Gagal sesudah PASANG SQL = pulih otomatis. Pulih:
`ssh aleta 'bash /root/abt-relaas-penetapan-20261030/pulih-satker.sh'` (baris akhir `PULIH COCOK`). Tidak perlu memulai ulang apa pun.
**Bila `BERKAS TIDAK SIAP`**: tidak ada yang diubah. Ambil pohon server (`ssh aleta 'tar czf - -C /var/www/html/aps_badilag/_blangko_abt derry_briantono' > derry.tgz`,
ekstrak ke folder pendek), `python sumber/bangun_paket.py aps_badilag_2810 <folder>/derry_briantono` (basis ABT: dump server terbaru bila
variabel asal berubah - PRASYARAT D), salin ulang. Bangun deterministik (timpa.tgz identik byte).

## Temuan yang TIDAK diubah paket ini
- **Data SIPP**: urutan pihak tidak mulai 1 (12 perkara Tergugat, 8 Penggugat; mis. 10225 urutan 25, 10155 urutan 3, 7900 urutan 2) -> variabel
  bawaan `#0102#`.. (urutan_data 1) kosong: "TELAH MEMANGGIL , umur 2026 tahun" / amplop "Kepada: ...". Perbaiki urutan di SIPP, atau
  variabel bawaan (bukan milik Derry). Alamat ganda/berkoma dari isian SIPP ("Kecamatan, Balaesang Tanjung", "Domisili Elektronik:..."
  di dalam alamat), amar SIPP berbutir "." (1 perkara, 10163), tanggal relaas hari Minggu (10083).
- **Kinerja**: kode pos amplop `#9290#`/`#9291#` 27-70 detik per perkara (pindai penuh `kode_pos` 82.818 baris dua kali); amplop lambat dicetak.
- **Milik paket prodeo**: rincian/amar biaya penetapan ikrar [90]-[92a], coret, akta perdamaian (render: "Rp ...,00", amar "2. ....").
- **Bersama putusan**: identitas `#7047#`/`#7048#` di PTSP/penetapan "NIK ," bila NIK kosong (dipakai juga putusan - agen putusan).
- Relaas mediasi tanpa jadwal mediasi: "Hari/Tanggal : , ..." dan "Mediator ..., Mediator" (cetak sebelum jadwal diisi).
- Relaas 4 ikrar: kalimat `#7099#` "untuk pemeriksaan perkara ..." (sidang ikrar bukan pemeriksaan) - kata, menunggu keputusan (P4).
- **Sampul, daftar isi, lampiran sampul, ceklist** (99 PTSP 18 berkas + 98b 3): DIKELUARKAN dari lingkup (agen lain, 30 Okt) - tidak
  diubah. Hasil render (10163, 10155, 10275; varian F4/Legal 10163): 0 sisa penanda, 0 galat; tabel dokumen daftar isi/ceklist hanya terisi
  bila dicetak lewat panel Blangko (cetak langsung dari ABT: hanya kalimat "Tabel dokumen disusun otomatis ..."); sisanya derau alamat SIPP.
- `_ikrar_talak/2 Relaas Ikrar Talak/[JS] 4. ...` (salinan blangko Derry di grup bawaan, laptop) memakai variabel lama yang sama: tidak disentuh.

## Pertanyaan untuk pengguna (usulan sudah dipasang kecuali disebut)
1. Pemberitahuan putusan kepada Penggugat/Pemohon: upaya hukumnya "banding ... Pasal 199 ayat (1) RBg" (dipasang). Benar? Untuk permohonan
   voluntair (alur Pdt.P) upaya hukumnya kasasi, bukan banding - usul: kalimat upaya hukum Pdt.P diganti kasasi (dasar pasal dari pengguna) atau dibuang.
2. Pemberitahuan putusan kepada Tergugat kontradiktoir: dasar banding Pasal 199 ayat (1) RBg (dipasang; dulu 153 = verzet). Benar?
3. "atas perintah Ketua Majelis ... Tanggal [PHS]" pada pemberitahuan putusan (2.P/2.T): tanggal perintahnya PHS. Usul: tanggal putusan (`#1069#`)? (belum diubah)
4. Panggilan ikrar (4): ganti "untuk pemeriksaan perkara ... antara:" menjadi "untuk menghadiri sidang penyaksian ikrar talak dalam perkara ... antara:"? (belum diubah)
5. Agama Tergugat kosong di SIPP: dicetak "..." (dipasang) - atau tetap "Islam"?
