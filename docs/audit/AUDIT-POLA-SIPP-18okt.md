# Audit pola tulisan ALETA ke SIPP - 18 Oktober 2026

Permintaan hakim 18 Okt ±21.15: penetapan otomatis/manual dan penginputan otomatis lain harus sesuai kerja petugas, baik
susunan maupun pola waktunya, karena basis data SIPP dapat dilihat pusat.

**Sumber kebenaran.** `sipp_donggala` lokal (salinan server sampai 9 Okt 2026), baris buatan petugas 2026. Baris ALETA
dikenali lewat `aleta_bot.aleta_bot_jejak_penetapan`: perkara 10119, 10187 (630/Pdt.G), 10019, 9892, 9956, 10078, 9729, dan uji
lokal 10222 (127.0.0.1). Kode SIPP yang dibaca: `D:\Aplikasi\SIPP\application` (`jadwal_sidang_c.php` validateTunda dan
validateEdit, `riwayat_perkara_m::updateproses`). Semua pengukuran hanya SELECT. Salinan kerja `auditpola_ukur` (sys_audittrail
sejak Juli 2025, tanpa kolom description) dibuat untuk mempercepat kueri, lalu dihapus. Skrip ukur ada di
`D:\Aplikasi\aleta\tmp\auditpola\`.

Semua jam di bawah memakai jam SIPP (WIB), kecuali disebut lain.

## Ringkasan temuan

| # | Jalur | Temuan | Tingkat | Tindakan |
|---|---|---|---|---|
| 1 | Penetapan PMH/PPP/PJS/PHS | Bila tombol ditekan **sebelum 07.00** dan kejadian terakhir perkara ada pada hari sebelumnya, mesin jam **meregangkan** jedanya mengisi beberapa hari. Contoh: PMH tercatat Jumat, PPP Sabtu, PJS Senin dini hari. Tanggal input jadi mendahului tanggal penetapan dan jatuh di akhir pekan. Disimulasikan 4.000 kali, median PMH->PPP 44 jam. | **PARAH** | Diperbaiki |
| 2 | Putus sidang (Jadwal Sidang) | Baris audit memakai formulir `PENUNDAAN JADWAL SIDANG` dengan ditunda='T'. Bentuk ini dipakai petugas hanya 5 dari 804 kali (0,6%). Petugas menutup sidang lewat borang `EDIT JADWAL SIDANG`, yang selalu berpasangan dengan perkara UPDATE (854 lawan 854), atau lewat aplikasi antrian. | **SEDANG** | Nama halaman diperbaiki; baris pasangannya menunggu **K7** |
| 3 | Tunda, putus, putus ikrar | `jam_sidang` dan `sampai_jam` ditulis dengan detik nyata, dan `sampai_jam` selalu tepat +1 jam dari `diperbaharui_tanggal`. Bentuk ini tidak dibuat oleh siapa pun. Borang SIPP hanya menerima HH:mm, sehingga 92% berdetik 00. Aplikasi antrian menulis `sampai_jam` sama persis dengan `diperbaharui_tanggal`. | **SEDANG** | Diperbaiki |
| 4 | e-Doc penetapan (`perkara_dokumen_penetapan`) | `diinput_tanggal` ditulis dalam jam 24. Seluruh 3.739 baris petugas 2026 berjam 01-12: SIPP memakai `date("h")`. Tiap unggahan ALETA sesudah pukul 13.00 akan jadi satu-satunya baris berjam 13+ di tabel itu. | **SEDANG** | Diperbaiki |
| 5 | Kasir otomatis | Jarak antarperkara 1,8-4,2 detik. Petugas: p10 20 detik, median 76 detik, dan yang ≤5 detik hanya 0,4%. Dengan jarak lama, sepuluh perkara tercatat dalam satu menit atas akun kasir. | **SEDANG** | Diperbaiki (portal + ekstensi) |
| 6 | Ikrar talak, tenggat 6 bulan (keputusan no. 91) | Tenggat masih memakai BHT bila PHS ikrar kosong. Tunda (b) bawaan "BHT + 6 bulan". Tunda yang melewati tenggat hanya diperingatkan. #1183 dihitung dari sidang ikrar pertama. KT16, penjaga tenggat, checklist, dan SKP dihitung dari BHT. | **SEDANG** | Diperbaiki, lihat bagian ikrar |
| 7 | Semua jalur | Tidak ada pagar jam kerja atau hari libur untuk jam INPUT. Petugas tidak pernah menginput penetapan di luar 07.00-16.30 atau pada Sabtu/Minggu (0 dari 883), sedangkan ALETA tercatat bekerja pukul 03.18 dan 06.02 WITA. | **PARAH** (bagi pusat) | **Keputusan pengguna K1** |
| 8 | Putus/tunda | ALETA menulis bentuk borang SIPP (ada sys_audittrail). Petugas justru 75% lewat aplikasi antrian, yang tanpa sys_audittrail dan dengan jam WITA. | kecil | Keputusan K2 |
| 9 | Kasir massal manual, e-Doc penetapan (akun), IP kosong, jeda baris dalam satu perkara | Lihat bagian keputusan. | kecil | Keputusan K3-K6 |

## 1. Penetapan PMH -> PPP -> PJS -> PHS

**Susunan: SAMA dengan petugas.**

- Baris audit per langkah: PMH 5 baris (perkara_penetapan INSERT, perkara_hakim_pn INSERT x3 berjudul " Smart Majelis", perkara
  UPDATE), PPP 3 baris, PJS 3 baris, PHS 5 baris.
- Kunci `Foreign Key [perkara_id]` pada perkara_panitera_pn dan perkara_jurusita (petugas 896/899 dan 902/905). Kunci
  `[id=..]` pada perkara_jadwal_sidang dan perkara_penetapan_hari_sidang.
- Riwayat proses 20/30/40/80/81, dengan 81 "Sidang pertama" sejam dengan PHS (petugas 862/883).
- Penetapan 630/Pdt.G/2026 (ALETA, 5 Okt) dibandingkan baris demi baris dengan 629/Pdt.G/2026 (tangan, hari yang sama): bentuknya
  sama.
- Uji lokal 9 Okt (10222) masih menunjukkan jam PPP, PJS, PHS sedetik. Mesin jam yang sekarang tidak lagi begitu.

**Akun: sesuai keputusan 13 Okt.** PMH = Ketua/Wakil/Plh pilihan. PPP & PJS = Panitera. PHS = Ketua Majelis. Petugas: PPP oleh
Sri Susilowati 872/883, PPP dan PJS oleh orang yang sama 883/883.

**Pola waktu: petugas (883 perkara 2026) dibanding mesin ALETA (4.000 simulasi).**

| Ukuran | Petugas p10 / median / p90 | ALETA p10 / median / p90 | Catatan |
|---|---|---|---|
| daftar -> PMH | 7 mnt / 40 mnt / 1,8 jam (100% hari yang sama) | ≥1-10 mnt sesudah kejadian terakhir | wajar |
| PMH -> PPP | 3,6 mnt / 30 mnt / 3,8 jam | 2 mnt / 6,8 mnt / 22 mnt | lebih rapat dari petugas, tetapi masih dalam sebaran; ekornya sengaja dipangkas |
| PPP -> PJS | 6 dtk / 9 dtk / 20 dtk | 6 dtk / 15 dtk / 36 dtk | wajar |
| PJS -> PHS | 54 dtk / 4,7 mnt / 40 mnt | 55 dtk / 3,2 mnt / 11 mnt | wajar |
| Jam PMH | 08.12 / 11.06 / 14.54 WIB; tidak pernah <07.00 atau ≥16.30 | jam tekan; ditekan sesudah 16.30, diakhiri 16.10-16.30 | lihat K1 |
| Hari | Senin-Jumat saja | hari tekan | lihat K1 |
| Detik 00 | 17/883 (1,9%) | acak | wajar |
| tanggal input = tanggal penetapan | 883/883 | ya bila tanggal penetapan = hari ini | lihat K1 |
| PMH beruntun oleh orang yang sama | median 33 dtk, ≤10 dtk 53/733 | rangkaian per perkara saling bertumpang | wajar |

**Perbaikan 1 (PARAH).** Fungsi yang diperbaiki: `jamRangkaianManusia` (`aleta_bot/services/penetapanTulisService.js`).

- Bila ruang hari ini sempit, lantainya tidak pernah sebelum awal hari ini.
- Jeda hanya dirapatkan, tidak pernah diregangkan. Bila ruangnya cukup, jeda asli dipakai apa adanya.

Hasil simulasi sesudah perbaikan:

- Ditekan 05.02: keempat langkah pada hari itu (04.33-05.02), PMH->PPP median 6,9 menit.
- Ditekan 00.05: tetap hari itu.

Diuji di `audit-pola-sipp-18okt.test.ts`.

## 2. Tunda sidang (Jadwal Sidang)

**Ukuran petugas: 1.103 tundaan 2026 yang diperbarui pada hari sidangnya.**

| Bentuk | Jumlah | sys_audittrail | jam_sidang & sampai_jam | sampai_jam - diperbaharui |
|---|---|---|---|---|
| Aplikasi antrian | 856 (75%) | tidak ada | detik nyata; jam_sidang ±2 mnt sebelum diperbaharui | **0 detik** (856/856) |
| Borang SIPP `PENUNDAAN JADWAL SIDANG` | 277 (25%) | jadwal UPDATE + INSERT + perkara UPDATE, jam = diperbaharui | **detik 00** 255/277 (borang HH:mm) | sebaran jam ketikan WITA |
| ALETA (sebelum perbaikan) | - | bentuk borang | detik nyata (jam masuk ruang) | **selalu +3.600 detik** (WITA lawan WIB) |

Pola lain pada tundaan petugas:

- Baris sidang berikutnya diinput pada detik yang sama dengan pembaruan baris hari ini: 1.022/1.099. ALETA juga begitu, dan itu sesuai.
- `agenda_id` tidak pernah diisi petugas (0/1.176). ALETA juga tidak mengisinya, dan itu sesuai.
- `dihadiri_oleh`: 2 sebanyak 630, 1 sebanyak 428, 4 sebanyak 101, 3 sebanyak 17. Urutan sumber ALETA (blangko, lalu antrian, lalu tercatat, lalu 4) sesuai.
- Alasan teratas: "Panggil Tergugat" dan "Tergugat tidak hadir". Teks bebas, tanpa daftar baku SIPP.
- Akun: PP perkara, sesuai keputusan 7 Okt.

**Perbaikan 3.** `jamBorang` dan `jamSelesaiBorang` (`sidangHasilService.js`):

- jam_sidang dan sampai_jam ditulis HH:MM:00, sama dengan isian borang.
- Jam selesai selalu lebih dari jam mulai. Bila sama, dipakai menit berikutnya, sebab validateTunda/validateEdit SIPP menolak jam
  selesai yang sama dengan jam mulai.

## 3. Putus sidang dan putus ikrar (Jadwal Sidang)

**Ukuran petugas: 804 baris ditunda='T' yang diperbarui pada hari sidangnya.**

- Borang `EDIT JADWAL SIDANG`: 278 baris. Jam audit = diperbaharui pada 236 baris.
- Aplikasi antrian, tanpa audit: ±520 baris.
- Borang `PENUNDAAN JADWAL SIDANG`: 5 baris.
- validateEdit memanggil `updateproses(200, tanggal sidang)`, yang menulis riwayat lalu perkara UPDATE dengan auditnya. Di 2026 ada
  854 perkara UPDATE untuk 854 jadwal UPDATE.

**Perbaikan 2.** Baris audit jadwal pada tombol Putus dan Putus ikrar kini bernama halaman `EDIT JADWAL SIDANG`, bukan
`PENUNDAAN JADWAL SIDANG`. Jam borang mengikuti perbaikan 3. Uji perilakunya memeriksa satu baris audit, akun PP, jam SIPP, dan
memastikan tidak ada penulisan perkara_putusan maupun tahapan.

Yang **belum** ditiru adalah pasangan yang selalu ditulis validateEdit, yaitu riwayat proses 200 bertanggal sidang dan perkara
UPDATE dengan auditnya. Bagian ini sudah sempat dikerjakan, lalu dicabut karena bertentangan dengan keputusan 30 Sep butir 12
(tombol Putus tidak menulis tahapan perkara). Diajukan sebagai **K7**.

Pola waktu putus petugas: jam pembaruan p10 09.12, median 11.12, p90 15.00 WIB. 804 dari 821 baris diperbarui pada hari sidang.
ALETA menulis jam tekan (lihat K1).

## 4. Ikrar talak - tenggat 6 bulan sejak penetapan hari sidang ikrar (keputusan no. 91)

**Ukuran.** `perkara_ikrar_talak.tanggal_penetapan_sidang_ikrar` terisi pada 172 dari 172 baris 2025+. Kolom itu selalu
mendahului `tanggal_sidang_pertama` (rata-rata 15 hari). Kolom inilah dasar tenggatnya.

**Perbaikan 6.**

| Tempat | Sebelum | Sesudah |
|---|---|---|
| `aleta_bot/services/ikrarTalakService.js` | `batasEnamBulanIkrar` memakai PHS, lalu BHT bila PHS kosong | Hanya PHS ikrar + 6 bulan kalender (31 Agt -> 28/29 Feb). Tanpa PHS: "" dan `keteranganBatasIkrar` menjawab "belum ditetapkan hari sidang ikrar - tenggat 6 bulan belum berjalan" |
| `aleta_bot/services/sidangHasilService.js` (tunda ikrar) | lewat tenggat hanya diperingatkan | **ditolak** (`tanggal_ikrar_melewati_batas_6_bulan`, batas disebut); tanggal batas itu sendiri masih boleh; tanpa PHS dicatat "belum berjalan" |
| `manajemen_surat/src/lib/ikrar-talak.ts` + `hasil-sidang.tsx` | tunda (b) = BHT + 6 bulan; batas memakai cadangan BHT | (b) = PHS ikrar + 6 bulan, mundur ke hari kerja; (a) +14 hari dijepit ke tenggat; simpan dicegah bila melewati tenggat |
| `abtIsianSippLanjutan.js` #1183 | sidang ikrar pertama + 6 bulan | penetapan hari sidang ikrar + 6 bulan |
| `analisaLanjutService.js`, `deteksi/cerai.js`, KT16 (`penilaianTahapanService.js`, `katalogEAuditService.js`), `penjagaTenggatService.js` + `penjaga-tenggat.ts`, checklist (`checklistMilestoneService.js`, `checklist-milestone*.ts`), SKP (`eviden-skp-katalog.ts`) | dari BHT | dari PHS ikrar (rincian di pesan commit dan uji masing-masing) |

Baris audit jadwal putus ikrar bernama halaman Edit (perbaikan 2). Form ikrar atas akun Ketua Majelis ikrar tetap sesuai keputusan 18 Okt.
e-Doc penetapan ikrar tidak menulis sys_audittrail, dan polanya belum diukur (lihat K6).

## 5. Kasir / jurnal

**Ukuran petugas: 9.178 baris perkara_biaya 2026, 9.174 di antaranya oleh `kasir`.**

| Ukuran | Petugas | ALETA |
|---|---|---|
| Formulir audit | `Add Mediasi` INSERT, judul `Tambah Data Biaya ... [ID=..]` | sama |
| Jam diinput_tanggal | jam 24 sejak ±5 Agt 2026 (1.786/1.848 = jam audit); sebelumnya jam 12 | jam 24 = jam audit (sesuai) |
| Jam input | 07.00-15.59, tidak pernah Sabtu/Minggu | jam halaman kasir terbuka (lihat K1) |
| tanggal_transaksi = hari input | 9.118/9.178 (99,3%) | otomatis: ya; massal manual: tanggal peristiwa (lihat K3) |
| Jarak baris beruntun, perkara sama | median 11 dtk; 31% detik yang sama | 0,35-2,2 dtk (lihat K5) |
| Jarak antarperkara | p10 20 dtk, median 76 dtk, ≤5 dtk 0,4% | **1,8-4,2 dtk -> diperbaiki: 20-150 dtk** |

**Perbaikan 5.**

- `lamaJedaAntarPerkara` / `jedaAntarPerkara` (`manajemen_surat/src/lib/kasir-otomatis.ts`).
- Kasir otomatis di `ekstensi-sipp/basmassal.js`. Perubahan ekstensi ini perlu dirilis lewat skill `rilis-ekstensi`; agen ini
  tidak merilis.

Kasir otomatis berjalan di latar, jadi tidak ada orang yang menunggu jeda ini.

## 6. e-Doc dan putusan

| Jalur | Petugas | ALETA | Hasil |
|---|---|---|---|
| Putusan akhir (`perkara_putusan` + `perkara_pertimbangan_hukum`) | dua baris audit pada detik yang sama | sama | sesuai |
| Unggah putusan (`dirput_dokumen`) | `created_by`='SYSTEM', jam 00:00:00 (1.530/1.531) | sama | sesuai |
| e-Doc penetapan, `is_penetapan_kembali` | 1 untuk penetapan biasa (3.721 baris) | 1 | sesuai |
| e-Doc penetapan, jam diinput_tanggal | **jam 12** (01-12, nol baris berjam 0 atau ≥13) | jam 24 | **diperbaiki** (`jamDuaBelas`, `dokumenPenetapanService.js`) |
| e-Doc penetapan, akun | `fahri` mengunggah ±70% dokumen keempat jenis, siapa pun pejabatnya | akun pemicu | lihat K4 |

## 7. Mediasi (penunjukan mediator)

- Petugas: `Add Mediasi` perkara_mediasi INSERT, tiga baris audit pada detik yang sama pada 195/213 kejadian. ALETA juga tiga baris
  sedetik, jadi sesuai.
- perkara_mediasi.diinput_tanggal berjam 12 (0/127 ≥13). ALETA berjam 12, jadi sesuai.
- Tanpa jeda dan tanpa pagar jam kerja: lihat K1.

## 8. Lain-lain

| Jalur | Hasil |
|---|---|
| `ipaddress` | Tidak pernah kosong pada 53.541 baris audit petugas 2026. ALETA mengosongkannya bila portal tidak meneruskan IP (keputusan butir 14: tidak dikarang). Lihat K6. |
| Kata "Aleta" di SIPP | Diperiksa agen AUDIT-JEJAK, bukan bagian audit ini. |
| Penetapan kembali, Court Calendar, posita, BAS | Satu jam untuk seluruh baris satu simpanan, sama dengan satu tekan Simpan SIPP. Polanya tidak diukur lebih jauh. |

## Keputusan untuk pengguna

| No | Pertanyaan | Data | Usul bawaan |
|---|---|---|---|
| K1 | **Tulisan di luar jam kerja dan hari libur.** Petugas tidak pernah menginput penetapan sebelum 07.00, sesudah 16.30, atau pada Sabtu/Minggu (0/883; tunda 6 dari 1.176 sebelum 07.00). ALETA menulis pada jam tombol ditekan: jejak 14 Sep pukul 03.18 WITA, 5 Okt pukul 06.02 WITA. Jam input tidak dapat dimundurkan ke hari sebelumnya tanpa memalsukan tanggal. | a) **antrekan** tulisan di luar 07.30-16.00 WITA (Jumat 16.30) dan hari libur, lalu kerjakan otomatis pada jam kerja berikutnya; b) tolak dengan pesan; c) biarkan seperti sekarang | a |
| K2 | Bentuk tunda/putus. 75% petugas lewat aplikasi antrian: tanpa sys_audittrail, jam WITA, sampai_jam = jam simpan. ALETA meniru borang SIPP (dengan audit, sesuai keputusan 7 Okt dan 18 Okt "tercatat di riwayat & sys_audittrail"). | a) tetap borang (sekarang); b) bentuk aplikasi antrian | a |
| K3 | Kasir massal manual (tombol, ditonton petugas): jarak antarperkara masih 1,8-4,2 dtk, dan `tanggal_transaksi` = tanggal peristiwa (bisa beberapa hari mundur), padahal petugas 99,3% menulis hari input. | a) samakan jeda 20-150 dtk dan tanggal = hari input; b) biarkan | a untuk jeda; tanggal perlu keputusan |
| K4 | Akun e-Doc penetapan. Petugas: hampir semua diunggah akun `fahri`. ALETA: akun pemicu. | a) akun pejabat penetapannya; b) akun pemicu (sekarang) | b sampai dipastikan siapa pemilik akun `fahri` |
| K5 | Jeda baris dalam satu perkara (Kasir): ALETA 0,35-2,2 dtk, petugas median 11 dtk. Memperpanjangnya membuat satu permintaan bisa berjalan ±1 menit. | a) 6-25 dtk per baris; b) biarkan | b |
| K6 | IP kosong bila portal tidak meneruskan IP, dan e-Doc penetapan ikrar belum diukur. | tolak tulis tanpa IP? | ya, tolak |
| K7 | Tombol Putus kini memakai nama halaman `EDIT JADWAL SIDANG`, tetapi baru menulis satu baris audit. Borang Edit SIPP selalu menambah riwayat Persidangan (proses 200, tanggal sidang) dan perkara UPDATE beserta auditnya (854/854). Tahapannya dibaca ulang dari riwayat terbaru, jadi tidak pernah menjadi "Putusan". Ini bertentangan dengan keputusan 30 Sep butir 12. | a) tiru pasangannya (tahapan tetap Persidangan/yang sudah ada); b) tetap satu baris | a |

## Verifikasi

- Uji perilaku baru: `manajemen_surat/src/test/audit-pola-sipp-18okt.test.ts`. Uji ini menjalankan layanan bot dengan basis data
  tiruan dan mencakup:
  - jam penetapan dini hari;
  - nama halaman Edit pada putus;
  - jam borang pada tunda dan putus;
  - tenggat ikrar beserta penolakan tunda;
  - jam 12 pada e-Doc penetapan;
  - jeda Kasir.
- Uji sasaran lain yang disesuaikan: `hasil-sidang-layar`, `ikrar-talak-jadwal-sidang`, `checklist-milestone-aturan`,
  `eviden-skp-katalog`, `isi-sipp-abt-sipp-lanjutan`.
- Uji penuh tidak dijalankan.
