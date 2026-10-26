-- =============================================================================
-- KATALOG SAKSI DI BASIS DATA DENGAN VERSI (25 Okt 2026, rantai C, butir C4 = U8)
-- =============================================================================
--
-- Katalog Susun saksi dahulu tertanam di ekstensi (saksi-katalog-jenis/*.json),
-- jadi perbaikan satu kalimat menunggu rilis ekstensi. Tabel ini menyimpan
-- PENIMPA berversi untuk katalog itu:
--
--   aleta_saksi_katalog         satu baris per kunci katalog yang pernah
--                               disunting: versi_aktif (0 = pakai bawaan JSON
--                               di ekstensi), siapa dan kapan terakhir mengubah.
--   aleta_saksi_katalog_versi   riwayat versi: isi JSON utuh, sidik, catatan.
--                               Versi tidak pernah dihapus atau diubah; yang
--                               berganti hanya versi_aktif (aktifkan / kembali
--                               ke bawaan). Satu perkara memakai versi yang
--                               tercatat di aleta_saksi_butir.versi_katalog (0091).
--
-- SAKLAR: butir katalog Fitur Satker "katalog-saksi-basis-data" (bawaan MATI).
-- Mati = portal tidak menyajikan penimpa; ekstensi memakai JSON tertanamnya
-- seperti sebelum tabel ini ada. Menyunting dan menyimpan versi tetap boleh
-- (draf berversi) tetapi belum berlaku sampai saklar menyala DAN versi aktif.
-- Hak menyunting: Super Admin, ditambah akun yang didaftarkan di setelan sistem
-- "sistem:penyunting-katalog-saksi" (mis. akun Derry).
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul
-- (src/server/modules/aleta-ecourt/saksi-katalog-db.ts). Waktu ISO UTC sebagai TEXT.
--
-- NOMOR: 0093 milik rantai C. Di cabang ini jurnal terakhir idx 81 = 0091, jadi 0093
-- memakai idx 82 (jurnal harus tanpa lubang; idx DIRAPIKAN saat gabung akhir).
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_SAKSI_KATALOG);
--   (c) kedua tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/katalog-saksi-db-25okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_saksi_katalog (
  kunci TEXT PRIMARY KEY,
  judul TEXT NOT NULL DEFAULT '',
  versi_aktif INTEGER NOT NULL DEFAULT 0,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_nama TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_saksi_katalog_versi (
  id TEXT PRIMARY KEY,
  kunci TEXT NOT NULL,
  versi INTEGER NOT NULL,
  isi_json TEXT NOT NULL,
  sidik TEXT NOT NULL DEFAULT '',
  catatan TEXT NOT NULL DEFAULT '',
  dasar_versi INTEGER NOT NULL DEFAULT 0,
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dibuat_nama TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saksi_katalog_versi_kunci ON aleta_saksi_katalog_versi(kunci, versi);
