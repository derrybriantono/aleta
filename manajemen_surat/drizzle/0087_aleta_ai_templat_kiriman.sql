-- =============================================================================
-- ALETA Ai TAHAP 3: TEMPLAT PROYEK V4.5 DAN KIRIMAN KE ALUR ALETA (25 Okt 2026)
-- =============================================================================
--
--   aleta_ai_proyek_berkas  isi templat proyek V4.5 (HTML/RTF/DOCX/XLSX) per
--                           versi proyek, disimpan saat Super Admin mengunggah
--                           ZIP (tahap 1 hanya mencatat nama lampiran). Templat
--                           TIDAK ada di repo: selalu dibaca dari sini.
--                           `isi` = base64.
--   aleta_ai_kiriman        hasil tugas yang DIUSULKAN untuk Blangko ABT by
--                           Derry (isian), Draf H-7, atau BAS. Hanya berlaku
--                           sesudah petugas menekan tombol dan MENGONFIRMASI
--                           (status 'dikonfirmasi'); alur tujuan membacanya,
--                           petugas yang menyimpan. ALETA Ai tidak pernah
--                           menulis langsung ke SIPP/ABT/e-Court. `nilai`
--                           TERENKRIPSI dan bebas kata "ALETA".
--
-- Tanpa kunci asing dan tanpa CHECK: nilai sah dijaga modul.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib:
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_ALETA_AI_TEMPLAT_KIRIMAN);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_ai_proyek_berkas (
  id TEXT PRIMARY KEY,
  proyek_id TEXT NOT NULL,
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL,
  ukuran INTEGER NOT NULL DEFAULT 0,
  isi TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_kiriman (
  id TEXT PRIMARY KEY,
  tugas_id TEXT NOT NULL,
  pemilik_id TEXT NOT NULL,
  tujuan TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  nilai TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'menunggu-konfirmasi',
  dikonfirmasi_oleh TEXT NOT NULL DEFAULT '',
  dikonfirmasi_at TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_proyek_berkas_proyek ON aleta_ai_proyek_berkas(proyek_id);
CREATE INDEX IF NOT EXISTS idx_ai_kiriman_tujuan ON aleta_ai_kiriman(tujuan, nomor_perkara, status);
CREATE INDEX IF NOT EXISTS idx_ai_kiriman_tugas ON aleta_ai_kiriman(tugas_id);
