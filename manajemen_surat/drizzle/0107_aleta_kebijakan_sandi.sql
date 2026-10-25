-- =============================================================================
-- KEBIJAKAN SANDI + SETELAN KEAMANAN (25 Okt 2026, Bagian 6a)
-- =============================================================================
--
-- Saklar "Kebijakan sandi" di Pengaturan Keamanan, MATI bawaan. Selama mati,
-- aturan sandi persis seperti sebelumnya; tabel di sini hanya mencatat.
--
--   aleta_setelan_keamanan  kunci-nilai untuk semua saklar keamanan Bagian 6
--                           (sandi.*, pengaman.*, pulih.*). Tanpa baris = bawaan.
--   aleta_riwayat_sandi     sidik sandi LAMA per akun (HMAC-SHA256 berkunci id
--                           akun) agar "larang pakai ulang N sandi terakhir"
--                           dapat diperiksa. Sandi asli TIDAK pernah disimpan.
--   aleta_status_sandi      kapan sandi terakhir diganti, di bawah kebijakan
--                           versi berapa, dan apakah akun dipaksa ganti sandi
--                           pada masuk berikutnya.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul
-- (src/server/modules/keamanan/). Waktu ISO UTC sebagai TEXT.
--
-- NOMOR: 0107 (cadangan laptop Bagian 6: 0107, 0108, 0109).
-- TIGA TEMPAT PENDAFTARAN: berkas ini + meta/_journal.json; DDL_KEBIJAKAN_SANDI
-- di src/server/db/schema.ts; tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_setelan_keamanan (
  kunci TEXT PRIMARY KEY,
  nilai TEXT NOT NULL DEFAULT '',
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_pada TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_riwayat_sandi (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sidik TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_status_sandi (
  user_id TEXT PRIMARY KEY,
  diganti_pada TEXT NOT NULL DEFAULT '',
  versi_kebijakan INTEGER NOT NULL DEFAULT 0,
  paksa_ganti INTEGER NOT NULL DEFAULT 0,
  paksa_oleh TEXT NOT NULL DEFAULT '',
  paksa_pada TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_riwayat_sandi_akun ON aleta_riwayat_sandi(user_id, dibuat_pada);
