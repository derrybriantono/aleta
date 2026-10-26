-- =============================================================================
-- BATAS JARINGAN PER PERAN (25 Okt 2026, Bagian 6b)
-- =============================================================================
--
-- Daftar jaringan kantor dan aturan per peran. TANPA baris = bawaan: semua peran
-- boleh masuk dari mana pun, sehingga perilakunya sama dengan sebelum fitur ini.
--
--   aleta_subnet_kantor          jaringan kantor dalam bentuk CIDR yang sudah baku
--                                (mis. 192.168.10.0/24, atau satu alamat /32).
--   aleta_aturan_jaringan_peran  satu baris per peran yang DIBATASI:
--                                aturan = 'kantor-saja' atau 'luar-kantor-verifikasi'.
--                                Peran tanpa baris = 'mana-pun'.
--
-- Penolakan masuk dicatat di aleta_jejak_masuk (0085) sebagai peristiwa
-- MASUK_DITOLAK_JARINGAN; kolom peristiwa berupa TEXT sehingga tidak ada ubahan
-- di tabel itu.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul
-- (src/server/modules/keamanan/jaringan.ts). Waktu ISO UTC sebagai TEXT.
--
-- NOMOR: 0108 (cadangan laptop Bagian 6: 0107, 0108, 0109).
-- TIGA TEMPAT PENDAFTARAN: berkas ini + meta/_journal.json; DDL_BATAS_JARINGAN
-- di src/server/db/schema.ts; tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_subnet_kantor (
  id TEXT PRIMARY KEY,
  cidr TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  aktif INTEGER NOT NULL DEFAULT 1,
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_aturan_jaringan_peran (
  role_id TEXT PRIMARY KEY,
  aturan TEXT NOT NULL DEFAULT 'mana-pun',
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_pada TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subnet_kantor_cidr ON aleta_subnet_kantor(cidr);
