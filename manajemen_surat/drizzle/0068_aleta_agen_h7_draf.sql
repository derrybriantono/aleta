-- =============================================================================
-- AGEN H-7 DRAF PUTUSAN (F4.2, 17 Oktober 2026)
-- =============================================================================
--
-- Tiap pagi agen ALETA menyiapkan draf putusan untuk perkara yang Hari
-- Putusan-nya jatuh tujuh hari lagi (dan memperbarui yang lebih dekat):
-- blangko Derry yang dipilih, golongan tiap isian (sudah di ABT / disiapkan
-- agen / usulan / perlu manusia), ringkasan duduk perkara, jawab-menjawab,
-- bukti, saksi, kesimpulan, dan kesiapannya. Aturannya di
-- src/lib/agen-h7-putusan.ts. TIDAK ADA yang ditulis ke SIPP maupun ABT.
--
-- aleta_agen_h7_draf   satu draf per perkara per Hari Putusan (kunci
--                      perkara_id + tanggal_sidang). ringkas_json untuk
--                      Jadwal Sidang/checklist/widget, draf_json utuh.
-- aleta_agen_h7_jalan  catatan tiap jalan agen (terjadwal atau dari tombol):
--                      kapan, berapa diperiksa/dibuat/diperbarui/gagal.
--
-- NOMOR: 0068 (idx 65) diklaim 17 Okt 2026 oleh agen F4.2 (branch fitur-f42
-- dari integrasi-1204). Lihat memori migrasi-0039-diklaim.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_AGEN_H7);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/agen-h7-putusan-f42.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_agen_h7_draf (
  perkara_id TEXT NOT NULL,
  tanggal_sidang TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  jenis_perkara TEXT NOT NULL DEFAULT '',
  alasan TEXT NOT NULL DEFAULT '',
  tingkat TEXT NOT NULL DEFAULT '',
  persen INTEGER NOT NULL DEFAULT 0,
  ringkas_json TEXT NOT NULL DEFAULT '{}',
  draf_json TEXT NOT NULL DEFAULT '{}',
  dibuat_pada TEXT NOT NULL,
  diperbarui_pada TEXT NOT NULL,
  jalan_id TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (perkara_id, tanggal_sidang)
);

CREATE TABLE IF NOT EXISTS aleta_agen_h7_jalan (
  id TEXT PRIMARY KEY,
  tanggal TEXT NOT NULL,
  pemicu TEXT NOT NULL DEFAULT '',
  oleh TEXT NOT NULL DEFAULT '',
  mulai TEXT NOT NULL,
  selesai TEXT NOT NULL DEFAULT '',
  diperiksa INTEGER NOT NULL DEFAULT 0,
  dibuat INTEGER NOT NULL DEFAULT 0,
  diperbarui INTEGER NOT NULL DEFAULT 0,
  gagal INTEGER NOT NULL DEFAULT 0,
  galat TEXT NOT NULL DEFAULT ''
);
