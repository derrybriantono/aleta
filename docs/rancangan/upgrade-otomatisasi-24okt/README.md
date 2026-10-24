# Rencana upgrade otomatisasi yang sudah ada (24 Okt 2026)

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

## Urutan kerja yang disarankan

| Gelombang | Butir | Kenapa duluan | Migrasi (perkiraan) |
| :--- | :--- | :--- | :--- |
| 1 | U1, U2, U6 | Tanpa jejak, tidak ada yang bisa diukur atau diurungkan lintas PC | 0090 (`aleta_saksi_butir`, `aleta_isian_jejak`) |
| 2 | U3, U4, U5 | Ketepatan hidup + data terpadu; dasar menaikkan isian otomatis | 0091 (`aleta_ketepatan_isian`, `aleta_fakta_perkara`) |
| 3 | U7, U8, U9 (sesudah T2 digabung) | Saksi satu mesin, katalog tanpa rilis, non-cerai terisi | 0092 (`aleta_saksi_katalog`) |
| 4 | U11, U13, U14, U15 | Menutup isian manual terbanyak, dibimbing data gelombang 2 | pakai 0035/0067 + kolom baru bila perlu |
| 5 | U12, U10, U16–U19 | Perlu uji hati-hati di ABT/SIPP atau lintas PC | 0093+ |

Tiap gelombang kira-kira satu sampai dua sesi cloud per butir. Lalu digabung, diuji penuh, dan dipasang lewat sesi laptop.

## Yang perlu diputuskan Derry sebelum mulai
1. Retensi `aleta_saksi_butir` dan `aleta_isian_jejak`: berisi teks keterangan saksi asli, saran 2 tahun.
2. Siapa yang boleh menyetujui naik/turun status isian (U3) dan menyunting katalog saksi (U8): saran Super Admin + akun Derry.
3. Ambang naik status otomatis: saran presisi ≥ 0,95 dengan n ≥ 30 per kode dan jenis perkara.
4. Butir mana dari gelombang 1 yang dikerjakan lebih dulu.
