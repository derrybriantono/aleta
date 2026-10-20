-- =============================================================================
-- SK MAJELIS: MAJELIS DAPAT DIHAPUS DARI SK (soft)  -  20 Oktober 2026 (agen B1)
-- =============================================================================
--
-- Halaman admin "SK susunan majelis" kini dapat menambah, mengubah, dan
-- MENGHAPUS majelis. Penghapusan tidak membuang baris: kolom aktif = 0 menandai
-- majelis itu tidak lagi ada di SK, sehingga
--   (a) majelis bawaan (A, B, C1 - nilai awal di kode) yang dihapus tidak muncul
--       lagi dari bawaan itu, dan
--   (b) riwayat isinya tetap ada untuk dipulihkan dengan menyimpan ulang.
--
-- Data lama tetap terbaca: baris yang sudah ada otomatis aktif = 1.
--
-- Jejak perubahan (siapa, kapan, sebelum/sesudah) memakai audit_logs yang sudah
-- ada (entity_type 'sk_majelis'); tidak ada tabel baru. "Berlaku mulai" disimpan
-- di aleta_sipp_aturan_penunjukan (kunci skBerlakuMulai); tidak ada kolom baru.
--
-- NOMOR: 0079 diklaim 20 Okt 2026 (jurnal terakhir idx 71 = 0078); idx 72.
-- DDL yang sama ada di src/server/db/schema.ts (aleta_sipp_hari_sidang.aktif).
-- =============================================================================

ALTER TABLE aleta_sipp_hari_sidang
  ADD COLUMN IF NOT EXISTS aktif SMALLINT NOT NULL DEFAULT 1;
