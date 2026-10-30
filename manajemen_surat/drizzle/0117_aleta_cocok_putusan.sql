-- =============================================================================
-- PUTUSAN DI SIPP vs DOKUMEN PUTUSAN YANG DIUNGGAH - HASIL PENCOCOKAN (G4 4.3, 30 Oktober 2026)
-- =============================================================================
--
-- Sesudah putus, amar dan tanggal putusan SIPP dicocokkan dengan dokumen putusan e-Doc (hanya membaca SIPP).
-- Hasil terakhir per perkara disimpan di sini supaya (1) panel tidak membaca ulang dokumen yang sama tiap
-- dibuka, dan (2) Pusat Kesehatan dapat menyebut perkara yang berbeda. Aturan: src/lib/cocok-putusan.ts;
-- penulis: src/server/modules/aleta-ecourt/cocok-putusan.ts.
--
--   aleta_cocok_putusan   satu baris per perkara: keadaan (cocok | beda | tidak-terbaca | tanpa-dokumen |
--                         belum-putus), ringkas, rincian (JSON beda), sidik (sha256 bahan: tanggal + amar SIPP +
--                         isi dokumen - berubah = diperiksa ulang), tanggal_putusan (SIPP), diperiksa_pada (ISO UTC).
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modulnya.
--
-- NOMOR: 0117 (idx 103) diklaim 30 Okt 2026 (cabang g4-tautan-sinkron, blok 0117-0118).
--
-- TIGA TEMPAT PENDAFTARAN: berkas ini + meta/_journal.json; DDL_COCOK_PUTUSAN di src/server/db/schema.ts;
-- tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts). Kesamaannya dijaga src/test/cocok-putusan-30okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_cocok_putusan (
  perkara_id TEXT PRIMARY KEY,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  keadaan TEXT NOT NULL,
  ringkas TEXT NOT NULL DEFAULT '',
  rincian TEXT NOT NULL DEFAULT '[]',
  sidik TEXT NOT NULL DEFAULT '',
  tanggal_putusan TEXT NOT NULL DEFAULT '',
  diperiksa_pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cocok_putusan_keadaan ON aleta_cocok_putusan(keadaan, diperiksa_pada);
