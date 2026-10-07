-- =============================================================================
-- JEJAK MASUK ALETA DENGAN AKUN SIPP
-- =============================================================================
--
-- 7 Oktober 2026 - rencana yang disetujui 6 Oktober malam
-- (D:/aleta-dev/kerja/masuk-satu-akun-sipp/RENCANA.md). Satu baris per
-- percobaan masuk lewat POST /api/auth/sign-in/sipp yang benar-benar memeriksa
-- password (akun bertautan SIPP): berhasil lewat SIPP, berhasil lewat password
-- ALETA, ditolak (salah, akun SIPP diblokir/kedaluwarsa), atau dibatasi.
--
-- Akses HANYA lewat src/server/modules/portal/masuk-sipp-plugin.ts.
--
-- JUJUR DAN DI SISI ALETA: siapa (aleta_user_id), akun SIPP mana
-- (username_sipp, sipp_user_id), lewat apa, hasilnya, dari mana. Tidak ada
-- satu baris pun yang ditulis ke SIPP - pemeriksaannya murni membaca sys_users.
--
-- YANG TIDAK PERNAH MASUK TABEL INI: password (SIPP maupun ALETA), sidik
-- password, kode aktivasi SIPP. identitas disamarkan ("bu***") - id akunnya
-- sudah menyebut siapa. Dijaga src/test/masuk-akun-sipp.test.ts.
--
-- Waktu disimpan sebagai TEXT ISO, mengikuti 0050-0056.
--
-- NOMOR: 0058 diklaim 7 Okt 2026 (0057 milik Agen ALETA tahap 1, belum
-- di-commit). Selama 0057 belum masuk, entri jurnalnya ber-idx 57 supaya
-- jurnal tanpa lubang; ketika 0057 digabung, entri ini menjadi idx 58. Nilai
-- "when"-nya sengaja lebih besar daripada yang lazim untuk 0057.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_MASUK_JEJAK);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/masuk-akun-sipp.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_masuk_jejak (
  id TEXT PRIMARY KEY,
  aleta_user_id TEXT,
  identitas TEXT NOT NULL DEFAULT '',
  username_sipp TEXT NOT NULL DEFAULT '',
  sipp_user_id TEXT NOT NULL DEFAULT '',
  lewat TEXT NOT NULL DEFAULT '' CHECK (lewat IN ('', 'sipp', 'aleta')),
  hasil TEXT NOT NULL CHECK (hasil IN ('berhasil', 'ditolak', 'dibatasi')),
  alasan TEXT NOT NULL DEFAULT '',
  alamat_ip TEXT NOT NULL DEFAULT '',
  agen_peramban TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_masuk_jejak_pengguna ON aleta_masuk_jejak(aleta_user_id, dibuat_pada);
