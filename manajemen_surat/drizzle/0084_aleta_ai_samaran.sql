-- =============================================================================
-- ALETA Ai TAHAP 2a: KODE SAMARAN PER PERCAKAPAN (23 Okt 2026)
-- =============================================================================
--
-- Penyamaran dua arah (rencana ALETA Ai v2 bagian 4): nama, NIK, alamat rinci,
-- telepon, email, dan nomor rekening diganti kode ([NAMA-1], [NIK-1], ...)
-- sebelum dikirim ke layanan AI, lalu dikembalikan pada jawaban. Supaya kode
-- tetap sama sepanjang SATU percakapan, pasangannya disimpan di sini.
--
--   aleta_ai_samaran   satu baris per (percakapan, kode). `asli` TERENKRIPSI
--                      (AES-256-GCM, mekanisme yang sama dengan isi pesan);
--                      hanya dibaca server untuk percakapan milik pemiliknya.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai sah dijaga modul
-- (src/server/modules/aleta-ai/samaran.ts). Tidak ada yang ditulis ke SIPP.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib:
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_ALETA_AI_SAMARAN);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/aleta-ai-tahap2a-23okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_ai_samaran (
  id TEXT PRIMARY KEY,
  percakapan_id TEXT NOT NULL,
  kode TEXT NOT NULL,
  jenis TEXT NOT NULL,
  asli TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_samaran_kode ON aleta_ai_samaran(percakapan_id, kode);
