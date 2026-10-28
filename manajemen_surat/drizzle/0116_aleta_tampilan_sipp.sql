-- =============================================================================
-- TAMPILAN ALETA DI HALAMAN SIPP - ATURAN PER PERAN DAN PER PENGGUNA (28 Oktober 2026)
-- =============================================================================
--
-- Admin/Super Admin mengatur elemen ALETA mana yang tampil di halaman SIPP: per golongan peran, dan dapat
-- menimpa per pengguna. Tiap elemen = "boleh" (pengguna boleh menyalakan/mematikan) + bawaan, "selalu", atau
-- "tidak". Katalog elemen dan pemecahnya di src/lib/tampilan-sipp.ts; pilihan pengguna sendiri disimpan di
-- aleta_ekstensi_setelan (kunci "tampilan.sipp"), bukan di sini.
--
--   aleta_tampilan_sipp_aturan   satu baris per sasaran: lingkup ('peran' | 'pengguna'), sasaran (golongan
--                                atau id pengguna), aturan (JSON {kunciElemen: {mode, bawaan}}), catatan,
--                                diubah_oleh (akun), diubah_pada (ISO UTC).
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modulnya (src/server/modules/aleta-ecourt/tampilan-sipp.ts).
--
-- NOMOR: 0116 (idx 102) diklaim 28 Okt 2026.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_TAMPILAN_SIPP);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/tampilan-sipp-peran-28okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_tampilan_sipp_aturan (
  lingkup TEXT NOT NULL,
  sasaran TEXT NOT NULL,
  aturan TEXT NOT NULL DEFAULT '{}',
  catatan TEXT NOT NULL DEFAULT '',
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_pada TEXT NOT NULL,
  PRIMARY KEY (lingkup, sasaran)
);

CREATE INDEX IF NOT EXISTS idx_tampilan_sipp_aturan_pada ON aleta_tampilan_sipp_aturan(diubah_pada);
