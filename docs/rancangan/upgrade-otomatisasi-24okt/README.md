# Rencana upgrade otomatisasi dan kinerja (24 Okt 2026)

Permintaan Derry: saran dan rencana untuk meng-upgrade fitur yang **sudah ada**, dengan dukungan basis data. Fokusnya:
- susun keterangan saksi otomatis;
- isi data otomatis dari SIPP ke ABT dan Blangko ABT by Derry Briantono;
- ekstensi ALETA.

Disusun dari peta kode `integrasi-1205-38` (ekstensi 1.205.38) ditambah cabang yang belum digabung: T2 saksi semua jenis, dan T7/T8 Referensi Data Pihak. **Belum ada yang dikerjakan.** Kerjakan bertahap, satu butir per cabang `fitur/<nama>`, mengikuti `AWAN.md`/`CLAUDE.md`.

## Temuan utama

ALETA sudah punya banyak pengisi otomatis. Contohnya: 45 katalog saksi untuk 33 jenis perkara, 159 dari 345 isian popup otomatis, dan 259 blangko yang terisi penuh. Ada tiga kelemahan besar:

1. **Koreksi petugas hampir tidak tercatat, jadi ALETA tidak bisa belajar.**
   - Lingkar "koreksi berulang → calon pola" (`aleta_jejak_koreksi`, `aleta_kamus_deteksi_calon`, migrasi 0060) baru hidup untuk panel usulan lama (`ekstensi-sipp/abt.js:3141`).
   - **Susun saksi** (`saksi-susun.js` `simpan()`) dan **Blangko Derry** (`blangko-derry-isian.js` `simpanIsian` ~2701) tidak mengirim koreksi. Blangko Derry bahkan tidak mencatat ketikan manual sama sekali.
2. **Ketepatan tidak diukur dari lapangan.**
   - `aleta_bot/config/gerbang-isian.json` (status otomatis/terstruktur/saran per kode) diukur luring sekali pada 20 Okt dan statis.
   - Ukuran saksi hanya menghitung tingkat terisi ("..." tersisa), bukan kebenaran isi.
   - Huruf alasan cerai hanya cocok 27 dari 318 dengan pilihan hakim (`abtAturanAlasan.js:~420`).
3. **Data tersebar dan dibaca ulang terus.**
   - Fakta SIPP dibaca ulang tiap permintaan (batas 2,5–4 detik), tanpa singgahan server.
   - Kehadiran punya tiga sumber yang bisa berbeda: teks blangko, SIPP, dan `aleta_bas_kehadiran`.
   - Konteks perkara dan riwayat yang bisa diurungkan hanya ada di peramban (12 perkara, per PC).

Karena itu urutan rencana: **fondasi data dan lingkar belajar dulu, baru menambah isian.** Tanpa fondasi, setiap isian baru tidak bisa dinilai benar atau salahnya.

## Aturan yang berlaku untuk semua butir

- TIDAK satu kata "Aleta"/"ALETA" masuk ke nilai SIPP/ABT/e-Court (`penjaga-tanda.js`, `tandaAletaService.js`, `tanda-aleta.ts`).
- Isian yang sudah berisi tidak pernah ditimpa tanpa persetujuan. Isian hukum (huruf alasan 8503, keputusan majelis 4100–4105, dasar hukum) **paling jauh usulan**.
- Hanya blangko dan variabel milik `derry_briantono` yang boleh diubah.
- Data koreksi berisi nama asli, jadi hanya disimpan di Postgres ALETA di server kantor. Tidak masuk repo atau cloud; fixture memakai nama rekaan. Retensi dapat diatur.
- Migrasi memakai nomor **0090+** (0084 T1, 0085 audit login, 0086–0087 T9, 0088 T10).
- Kenaikan status isian (mis. dari "saran" ke "otomatis") **tidak pernah otomatis**: sistem mengusulkan, Super Admin menyetujui.

---

## C0 — Cermin Perkara: keadaan tiap perkara selalu siap di basis data (usulan Derry 24 Okt)

**Ide:** sekali di awal, ALETA memindai **seluruh** perkara SIPP lalu menyimpan keadaannya di basis data ALETA (Postgres). Sesudah itu tidak perlu memindai ulang: hanya perkara **baru atau berubah** yang diperbarui otomatis. Semua layar dan ekstensi membaca dari cermin ini, bukan menanyai SIPP berkali-kali.

**Kenapa bisa:** tabel SIPP punya `diinput_tanggal` dan `diperbaharui_tanggal`, dan sudah dipakai ratusan kali di kode bot, termasuk `perkara_jadwal_sidang.diperbaharui_tanggal`. Mekanisme kembaran (`sinkronDumpService.js`) juga sudah membaca struktur SIPP.

### Cara kerja
1. **Pemindai awal (sekali)**
   - Membaca semua perkara dalam **kelompok kecil** (mis. 200–500 perkara per kelompok, jeda di antaranya).
   - Berjalan **malam hari/di luar jam kerja** supaya SIPP tidak terbebani.
   - **Bisa dilanjutkan**: titik terakhir disimpan, jadi bila terputus atau server mulai ulang, pemindaian lanjut dari situ, bukan dari awal.
   - Ada layar kemajuan untuk Super Admin, mis. "18.400 dari 23.100 perkara, perkiraan selesai 02.40".
2. **Pembaruan berkala**
   - Tiap 1–2 menit, bot membaca baris SIPP yang `diinput_tanggal`/`diperbaharui_tanggal`-nya lebih baru dari tanda terakhir: perkara, jadwal sidang, pihak, putusan, biaya, mediasi, panggilan.
   - Hanya perkara yang tersentuh yang dihitung ulang. Perkara baru otomatis masuk.
3. **Tulisan dari ALETA langsung masuk cermin**
   - Tunda, putus, penetapan, kehadiran, dan isian yang ditulis lewat ALETA memperbarui cermin seketika, tanpa menunggu putaran berkala.
4. **Pencocokan mingguan**
   - Untuk tabel yang tidak punya kolom waktu, dan untuk data yang **dihapus** di SIPP (penghapusan tidak terlihat dari kolom waktu).
   - Selisih diperbaiki dan dicatat.
5. **SIPP tetap sumber kebenaran**
   - Cermin hanya untuk **dibaca**. Semua tulisan tetap ke SIPP/ABT dengan penjaga yang sudah ada.
   - Sesaat sebelum menulis, ALETA tetap membaca ulang SIPP. Aturan ini tidak berubah.
   - Tidak ada trigger atau ubahan apa pun di basis data SIPP.

### Isi cermin (perkiraan tabel, migrasi 0090+)
- `aleta_cermin_perkara`, satu baris per perkara:
  - identitas: nomor, jenis, alur, tanggal daftar;
  - pelaksana: tahapan/proses terakhir, majelis, PP, JS;
  - sidang: sidang terakhir dan berikutnya;
  - akhir perkara: status putus, minutasi, BHT;
  - mediasi dan biaya: status mediasi, sisa panjar;
  - penanda: ghaib, prodeo, sita/eksekusi, e-Court, belum upload;
  - waktu: `sipp_diperbarui`, `cermin_diperbarui`.
- `aleta_cermin_sidang`: satu baris per jadwal sidang (agenda, ruang, hasil, ditunda, kehadiran), dipakai layar Jadwal Sidang dan layar publik.
- `aleta_cermin_pihak`: nama dan sebutan pihak, kuasa, alamat ringkas. Dipakai pencarian dan isian; berisi data pribadi, jadi hanya di server kantor.
- `aleta_cermin_tag`: penanda Status Perkara yang sudah dihitung, sehingga klik tag cukup sekali baca Postgres, tanpa 19 kueri SIPP.
- `aleta_cermin_jejak`: tanda terakhir per tabel SIPP, kemajuan pemindai awal, dan hasil pencocokan.

### Cakupan: layar dan fitur yang membaca dari cermin (permintaan Derry)
| Layar / fitur | Dibaca dari cermin | Tetap dibaca langsung (bersama untuk semua layar, K1) |
| :--- | :--- | :--- |
| **Jadwal Sidang** (portal + tautan `/jadwal`) | Daftar sidang per tanggal/rentang, agenda, ruang, majelis/PP/JS, pihak, hasil & tunda, penanda (ghaib, prodeo, e-Court, belum upload, sita), kesiapan | Antrean "sedang disidang" detik demi detik |
| **Jadwal Mediasi** | Pertemuan mediasi per tanggal, mediator, tenggang 30 hari sejak penetapan mediator, laporan mediator, ditunda | — |
| **Status Perkara** | Pencarian, rincian satu perkara, **semua tag beserta hitungannya** (tanpa 19 kueri SIPP per klik), tahapan, putus/minutasi/BHT | — |
| **Layar publik & antrean** (`antrian-layar`, `antrian-ruang`, `antrian-tampil`, `sidang-ruang`, panggil) | Jadwal hari itu, ruang, urutan | Panggilan/kehadiran saat itu |
| **Ekstensi di halaman SIPP/ABT** | "Keadaan perkara" satu panggilan (`sipp-konteks`), penanda/pita, widget checklist & kehadiran | — |
| **Isian Blangko Derry / susun saksi** | Fakta perkara (pernikahan, anak, pihak, mediasi, identitas saksi) sebagai sumber pertama, sebelum SIPP | SIPP dibaca ulang bila fakta di cermin lebih tua dari batas atau sebelum menulis |
| **Kasir** | Sisa panjar, biaya, jurnal ringkas per perkara | Pembacaan ulang sebelum menulis jurnal |
| **Relaas & panggilan, penunjukan, statistik, SKP/penilaian, laporan** | Daftar per juru sita/majelis, rekap per bulan | — |
| **Kerja otomatis** (tunda/putus otomatis, H-7, putusan terjadwal) | Bahan daftar/pratinjau | **Penjaga sebelum menulis tetap membaca SIPP langsung** (aturan lama tidak berubah) |

Tabel cermin bertambah: `aleta_cermin_mediasi` (satu baris per pertemuan/perkara mediasi) dan ringkasan biaya di `aleta_cermin_perkara`. Setiap layar menampilkan tanda "diperbarui hh:mm" dari `cermin_diperbarui`.

### Dampak (perkiraan, dibuktikan dengan uji beban K9)
| Hal | Sekarang | Dengan cermin |
| :--- | :--- | :--- |
| Buka Jadwal Sidang / Status Perkara | ±40 kueri SIPP lewat bot per muat penuh; hitung tag 1,2–6,6 dtk | 1–2 kueri Postgres yang sudah siap; jawaban kecil dan cepat |
| 100 perangkat membuka Jadwal | ±3.000–8.000 kueri SIPP/menit | Beban SIPP hanya dari putaran pembaruan, **tetap sama berapa pun perangkatnya** |
| Ekstensi saat membuka perkara di SIPP | Beberapa panggilan + bot membaca SIPP tiap kali | Satu panggilan kecil "keadaan perkara" dari cermin |
| SIPP lambat/bot mulai ulang | Semua layar galat | Layar tetap tampil dari cermin dengan tanda "diperbarui hh:mm" |

### Batas yang perlu jujur disampaikan
- **Keringanan laptop:** cermin terutama meringankan **server, SIPP, dan waktu tunggu**. Laptop ikut lebih ringan karena jawaban lebih kecil dan cepat, dan ekstensi tidak perlu banyak memanggil. Tetapi beban terbesar di PC tua tetap **ukuran skrip ekstensi** (12,4 MB di halaman ABT). Itu tetap diselesaikan oleh K10–K12, jadi C0 dan K-1 saling melengkapi.
- **Kesegaran data:** perubahan yang dibuat **langsung di SIPP** (bukan lewat ALETA) masuk cermin dalam ±1–2 menit. Yang perlu detik demi detik, seperti antrean "sedang disidang", tetap dibaca langsung tetapi bersama untuk semua layar (K1).
- **Pemindai awal** butuh beberapa jam pada malam pertama, tergantung jumlah perkara dan kecepatan SIPP; diukur di kembaran laptop lebih dulu.

### Hubungan dengan butir lain
- C0 **menggantikan dan memperluas U5** (fakta perkara terpadu) **dan K8** (Status Perkara dihitung di latar).
- C0 **memudahkan K1**: layar membaca cermin, bukan SIPP.
- C0 menjadi **sumber data U3/U4** (ketepatan per jenis perkara) dan **U17** (kabar perubahan data SIPP).

---

## Tahap A — Fondasi data dan lingkar belajar (prioritas tertinggi)

### U1. Simpan usulan dan hasil akhir per butir jawaban saksi
- **Masalah:** teks usulan dan teks final saksi tidak tersimpan di ALETA, hanya ringkasan "N tanya-jawab dari katalog X" (`saksi-susun.js:1432`). Di ABT hanya ada nilai akhir.
- **Usulan:**
  - Tabel `aleta_saksi_butir`: perkara, sidang, saksi ke-, pihak (P/T), katalog, varian, jenis keterangan, pertanyaan, usulan mesin, teks final, sumber fakta (isian/SIPP/posita/BAS), `kode_pola`, pengguna, waktu.
  - Diisi oleh ketiga jalur: saksi-sdg cerai, katalog, dan Blangko Derry tanya-jawab.
  - Selisih usulan dan final dikirim ke `aleta_jejak_koreksi`. Pengisi `isiJawabanSaksi*` membawa `kodePola` supaya statistik per pola (`kamus-deteksi.ts:267`) menjangkau saksi.
- **Ukuran berhasil:** setiap simpan saksi menghasilkan baris butir. Laporan menampilkan "% butir diterima tanpa diubah" per katalog, varian, dan jenis perkara.

### U2. Jejak isian manual dan koreksi di Blangko Derry
- **Masalah:** ketikan petugas, perubahan atas nilai otomatis, dan saran Tab tidak tercatat (`blangko-derry-isian.js:2701–2750`, grep "koreksi" = 0).
- **Usulan:**
  - `simpanIsian` mencatat ke tabel `aleta_isian_jejak`: perkara, blangko, kode variabel, nilai usulan beserta asal pengisi, nilai final, cara (otomatis diterima / saran diterima / diubah / diketik baru), pengguna, waktu.
  - Bila nilai otomatis diubah, ikut dikirim sebagai koreksi.
- **Ukuran berhasil:** per kode variabel diketahui berapa kali usulan diterima atau diubah.

### U3. Gerbang isian hidup (ketepatan dari lapangan)
- **Masalah:** `gerbang-isian.json` statis, dan bot tidak membaca jejak koreksi (grep di `aleta_bot` = 0).
- **Usulan:**
  - Tabel `aleta_ketepatan_isian` (kode, pengisi, jenis perkara, bulan, jumlah usulan, diterima, diubah, presisi), diperbarui harian dari U1+U2.
  - Layar Super Admin "Ketepatan isian" berisi daftar kode yang layak naik status (mis. presisi ≥ 0,95 dengan n ≥ 30) dan yang harus turun (presisi anjlok).
  - Tombol setujui naik/turun ditulis ke `gerbang-isian` versi DB. Berkas JSON tetap menjadi bawaan dan cadangan.
- **Ukuran berhasil:** jumlah kode "otomatis" bertambah dengan dasar data lapangan, bukan perkiraan.

### U4. Ukur kebenaran isi saksi, bukan hanya tingkat terisi
- **Usulan:**
  - Skrip ukur baru membandingkan usulan dengan teks final (U1), dengan kemiripan per butir dan per jenis keterangan.
  - Ringkasan bulanan tampil di layar Ketepatan (U3).
  - Skrip lama `ukur-jawaban-saksi-*` tetap untuk ukur luring.
- **Butuh laptop:** menjalankan ukur atas data nyata (n ≥ 10 per jenis), sesuai daftar T2.

### U5. Fakta perkara terpadu dengan singgahan server
- **Masalah:**
  - `faktaPerkara.js`, `isiSumber.bacaSippSaksi`, `konteksPerkaraSaksi`, dan `mediasiPerkara` membaca SIPP berulang kali.
  - Kehadiran punya 3 sumber.
  - Konteks di peramban hanya 12 perkara.
- **Usulan:**
  - Tabel `aleta_fakta_perkara`: perkara, kunci fakta, nilai, sumber, terbaca_pada, sidik_sipp (hash baris sumber).
  - Dibaca lewat satu layanan dengan masa berlaku pendek (mis. 10 menit, atau sampai `diedit_tanggal` SIPP berubah).
  - Kehadiran disatukan dengan urutan sumber yang jelas: SIPP > `aleta_bas_kehadiran` > tafsir teks. Bila sumbernya bertentangan, ditampilkan sebagai peringatan.
- **Ukuran berhasil:** waktu susun saksi dan isi blangko turun. Satu nilai kehadiran per sidang dipakai semua fitur.

### U6. Verifikasi baca-ulang dan riwayat yang bisa diurungkan dari server
- **Masalah:**
  - Blangko Derry menyimpan dengan `verifikasi: false` (`blangko-derry-isian.js:~2737`), padahal `abt-klien.js:686` menyediakan verifikasi.
  - Urungkan hanya ada di peramban (`abt.js:2355–2470`). ABT memakai `REPLACE INTO` tanpa riwayat.
- **Usulan:**
  - Simpan dengan verifikasi (baca ulang nilai di ABT). Bila berbeda, tandai merah.
  - Nilai sebelum ditimpa disimpan di `aleta_isian_jejak` (U2), sehingga **Urungkan bisa dilakukan dari PC mana pun** lewat portal dengan konfirmasi.

---

## Tahap B — Susun keterangan saksi

### U7. Satukan dua mesin saksi
- **Masalah:**
  - Jalur lama cerai (`abt.js:4697`) hanya untuk 2 saksi dengan 6 pilihan pengetahuan.
  - Jalur katalog (`saksi-susun.js`) mendukung 2–5 saksi P dan 4 saksi T dengan 7 jenis keterangan.
  - Dua mesin berjalan sejajar.
- **Usulan:** jalur cerai memakai mesin katalog, dengan semua kemampuan lama dipertahankan (fitur lama tidak boleh hilang). Tombol lama tetap ada tetapi memanggil mesin yang sama. Uji kesamaan hasil lama dan baru.

### U8. Katalog saksi di basis data dengan versi
- **Masalah:** katalog tertanam di ekstensi (`saksi-katalog-data.js`), jadi setiap ubahan harus lewat rilis.
- **Usulan:**
  - Tabel `aleta_saksi_katalog` + `_versi`. JSON di ekstensi tetap menjadi cadangan saat portal tak terjangkau.
  - Penyunting katalog di portal untuk Super Admin dan akun Derry, dengan pratinjau dan riwayat versi.
  - Satu perkara memakai versi katalog yang tercatat di U1.
- **Ukuran berhasil:** perbaikan kalimat katalog langsung berlaku tanpa rilis ekstensi.

### U9. Keadaan dan fakta otomatis untuk perkara non-cerai (sesudah T2 digabung)
- **Usulan:**
  - Turunkan keadaan katalog per jenis dari SIPP/posita: kumulasi, objek harta, ahli waris, wali, dan sebagainya. Sekarang keadaan untuk jenis lain dipilih manual (`saksi-susun.js:~96`).
  - Isi 2557/2558 (berapa kali melihat/mendengar pertengkaran) dari BAS.
  - Gerbang presisi per jenis memakai data U3.
- **Butuh laptop:** ukur atas posita/BAS asli (daftar T2: #1217, #0650/#0651, #8087, dan seterusnya).

### U10. Kirim keterangan saksi ke BAS SIPP (ide abt-20)
- **Usulan:** keterangan saksi di ABT dapat dikirim ke BAS di SIPP lewat tombol dan pratinjau. Tidak pernah otomatis, tanpa kata "Aleta", dan tercatat.

---

## Tahap C — Isi SIPP ke ABT / Blangko Derry

### U11. Tutup isian "tidak" berdasarkan beban manual
- **Masalah:** dari 345 isian popup, 134 masih "tidak", 53 di antaranya tanpa sumber, dan 52 "sebagian" (`docs/isi-sipp-abt/DAFTAR-CEK.md`).
- **Usulan:**
  1. Urutkan memakai `docs/isi-sipp-abt/BEBAN-MANUAL.json`: kode yang paling sering diketik manual dikerjakan lebih dulu.
  2. Cari sumber SIPP yang belum dipakai: tabel panggilan, sita, mediasi, biaya, e-Court.
  3. Untuk isian **tanpa sumber**, buat **isian sekali per perkara** yang disimpan di `aleta_isian_perkara` (0035, sudah ada) dan dipakai ulang di semua blangko perkara itu. Contoh: prodeo 0661/0663, fasakh 0227, pidana 8536, eksepsi 9682–9685.
- **Ukuran berhasil:** jumlah isian "ya" dan blangko yang terisi penuh naik per bulan, terlihat di layar Ketepatan.

### U12. Isian per sidang untuk BAS beruntun
- **Masalah:** isian teks/tanggal ABT berkunci (no_var, perkara), bukan per sidang, sehingga BAS sidang kedua menimpa yang pertama (`blangko-derry-isian.js:20`).
- **Usulan:** lapisan ALETA menyimpan nilai per sidang (`aleta_isian_perkara` + kolom sidang). Saat mencetak BAS sidang tertentu, nilai sidang itu yang ditulis, dan nilai sidang lain dipulihkan sesudahnya. Perlu diuji hati-hati di ABT (MariaDB 5.5).

### U13. Daftar wajib sebelum CETAK (ide abt-17) dan salin dari perkara serupa (ide abt-14)
- **Usulan:**
  - Sebelum cetak, tampilkan isian wajib yang masih kosong. Data dari laporan konseptor `aleta_konseptor_blangko` (0067) yang sekarang hanya untuk putusan; perluas ke semua blangko dan simpan sejarahnya, bukan baris terakhir saja.
  - "Salin dari perkara serupa" memakai `aleta_perkara_sidik` (0028): isian non-identitas dari perkara sejenis yang sudah putus, sebagai usulan.

### U14. Huruf alasan dan dasar hukum yang belajar dari hakim (ide abt-27)
- **Usulan:**
  - Simpan pilihan akhir hakim untuk 8503 (U2).
  - Hitung kecocokan per pola. Usulan huruf memakai riwayat hakim yang sama atau majelis sebagai pertimbangan tambahan, tetap sebagai usulan.
  - Saran dasar hukum per huruf diambil dari pustaka pertimbangan (0026) dan ditandai `[PERLU VERIFIKASI]` bila belum terverifikasi.

### U15. Sebutan pihak lengkap
- **Masalah:** `sebutan-pihak.ts` dan `sebutanPihakService.js` belum mengenal Pelawan/Terlawan, rekonvensi, dan Pemohon I/II.
- **Usulan:** lengkapi aturan dari satu sumber, dengan uji per alur. Semua pengisi dan katalog saksi memakainya.

---

## Tahap D — Ekstensi dan kerja lintas PC

### U16. Konteks, setelan, dan riwayat di server
- Konteks perkara (sekarang 12 perkara per peramban) dan riwayat Urungkan (U6) disimpan di server per pengguna.
- Sinkron setelan antar PC (ide portal-30).
- Peringatan bila versi ekstensi berbeda antar PC (portal-24); sebagian sudah terlihat di Pusat kesehatan (rencana fitur admin no. 2).

### U17. Riwayat perubahan data SIPP dan kabar dari petugas lain (ide sipp-15, sipp-25)
- Dari potret berkas `aleta_berkas_riwayat` (0024) dan `sidik_sipp` (U5): tampilkan "data pihak diubah petugas X pukul 10.12" di panel. Beri tahu bila perkara yang sedang dibuka diubah orang lain.

### U18. Pemeriksa ejaan dan nama pihak (ide sipp-20) dengan kamus alias
- Tabel `aleta_alias_nama` (nama baku, varian ejaan, sumber). Hanya disimpan di server kantor.
- Dipakai untuk: peringatan ejaan beda antara SIPP, blangko, dan BAS; pengenalan saksi; dan **penyamaran ALETA Ai (T9)** supaya nama bebas lebih banyak dikenali.

### U19. Riwayat tunda/putus otomatis yang terstruktur
- Sekarang berupa blob JSON di `aleta_ekstensi_setelan`. Pindahkan ke tabel `aleta_otomatis_jejak` (fitur, perkara, aturan yang cocok, hasil, kering atau nyata, ditolak penjaga atau tidak).
- Dari tabel itu dibuat laporan ketepatan per aturan.

---

## Tahap K — Kinerja: 100+ perangkat bersamaan dan PC tua

Ditambahkan atas permintaan Derry: Jadwal Sidang, Jadwal Mediasi, Status Perkara, dan isian ALETA di SIPP/ABT. Ia khawatir ALETA lambat atau galat bila dipakai 100+ perangkat sekaligus, dan bila banyak PC/laptop tua (4 GB RAM, Core i3 lama/Celeron).

Angka di bawah dihitung dari kode `integrasi-1205-38` dan dari `docs/audit/PERFORMA-MUAT-19okt.md`. Angka beban 100 perangkat adalah **perkiraan** (interval × jumlah perangkat) dan wajib dibuktikan dengan uji beban (K9) sebelum dan sesudah perbaikan.

### Keadaan sekarang
- **Satu layar Jadwal Sidang** (hari ini, tab terlihat) mengirim **±21 permintaan/menit**:
  - jadwal penuh tiap 45 dtk, ±40 kueri SIPP;
  - bacaan ringan tiap 8 dtk, 4 kueri SIPP, **tanpa singgahan**;
  - keadaan "disidang" tiap 5 dtk.

  Untuk 100 layar: ±2.100 permintaan/menit ke portal dan **±3.000–8.000 kueri SIPP/menit**.
- Semua kueri SIPP lewat **satu proses bot** dengan **kolam 10 sambungan** (`aleta_bot/db_config.js:23`). Proses yang sama juga menjalankan WhatsApp, e-Court (dua Chromium), dan ±20 cron.
  - Batas waktu kueri efektif hanya 17 dtk di sisi klien; MariaDB mengabaikan `MAX_EXECUTION_TIME`.
  - Lima kali habis waktu membuka pemutus arus 30 dtk (`sippCircuitBreakerService.js`). **Semua layar** lalu menampilkan "ALETA Bot belum dapat dihubungi".
- **Portal satu proses** Next.js dengan kolam Postgres bawaan 10 dan tanpa `statement_timeout`. Kerja latar (OCR, putusan terjadwal, sinkron, tunda/putus otomatis) berjalan di proses yang sama. Tidak ada batas CPU/memori di kontainer.
  - `tandaiTulisan()` membuang **seluruh** singgahan setiap ada satu tulisan (`singgah-singkat.ts:109-113`).
  - Setiap pemanggil menerima salinan `structuredClone` jawaban sampai 1 MB.
- **Postgres:** setiap muat penuh Jadwal menulis transaksi `rekamAntrian` (±20 UPDATE) di disk berputar, ±133 transaksi/menit pada 100 perangkat.
- **Peramban:** SIPP, ABT, dan ALETA memakai satu host `:80`, dan peramban hanya membuka 6 sambungan per host. Antrean 26–56 dtk sudah pernah terukur. Port 8008 (K1 audit 19 Okt) belum dipastikan terpasang.
- **Jadwal Mediasi** (tanpa polling, <50 ms) **bukan titik macet**.
- **Status Perkara:** aman untuk pemakaian biasa. Hitungan tag menahan sambungan SIPP 1,2–6,6 dtk, dan pencarian serta satu perkara tidak bersinggah.
- **PC tua:**
  - **Halaman ABT memuat ±12,4 MB JavaScript per tab**, 9,4 MB di antaranya literal katalog saksi (`saksi-katalog-data.js`).
  - **Setiap halaman SIPP memuat ±3,45 MB JS + 0,49 MB CSS**, termasuk halaman daftar dan menu.
  - ±10 MutationObserver di seluruh `document.body` dan ±8 interval 0,7–1,5 dtk berjalan terus, sehingga CPU latar tidak pernah diam.
  - Tabel Jadwal sampai 200 baris × ±74 ruas digambar ulang penuh tiap 45 dtk, tanpa virtualisasi.
  - Hakim/Admin/Ketua: polling putusan terjadwal berjalan di **setiap tab SIPP**, juga yang tersembunyi.
- **Belum disimpan ke basis data:**
  - riwayat Urungkan ABT (`abtRiwayat`; salinan ke server gagal diam-diam);
  - antrean cetak massal dan relaas massal (hilang saat Chrome ditutup);
  - catatan pengerjaan putusan terjadwal;
  - tampilan per peramban;
  - rate-limit dan singgahan di memori proses (hilang saat mulai ulang, dan tidak dapat dibagi bila kelak portal >1 proses).

### Sisi server (100+ perangkat)
| No | Butir | Isi | Dampak perkiraan |
| :--- | :--- | :--- | :--- |
| K1 | **Satu bacaan untuk semua perangkat** | Bacaan ringan (8 dtk) dan disidang (5 dtk) disinggahkan 2–3 dtk **bersama** di portal, dengan penyatuan permintaan serentak antarperangkat. Tahap 2: portal membaca sekali lalu **mendorong** perubahan lewat SSE (`EventSource`) ke semua layar Jadwal, layar publik, dan antrean, sehingga beban SIPP tidak lagi bergantung pada jumlah perangkat. | ±3.000 → ±40 kueri SIPP/menit untuk bacaan ringan |
| K2 | **Singgahan jadwal lebih pintar** | `tandaiTulisan` hanya membuang kunci tanggal/perkara yang terkena, bukan semuanya. Jawaban disimpan sekali sebagai teks JSON tanpa `structuredClone` per pemanggil. Kunci layar publik disamakan dengan layar Jadwal supaya singgahannya terbagi. `getGatewayAntrianSidang` ikut bersinggah. | Jadwal penuh tembus ke bot ±15×/menit, bukan sampai 133× |
| K3 | **Kolam SIPP dipisah dan dijaga** | Kolam **interaktif** (layar) terpisah dari kolam **latar** (WhatsApp, penilaian, cron), supaya kerja latar tidak pernah merebut sambungan layar. Ukuran kolam dinaikkan menurut `max_connections` MariaDB (diukur di server). Ada `acquireTimeout`/`queueLimit` supaya gagal cepat, bukan menunggu 17 dtk. Kueri lambat diputus dari sisi bot (`KILL QUERY`). | Tidak ada lagi efek domino ke pemutus arus |
| K4 | **Pisahkan proses bot** | Satu image, dua kontainer: (a) jembatan data SIPP/ABT, dan (b) WhatsApp + e-Court (Chromium) + cron. Masalah Chromium tidak lagi mematikan semua layar. | Isolasi kegagalan |
| K5 | **Portal lebih dari satu proses** | Kerja latar dipindah ke kontainer pekerja sendiri. Portal web dijalankan 2–4 proses sesudah rate-limit dan singgahan bersama pindah ke Postgres (atau satu proses pemimpin). Batas CPU/memori per kontainer. Kolam pg dan `statement_timeout` diatur. | Lonjakan permintaan dibagi ke beberapa inti CPU |
| K6 | **Kurangi tulisan Postgres** | `rekamAntrian` hanya menulis bila datanya berubah (dibandingkan dulu), bukan setiap muat. Indeks untuk kueri tersering diperiksa. | ±133 → beberapa transaksi/menit |
| K7 | **Lepas dari batas 6 sambungan peramban** | Pastikan Apache port 8008 terpasang dan dipakai portal **dan** widget di halaman SIPP/ABT. Dengan SSE (K1), satu sambungan cukup menggantikan puluhan polling. | Antrean 26–56 dtk hilang |
| K8 | **Status Perkara** | Pencarian dan satu perkara disinggahkan singkat. Hitungan tag dihitung **di latar** ke tabel ringkasan Postgres (diperbarui berkala dan saat ada tulisan), bukan 19 kueri SIPP per klik. | Klik tag <100 ms, tanpa menahan SIPP |
| K9 | **Uji beban** | Skrip yang meniru 100 dan 200 perangkat (Jadwal, widget, konteks SIPP) dijalankan di **kembaran laptop**, bukan server produksi. Diukur p95 waktu jawab, sambungan SIPP terpakai, CPU/RAM. Dijalankan sebelum dan sesudah tiap butir K. Hasilnya tampil di Pusat kesehatan (rencana fitur admin no. 2). | Bukti angka, bukan perkiraan |

### Sisi PC tua
| No | Butir | Isi | Dampak perkiraan |
| :--- | :--- | :--- | :--- |
| K10 | **Katalog saksi dimuat sesuai kebutuhan** | Katalog 9,4 MB tidak lagi disuntik ke **setiap** halaman ABT. Yang dimuat hanya katalog jenis perkara yang dibuka, dari portal/basis data (sejalan dengan U8), dan disinggahkan di peramban. | Halaman ABT ±12,4 MB → ±3 MB JS |
| K11 | **Skrip hanya di halaman yang memakainya** | Pola `matches` di manifest dipersempit (mis. modul putusan hanya di halaman putusan). Modul besar dipecah dan dimuat saat dipakai (`import()` dari `chrome.runtime.getURL`). `konten.js` (1,2 MB) dipecah per fitur. | Halaman daftar/menu SIPP jauh lebih ringan |
| K12 | **Satu pengamat dan berhenti saat tab tersembunyi** | Kesepuluh MutationObserver disatukan menjadi satu pengirim kejadian yang dibatasi. Interval 0,7–1,5 dtk diganti reaksi atas kejadian. Polling putusan terjadwal hanya berjalan di **satu** tab yang terlihat per PC (koordinasi lewat pekerja latar). Semua penyegaran berhenti di tab tersembunyi. | CPU latar mendekati nol saat diam |
| K13 | **Tabel Jadwal ringan** | Baris tabel divirtualisasi dan di-`memo`. Yang diperbarui hanya baris yang berubah, bukan seluruh tabel. Komponen 543 KB dipecah dan dimuat bertahap. Ruas jadwal dipangkas (K4 audit 19 Okt, −20–25% ukuran). | Gambar ulang dari ratusan ms jadi puluhan ms |
| K14 | **Kerja berkas di server** | Cetak massal (RTF+ZIP+PDF), relaas massal, dan pemeriksaan sisa blangko dikerjakan server. Salinan TS pemeriksa sisa blangko sudah ada (`src/lib/deteksi-sisa-blangko.ts`). Peramban hanya menerima hasil jadi dan dapat ditutup tanpa menghentikan kerja. | PC tua tidak tersendat saat cetak massal |
| K15 | **Data peramban pindah ke basis data** | Riwayat Urungkan ABT (U6), antrean cetak/relaas massal (bisa dilanjutkan sesudah Chrome ditutup), catatan putusan terjadwal, dan tampilan per pengguna (U16) disimpan di Postgres. | Tidak ada kerja yang hilang; ringan di `chrome.storage` |
| K16 | **Mode ringan otomatis** | Bila `navigator.deviceMemory` ≤ 4 atau `hardwareConcurrency` ≤ 2, ekstensi dan portal otomatis mematikan hiasan, memperpanjang interval, dan memuat modul seperlunya. Dapat dinyalakan/dimatikan per pengguna. | PC tua tetap lancar |

### Urutan kinerja yang disarankan
| Gelombang | Butir | Kenapa |
| :--- | :--- | :--- |
| K-1 (cepat, risiko kecil, dampak besar) | K9 (uji beban dulu), **C0 Cermin Perkara**, K1 tahap 1, K2, K6, K10, K12 | Memangkas beban SIPP/Postgres terbesar dan memori PC tua; C0 membuat beban SIPP tidak lagi bergantung pada jumlah perangkat |
| K-2 | K3, K7, K8, K11, K13, K16 | Penjagaan kolam, port 8008, Status Perkara, dan pengurangan skrip |
| K-3 (perubahan arsitektur) | K4, K5, K1 tahap 2 (SSE), K14, K15 | Butuh uji di kembaran laptop dan jendela pemasangan |

**Gelombang K-1 disarankan dikerjakan bersama atau sebelum gelombang 1 (U1, U2, U6)**, karena menambah fitur di atas fondasi yang sudah mendekati batas akan memperparah lambatnya.

### Perlu diukur di server/laptop (sesi laptop)
- Jumlah perangkat yang benar-benar dipakai bersamaan, termasuk jumlah layar Jadwal dan layar publik yang selalu menyala.
- Spesifikasi server: inti CPU, RAM, disk.
- `max_connections` serta versi MariaDB SIPP dan ABT.
- Apakah Apache 8008 sudah terpasang dan terbuka di firewall.
- Contoh PC tua: memori Chrome per tab SIPP/ABT sebelum dan sesudah K10–K12 (Pengelola Tugas Chrome).

## Urutan kerja yang disarankan

| Gelombang | Butir | Kenapa duluan | Migrasi (perkiraan) |
| :--- | :--- | :--- | :--- |
| 1 | U1, U2, U6 | Tanpa jejak, tidak ada yang bisa diukur atau diurungkan lintas PC | 0090 (`aleta_saksi_butir`, `aleta_isian_jejak`) |
| 2 | U3, U4 (U5 digantikan C0) | Ketepatan hidup; dasar menaikkan isian otomatis | 0091 (`aleta_ketepatan_isian`) |
| 3 | U7, U8, U9 (sesudah T2 digabung) | Saksi satu mesin, katalog tanpa rilis, non-cerai terisi | 0092 (`aleta_saksi_katalog`) |
| 4 | U11, U13, U14, U15 | Menutup isian manual terbanyak, dibimbing data gelombang 2 | pakai 0035/0067 + kolom baru bila perlu |
| 5 | U12, U10, U16–U19 | Perlu uji hati-hati di ABT/SIPP atau lintas PC | 0093+ |

Gelombang kinerja K-1/K-2/K-3 (Tahap K di atas) berjalan sejajar. **K-1 sebaiknya sebelum atau bersama gelombang 1.**

Tiap gelombang kira-kira satu sampai dua sesi cloud per butir. Lalu digabung, diuji penuh, dan dipasang lewat sesi laptop.

## Yang perlu diputuskan Derry sebelum mulai
1. Retensi `aleta_saksi_butir` dan `aleta_isian_jejak`: berisi teks keterangan saksi asli, saran 2 tahun.
2. Siapa yang boleh menyetujui naik/turun status isian (U3) dan menyunting katalog saksi (U8): saran Super Admin + akun Derry.
3. Ambang naik status otomatis: saran presisi ≥ 0,95 dengan n ≥ 30 per kode dan jenis perkara.
4. Butir mana yang dikerjakan lebih dulu: saran **C0 + K-1 + gelombang 1**.
6. C0: jam pemindaian awal (saran mulai 18.00, berhenti otomatis 06.30 dan lanjut malam berikutnya bila belum selesai) dan selang pembaruan (saran 1 menit).
5. Boleh memakai kembaran laptop sebagai tempat uji beban (K9). Uji beban tidak boleh dijalankan ke server produksi pada jam kerja.
