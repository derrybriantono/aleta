# Tahapan kerja: Cermin Perkara, kinerja, lingkar belajar, dan fitur admin (24 Okt 2026)

Urutan pengerjaan semua butir di `README.md` (C0, U1–U19, K1–K16) dan fitur admin pilihan (no. 1, 2+3, 5, 6 dari `docs/rancangan/fitur-admin-23okt/README.md`). Tampilan tiap butir ada di kanvas "Tampilan Rencana Upgrade ALETA".

**24 Okt: Derry menyetujui semua saran ("kerjakan semua tahap").** Pembagian kerja sesi awan per rantai ada di `docs/awan/rantai-upgrade-24okt.md`. Bagian penggabungan di Tahap 0 dikerjakan di awan menjadi `integrasi-awan-24okt`; pengukuran, rilis, dan pasang tetap di laptop.

## Cara kerja tiap tahap

- **Satu butir = satu cabang `fitur/<nama>`** dari dasar terbaru (`integrasi-1205-38`, atau cabang integrasi berikutnya sesudah Tahap 0). Tanpa menaikkan versi, tanpa PR kecuali diminta.
- **Di sesi awan:** kode, migrasi, uji berkas sasaran, `tsc`, dan uji di peramban dengan data rekaan. Cabang didorong ke GitHub.
- **Di sesi laptop:** gabung, uji penuh (`periksa-uji`), rilis ekstensi (`rilis-ekstensi`), uji beban di kembaran laptop, lalu pasang ke server 192.168.10.10. Pemasangan tetap dari laptop, bukan dari awan.
- **Saklar mati dulu:** fitur yang mengubah sumber data, misalnya layar membaca cermin, dipasang dalam keadaan mati. Super Admin menyalakannya sesudah hasil diperiksa. Bila cermin belum lengkap atau tertinggal dari SIPP, layar kembali membaca SIPP seperti sekarang.
- **Tiap tahap ditutup dengan titik pasang:** rilis, pasang, pantau 1–3 hari kerja, baru tahap berikut dimulai. Kecuali tahap yang ditandai **sejajar**.
- **Aturan tetap:**
  - tidak satu kata "Aleta"/"ALETA" masuk ke SIPP/ABT/e-Court;
  - hanya blangko milik `derry_briantono` yang diubah;
  - isian hukum paling jauh usulan;
  - data asli tidak masuk repo atau awan;
  - fitur lama tidak dikurangi.

## Pembagian nomor migrasi

Dicadangkan supaya cabang sejajar tidak berebut nomor. Saat gabung, urutan `idx` di `_journal.json` dirapikan seperti pada `docs/awan/gabung-23okt.md`.

| Nomor | Isi |
| :--- | :--- |
| 0084–0088 | Sudah dipakai T1, audit login, T9, T10 (menunggu gabung Tahap 0) |
| 0090 | C0: `aleta_cermin_perkara`, `_sidang`, `_pihak`, `_mediasi`, `_tag`, `_jejak` |
| 0091 | U1 + U2 + U6: `aleta_saksi_butir`, `aleta_isian_jejak` |
| 0092 | U3 + U4: `aleta_ketepatan_isian` |
| 0093 | U8: `aleta_saksi_katalog` (+ versi) |
| 0094 | Admin 3: catatan galat |
| 0095 | Admin 6: OTP dan perangkat tepercaya |
| 0096+ | K15, U11–U19, sesuai urutan cabang dibuat |

## Ringkasan tahap

| Tahap | Isi | Tempat | Perkiraan sesi | Hasil yang terasa |
| :--- | :--- | :--- | :--- | :--- |
| 0 | Gabung 13 cabang, rilis 1.205.39, pengukuran server | Laptop | 1–2 laptop | T1–T10, audit login, PWA terpasang |
| 1 | Uji beban K9 + Pusat kesehatan & catatan galat (admin 2+3) | Awan, lalu laptop | 2–3 awan + 1 laptop | Angka awal yang nyata |
| 2 | **C0 Cermin Perkara** (5 cabang) | Awan, lalu laptop | 6–8 awan + 1–2 laptop | Jadwal, Mediasi, Status Perkara, dan panel SIPP cepat |
| 3 | K-1 sisa: K2, K6, K10, K12 (K1 tahap 1 ikut 2c) | Awan (sejajar Tahap 2) | 4–5 awan | PC tua ringan di halaman ABT/SIPP |
| 4 | Gelombang 1: U1, U2, U6 | Awan | 3 awan + 1 laptop | Riwayat isian & Urungkan lintas PC |
| 5 | K-2: K3, K7, K11, K13, K16 + mode pemeliharaan (admin 5) | Awan | 5–6 awan + 1 laptop | Mode ringan, kolam SIPP terjaga |
| 6 | Gelombang 2: U3, U4 | Awan | 2 awan | Layar Ketepatan isian |
| 7 | Gelombang 3: U7, U8, U9 | Awan | 3–4 awan + 1 laptop | Katalog saksi di basis data |
| 8 | Gelombang 4: U11, U13, U14, U15 + Lihat sebagai (admin 1) | Awan | 4–5 awan + 1 laptop | Periksa sebelum CETAK, isian manual berkurang |
| 9 | K-3: K4, K5, K1 tahap 2 (SSE), K14, K15 + OTP (admin 6) | Awan, uji berat di laptop | 5–6 awan + 2 laptop | Tahan 200+ perangkat, cetak massal di server |
| 10 | Gelombang 5: U17, U16, U18, U19, U12, U10 | Awan | 5–6 awan + 1 laptop | Kabar perubahan, konteks lintas PC |

Perkiraan sesi bukan janji jam. Satu sesi awan kira-kira satu cabang beserta ujinya. Angka diperbarui sesudah Tahap 1 dan 2 karena keduanya paling banyak belum diketahui.

---

## Tahap 0 — Gabung dan ukur (laptop, prasyarat)

1. Gabung 13 cabang sesuai `docs/awan/gabung-23okt.md` (cabang `fitur/panduan-gabung-23okt`), uji penuh hijau, rilis **1.205.39**, pasang.
2. Ukur di server dan catat di `docs/rancangan/upgrade-otomatisasi-24okt/ukuran-server.md` (tanpa sandi atau data perkara):
   - inti CPU, RAM, disk server; `max_connections` dan versi MariaDB SIPP dan ABT;
   - apakah Apache port 8008 terpasang dan terbuka;
   - jumlah perangkat yang dipakai bersamaan, termasuk layar Jadwal/publik yang selalu menyala;
   - **kolom waktu SIPP**: tabel mana yang punya `diinput_tanggal`/`diperbaharui_tanggal` dan terisi, di kembaran laptop (menentukan mana yang cukup diperbarui berkala dan mana yang perlu pencocokan mingguan);
   - jumlah perkara total (perkiraan lama pemindaian awal);
   - 2–3 contoh PC tua: memori Chrome per tab SIPP/ABT (Pengelola Tugas Chrome).
3. Jadikan hasil gabungan dasar baru untuk Tahap 1, misalnya `integrasi-1205-39`, dan dorong ke GitHub supaya sesi awan mulai dari situ.

**Selesai bila:** 1.205.39 berjalan di server, `ukuran-server.md` terisi, dan dasar baru ada di GitHub.

## Tahap 1 — Ukur dulu (awan, lalu laptop)

| Cabang | Isi |
| :--- | :--- |
| `fitur/uji-beban` (K9) | Skrip peniru 100/200 perangkat: Jadwal Sidang, widget, konteks SIPP, Status Perkara. Hanya ke kembaran laptop; menolak berjalan bila sasarannya server produksi. Laporan p95, kueri SIPP/menit, sambungan terpakai, CPU/RAM. |
| `fitur/pusat-kesehatan` (admin 2+3) | Pusat kesehatan sistem + catatan galat (migrasi 0094). Menampilkan hasil uji beban terakhir. |

**Di laptop:** jalankan uji beban **sebelum** perbaikan apa pun. Angka ini menjadi pembanding semua tahap berikut.

**Selesai bila:** ada laporan angka awal 100 dan 200 perangkat, dan Pusat kesehatan menampilkannya.

## Tahap 2 — C0 Cermin Perkara (awan, 5 cabang berurutan)

| Urut | Cabang | Isi | Syarat selesai |
| :--- | :--- | :--- | :--- |
| 2a | `fitur/cermin-dasar` | Migrasi 0090; pemindai awal berkelompok yang bisa dilanjutkan (jam 18.00–06.30); layar **Pemantau Cermin Perkara** (admin). Saklar mati. | Uji: pemindai berhenti/lanjut dari titik terakhir; tidak menulis apa pun ke SIPP |
| 2b | `fitur/cermin-pembaruan` | Pembaruan tiap 1 menit dari kolom waktu SIPP; tulisan lewat ALETA masuk seketika; pencocokan mingguan (Minggu 02.00) untuk data dihapus/tabel tanpa kolom waktu. | Uji: perkara baru masuk, perubahan masuk ≤1 menit, data dihapus tertangkap pencocokan |
| 2c | `fitur/cermin-jadwal-sidang` | Jadwal Sidang, tautan `/jadwal`, layar publik/antrean membaca cermin; tanda "Cermin · diperbarui"; kembali ke SIPP bila cermin tertinggal. Antrean "sedang disidang" tetap langsung, tetapi bersama untuk semua layar (K1 tahap 1). | Kolom dan isi sama dengan sekarang untuk data rekaan yang sama (uji perbandingan) |
| 2d | `fitur/cermin-mediasi-status` | Jadwal Mediasi + Status Perkara (tag dihitung di cermin, menggantikan K8). | Hitungan tag sama dengan cara lama pada data rekaan |
| 2e | `fitur/cermin-ekstensi` | "Keadaan perkara" di panel SIPP satu panggilan ke cermin; fakta perkara untuk Blangko Derry/susun saksi dari cermin dulu (menggantikan U5). Penjaga sebelum menulis tetap membaca SIPP. | Uji ekstensi; perlu rilis ekstensi di laptop |

**Titik pasang (laptop):** gabung 2a–2e, uji penuh, uji beban ulang di kembaran, pasang dengan saklar mati. Malam pertama pemindaian awal berjalan (pantau di Pemantau Cermin). Sesudah 100% dan pencocokan pertama bersih, Super Admin menyalakan cermin **per layar**: Jadwal Mediasi dulu (paling sederhana), lalu Status Perkara, lalu Jadwal Sidang, lalu panel ekstensi.

**Selesai bila:** keempat layar membaca cermin selama 3 hari kerja tanpa selisih, dan uji beban menunjukkan beban SIPP tidak naik mengikuti jumlah perangkat.

## Tahap 3 — K-1 sisa (awan, **sejajar** Tahap 2)

Tidak bergantung pada cermin, jadi dapat dikerjakan bersamaan dan ikut titik pasang Tahap 2.

| Cabang | Butir |
| :--- | :--- |
| `fitur/singgah-jadwal` | K2: singgahan hanya dibuang untuk kunci yang terkena; tanpa `structuredClone` per pemanggil |
| `fitur/rekam-antrian-hemat` | K6: `rekamAntrian` menulis hanya bila berubah |
| `fitur/katalog-saksi-sebagian` | K10: katalog saksi dimuat per jenis perkara (berkas terpisah di ekstensi dulu; pindah ke basis data di Tahap 7) |
| `fitur/pengamat-tunggal` | K12: satu MutationObserver, interval diganti kejadian, berhenti di tab tersembunyi, putusan terjadwal di satu tab per PC |

**Selesai bila:** halaman ABT ±3 MB JS dan CPU latar tab tersembunyi mendekati nol (diukur di contoh PC tua Tahap 0).

## Tahap 4 — Gelombang 1: jejak isian (awan)

| Cabang | Butir |
| :--- | :--- |
| `fitur/saksi-butir` | U1: susun saksi mencatat usulan vs hasil akhir per butir (migrasi 0091) |
| `fitur/jejak-isian` | U2: Blangko Derry mencatat isian manual dan koreksi |
| `fitur/riwayat-urungkan` | U6: baca-ulang dari ABT sesudah simpan; riwayat Urungkan di server, bisa dari PC mana pun |

Retensi 2 tahun; data hanya di Postgres kantor.

**Selesai bila:** setiap simpan di susun saksi dan Blangko Derry tercatat, dan Urungkan berhasil dari PC lain di kembaran laptop.

## Tahap 5 — K-2 + mode pemeliharaan (awan)

| Cabang | Butir |
| :--- | :--- |
| `fitur/kolam-sipp` | K3: kolam SIPP interaktif dan latar dipisah, gagal cepat, putus kueri lambat |
| `fitur/port-8008` | K7: portal dan widget memakai port 8008 (pemasangan Apache di laptop/server) |
| `fitur/skrip-sesuai-halaman` | K11: `matches` dipersempit, `konten.js` dipecah per fitur |
| `fitur/tabel-jadwal-ringan` | K13: baris tabel divirtualisasi, hanya baris berubah yang digambar ulang |
| `fitur/mode-ringan` | K16: mode ringan otomatis (RAM ≤ 4 GB atau ≤ 2 inti), dapat diatur per pengguna |
| `fitur/mode-pemeliharaan` | Admin 5: dipakai mulai titik pasang berikut supaya pengguna diberi tahu sebelum pemasangan |

## Tahap 6 — Gelombang 2: ketepatan (awan)

| Cabang | Butir |
| :--- | :--- |
| `fitur/ketepatan-isian` | U3 + U4: layar Ketepatan isian dari data Tahap 4 (migrasi 0092); ambang naik ≥95% dari minimal 30 kejadian; persetujuan Super Admin + Derry. Kebenaran isi saksi diukur, bukan hanya tingkat terisi. |

Kode dibuat sekarang; usulan naik/turun baru bermakna sesudah data lapangan terkumpul **2–4 minggu** sejak Tahap 4 terpasang.

## Tahap 7 — Gelombang 3: saksi (awan)

| Cabang | Butir |
| :--- | :--- |
| `fitur/mesin-saksi-tunggal` | U7: dua mesin saksi disatukan |
| `fitur/katalog-saksi-db` | U8: katalog saksi di basis data dengan versi (migrasi 0093) + layar penyunting; K10 kini memuat katalog dari portal |
| `fitur/fakta-non-cerai` | U9: keadaan dan fakta untuk perkara non-cerai (butuh T2 dari Tahap 0) |

## Tahap 8 — Gelombang 4: isian ABT + Lihat sebagai (awan)

| Cabang | Butir |
| :--- | :--- |
| `fitur/tutup-isian-manual` | U11: isian "tidak" terbanyak menurut data Tahap 4 |
| `fitur/wajib-sebelum-cetak` | U13: daftar wajib sebelum CETAK + salin dari perkara serupa |
| `fitur/huruf-alasan-belajar` | U14: huruf alasan/dasar hukum belajar dari pilihan hakim (tetap usulan) |
| `fitur/sebutan-pihak` | U15: sebutan pihak lengkap |
| `fitur/lihat-sebagai` | Admin 1: Lihat sebagai pengguna/peran (baca-saja, tercatat) |

## Tahap 9 — K-3 arsitektur + OTP (awan, uji berat di laptop)

K14, K15, dan OTP tidak bergantung pada uji beban, jadi ikut dikerjakan sekarang (rantai B dan E). K4, K5, dan K1 tahap 2 hanya dikerjakan bila uji beban sesudah Tahap 5 belum memenuhi sasaran untuk jumlah perangkat yang diukur di Tahap 0, atau bila server akan dipakai lebih banyak satker.

| Cabang | Butir |
| :--- | :--- |
| `fitur/bot-dua-kontainer` | K4: jembatan data terpisah dari WhatsApp/e-Court/cron |
| `fitur/portal-pekerja` | K5: kerja latar ke kontainer pekerja; portal 2–4 proses |
| `fitur/dorong-sse` | K1 tahap 2: perubahan didorong lewat SSE ke semua layar |
| `fitur/berkas-di-server` | K14: cetak massal, relaas massal, pemeriksa sisa blangko di server |
| `fitur/data-peramban-ke-db` | K15: antrean cetak/relaas, catatan putusan terjadwal, tampilan per pengguna ke Postgres |
| `fitur/otp-whatsapp` | Admin 6: verifikasi dua langkah per peran (migrasi 0095) |

**Titik pasang** butuh jendela pemeliharaan (admin 5) di luar jam kerja dan rencana kembali ke versi sebelumnya.

## Tahap 10 — Gelombang 5: lintas PC (awan)

| Cabang | Butir |
| :--- | :--- |
| `fitur/kabar-perubahan` | U17: kabar perubahan data SIPP (dari jejak cermin; lebih cepat bila SSE Tahap 9 sudah ada) |
| `fitur/konteks-server` | U16: konteks, setelan, riwayat di server |
| `fitur/ejaan-nama-pihak` | U18: pemeriksa ejaan dan nama pihak |
| `fitur/riwayat-tunda-putus` | U19: riwayat tunda/putus otomatis terstruktur |
| `fitur/isian-per-sidang` | U12: isian per sidang untuk BAS beruntun |
| `fitur/saksi-ke-bas-sipp` | U10: kirim keterangan saksi ke BAS SIPP (paling akhir: menulis ke SIPP, butuh uji paling hati-hati) |

---

## Yang perlu diputuskan Derry sebelum mulai

Jawaban "sesuai saran" berarti memakai semua saran di bawah.

1. Mulai dari Tahap 0, lalu Tahap 1–3. **Saran:** ya (C0 + K-1 + gelombang 1 sesudahnya).
2. Retensi `aleta_saksi_butir` dan `aleta_isian_jejak`. **Saran:** 2 tahun.
3. Penyetuju naik/turun status isian dan penyunting katalog saksi. **Saran:** Super Admin + akun Derry.
4. Ambang naik status otomatis. **Saran:** ≥95% dari minimal 30 kejadian per isian dan jenis perkara.
5. Uji beban hanya di kembaran laptop. **Saran:** ya; tidak pernah ke server produksi saat jam kerja.
6. Jam pemindaian awal Cermin dan selang pembaruan. **Saran:** 18.00–06.30, pembaruan tiap 1 menit.
7. Fitur admin yang ikut. **Saran:** no. 1, 2+3, 5, 6 seperti dijadwalkan di atas; sisanya (4, 7–15) sesudah Tahap 10 atau bila diminta.
8. Tahap 9 (arsitektur). **Saran:** diputuskan sesudah melihat hasil uji beban Tahap 5.
