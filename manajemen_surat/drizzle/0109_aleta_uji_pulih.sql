-- =============================================================================
-- UJI PULIH CADANGAN (25 Okt 2026, Bagian 6d)
-- =============================================================================
--
-- Hasil uji mingguan: cadangan ALETA terbaru dipulihkan ke basis data SEMENTARA,
-- diperiksa, lalu basis data sementara dihapus. Satu baris per percobaan.
--
--   aleta_uji_pulih   status 'berjalan' | 'berhasil' | 'gagal'; tingkat 'baik' |
--                     'peringatan' | 'gagal'; pemicu 'jadwal' | 'manual';
--                     dibersihkan 1 = basis data sementara dan folder kerja sudah
--                     dihapus; rincian = JSON langkah, tabel yang dibandingkan,
--                     migrasi. Tidak memuat sandi, isi cadangan, atau data perkara.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul
-- (src/server/modules/keamanan/uji-pulih.ts). Waktu ISO UTC sebagai TEXT.
-- Fitur MATI bawaan (setelan pulih.aktif di aleta_setelan_keamanan, 0107).
--
-- NOMOR: 0109 (cadangan laptop Bagian 6: 0107, 0108, 0109).
-- TIGA TEMPAT PENDAFTARAN: berkas ini + meta/_journal.json; DDL_UJI_PULIH
-- di src/server/db/schema.ts; tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_uji_pulih (
  id TEXT PRIMARY KEY,
  mulai_pada TEXT NOT NULL,
  selesai_pada TEXT NOT NULL DEFAULT '',
  pemicu TEXT NOT NULL DEFAULT 'manual',
  oleh TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'berjalan',
  tingkat TEXT NOT NULL DEFAULT '',
  bundel TEXT NOT NULL DEFAULT '',
  berkas TEXT NOT NULL DEFAULT '',
  pesan TEXT NOT NULL DEFAULT '',
  durasi_ms INTEGER NOT NULL DEFAULT 0,
  dibersihkan INTEGER NOT NULL DEFAULT 0,
  rincian TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_uji_pulih_waktu ON aleta_uji_pulih(mulai_pada);
