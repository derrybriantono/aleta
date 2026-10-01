-- =============================================================================
-- JEJAK AKSI e-COURT LEWAT SESI PRIBADI
-- =============================================================================
--
-- Perbaikan 1 Oktober 2026 (butir E9, E10, 16b; kontrak K5 dan K6 di
-- D:/aleta-dev/kerja/perbaikan-1okt/KONTRAK.md). Satu baris per aksi yang
-- diminta seorang pengguna ALETA ke e-Court memakai sesi e-Court akunnya
-- sendiri: sambung/putus sesi, unduh lewat sesi, verifikasi majelis, TTE
-- salinan putusan, unggah salinan putusan.
--
-- Akses HANYA lewat src/server/modules/aleta-ecourt/ecourt-aksi.ts.
--
-- JUJUR, BUKAN MENYAMAR (keputusan pengguna 26 Sep 2026): siapa (pengguna_id,
-- pengguna_nama), dari mana (alamat_ip), lewat apa (lewat = 'ALETA'), akun
-- e-Court mana (akun_ecourt), perkara, hasil, dan alasan bila gagal.
--
-- YANG TIDAK PERNAH MASUK TABEL INI: passphrase TTE, sandi e-Court, cookie
-- sesi, isi berkas. Dijaga src/test/ecourt-aksi-1okt.test.ts.
--
-- Waktu disimpan sebagai TEXT ISO, mengikuti 0050, 0052, 0053, dan 0054.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_ECOURT_AKSI_JEJAK);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/ecourt-aksi-1okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_ecourt_aksi_jejak (
  id TEXT PRIMARY KEY,
  pengguna_id TEXT NOT NULL,
  pengguna_nama TEXT NOT NULL DEFAULT '',
  aksi TEXT NOT NULL CHECK (aksi IN ('sambung', 'putus', 'periksa', 'unduh', 'verifikasi', 'verifikasi_kering', 'tte', 'unggah_salinan')),
  peran_ecourt TEXT NOT NULL DEFAULT '',
  akun_ecourt TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  sasaran TEXT NOT NULL DEFAULT '',
  hasil TEXT NOT NULL CHECK (hasil IN ('berhasil', 'gagal', 'ditolak')),
  alasan TEXT NOT NULL DEFAULT '',
  alamat_ip TEXT NOT NULL DEFAULT '',
  lewat TEXT NOT NULL DEFAULT 'ALETA',
  dibuat_pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ecourt_aksi_jejak_pengguna ON aleta_ecourt_aksi_jejak(pengguna_id, dibuat_pada);

CREATE INDEX IF NOT EXISTS idx_ecourt_aksi_jejak_perkara ON aleta_ecourt_aksi_jejak(nomor_perkara, dibuat_pada);
