-- =============================================================================
-- KOMENTAR HAKIM ATAS BAS, TEMPLAT PERTIMBANGAN & DASAR HUKUM, VARIABEL WAJIB ABT
-- =============================================================================
--
-- Tahap 6-7 rencana "ekstensi dulu" (29 September 2026). Tiga tabel untuk tiga
-- keputusan pengguna yang berbeda, dibuat sekaligus karena ketiganya dibaca
-- ekstensi lewat kontrak yang sama (D:/aleta-dev/kerja/tahap67/KONTRAK.md).
--
-- Akses tiap tabel HANYA lewat modulnya:
--   aleta_bas_komentar        src/server/modules/aleta-ecourt/bas-komentar.ts
--   aleta_templat_hukum       src/server/modules/aleta-ecourt/templat-hukum.ts
--   aleta_abt_variabel_wajib  src/server/modules/aleta-ecourt/abt-wajib.ts
--
-- =============================================================================
-- aleta_bas_komentar - KOMENTAR, BUKAN ACC
-- =============================================================================
--
-- Keputusan pengguna: TANPA acc hakim. Hakim membaca alur BAS / keterangan
-- saksi dan menunjuk bagian yang salah; panitera tetap dapat mengerjakan BAS
-- tanpa menunggu. Karena itu tabel ini tidak punya kolom keadaan yang dapat
-- menahan apa pun - hanya "selesai" (sudah ditanggapi) sebagai catatan.
--
-- Kuncinya nomor perkara, BUKAN perkara_id saja: ekstensi di halaman ABT dan
-- hakim di portal sama-sama memegang nomor, sedangkan perkara_id hanya ada
-- bila halamannya sempat membaca SIPP. perkara_id tetap disimpan bila ada.
-- Nomor disimpan sudah dinormalkan (titik di ujung dibuang - arsip SIPP
-- menulis nomor berekor titik).
--
-- bagian adalah kunci bebas yang stabil ("saksi-1:3", "saksi-T1:2",
-- "alasan:f", "umum"); kutipan adalah potongan kalimat yang dikomentari,
-- disimpan supaya komentar tetap terbaca walau BAS-nya kemudian berubah.
--
-- =============================================================================
-- aleta_templat_hukum - SEMUA BENIH ADALAH DRAF
-- =============================================================================
--
-- jenis 'pertimbangan' berkunci status putusan (gugur, dicabut, verstek,
-- tidak-diterima); jenis 'pasal' berkunci huruf alasan perceraian. Butir
-- dianggap SAH hanya bila disahkan_pada terisi - diturunkan, tidak disimpan
-- sebagai kolom keadaan kedua yang dapat berselisih. Menyunting isi atau
-- judul MENGHAPUS pengesahan (kembali DRAF): pengesahan melekat pada kalimat
-- yang dibaca pimpinan, bukan pada barisnya.
--
-- Penghapusan LUNAK (dihapus_pada): benih ditanam dengan id tetap dan
-- ON CONFLICT DO NOTHING, jadi benih yang dihapus Super Admin tidak tumbuh
-- lagi pada mulai ulang berikutnya. Tidak ada UNIQUE(jenis, kunci) di basis
-- data karena baris terhapus tetap ada; keunikan di antara yang hidup dijaga
-- modulnya.
--
-- =============================================================================
-- aleta_abt_variabel_wajib - PERINGATAN, BUKAN PENAHAN CETAK
-- =============================================================================
--
-- Satu baris per (jenis perkara, kode variabel ABT). sumber 'ukur' = hasil
-- ukur atas putusan (abt_data_teks/abt_data_tanggal perkara yang sudah
-- diputus, lewat jembatan bot BACA-SAJA); sumber 'admin' = ditambahkan Super
-- Admin. ditetapkan_admin = 1 berarti saklar aktif dipegang Super Admin dan
-- TIDAK ditimpa oleh ukur ulang. Persen tidak disimpan - dihitung dari
-- jumlah_terisi / jumlah_perkara supaya tidak ada angka ketiga yang berselisih.
--
-- jenis disimpan dalam bentuk kunci (huruf kecil, tanpa tanda baca);
-- jenis_nama menyimpan tulisan aslinya untuk layar.
--
-- Waktu disimpan sebagai TEXT ISO, mengikuti 0050 dan 0052.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_KOMENTAR_TEMPLAT_WAJIB);
--   (c) ketiga tabel di IN_MEMORY_TABLE_PERSISTENCE_ORDER (client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/komentar-templat-wajib-skema.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_bas_komentar (
  id TEXT PRIMARY KEY,
  nomor_perkara TEXT NOT NULL,
  perkara_id TEXT,
  sidang_ke INTEGER,
  bagian TEXT NOT NULL,
  kutipan TEXT NOT NULL DEFAULT '',
  isi TEXT NOT NULL,
  penulis_id TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL,
  selesai SMALLINT NOT NULL DEFAULT 0 CHECK (selesai IN (0, 1)),
  diselesaikan_oleh TEXT NOT NULL DEFAULT '',
  diselesaikan_pada TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_templat_hukum (
  id TEXT PRIMARY KEY,
  jenis TEXT NOT NULL CHECK (jenis IN ('pertimbangan', 'pasal')),
  kunci TEXT NOT NULL,
  judul TEXT NOT NULL,
  isi TEXT NOT NULL,
  benih SMALLINT NOT NULL DEFAULT 0 CHECK (benih IN (0, 1)),
  disahkan_oleh TEXT NOT NULL DEFAULT '',
  disahkan_pada TEXT NOT NULL DEFAULT '',
  dihapus_pada TEXT NOT NULL DEFAULT '',
  dibuat_oleh TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL,
  diubah_oleh TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_abt_variabel_wajib (
  jenis TEXT NOT NULL,
  kode TEXT NOT NULL,
  jenis_nama TEXT NOT NULL DEFAULT '',
  nama TEXT NOT NULL DEFAULT '',
  sumber TEXT NOT NULL CHECK (sumber IN ('ukur', 'admin')),
  jumlah_perkara INTEGER,
  jumlah_terisi INTEGER,
  aktif SMALLINT NOT NULL DEFAULT 1 CHECK (aktif IN (0, 1)),
  ditetapkan_admin SMALLINT NOT NULL DEFAULT 0 CHECK (ditetapkan_admin IN (0, 1)),
  diukur_pada TEXT NOT NULL DEFAULT '',
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_pada TEXT NOT NULL,
  PRIMARY KEY (jenis, kode)
);

CREATE INDEX IF NOT EXISTS idx_bas_komentar_nomor ON aleta_bas_komentar(nomor_perkara, dibuat_pada);

CREATE INDEX IF NOT EXISTS idx_templat_hukum_jenis ON aleta_templat_hukum(jenis, kunci);
