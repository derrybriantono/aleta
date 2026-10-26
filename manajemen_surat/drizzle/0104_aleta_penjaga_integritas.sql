-- =============================================================================
-- PENJAGA INTEGRITAS BERKAS WEBSITE/SIPP/ABT (E6, 25 Okt 2026)
-- =============================================================================
--
-- Latar: surat Dirjen soal judi online di website satker. ALETA mencatat sidik
-- (sha256, ukuran, waktu ubah) berkas di folder yang didaftarkan Super Admin
-- dan memberi peringatan bila ada berkas .php baru/berubah, .php di folder
-- unggahan, pola webshell, atau kata judol. Folder HANYA DIBACA; tidak ada yang
-- ditulis, dipindah, atau dihapus di sana. Isi berkas mencurigakan TIDAK
-- disalin ke basis data: temuan hanya menyimpan jalur, jenis, nama aturan,
-- nomor baris, ukuran, dan sha256.
--
--   aleta_integritas_berkas  baseline per folder: jalur relatif, sha256, ukuran,
--                            waktu ubah. Dasar pembeda "baru" dan "berubah".
--   aleta_integritas_temuan  satu baris per (folder, jalur, jenis, aturan);
--                            status baru / ditangani / aman.
--   aleta_integritas_aman    daftar "diketahui aman": sha256 yang sudah diperiksa
--                            manusia (mis. pembaruan resmi). Berkas dengan sha256
--                            itu tidak lagi dianggap berubah/baru.
--   aleta_integritas_pindai  riwayat pemindaian (90 hari).
--
-- Saklar, daftar folder, URL halaman publik, selang, dan peringatan WhatsApp
-- disimpan di aleta_ekstensi_setelan (pengguna *sistem*), MATI bawaan.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai sah dijaga modul
-- (src/server/modules/integritas/*). Waktu ISO UTC sebagai TEXT.
--
-- NOMOR: rantai E memegang 0094, 0095, 0104. Jurnal memakai idx sementara 83
-- (menyambung 82 agar uji "idx = urutan" tetap hijau); dirapikan saat gabung akhir.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_PENJAGA_INTEGRITAS);
--   (c) tabel-tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_integritas_berkas (
  folder_id TEXT NOT NULL,
  jalur TEXT NOT NULL,
  sha256 TEXT NOT NULL DEFAULT '',
  ukuran INTEGER NOT NULL DEFAULT 0,
  diubah_at TEXT NOT NULL DEFAULT '',
  dilihat_at TEXT NOT NULL,
  PRIMARY KEY (folder_id, jalur)
);

CREATE TABLE IF NOT EXISTS aleta_integritas_temuan (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL,
  jalur TEXT NOT NULL,
  jenis TEXT NOT NULL,
  aturan TEXT NOT NULL DEFAULT '',
  baris INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',
  ukuran INTEGER NOT NULL DEFAULT 0,
  pertama_at TEXT NOT NULL,
  terakhir_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'baru',
  ditangani_oleh TEXT NOT NULL DEFAULT '',
  ditangani_at TEXT NOT NULL DEFAULT '',
  diperingatkan_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_integritas_aman (
  folder_id TEXT NOT NULL,
  jalur TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  alasan TEXT NOT NULL DEFAULT '',
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  PRIMARY KEY (folder_id, jalur, sha256)
);

CREATE TABLE IF NOT EXISTS aleta_integritas_pindai (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL,
  jenis TEXT NOT NULL DEFAULT 'rutin',
  mulai_at TEXT NOT NULL,
  selesai_at TEXT NOT NULL DEFAULT '',
  jumlah_berkas INTEGER NOT NULL DEFAULT 0,
  temuan_baru INTEGER NOT NULL DEFAULT 0,
  galat TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integritas_temuan_kunci ON aleta_integritas_temuan(folder_id, jalur, jenis, aturan);
CREATE INDEX IF NOT EXISTS idx_integritas_temuan_status ON aleta_integritas_temuan(status, terakhir_at);
CREATE INDEX IF NOT EXISTS idx_integritas_pindai_mulai ON aleta_integritas_pindai(folder_id, mulai_at);
