# Kartu kerja sesi awan: rantai upgrade 24 Okt 2026

Derry menyetujui semua saran di `docs/rancangan/upgrade-otomatisasi-24okt/TAHAPAN.md` ("kerjakan semua tahap"). Butir dikelompokkan menjadi **rantai**. Satu sesi awan mengerjakan satu rantai, dan cabang di dalam satu rantai bertumpuk supaya tidak saling bentrok.

## Aturan bersama (wajib untuk setiap rantai)

1. **Baca dulu:**
   - `AWAN.md` dan `CLAUDE.md` (bagian awan; bagian laptop drive D:/C:/papan localhost tidak berlaku);
   - `docs/rancangan/upgrade-otomatisasi-24okt/README.md` (isi butir) dan `TAHAPAN.md` (urutan, syarat selesai);
   - kanvas tampilan bila ada di prompt.
2. **Dasar:** `origin/integrasi-awan-24okt` (hasil gabung 13 cabang 23–24 Okt). Cabang pertama rantai dibuat dari situ. Cabang berikutnya dibuat dari **ujung cabang sebelumnya dalam rantai yang sama** (bertumpuk), kecuali kartu menyebut lain.
3. **Tiap butir satu cabang `fitur/<nama>`** seperti di tabel rantai, dan dorong tiap cabang begitu ujinya hijau. Jangan push ke `main`/`integrasi-*`, jangan PR, jangan naikkan versi (manifest, `APP_VERSION`), jangan pasang ke server.
4. **Saklar mati dulu.** Fitur yang mengganti sumber data atau mengubah perilaku lama dipasang di balik saklar Super Admin yang bawaannya mati. Bila saklar mati atau sumber baru belum siap, jalur lama berjalan persis seperti sekarang. Fitur lama tidak dikurangi.
5. **Keamanan data dan hukum:**
   - TIDAK satu kata "Aleta"/"ALETA" masuk ke nilai SIPP/ABT/e-Court (`penjaga-tanda.js`, `tandaAletaService.js`, `tanda-aleta.ts`).
   - Hanya blangko/variabel milik `derry_briantono` yang diubah.
   - Isian hukum (huruf alasan 8503, keputusan majelis 4100–4105, dasar hukum) paling jauh usulan.
   - Sebelum menulis ke SIPP/ABT selalu membaca ulang sumber; cermin hanya untuk dibaca.
   - Tidak ada trigger/ubahan skema di basis data SIPP/ABT. ABT = MariaDB 5.5 (tanpa fungsi JSON, tanpa CTE).
   - Fixture memakai nama/NIK rekaan. Tidak ada dump, `.env`, sandi, token di repo.
6. **Migrasi:**
   - pakai nomor cadangan rantai Anda (tabel di bawah);
   - setiap migrasi: berkas SQL + entri `_journal.json` + kembaran DDL di `src/server/db/schema.ts` + daftar tabel di `src/server/db/client.ts`;
   - uji `tabel-cadangan-terdaftar` hijau;
   - `idx` jurnal dirapikan saat gabung akhir.
7. **Verifikasi per cabang:**
   - uji berkas sasaran (`npx vitest run src/test/<berkas>.test.ts`), berkas uji baru per butir dengan akhiran tanggal;
   - `npx tsc --noEmit`, `npm run lint` (tidak menambah pelanggaran);
   - perubahan tampilan diperiksa di peramban (Playwright, `executablePath` Chromium pra-pasang) dengan data rekaan.
8. **Akhir rantai:**
   - jalankan uji penuh sekali di ujung rantai: `ALETA_FOLDER_KERJA=<scratchpad> ALETA_UJI_TMP=<scratchpad>/tmp node scripts/periksa-uji.mjs` dari `manajemen_surat/`;
   - uji yang sudah merah di `integrasi-awan-24okt` karena lingkungan boleh tetap merah, tetapi tidak boleh bertambah;
   - jangan skip/menonaktifkan uji.
9. **Laporan:** tulis `docs/awan/laporan-rantai-<huruf>.md` di cabang terakhir rantai, berisi:
   - daftar cabang + commit ujung;
   - uji (angka hijau/merah);
   - saklar baru dan bawaannya;
   - langkah laptop yang diperlukan (mulai ulang bot, rilis ekstensi, Apache, dsb.);
   - **pertanyaan terbuka**.
10. **Pertanyaan:** jangan berhenti menunggu jawaban. Pilih opsi paling aman yang sejalan dengan saran di README/TAHAPAN, catat di laporan, lalu lanjut. Berhenti hanya bila dua pilihan sama-sama bisa merusak data asli.

## Nomor migrasi cadangan

| Rantai | Nomor |
| :--- | :--- |
| A Cermin | 0090, 0096, 0097 |
| C Jejak & saksi | 0091, 0093, 0101 |
| D Blangko | 0092, 0102, 0103 |
| E Ukur & admin | 0094, 0095, 0104 |
| B Ekstensi & PC tua | 0098, 0099, 0100 |
| F Server | 0105, 0106 |

## Rantai A — Cermin Perkara (Tahap 2, K2/K6, K13, U17)

| Urut | Cabang | Butir |
| :--- | :--- | :--- |
| A1 | `fitur/singgah-jadwal` | K2 + K6: `tandaiTulisan` hanya membuang kunci yang terkena; jawaban disimpan sekali tanpa `structuredClone` per pemanggil; kunci layar publik = layar Jadwal; `getGatewayAntrianSidang` bersinggah; `rekamAntrian` menulis hanya bila berubah |
| A2 | `fitur/cermin-dasar` | C0: migrasi 0090 (tabel `aleta_cermin_*`), pemindai awal berkelompok yang bisa dilanjutkan (jadwal 18.00–06.30), layar admin "Pemantau Cermin Perkara". Saklar mati |
| A3 | `fitur/cermin-pembaruan` | Pembaruan tiap 1 menit dari `diinput_tanggal`/`diperbaharui_tanggal`; tulisan lewat ALETA masuk seketika; pencocokan mingguan Minggu 02.00 |
| A4 | `fitur/cermin-jadwal-sidang` | Jadwal Sidang, `/jadwal`, layar publik/antrean membaca cermin (saklar per layar); tanda "Cermin · diperbarui"; kembali ke SIPP bila tertinggal; K1 tahap 1 (bacaan ringan + disidang bersama untuk semua layar) |
| A5 | `fitur/cermin-mediasi-status` | Jadwal Mediasi + Status Perkara (tag di `aleta_cermin_tag`, menggantikan K8) |
| A6 | `fitur/cermin-ekstensi` | "Keadaan perkara" panel SIPP satu panggilan ke cermin; fakta perkara Blangko Derry/susun saksi dari cermin dulu (menggantikan U5) |
| A7 | `fitur/tabel-jadwal-ringan` | K13: baris divirtualisasi/`memo`, hanya baris berubah digambar ulang |
| A8 | `fitur/kabar-perubahan` | U17: kabar perubahan data SIPP dari jejak cermin (polling ringan; SSE menyusul bila K1 tahap 2 disetujui) |

Uji perbandingan wajib (A4/A5): untuk data rekaan yang sama, isi layar dari cermin = isi dari jalur lama.

## Rantai B — Ekstensi dan PC tua (K12, K16, K15, K14, U16, U18)

| Urut | Cabang | Butir |
| :--- | :--- | :--- |
| B1 | `fitur/pengamat-tunggal` | K12: MutationObserver disatukan, interval → kejadian, berhenti di tab tersembunyi, putusan terjadwal satu tab per PC |
| B2 | `fitur/mode-ringan` | K16: otomatis bila `deviceMemory` ≤ 4 atau `hardwareConcurrency` ≤ 2; pengaturan per pengguna |
| B3 | `fitur/data-peramban-ke-db` | K15: antrean cetak/relaas massal (bisa dilanjutkan sesudah Chrome ditutup) dan catatan putusan terjadwal ke Postgres. Riwayat Urungkan dikerjakan rantai C (U6) |
| B4 | `fitur/berkas-di-server` | K14: cetak massal, relaas massal, pemeriksa sisa blangko dikerjakan server; peramban menerima hasil jadi |
| B5 | `fitur/konteks-server` | U16: konteks, setelan, tampilan per pengguna di server |
| B6 | `fitur/ejaan-nama-pihak` | U18: pemeriksa ejaan dan nama pihak dengan kamus alias (hanya usulan) |

## Rantai C — Jejak isian dan saksi (U1, U2, U6, K10, U7, U8, U9, U10)

| Urut | Cabang | Butir |
| :--- | :--- | :--- |
| C1 | `fitur/jejak-isian` | U1 + U2 + U6, migrasi 0091 (`aleta_saksi_butir`, `aleta_isian_jejak`): susun saksi mencatat usulan vs akhir; Blangko Derry mencatat isian manual/koreksi; baca-ulang ABT sesudah simpan; Urungkan dari server. Retensi 2 tahun. **Dorong secepatnya; rantai D menunggu cabang ini** |
| C2 | `fitur/katalog-saksi-sebagian` | K10: katalog saksi dimuat per jenis perkara, bukan 9,4 MB di setiap halaman ABT |
| C3 | `fitur/mesin-saksi-tunggal` | U7: dua mesin saksi disatukan tanpa mengurangi keluaran |
| C4 | `fitur/katalog-saksi-db` | U8: katalog di basis data dengan versi (0093) + layar penyunting (Super Admin + Derry); K10 memuat dari portal |
| C5 | `fitur/fakta-non-cerai` | U9: keadaan dan fakta untuk perkara non-cerai (memakai T2 yang sudah digabung) |
| C6 | `fitur/saksi-ke-bas-sipp` | U10: kirim keterangan saksi ke BAS SIPP. Menulis ke SIPP: saklar mati, pratinjau dulu, baca ulang sebelum tulis, penjaga tanda wajib |

## Rantai D — Blangko dan ketepatan (U3, U4, U11, U13, U14, U15, U12)

Dasar: **`origin/fitur/jejak-isian`** (C1), bukan `integrasi-awan-24okt`.

| Urut | Cabang | Butir |
| :--- | :--- | :--- |
| D1 | `fitur/ketepatan-isian` | U3 + U4 (0092): layar Ketepatan isian; usulan naik bila ≥95% dari minimal 30 kejadian per isian dan jenis perkara; persetujuan Super Admin + Derry, tidak pernah otomatis. Ukur kebenaran isi saksi. Data lapangan baru terkumpul sesudah dipasang |
| D2 | `fitur/tutup-isian-manual` | U11 |
| D3 | `fitur/wajib-sebelum-cetak` | U13: daftar wajib sebelum CETAK + salin dari perkara serupa (non-identitas) |
| D4 | `fitur/huruf-alasan-belajar` | U14: tetap usulan |
| D5 | `fitur/sebutan-pihak` | U15 |
| D6 | `fitur/isian-per-sidang` | U12: isian per sidang untuk BAS beruntun |

## Rantai E — Ukur dan admin (K9, admin 2+3, 5, 1, 6)

| Urut | Cabang | Butir |
| :--- | :--- | :--- |
| E1 | `fitur/uji-beban` | K9: skrip 100/200 perangkat ke **kembaran laptop saja**; menolak berjalan ke 192.168.10.10 atau alamat produksi lain; laporan p95, kueri SIPP/menit, sambungan, CPU/RAM |
| E2 | `fitur/pusat-kesehatan` | Admin 2+3 (0094): Pusat kesehatan + catatan galat; menampilkan hasil uji beban terakhir |
| E3 | `fitur/mode-pemeliharaan` | Admin 5 |
| E4 | `fitur/lihat-sebagai` | Admin 1. Periksa dulu `origin/fitur/lihat-sebagai-unik` dan kode yang ada; lengkapi, jangan menggandakan |
| E5 | `fitur/otp-whatsapp` | Admin 6 (0095): verifikasi dua langkah, **mati bawaan (keputusan Derry 24 Okt)**: saklar terpisah untuk OTP WhatsApp dan authenticator di Pengaturan admin, keduanya mati sesudah dipasang, sehingga tidak ada pengguna yang dimintai kode sampai Super Admin menyalakannya. Pengguna tetap boleh mendaftarkan authenticator lebih dulu, tetapi kode belum ditagih. Cara: OTP WhatsApp (bawaan) + **authenticator TOTP** (pilihan; QR boleh dipindai di 2 HP); passkey disiapkan tetapi hanya aktif bila HTTPS. Aturan per peran: Super Admin/Admin wajib, hakim/pejabat "hanya dari luar kantor", lainnya opsional. Kode hanya diminta di perangkat baru atau dari luar subnet kantor; "percayai perangkat 30 hari"; kode cadangan dari admin. Memakai kuki perangkat dari audit login dan batas perangkat (5 per akun tetap berlaku) |
| E6 | `fitur/penjaga-integritas-berkas` | **Baru (permintaan Derry 24 Okt, isu judol di website satker; surat Dirjen):** bot ALETA mencatat sidik (sha256, ukuran, waktu ubah) berkas di folder web yang didaftarkan Super Admin, yaitu website satker yang dihosting di server kantor, ditambah SIPP/ABT bila diizinkan. Folder dibaca saja, tidak pernah ditulis. Berkas `.php` baru/berubah, `.php` di folder unggahan, pola webshell (`eval(base64_decode`, `assert(`, `gzinflate`, `preg_replace /e`), dan kata judol pada halaman publik → peringatan WhatsApp ke admin + merah di Pusat kesehatan (E2). Ada daftar "diketahui aman" untuk pembaruan resmi. Tidak menghapus apa pun secara otomatis. Migrasi 0104 |

## Rantai F — Server (K3, K7, U19)

| Urut | Cabang | Butir |
| :--- | :--- | :--- |
| F1 | `fitur/kolam-sipp` | K3: kolam interaktif terpisah dari latar, `acquireTimeout`/`queueLimit`, putus kueri lambat; ukuran dari pengaturan (diisi laptop dari `max_connections`) |
| F2 | `fitur/port-8008` | K7 sisi kode: portal dan widget memakai alamat 8008 bila tersedia, kembali ke :80 bila tidak. Pemasangan Apache dicatat sebagai langkah laptop |
| F3 | `fitur/riwayat-tunda-putus` | U19 |

## Ditunda (keputusan 8 di TAHAPAN)

K4 (bot dua kontainer), K5 (portal banyak proses), K1 tahap 2 (SSE) diputuskan sesudah uji beban di laptop. K11 (pecah `konten.js`, persempit `matches`) dikerjakan **paling akhir** sesudah semua rantai digabung, karena bentrok dengan hampir semua cabang ekstensi.
