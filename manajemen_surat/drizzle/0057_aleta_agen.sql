-- =============================================================================
-- AGEN ALETA - TAHAP 1 (SUPER ADMIN + HAKIM)
-- =============================================================================
--
-- 4 Oktober 2026. Agen mengerjakan tugas peran menurut jadwal (harian sampai
-- tahunan) memakai fitur ALETA yang sudah ada, dan SELALU memberitahukan apa
-- yang dikerjakannya. Gambaran & planning:
-- D:/aleta-dev/kerja/agen-aleta/agen-aleta.html.
--
-- Tiga kelas tindakan: A otomatis penuh (dapat diurungkan), B otomatis dengan
-- tenggang 10 menit, C satu ketukan. Keputusan pengguna 4 Okt: tindakan hukum
-- (penetapan, unggah putusan, TTE) SELALU kelas C.
--
-- Tiga tabel:
--   aleta_agen_jejak    satu baris per tindakan agen (termasuk yang dicoba,
--                       dibatalkan, diurungkan). JUJUR: siapa, kapan, apa,
--                       sistem mana, sebelum -> sesudah. Tanpa sandi/isi berkas.
--   aleta_agen_antrean  pekerjaan yang akan dikerjakan (B) atau menunggu
--                       ketukan (C), juga dibaca agen ekstensi.
--   aleta_agen_setelan  kelas & aktif per (peran, tugas), diatur Super Admin.
--
-- Akses HANYA lewat src/server/modules/aleta-ecourt/agen/.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_AGEN);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/agen-tahap1.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_agen_jejak (
  id TEXT PRIMARY KEY,
  pengguna_id TEXT NOT NULL,
  pengguna_nama TEXT NOT NULL DEFAULT '',
  peran TEXT NOT NULL,
  tugas TEXT NOT NULL,
  kelas TEXT NOT NULL CHECK (kelas IN ('A', 'B', 'C')),
  sistem TEXT NOT NULL CHECK (sistem IN ('aleta', 'sipp', 'abt', 'ecourt')),
  nomor_perkara TEXT NOT NULL DEFAULT '',
  ringkas TEXT NOT NULL,
  rincian TEXT NOT NULL DEFAULT '',
  sebelum_json TEXT NOT NULL DEFAULT '',
  sesudah_json TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('dikerjakan', 'dicoba', 'gagal', 'dibatalkan', 'diurungkan', 'diketuk')),
  alasan TEXT NOT NULL DEFAULT '',
  alamat_ip TEXT NOT NULL DEFAULT '',
  lewat TEXT NOT NULL DEFAULT 'ALETA',
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_agen_antrean (
  id TEXT PRIMARY KEY,
  pengguna_id TEXT NOT NULL,
  peran TEXT NOT NULL,
  tugas TEXT NOT NULL,
  kelas TEXT NOT NULL CHECK (kelas IN ('B', 'C')),
  sistem TEXT NOT NULL CHECK (sistem IN ('aleta', 'sipp', 'abt', 'ecourt')),
  nomor_perkara TEXT NOT NULL DEFAULT '',
  kunci TEXT NOT NULL,
  ringkas TEXT NOT NULL,
  rincian TEXT NOT NULL DEFAULT '',
  muatan_json TEXT NOT NULL DEFAULT '{}',
  jadwal_pada TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('menunggu', 'dikerjakan', 'dibatalkan', 'kedaluwarsa')),
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_agen_setelan (
  peran TEXT NOT NULL,
  tugas TEXT NOT NULL,
  kelas TEXT NOT NULL CHECK (kelas IN ('A', 'B', 'C')),
  aktif INTEGER NOT NULL DEFAULT 1,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_pada TEXT NOT NULL,
  PRIMARY KEY (peran, tugas)
);

CREATE INDEX IF NOT EXISTS idx_agen_jejak_pengguna ON aleta_agen_jejak(pengguna_id, dibuat_pada);

CREATE INDEX IF NOT EXISTS idx_agen_jejak_tugas ON aleta_agen_jejak(tugas, dibuat_pada);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agen_antrean_kunci ON aleta_agen_antrean(pengguna_id, kunci);

CREATE INDEX IF NOT EXISTS idx_agen_antrean_status ON aleta_agen_antrean(pengguna_id, status);
