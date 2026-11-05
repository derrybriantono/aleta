-- =============================================================================
-- PEMBANDING ISI ABT UNTUK BLANGKO YANG BERBEDA (5 Nov 2026, Tahap 9)
-- =============================================================================
--
-- Sinkron dari ABT tidak menimpa blangko yang sudah diubah di ALETA ABT (aleta_abt_berkas.diubah = 1); bedanya selama ini
-- hanya tercatat sebagai sidik (bentrok_md5). Tabel ini menyimpan ISI ABT terbaru untuk blangko yang berbeda itu saja, di
-- samping isi ALETA ABT, supaya Super Admin dapat membandingkan dan memilih (layar "Beda dengan ABT").
--
--   peran   'beda'  isi ABT yang berbeda dari isi ALETA ABT dan belum ditinjau; paling banyak 3 per blangko (yang lebih lama dibuang);
--           'dasar' isi ABT yang dipertahankan ALETA ABT lewat pilihan "tetap memakai ALETA ABT"; satu per blangko, dipakai sebagai
--                   dasar paket ubahan (md5 = aleta_abt_berkas.md5_asal).
--   Baris dibuang bila bedanya selesai (diambil dari ABT, ABT kembali sama, atau blangko tidak lagi berbeda).
--   Isi hanya untuk blangko yang berbeda, bukan salinan seluruh ABT, supaya disk server tidak terisi.
--
-- Tidak ada yang ditulis ke ABT/SIPP. Pengaturan jadwal dan catatan putarannya memakai aleta_ekstensi_setelan (tanpa tabel).
--
-- NOMOR: 0136, jurnal idx 118 (sesudah 0135/idx 117). TIGA TEMPAT: (a) berkas ini + meta/_journal.json;
-- (b) DDL_ALETA_ABT_BANDING di src/server/db/schema.ts; (c) IN_MEMORY_TABLE_PERSISTENCE_ORDER di src/server/db/client.ts.
-- Tanpa kunci asing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_abt_berkas_banding (
  id TEXT PRIMARY KEY,
  berkas_id TEXT NOT NULL,
  md5 TEXT NOT NULL,
  peran TEXT NOT NULL DEFAULT 'beda',
  isi TEXT NOT NULL DEFAULT '',
  pengkodean TEXT NOT NULL DEFAULT 'latin1',
  ukuran INTEGER NOT NULL DEFAULT 0,
  penanda_asal TEXT NOT NULL DEFAULT '[]',
  diambil_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_abt_banding_berkas_md5 ON aleta_abt_berkas_banding(berkas_id, md5);
CREATE INDEX IF NOT EXISTS idx_abt_banding_peran ON aleta_abt_berkas_banding(berkas_id, peran);
