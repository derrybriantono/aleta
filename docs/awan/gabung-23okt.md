# Panduan gabung hasil sesi cloud 23-24 Okt 2026 (untuk sesi LAPTOP)

Dikerjakan di repo ALETA LOKAL di laptop. Patuhi `CLAUDE.md` (bagian laptop: drive D:/C:, papan kemajuan localhost:8787, skill `periksa-uji` dan `rilis-ekstensi`). Pengguna (Derry) meminta: sesudah semua selesai, langsung pasang ke server dari laptop.

Panduan ini MENGGANTIKAN kartu tugas "Gabung semua hasil 23 Okt dan pasang ke server" (kartu itu belum memuat T9/T10).

## Dasar
- Mulai dari `integrasi-1205-38` LOKAL. Cabang ini sudah berisi perbaikan error 1.205.38 yang dipasang di lokal dan server, tetapi belum ada di GitHub (di GitHub `integrasi-1205-38` = `24fa2f74`).
- Gabungkan juga `origin/integrasi-1205-38` (dokumen AWAN T9/T10), lalu `git push origin integrasi-1205-38`.
- `git fetch origin`, lalu `git switch -c integrasi-1205-39`.

## Urutan merge (merge, BUKAN rebase; satu per satu; ujung cabang terbaru di origin)
| No | Cabang | Isi | Catatan |
| :--- | :--- | :--- | :--- |
| 1 | `fitur/kalender-libur-sidang` | uji kalender `e3fa87c9` | |
| 2 | `fitur/t6-kartu-saksi-terlipat` | pita saksi terlipat + terbuka saat peringatan | |
| 3 | `fitur/t7-t8-referensi-pihak` | hubungan saksi + isian otomatis | agama Islam masih usulan |
| 4 | `fitur/t2-saksi-semua-jenis` | saksi semua jenis perkara | bot WAJIB dimulai ulang |
| 5 | `fitur/t4-tema-ekeuangan-ecourt` | tema e-Court/E-Keuangan | `content_scripts` baru |
| 6 | `fitur/t3-kasir-jurnal-keuangan` | tombol Kasir di Jurnal Keuangan | |
| 7 | `fitur/t5-panduan-kasir-sorot` | panduan kasir bersorot | |
| 8 | `fitur/t1-aleta-ai-tahap2` | ALETA Ai tahap 2 | migrasi **0084** |
| 9 | `fitur/audit-login-perangkat` | riwayat masuk, batas perangkat, pencabutan sesi, MAC, batas laju IP ujung | migrasi **0085** |
| 10 | `fitur/t10-dompet-aleta-ai` | Dompet lengkap: rumus harga + MDR **1%**, kurs JISDOR, kuota hibah per peran (**hangus akhir bulan**), batas satker Rp5 jt/bulan, perkiraan biaya, laporan laba, struk, **koreksi saldo Super Admin** | migrasi **0088** (0089 tidak dipakai) |
| 11 | `fitur/t9-aleta-ai-tugas` | Tugas/cowork; berhenti "saldo habis" lalu lanjut; penyamaran teks bebas diperluas; keluaran mengikuti V4.5 (HTML = templat + `window.SIDANG`/`KOMPARASI`; putusan = naskah berpenanda ALETA_08 dicetak `aleta_putusan_docx.py` di sandbox, dengan cadangan); kirim ke alur | migrasi **0086, 0087**; sudah memuat merge T1 |
| 12 | `fitur/pwa-pasang` | Pasang di HP | |
| 13 | `fitur/rencana-fitur-admin` | dokumen rencana 15 fitur admin | |
| 14 | opsional `fitur/awan-cabang-dasar` | perbaikan kecil AWAN.md | lewati bila sudah benar |

## Bentrok dan penyelarasan yang sudah diketahui
- **Jurnal migrasi** `drizzle/meta/_journal.json`:
  - Tiap cabang menulis idx sendiri. T10 memakai idx 76 untuk 0088; audit login dan T1 juga memakai idx 76/77/78.
  - Susun ulang idx urut menurut nomor berkas: 0083 → 0084 → 0085 → 0086 → 0087 → 0088. Tidak boleh ganda.
  - Satukan juga DDL kembaran di `src/server/db/schema.ts` dan daftar tabel di `src/server/db/client.ts`. Uji `tabel-cadangan-terdaftar` harus hijau.
- **Saklar darurat ALETA Ai:**
  - T10 menyediakan `aletaAiDihentikan(db)`, `pantauSaklar(db, kendali)`, dan `daftarkanPekerjaanAi(kendali)` di `src/server/modules/aleta-ai/saklar.ts`.
  - T9 memakai `saklarDaruratMenyala(db)` di `src/server/modules/aleta-ai/tugas.ts`.
  - Keduanya membaca pengaturan `aktif` yang sama.
  - Saat digabung, ubah `saklarDaruratMenyala` agar memanggil `aletaAiDihentikan`, dan daftarkan tiap jalan tugas dengan `daftarkanPekerjaanAi` supaya saklar memutus seketika.
  - Uji saklar T9 dan T10 harus tetap hijau.
- **Dana tugas T9 dengan T10:**
  - Pola T10: `perkirakanBiayaTugas` → `tahanDana(db, id, rp, rujukanTugas, {sekali:true})` → `selesaikanTahanan`. T9 memakai `tahanDana`/`selesaikanTahanan` tanpa `{sekali:true}`; tambahkan opsi itu.
  - Batas harian/laju T10 belum diterapkan pada tugas T9. Pasang pemeriksaan batas yang sama sebelum tugas mulai.
  - Laporan laba dan rekonsiliasi T10 hanya menghitung giliran percakapan. Sertakan biaya/pendapatan tugas T9 (tabel tugas/langkah 0086) supaya laba = jumlah mutasi tetap benar.
- **Berkas tanaman** `src/server/shared/ekstensi-berkas.ts`: ambil salah satu sisi, lalu sesudah semua merge jalankan `ALETA_TANAM_PAKSA=1 node scripts/susun-ekstensi.mjs` dari `manajemen_surat/`.
- **Berkas yang disatukan, jangan ada entri hilang:**
  - `ekstensi-sipp/manifest.json`, `scripts/susun-ekstensi.mjs`, `ekstensi-sipp/latar.js`;
  - `src/lib/matriks-peran.ts` (bangkitkan ulang dokumen matriks hak);
  - `src/proxy.ts` (kuki perangkat), `src/app/layout.tsx` (Pasang di HP), `src/lib/auth.ts` (kait sesi + `advanced.ipAddress`).
- Bila dua sisi mengubah logika yang sama dan memilih salah satu menghilangkan perilaku, BERHENTI dan tanyakan pengguna.

## Verifikasi (wajib hijau sebelum rilis)
- `npx tsc --noEmit`, `npm run lint` (baseline `lint:jangan-bertambah`).
- Uji penuh lewat skill `periksa-uji`. Uji yang di cloud merah karena lingkungan, dan sudah merah di cabang dasar, harus sama atau lebih baik:
  - `abt-wajib`, `admin-integrasi-ecourt`, `penjaga-tanda-sipp-17okt`, `audit-sipp-ide-17okt`, `kasir-jurnal`, `kasir-otomatis-saklar-13okt`, `abt-usulan`;
  - `masuk-otomatis-nama-sipp-11okt`, `root-redirect`, `backend-db`, `backend-2okt`, `court-calendar-sidang`, `ecourt-aksi-1okt`;
  - `penetapan-ttd-cap-6okt`, `tema-tanpa-kedip-23okt`, `ekstensi-widget-tahap3`, `tanya-jawab-ecourt-18okt`.
- Uji baru yang harus hijau:

  | Bagian | Berkas uji |
  | :--- | :--- |
  | Kalender | `kalender-libur-23okt` |
  | T6 | `sipp-saksi-pita-terlipat-23okt` |
  | T7/T8 | `referensi-pihak-hubungan-t7-23okt`, `referensi-pihak-isian-t8-23okt` |
  | T2 | `saksi-semua-jenis-t2-25okt` |
  | T4 | `tema-ecourt-23okt`, `ekeuangan-tema-23okt` |
  | T3 | `kasir-jurnal-popup-t3-23okt`, `kasir-jurnal-hak-t3-23okt` |
  | T5 | `panduan-kasir-sorot` |
  | T1 | `aleta-ai-tahap2a-23okt`, `aleta-ai-gelembung-23okt`, `aleta-ai-matriks-kemampuan-23okt` |
  | Audit login | `jejak-masuk-perangkat`, `jejak-masuk-pencabutan`, `jejak-masuk-layar`, `jejak-masuk-batas-laju`, `pembaru-otomatis-23okt` |
  | T10 | `aleta-ai-dompet-25okt` (39), `aleta-ai-server-20okt` |
  | T9 | `aleta-ai-tugas-25okt`, `aleta-ai-tugas-layar-25okt` |
  | Pasang di HP | `pasang-aplikasi-23okt`, `ikon-aplikasi-23okt` |

- Jangan skip, nonaktifkan, atau karantina uji untuk mendapat hijau.

## Rilis dan pasang
1. Rilis ekstensi lewat `rilis-ekstensi` (mis. 1.205.39; catatan rilis ringkas per butir). Jangan naikkan `APP_VERSION`. Push `integrasi-1205-39`.
2. `bash scripts/aleta-deploy-from-git.sh HEAD --dry-run`, lalu tanpa `--dry-run`. Pastikan:
   - migrasi 0084–0088 berjalan;
   - bot dibangun ulang dan dimulai ulang (T2, rute ARP);
   - `/aleta/sw.js` terbuka.
3. **Tetap MATI, kecuali pengguna memerintahkan:**
   - ALETA Ai: jangan isi `ANTHROPIC_API_KEY`, jangan nyalakan `ALETA_AI_ALAT_DATA`, jangan buat akun DB `sipp_ai_baca`;
   - batas perangkat: bawaan tanpa batas;
   - isi saldo berbayar: `isiBerbayarAktif` mati;
   - sandbox Python: tanpa `ALETA_SANDBOX_SPOOL` berarti mati.
4. **Sandbox Python (T9).** Siapkan berkasnya, tetapi nyalakan hanya bila pengguna setuju.
   - Bentuk argumen di `sandbox-alat/izin.contoh.json` sudah dicocokkan dengan kode V4.5 tanggal 23-24 Okt. Periksa ulang bila V4.5 berubah.
   - `aleta_putusan_docx.py` membutuhkan `aleta_format.py` dan `aleta_alat.py` di folder yang sama, ditambah `python-docx` dan LibreOffice di image sandbox.
   - `bismillah.jpeg` diletakkan di `/skrip`.
   - Langkah:
     - salin skrip `aleta/*.py` V4.5 ke `sandbox-alat/skrip/` (JANGAN di-commit);
     - buat `izin.json` dari `izin.contoh.json`;
     - jalankan `docker compose -f sandbox-alat/docker-compose.yml up -d --build`;
     - isi env `ALETA_SANDBOX_SPOOL` dan pasang volumenya ke kontainer portal;
     - uji satu draf putusan rekaan sampai berkas .rtf terbuka di Word.
   - Templat HTML V4.5 (`ALETA_13`, `ALETA_18`, dan seterusnya) dibaca dari zip proyek yang diunggah Super Admin. Unggah ulang zip V4.5 sesudah migrasi 0087.
5. **Audit login di server:**
   - uji ARP: `docker compose exec aleta_bot node -e "console.log(require('./services/arpPerangkatService').bacaArp('192.168.10.X'))"`;
   - `ip -4 addr` dan `ip route`;
   - pasang ulang pembantu lokal ekstensi di tiap PC (popup → `pasang-pembaru-aleta.cmd`);
   - blokir akun uji: sesinya harus langsung putus.
6. **Kurs (T10):** pastikan halaman JISDOR BI terbaca dari server. Bila alamatnya pindah, setel `ALETA_AI_KURS_JISDOR_URL`.
7. **Cek di browser dan HP:**
   - Jadwal Sidang, form saksi, Referensi Data Pihak, Jurnal Keuangan, e-Court (tema), Susun saksi non-cerai;
   - "Pasang di HP" (Android + iPhone);
   - Admin → Riwayat Masuk & Perangkat;
   - Akun → Perangkat;
   - ALETA Ai → Dompet (saldo, struk) dan Tugas: layar tampil walau fitur mati.
8. **Papan kemajuan:** perbarui dengan commit, angka uji, dan versi. Tambahkan 15 fitur `docs/rancangan/fitur-admin-23okt/README.md` sebagai `menunggu`.

## Pertanyaan pengguna yang masih terbuka (laporkan, jangan menunggu)
- **T7+T8:** agama Islam otomatis di luar alur saksi? Masih usulan.
- **Sudah diputuskan Derry 24 Okt:** MDR 1%; batas satker Rp5 jt termasuk Super Admin; kuota hibah hangus akhir bulan; koreksi saldo perlu; penyamaran T9 diperluas; satu tahan per jalan tugas; templat mengikuti mekanisme V4.5.
- **T10 rekonsiliasi harian: DIBUAT** (keputusan Derry 24 Okt, commit `1687e32e`).
  - Pukul 01.00 WITA memeriksa data kemarin; lonceng "perlu perhatian" hanya untuk Super Admin bila ada selisih atau tahanan menggantung lebih dari 24 jam.
  - Diatur di Pengaturan ALETA Ai → Rekonsiliasi harian; dimatikan seluruhnya dengan env `ALETA_AI_REKONSILIASI=0`.
  - Detaknya dari `instrumentation.ts` (pola tunda-otomatis). Sesudah T9 digabung, pastikan tahanan tugas T9 (`rujukanTugas`) dan pendapatan tugas ikut terhitung (lihat butir dana tugas di atas).
- **T10 (lama, abaikan bila sudah dijawab):**
  1. MDR 0,7% dipungut selama QRIS belum ada, atau 0% dulu?
  2. Batas satker Rp5.000.000 biaya API/bulan, termasuk Super Admin: cocok?
  3. Ambang saldo menipis Rp5.000.
  4. Kuota hibah hangus akhir bulan?
  5. Penjadwal rekonsiliasi harian?
  6. Jalur koreksi saldo (angka minus)?
- **T9:**
  1. Penyamar T1 belum mengenali nama bebas (mis. "Saksi Rahmat"), sehingga nama itu ikut terkirim ke layanan AI. Perluas pola: sesudah "saksi", bin/binti, Penggugat/Tergugat?
  2. Satu tahan saldo per jalan atau per tugas?
  3. Penanda templat V4.5: `{{ISI}}`, `{{JUDUL}}`, `{{NOMOR_PERKARA}}`, `{{TANGGAL}}`, `{{TANDA_DRAF}}`?
- **Server masih http.** iPhone sudah bisa memasang. Android butuh https untuk aplikasi layar penuh.
- **Salinan HTML yang dibutuhkan** (disamarkan): SIPP Jurnal Keuangan (T3/T5), Tambah Referensi Data Pihak (T8), 6 halaman e-Court (T4). Ukuran isian saksi T2 atas posita/BAS asli.

## Laporan akhir
Cabang, commit gabungan, berkas bentrok dan cara menyelesaikannya, hasil `periksa-uji` (angka), versi rilis, hasil pemasangan, dan hasil cek.
