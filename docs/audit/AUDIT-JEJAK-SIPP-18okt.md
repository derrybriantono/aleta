# Audit jejak ALETA di SIPP / ABT / e-Court — 18 Oktober 2026

Perintah pengguna (hakim, 18 Okt ±21.15): "Untuk SIPP ingat jangan sampai terdeteksi tulisan ALETA sama
sekali ... database SIPP itu bisa dilihat pusat." Aturan tetap: tidak satu kata "Aleta" (huruf apa pun,
termasuk `aleta_`, "Aleta Judicia") sampai ke server/DB SIPP, e-Doc, ABT/DB ABT, maupun e-Court. Di dalam
ALETA sendiri boleh.

Cabang: `fitur/audit-jejak-sipp` (dari `origin/integrasi-1205-8`). Server produksi tidak disentuh;
pengukuran memakai salinan lokal (`sipp_donggala`, `aps_badilag`, `aps_badilag_i28`, `aps_badilag_pm57`)
dengan SELECT saja. Paket ABT diuji pada salinan sementara `aps_badilag_uji_jejak` (sudah dihapus).

## Ringkasan temuan

| # | Tingkat | Jalur | Contoh yang bocor | Perbaikan |
|---|---|---|---|---|
| 1 | PARAH | DB ABT `abt_variabel` (paket lama, di luar repo) | nama "(OTOMATIS ALETA: posita SIPP per butir ...)", "(dirapikan ALETA + Domisili Elektronik ...)", modifier `aleta` (8570), komentar kueri "Aturan sama dengan ALETA majelisPemeriksaService." | Paket ABT baru `D:/aleta-dev/kerja/audit-jejak-18okt/abt-netral-nama-variabel.sql` (bercadangan ke `aleta_bot`, idempoten, diuji). Rujukan `aleta_bot.` di 18 kueri → keputusan pengguna |
| 2 | SEDANG | e-Court: unggah salinan putusan | PDF diunggah apa adanya (Producer/Author/XMP ber-ALETA, isi tidak diperiksa) | `ecourtAksiService.unggahSalinan` kini lewat `siapkanBerkasSipp` + `tanpaTandaAletaMetadata`; nama pihak SIPP dikecualikan |
| 3 | SEDANG | e-Court: keterangan verifikasi hakim | "dicek lewat ALETA" diketik ke textarea e-Court (hanya dipotong 500 huruf) | Ditolak di bot (`ecourtAksiService.verifikasi`) dan di rute portal sebelum bot dipanggil |
| 4 | SEDANG | Kolam MySQL ABT (`db_config5`), antrian (`db_config4`), registri (`externalDbService`) | tanpa jaring sama sekali; `db_config` hanya mencatat | Jaring baru di keempat kolam: STRUKTUR ber-nama ALETA (tabel/kolom/indeks/pemicu/tampilan/fungsi) DITOLAK sebelum kueri; nilai ber-ALETA dicatat |
| 5 | SEDANG | Ekstensi: satu pintu pengisi kolom SIPP (`kirimKeJembatan`, `saksiscanJembatan`) | CKEditor pertimbangan/amar, alamat, email/HP, isian saksi/KTP tidak diperiksa (hanya `isiBorang` & `setel`) | `AletaPenjagaTanda.periksaTeks` di kedua pintu (data SIPP di halaman dikecualikan) |
| 6 | SEDANG | Ekstensi: `penjaga-tanda.js` | hanya badan POST yang diperiksa: kepala `X-Aleta-*`, nama query `?aleta=1`, nilai query, jalur, dan NAMA isian (`aleta_token=1`) lolos | Kepala & nama query diperiksa pada semua cara (juga GET); nilai query, jalur, nama isian pada tulisan |
| 7 | SEDANG | Ekstensi → ABT `main/anonim` | RTF terkirim apa adanya (grup `{\*\aletaasal}`, `{\info{\author ALETA}}`) | `pasangFetch` membersihkan RTF di FormData sebelum terkirim ke SIPP/ABT (`bersihkanRtf`) |
| 8 | KECIL | RTF unduhan (Blangko Derry, BAS naskah) yang diunggah petugas LANGSUNG lewat borang SIPP | grup tersembunyi `isianasal`/`aletaasal` ikut | `alatUnduh` (ekstensi) dan rute `bas/naskah` membuang grup itu saat unduh |
| 9 | KECIL | `sys_audittrail.ipaddress` (penetapan, mediator, kasir) | nilai bukan IPv4 hanya dipotong 15 huruf (mis. "aleta-portal-1" → "aleta-portal-1") | `penjagaTandaSipp.ipAuditSipp`: hanya IPv4, selain itu kosong |
| 10 | KECIL | Jaring nilai `tulisanBocor` | `START TRANSACTION; INSERT ...` tidak dikenali (hanya awal teks) | diperiksa per pernyataan |
| 11 | KECIL | Papan klip ringkasan musyawarah ABT | "Disusun ALETA dari panel ABT ..." (bisa ditempel ke SIPP) | "Disusun dari panel ABT ..." |
| 12 | KECIL | Eviden SKP (keluar ke sistem kinerja pusat) | PDF Author/Creator/Producer "ALETA", XLSX `dc:creator`/`Application` "ALETA" | metadata dikosongkan (Author = nama pegawai); opsi `aplikasi` di `createXlsxWorkbook` |

### Perubahan perilaku tulis ke SIPP (dijelaskan)
- **Tidak ada kolom atau urutan tulis SIPP yang berubah.** Satu-satunya perubahan nilai: `sys_audittrail.ipaddress`
  pada penetapan, mediator, dan kasir kini kosong bila alamat yang diterima bukan IPv4 (dulu dipotong 15 huruf).
  Portal (`alamatIpPeramban`) sudah hanya mengirim IPv4 atau kosong, jadi pada jalur normal nilainya sama.
- Kolam SIPP/ABT kini MENOLAK `CREATE/ALTER/RENAME` dan `INSERT/REPLACE/UPDATE` yang menyebut nama ber-ALETA di
  basis data kolam. Kode sekarang tidak pernah melakukannya (semua DDL `aleta_bot_*` lewat `bot_db_config`/`botDbService`
  — diperiksa per berkas), jadi tidak ada fitur yang berubah. `DROP/DELETE/TRUNCATE` tetap boleh (pembersih
  `scripts/audit-sipp-tabel-aleta.js` tetap jalan).
- e-Court: unggah salinan kini dapat DITAHAN bila isi PDF memuat kata ALETA (di luar nama pihak SIPP), dan PDF
  bertanda tangan elektronik ber-metadata ALETA ditahan (tidak diubah diam-diam) — sama dengan unggah ke SIPP.

## Jalur yang sudah bersih (bukti)

- **Nilai kolom tulisan bot ke SIPP**: seluruh `aleta_bot/services` & `routes` disisir; tidak ada cadangan `|| "aleta"`,
  `os.hostname()`, atau literal ALETA pada nilai INSERT/UPDATE non-`aleta_`. `diinput_oleh`/`diperbaharui_oleh` =
  `akun.username` petugas SIPP. Nama berkas e-Doc lewat `namaBerkasBersih`. Daftar `JALUR_TULIS_SIPP` (19 berkas)
  dijaga uji D `penjaga-tanda-sipp-17okt`.
- **Skema SIPP**: kolom yang dapat merekam jejak hanya `sys_audittrail` (datetime, ipaddress, username, tablename,
  formname, action, title, description), `sys_user_online` (user_agent/host — ditulis SIPP sendiri dari peramban
  petugas), `web_statistik` (0 baris). `Audittrail.php` SIPP hanya merekam kolom yang ditulis model, bukan
  seluruh `$_POST`; `sess_use_database = FALSE`.
- **Struktur DB SIPP salinan Donggala**: 0 tabel/kolom/pemicu/rutin/tampilan ber-ALETA (`sipp_donggala`). Salinan PA
  Bungku (`sipp`) masih memuat 13 tabel `aleta_bot_*` dari versi lama — alat `scripts/audit-sipp-tabel-aleta.js` ada.
- **Data SIPP salinan Donggala** (pindai 2.658 kolom teks): `sys_audittrail` 34–41 baris lama 28 Sep–1 Okt (sudah
  diketahui, dibersihkan paket Senin); sisanya nama orang/tempat (`kode_pos.area`, `pihak.nama`, `ref_kelurahan`,
  posita/amar yang menyebut nama pihak) dan 6 akun uji LOKAL `uji_*` "Uji ALETA ... (lokal)" (901–906, hanya di
  laptop — jangan ikut ke server).
- **Struktur DB ABT**: salinan terbaru (`aps_badilag`, `i22`–`i28`, `pm55`–`pm57`) tanpa fungsi `aleta_rtf_*`; hanya
  salinan uji lama `i4`, `i18`, `i21*` yang masih memilikinya (diurus paket i21).
- **HTTP**: bot tidak memanggil web SIPP/ABT (tulis langsung ke DB). e-Court: User-Agent Chrome biasa, tanpa kepala
  `X-Aleta*`. Ekstensi: tidak ada `document.cookie`, `window.name`, `pushState` ke SIPP; `#aleta-tab=…`/`#aleta-bd=…`
  hanya fragmen (tidak pernah terkirim ke server maupun Referer). Rute portal "masuk SIPP" memakai
  `Referrer-Policy: no-referrer`.
- **DOM ekstensi**: tidak ada elemen ber-`name` di dalam form SIPP/ABT (radio `aleta-massal-ganda-*` di panel di
  `body`; borang ABT `main/cari` bernama `a/b/c`). Tidak ada HTML berkelas/atribut ALETA yang ditulis ke editor SIPP
  (`t7RapikanHtml` hanya meloloskan `p/b/i/u` tanpa atribut; gaya CKEditor di `<head>` iframe).
- **Berkas**: pembangkit RTF/DOCX/PDF (laporan mediasi, draf putusan, blangko sendiri, konversi naskah, `buatDocx`,
  `buatPdf`, salinan putusan bot) dipindai lewat kode sungguhan termasuk aliran termampat/ObjStm — bersih
  (uji D1). Kode sekarang tidak menulis grup `{\*\aletaasal}` (hanya membaca/membuang).

## Uji penjaga baru (semuanya menjalankan kode)

- `manajemen_surat/src/test/audit-jejak-sipp-18okt.test.ts`
  - A: `strukturAletaDiSipp` (11 contoh ditolak, 9 diterima); `db_config`, `db_config4/5`, `externalDbService`
    menolak SEBELUM menyambung MySQL; `pasangJaring` menolak/meneruskan/mencatat.
  - B: `tulisanBocor` per pernyataan.
  - C: `ipAuditSipp`; rencana Data Umum penetapan dengan ip "aleta-portal-1" → kolom ipaddress kosong.
  - D0: pemindai berkas DIBUKTIKAN menangkap contoh salah (Producer ALETA di ObjStm pdf-lib, `\'41\'4c…`, docProps).
  - D1/D2: keluaran pembangkit berkas sungguhan + metadata Eviden SKP.
- `ecourt-aksi-1okt.test.ts`: verifikasi ber-ALETA ditolak tanpa menyentuh e-Court; salinan ber-metadata ALETA
  dibersihkan (panjang sama) sebelum terkirim; isi ber-ALETA ditahan; pihak SIPP "ALETA SARI" lolos.
- `penjaga-tanda-ekstensi-17okt.test.ts`: kepala/alamat/nama isian; `bersihkanRtf`; `pasangFetch` membersihkan RTF
  FormData ke ABT; urutan penjaga di `kirimKeJembatan`/`saksiscanJembatan` (pemeriksa dibuktikan menangkap pintu tanpa
  penjaga); teks salinan musyawarah.

## Keputusan pengguna (18 Okt ±23.00) dan pelaksanaannya

| no | keputusan | pelaksanaan |
|---|---|---|
| 94 | (b) basis data netral untuk kueri ABT | paket `D:/aleta-dev/kerja/audit-jejak-18okt/abt-db-netral/` (PRASYARAT → CADANGAN → PASANG transaksi → PERIKSA → PULIH, MD5SUMS, PASANG.md, uji jalur). Basis data `isian_data`, VIEW `ecourt_ringkasan`, `ktp_pihak`, `ecourt_berkas`; 18 variabel (2223, 8800–8811, 8813, 8870–8872, 11114). Render php56 85 nilai sebelum = sesudah. Definisi VIEW tetap menyebut sumber `aleta_bot` (dicatat jujur di PASANG.md). |
| 95 | paket netral nama variabel dipasang Senin | **diganti**: 25 dari 26 sasarannya sudah dikerjakan paket i21 (`abt-netral-db-derry`); memasang keduanya membuat hasil bergantung urutan. Sisa (modifier `aleta` 8570) dipindah ke `abt-db-netral`. Berkas `abt-netral-nama-variabel.sql` diberi tanda JANGAN DIPASANG. Urutan: `D:/aleta-dev/kerja/audit-jejak-18okt/URUTAN-PASANG.md`. |
| 96 | nama DB/pengguna MySQL ALETA tidak diganti | tidak ada perubahan |
| 97 | teks layar dibiarkan | tidak ada perubahan |
| 98 | Eviden SKP dinetralkan | "Data dibaca dari SIPP pada …", "… adalah USULAN dan belum disahkan …", sumber penilai "Pejabat penilai pada Lembar SKP"; uji D2 memindai PDF (teks pdf.js), XLSX, DOCX SKP: 0 kata ALETA |

Penjaga repo baru (uji E): Pengaturan SIPP & ABT menolak kueri variabel yang merujuk `aleta_bot` dan menerima `isian_data`; pemindai repo
memastikan tidak ada kode yang menyusun kueri variabel ABT (`#perkara_id#`) ke `aleta_bot` (pemindai dibuktikan menangkap contoh lama).
Kode repo memang tidak pernah membuatnya — kueri lama berasal dari paket ABT di luar repo (`abt-tanggal-ktp`, `abt-tanggal-ktp-2`, `abt-data-ecourt`).

Temuan sampingan: variabel ABT **2223** (salinan `pm57`/`i28`) membuat render ABT macet sampai memori habis — sebelum paket apa pun; namanya memuat
penanda `#2223#` (dugaan: ABT mengisi dirinya sendiri berulang). Kuerinya sama dengan 8872 yang normal. Perlu diperiksa pemilik paket yang membuatnya
sebelum dipasang.

## Perlu keputusan pengguna (asli, sebelum jawaban di atas)

1. **Rujukan basis data `aleta_bot.` di 18 kueri variabel ABT** (KTP e-Court 2223/8870–8872/11114, kontak &
   domisili elektronik 8800–8813). Siapa pun yang membuka `abt_variabel` melihat nama basis data `aleta_bot`.
   Pilihan: (a) biarkan; (b) buat basis data bernama netral (mis. `isian_bantu`) berisi VIEW ke tabel ALETA lalu ganti
   rujukannya (paket ABT + server); (c) ganti nama basis data ALETA (berat).
2. **Pasang paket ABT `abt-netral-nama-variabel.sql`** bersama paket Senin (diuji: 26 baris → 0, idempoten, jam ubah
   tidak berganti). Pastikan juga paket i21 mengganti pemanggilan `aleta_rtf_*` di `abt_variabel.sql_query`
   (9250–9265) — di salinan uji `pm57`/`i28` rujukannya masih `aps_badilag_i4.aleta_rtf_*`.
3. **Pengguna MySQL & basis data ALETA di server SIPP**: `aleta_bot_user` dan basis data `aleta_bot` terlihat di
   `mysql.user`/processlist server yang sama. Bukan isi DB SIPP, tetapi terlihat oleh pengelola server.
4. **Tampilan di layar SIPP/ABT** masih menyebut ALETA (mis. "Buka di ALETA", "ALETA mengusulkan …", "ALETA ·
   e-Court"). Tidak terkirim ke server; keputusan 17 Okt hanya mengatur database. Ganti istilah layar bila diinginkan.
5. **Teks tampak Eviden SKP** "Data dibaca ALETA dari SIPP pada …" dan "USULAN ALETA" (SKP jabatan) — berkas ini keluar
   ke sistem kinerja; metadata sudah netral, teks badan menunggu keputusan.
6. Folder unduhan relaas massal bernama "ALETA relaas <tanggal>" (lokal di PC petugas, tidak terkirim).

## Verifikasi (18 Okt ±22.40)

- `npx tsc --noEmit`: bersih.
- Uji sasaran (`--no-file-parallelism --maxWorkers=1`): `audit-jejak-sipp-18okt` + `penjaga-tanda-ekstensi-17okt`
  34/34; `ecourt-aksi-1okt` 36/36; `penjaga-tanda-sipp-17okt` + `tanpa-tanda-aleta-di-sipp-17okt` 68/68.
  (`eviden-skp-cetak` tidak dapat dijalankan di worktree: `public/mahkamah-agung-logo.png` tidak dilacak git.)
- Paket ABT diuji pada salinan `aps_badilag_pm57` (basis data sementara, sudah dihapus): 26 baris → 0, jalan kedua
  0 perubahan, baris lain dan kolom `modified` tidak berubah.
- Ekstensi berubah (penjaga-tanda.js, konten.js, saksiscan.js, panel-alat.js, abt.js): perlu rilis ekstensi
  (`rilis-ekstensi`) oleh sesi utama — tidak dijalankan di sini.
