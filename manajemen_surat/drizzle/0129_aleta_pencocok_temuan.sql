-- =============================================================================
-- PENCOCOK DATA SIPP - ABT - e-COURT: TEMUAN PER PERKARA (N3, 1 November 2026)
-- =============================================================================
--
-- Perkara yang datanya BERBEDA antar sistem (tanggal putus, kehadiran, pihak/kuasa, majelis/PP, jadwal vs Court
-- Calendar, dokumen e-Court yang belum masuk e-Doc SIPP, biaya, tahapan). Hanya membaca dan menandai - perbaikan
-- tetap lewat tombol yang sudah ada. Aturan: src/lib/pencocok-data.ts; penulis: src/server/modules/pencocok/layanan.ts.
--
--   aleta_pencocok_temuan   satu baris per (perkara, jenis temuan): tingkat (tinggi | sedang | rendah), ringkas,
--                           sisi (JSON [{sumber, nilai}] - NIK tersamar), majelis/panitera (teks petugas untuk
--                           penyaringan "perkara saya"), sidik (sidik isi - baris yang isinya sama TIDAK ditulis ulang),
--                           pertama_terlihat (kapan pertama kali ditemukan), diperiksa_pada (ISO UTC).
--
-- Perkara yang cocok TIDAK punya baris (baris dihapus bila temuannya hilang). Tanpa kunci asing dan tanpa CHECK:
-- nilai yang sah dijaga modulnya. Waktu putaran dan ringkasannya disimpan di aleta_ekstensi_setelan (tanpa tabel).
--
-- NOMOR: 0129 (journal idx 113) diklaim 1 Nov 2026 di D:/Aplikasi/aleta/tmp/klaim-1nov.txt (agen N3). CELAH idx 106-112
-- adalah milik cabang lain (0122 I2, 0123 I1, 0124 J1, 0125 N4, 0126 P2, 0127 N2; idx 112 kosong) - jurnal berurutan
-- setelah semua cabang digabung; sebelum itu penjaga "entri berurutan tanpa lubang" memang menyala di cabang ini.
--
-- TIGA TEMPAT PENDAFTARAN: berkas ini + meta/_journal.json; DDL_PENCOCOK_TEMUAN di src/server/db/schema.ts; tabelnya
-- di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts). Kesamaannya dijaga src/test/agen-pencocok-1nov.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_pencocok_temuan (
  perkara_id TEXT NOT NULL,
  jenis TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  tingkat TEXT NOT NULL DEFAULT 'sedang',
  ringkas TEXT NOT NULL DEFAULT '',
  sisi TEXT NOT NULL DEFAULT '[]',
  majelis TEXT NOT NULL DEFAULT '',
  panitera TEXT NOT NULL DEFAULT '',
  sidik TEXT NOT NULL DEFAULT '',
  pertama_terlihat TEXT NOT NULL,
  diperiksa_pada TEXT NOT NULL,
  PRIMARY KEY (perkara_id, jenis)
);

CREATE INDEX IF NOT EXISTS idx_pencocok_temuan_tingkat ON aleta_pencocok_temuan(tingkat, diperiksa_pada);
CREATE INDEX IF NOT EXISTS idx_pencocok_temuan_jenis ON aleta_pencocok_temuan(jenis, tingkat);
