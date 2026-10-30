# Paket ABT `abt-relaas-penetapan-30okt` - relaas/pemberitahuan dan penetapan PTSP blangko Derry (30 Okt 2026)

**Status: dibangun dan diuji di LAPTOP (server mati). Server: BELUM dipasang - dipasang sesi utama.**
Hanya blangko `derry_briantono` folder **98 Relaas** dan **99 PTSP** (25 berkas) + **21 variabel BARU** (blok 11200-11229: 11200-11220).
**Tidak ada variabel lama yang diubah** (variabel lama yang keliru dibiarkan - sebagian dipakai salinan blangko di luar Derry
`_ikrar_talak`, 7006/7008 terkunci - blangko Derry dialihkan ke nomor baru). Tanpa kata nama aplikasi, tanpa nama satker tertulis mati.

## Urutan pasang (server)
1. `prodeo-panggilan-29okt` (versi bangun ulang atas pohon server perkiraan) -> 2. `bas-tanya-jawab-29okt` -> 3. `ket-saksi-kata-30okt` -> **4. paket ini**.
Tumpang-tindih: **tidak ada**. Ketiga paket itu tidak menyentuh folder 98 Relaas / 99 PTSP (diperiksa: `daftar-timpa.tsv` prodeo w125 dan
bangun ulang `D:/Aplikasi/aleta/tmp/bas29/pr`, `daftar-berkas.tsv` / `rtf-daftar-tambal.tsv` BAS, ket-saksi-kata hanya fungsi), tidak memakai
nomor 11200-11229 (prodeo 11120-11166), dan tidak mengubah variabel/fungsi yang dirujuk paket ini. Jadi md5 dasar 25 berkas paket ini =
pohon server perkiraan sebelum maupun sesudah ketiganya, dan PRASYARAT-nya tidak bergantung urutan; urutan di atas tetap dipakai.

## Dasar
- Basis ABT: `aps_badilag_2810` (dump server 28 Okt 15.44): kueri lama 7100 7108 7109 7006 7008 9564 9565 (pengganti diturunkan
  darinya, tiap penggantian harus ditemukan tepat sekali) dan bukti blok 11200-11229 kosong.
- Pohon RTF: `D:/Aplikasi/aleta/tmp/bas29/dasar3/derry_briantono` = salinan server w82 + paket alamat-ganda-26okt, sampul-daftar-isi-26okt,
  pihak-urut-ecourt-27okt, court-calendar-28okt, blangko-ikrar-92-28okt (disusun agen BAS dengan `alat/susun_dasar.py`, penjaga md5 tiap paket).
- PRASYARAT `A|B|C|D` = blok 11200-11229 berisi lain (0) | sudah persis paket (0 / 21) | 38 variabel yang dirujuk ADA | 7 variabel asal
  persis dasar. Benar: `0|0|38|7` (pertama) atau `0|21|38|7` (ulang). RTF: tiap berkas harus md5 persis `md5_lama` (`daftar-timpa.tsv`),
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
- Contoh tambahan untuk upaya hukum (keputusan pengguna 30 Okt): 10139 587/Pdt.G/2026 (cerai talak, Termohon hadir satu kali), 9813
  315/Pdt.G/2026 (amar verstek tetapi sandi kehadiran SIPP mencatat Tergugat hadir), 10163 (verstek, Tergugat tidak pernah hadir), 10172
  229/Pdt.P/2026 (P3HP, Pemohon tunggal), 10191 231/Pdt.P/2026 (DK, Para Pemohon), 10083/10077 (panggilan ikrar).
- Render LAMA: 251 (224 lingkup utama + 15 penetapan ikrar/coret/perdamaian + 12 contoh upaya hukum), 0 galat render. Render BARU: 126 (25 berkas
  yang diubah x perkara yang sama), 0 galat render, 0 sisa `#NNNN#`. Beda teks lama-baru: `hasil/beda-render.txt` (semua beda = aturan di bawah).

## Isi perbaikan (`hasil/isi-paket.json`)
| kode | blangko | sebelum (contoh nyata) | sesudah |
|---|---|---|---|
| K1 | 0.P 0.T 2.P 2.T 3.b 4 | baris "," sendirian di atas "Jurusita," (e-Court: `#7078#`/`#7110#` kosong; bukan e-Court ",,") | koma dibuang (variabel sudah berkoma) |
| K2/11204, 11214 | 0.T 1.P 1.T 2.T 3.b 11.x 12.1 13.1 / 4 | "Tanggal 21 Agustus 2026yang didaftarkan ..." (nilai ABT di-`trim`, spasi tak bisa diawalkan) | `#1064##7100#` -> `#11204#` = "21 Agustus 2026 yang didaftarkan ...;" / "...;"; relaas ikrar `#11214#` dengan PHS ikrar |
| K2/11205 | 0.P 1.P 2.P 3.b 4 | "Dela Safitri binti Rustam.J NIK 72..." | koma sesudah nama; "Pemohon I"/"Penggugat I" hanya bila lebih dari satu |
| K2/11206 | 0.T 1.T 2.T 3.b 4 | "agama Islam" tertulis mati (19 perkara Tergugat Protestan/Katolik/Hindu/dll.) | agama SIPP `#0020#`, kosong = bawaan "Islam" (keputusan pengguna); "Tergugat I" bila lebih dari satu |
| K2/11207 + 11215 | 2.P | "Penggugat dapat mengajukan perlawanan (verzet) ... Pasal 153 ayat (1) RBg"; e-Court selalu "Surat Tercatat"; cabang "melalui Bupati karena Tergugat ghaib" untuk Penggugat | upaya hukum `#11215#` (lihat "Upaya hukum" di bawah); e-Court = domisili elektronik (kuasa) bila terdaftar, selain itu surat tercatat; cabang Bupati dibuang |
| K2/11208 + 11211, K6f | 2.T, 6.2 | upaya hukum dari jenis amar (`#7007#`: "Verstek" = verzet) dan dasar banding tetap "Pasal 153 ayat (1) RBg"; 6.2 verzet tertulis mati | upaya hukum `#11211#` menurut KEHADIRAN; e-Court = `#11212#` (domisili elektronik / surat tercatat) |
| K9 | 2.P, 2.T | "atas perintah Ketua Majelis ... Tanggal [PHS]" | tanggal PUTUSAN (`#1069#`; 2.T `#11216#` = tanggal putusan + kalimat e-Court) - keputusan pengguna |
| K8 | 4 | panggilan ikrar "untuk pemeriksaan perkara permohonan Cerai Talak antara :" | "untuk menghadiri sidang penyaksian ikrar talak dalam perkara permohonan Cerai Talak antara :" - keputusan pengguna |
| K2/11209-11210 | 0.x 1.x 3.b 4 11.1 | relaas yang dikirim kepada KUASA tidak terbaca -> "Pada hari ini ..... tanggal ....." (380 baris relaas kuasa P, 26 kuasa T) | relaas pihak ATAU kuasanya (313 sidang P, 15 sidang T berubah) |
| K3 | 2.P | nama Penggugat tercetak sebagai penanda tangan walau e-Court (tidak ada yang menandatangani) | `#7153#` (kosong bila e-Court, nama bila bukan) seperti 0.P |
| K4 | 4 | panggilan ikrar "atas perintah ... Tanggal 24 Agustus 2026" (= PHS pokok) | `#1099#` tanggal PHS ikrar (904 perkara ikrar) |
| K5 | 5.1 5.2 7 | "Donggala, 21 Agustus 2026" = tanggal PENUNJUKAN JURUSITA (`#0180#`), juga pada relaas Oktober | `#11200#`/`#11201#` = tanggal relaas sidang itu (pihak atau kuasa), belum tercatat = titik-titik |
| K6 | 6.2 | "umur 28, ...", "alamat email  sebagai Termohon" (email kosong), tanggal putusan dari `#1278#` (minutasi), "Melawan", "kediaman Termohon" tertulis mati (cerai gugat) | "umur 28 tahun", `#8811#` (kalimat domisili hanya bila ada), `#1069#`, "Lawan", `#0047#` |
| K7 | 3.a | "Kepada Yth. Ketua Pengadilan Agama Donggala, Provinsi Sulawesi Tengah / di Provinsi Sulawesi Tengah" (`#1066#`/`#1167#` potongan alamat Tergugat) | `#11202#`/`#11203#` = PA tujuan dari SIPP `delegasi_keluar` ("Pengadilan Agama Palu" / "Palu"), belum dicatat = titik-titik |
| P1 | @0 @2 @2a @2b | PHS "Ketua Majelis ... membaca Penetapan **Ketua Majelis** Nomor ..." | "membaca Penetapan `#7051#` `#8008#`" (Ketua/Wakil/Plh. Ketua Pengadilan yang menetapkan PMH) |
| P2 | @0 @0a @0b @3 | "Tahun 2009 Tentang", "Nomor 7 tahun 2022", "Tahun 2009. Peraturan", "Tentang Penetapan" | "tentang", "Tahun", koma |

## Upaya hukum pemberitahuan putusan (keputusan pengguna 30 Okt, final)
Satu aturan (`#11211#` butir kepada Tergugat/Termohon di 2.T, `#11220#` kalimat yang sama di 6.2, `#11215#` butir kepada Penggugat/Pemohon di 2.P),
diperiksa berurutan:
1. **Putusan dicabut / dicoret / gugur / digugurkan** (SIPP `perkara_putusan.status_putusan_id` -> `status_putusan.nama` LIKE 'Dicabut%' /
   'Dicoret%' / 'Gugur%' / 'Digugurkan%'):
   kalimat upaya hukum **dibuang seluruhnya** (butir `<li>` ikut hilang; tidak ada sisa "Bahwa ...;").
2. **Permohonan** (`perkara.alur_perkara_id = 16`): **kasasi** (`#11219#` Pasal 46 ayat (1) UU 14/1985 sebagaimana diubah UU 5/2004 dan
   UU 3/2009), sebutan "Pemohon" / "Para Pemohon" menurut jumlah `perkara_pihak1`.
3. **Gugatan, kepada Penggugat/Pemohon**: **banding** (`#11217#` Pasal 199 ayat (1) RBg), juga pada perkara verstek (pilihan a).
4. **Gugatan, kepada Tergugat/Termohon, amar verstek** (`LOCATE('verstek', perkara_putusan.amar_putusan) > 0`, tanpa membedakan huruf besar):
   **selalu perlawanan (verzet)** (`#11218#` Pasal 153 ayat (1) RBg), walau sandi kehadiran mencatat hadir.
5. **Gugatan, kepada Tergugat/Termohon, bukan verstek**: pernah hadir = **banding**; tidak pernah hadir = **verzet**. "Pernah hadir" =
   ada baris `perkara_jadwal_sidang` perkara itu dengan `dihadiri_oleh` IN (1, 3, 8, 9, 11, 15) dan `tanggal_sidang` <= tanggal putusan
   (1 semua pihak, 3 pihak kedua saja, 8 T + intervensi, 9 P + T, 11 sebagian Tergugat, 15 T + turut T). SIPP mencatat kehadiran per
   SIDANG, bukan per orang, jadi pada Tergugat banyak = salah satu Tergugat/Termohon pernah hadir.
Pasal hanya di 11217/11218/11219 (padanan HIR nanti cukup mengubah tiga variabel itu).

### Deteksi konflik "amar verstek tetapi sandi kehadiran Tergugat hadir" (untuk catatan temuan panel cetak - aturan IDENTIK)
Perkara dianggap KONFLIK bila semuanya benar:
- `perkara.alur_perkara_id = 15` (gugatan);
- ada `perkara_putusan` perkara itu dengan `LOCATE('verstek', amar_putusan) > 0`;
- ada `perkara_jadwal_sidang` perkara itu dengan `dihadiri_oleh IN (1, 3, 8, 9, 11, 15)` dan `tanggal_sidang <= perkara_putusan.tanggal_putusan`.
```sql
SELECT p.perkara_id, p.nomor_perkara, u.tanggal_putusan, j.urutan, j.tanggal_sidang, j.dihadiri_oleh
FROM perkara p JOIN perkara_putusan u ON u.perkara_id = p.perkara_id
JOIN perkara_jadwal_sidang j ON j.perkara_id = p.perkara_id
WHERE p.alur_perkara_id = 15 AND LOCATE('verstek', u.amar_putusan) > 0
  AND j.dihadiri_oleh IN (1, 3, 8, 9, 11, 15) AND j.tanggal_sidang <= u.tanggal_putusan;
```
Data sekarang (dump 28 Okt): **83 perkara** (contoh 9813 315/Pdt.G/2026). Pemberitahuan putusan tetap verzet (keputusan pengguna); catatan
temuan sebaiknya menyebut sidang (urutan, tanggal, sandi) yang dicatat hadir agar panitera sidang memperbaiki kehadiran di SIPP.

## Banding lama vs baru
- **Render php56 contoh**: 134 berkas lama/baru; contoh keputusan pengguna: cabut 10225 656/Pdt.G/2026 dan 10096 224/Pdt.P/2026 (tanpa
  kalimat upaya hukum, butir berikut langsung "Pemberitahuan isi putusan ..."), coret 6268 (tanpa kalimat), verstek dengan sandi hadir 9813
  315/Pdt.G/2026 (Tergugat verzet, Penggugat banding), NO bukan verstek 10143 (Tergugat tidak pernah hadir = verzet), cerai talak Termohon
  hadir sekali 10139 (banding), Pdt.P tunggal 10172 (Pemohon kasasi), Pdt.P dua pemohon 10191 (Para Pemohon kasasi), ikrar 10083/10077,
  gugur e-Court 10166 (Gugur) dan 10124 (Digugurkan) - kalimat upaya hukum hilang tanpa sisa, gugur bukan e-Court 8156 dan 7997 (sejak dulu
  tanpa kalimat, tetap).
- **Banding 161 perkara** (sampel acak 150 + 11 wakil) x 13 pasangan variabel (`alat/banding.py`, `alat/ringkas_banding.py`,
  `hasil/banding-ringkasan.json`): 0 galat render, 0 galat/sisa penanda baru, 0 beda di luar jenis yang dimaksud. Kepada Tergugat (2.T):
  verzet->verzet 85 (termasuk 2 verstek bersandi hadir), banding->banding 20, banding->kasasi 27, banding->verzet 1 (bukan verstek, tidak
  pernah hadir), banding->dibuang 17 (14 dicabut + 3 gugur e-Court), belum putus 11. Kepada Penggugat (2.P): verzet->banding 85,
  banding->banding 21, banding->kasasi 27, banding->dibuang 17, belum putus 11.
- Pindai pembaca (`hasil/pindai-render.txt`): koma sendiri 59 -> 3 (sisa = amar SIPP berbutir "."), "2026yang" 50 -> 0; tambahan "tempat
  kediaman di ," hanya pada 6.2 (PBT verstek) yang dicoba pada perkara Pdt.P / urutan pihak rusak (alamat Tergugat kosong).
- **SEMUA perkara (10.278)**: kueri tiap variabel baru dijalankan untuk tiap perkara (penanda bersarang = 0): versi 15 variabel 154.170 kueri,
  versi 20 variabel 61.668 kueri, versi akhir (11207 11208 11211 11215 11220) 51.390 kueri - semua 0 galat (`hasil/uji-semua-perkara.txt`).
  Jumlah perkara yang berubah per aturan dari datanya (`alat/hitung_beda_sql.py`, `hasil/hitung-beda-semua-perkara.json`): 2.695 e-Court
  ber-PHS (spasi), 5.836 gugatan (koma), 12 + 429 (nomor I), 19 + 49 (agama/nomor I Tergugat; 111 agama kosong tetap "Islam"), 26 (cabang
  Bupati), 313 + 15 sidang (relaas kuasa), 904 (PHS ikrar), 9.889 (tanggal perintah pemberitahuan = putusan), 406 (PA tujuan delegasi).
  Upaya hukum (perkara putus): cabut/coret/gugur 968 (532 gugatan + 436 permohonan) -> tanpa kalimat (yang berubah: 584 cabut/coret + 90 gugur
  e-Court [44 gugatan + 46 permohonan]; 294 gugur bukan e-Court sejak dulu tanpa kalimat); gugatan verstek 4.363 -> verzet (termasuk 83 KONFLIK
  sandi hadir, tetap verzet); bukan verstek + pernah hadir 711 -> banding (dasar 153 -> 199); bukan verstek + tidak pernah hadir 137 -> verzet
  (92 dikabulkan, 37 NO, 8 ditolak); permohonan 385 tunggal + 3.588 para pemohon -> kasasi; Penggugat gugatan -> banding.

## Siklus di laptop (`ABT_LOKAL=1`, basis `aps_badilag_rp30b`, blangko salinan)
pasang `PRASYARAT COCOK (0|0|38|7)`, `SIAP_TIMPA=25`, `SEMUA COCOK`, uji kueri 9 perkara x 21 variabel 0 galat, `TIMPA=25 COCOK=25 BERKAS COCOK`
-> pasang ulang `0|21|38|7`, `SUDAH=25` -> pulih `KEMBALI=25 BERKAS PULIH`, `PULIH COCOK`, md5 25 blangko = awal, CHECKSUM abt_variabel = dump
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
Keluaran benar: `PRASYARAT COCOK (0|0|38|7)`, `SIAP_TIMPA=25`, `BERKAS SIAP`, `CADANGAN: ...`, `SEMUA COCOK`, baris `uji kueri perkara NNNN: 21 variabel
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
- **Sampul, daftar isi, lampiran sampul, ceklist** (99 PTSP 18 berkas + 98b 3): DIKELUARKAN dari lingkup (agen lain, 30 Okt) - tidak
  diubah. Hasil render (10163, 10155, 10275; varian F4/Legal 10163): 0 sisa penanda, 0 galat; tabel dokumen daftar isi/ceklist hanya terisi
  bila dicetak lewat panel Blangko (cetak langsung dari ABT: hanya kalimat "Tabel dokumen disusun otomatis ..."); sisanya derau alamat SIPP.
- `_ikrar_talak/2 Relaas Ikrar Talak/[JS] 4. ...` (salinan blangko Derry di grup bawaan, laptop) memakai variabel lama yang sama: tidak disentuh.

## Keputusan pengguna 30 Okt (sudah dipasang)
1. Upaya hukum menurut aturan di atas; Penggugat pada perkara verstek = banding Pasal 199 ayat (1) RBg (pilihan a).
2. Dasar banding Tergugat kontradiktoir = Pasal 199 ayat (1) RBg.
3. "atas perintah ... tanggal" pada pemberitahuan putusan = tanggal putusan.
4. Panggilan ikrar = "untuk menghadiri sidang penyaksian ikrar talak".
5. Agama Tergugat kosong di SIPP = bawaan "Islam".
6. Penetapan cabut dan coret = kalimat upaya hukum dibuang; NO / ditolak / dikabulkan tetap aturan kehadiran.
9. Putusan gugur / digugurkan (juga perkara e-Court) = kalimat upaya hukum dibuang, sama dengan cabut/coret.
7. Dasar kasasi permohonan = Pasal 46 ayat (1) UU 14/1985 sebagaimana diubah UU 5/2004 dan UU 3/2009.
8. Amar verstek = selalu verzet bagi Tergugat/Termohon walau sandi kehadiran SIPP mencatat hadir (biasanya salah pilih kehadiran).

