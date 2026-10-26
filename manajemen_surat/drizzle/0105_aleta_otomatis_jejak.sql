-- =============================================================================
-- JEJAK TUNDA / PUTUS OTOMATIS YANG TERSTRUKTUR (U19, 25 Okt 2026)
-- =============================================================================
--
-- Riwayat tunda otomatis dan putus otomatis selama ini hanya berupa satu blob JSON
-- per hari di aleta_ekstensi_setelan ('sistem:tunda-otomatis:hari:YYYY-MM-DD' dan
-- 'sistem:putus-otomatis:hari:YYYY-MM-DD'). Blob tidak dapat dihitung: "berapa kali
-- aturan court-calendar ditolak penjaga bulan ini" tidak terjawab tanpa membuka
-- ratusan hari satu per satu.
--
--   aleta_otomatis_jejak   satu baris per (fitur, tanggal sidang, jadwal sidang):
--                          aturan yang cocok, hasil tulis, mode kering atau nyata,
--                          ditolak penjaga (bot membaca ulang lalu menolak) atau tidak,
--                          dibatalkan petugas atau tidak. Ditulis berdampingan dengan
--                          blob (blob tetap sumber logika harian), diisi ulang dari
--                          blob lama lewat isiUlangJejakOtomatis.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul
-- (src/server/modules/otomatis-jejak/). Waktu ISO UTC sebagai TEXT. Hanya nomor perkara
-- yang disimpan (tanpa nama pihak/NIK). Tidak ada yang ditulis ke SIPP/ABT/e-Court.
--
-- NOMOR: 0105 (cadangan rantai F). Di cabang ini jurnal terakhir idx 80 = 0088, jadi
-- 0105 memakai idx 81 (jurnal tanpa lubang dijaga banyak uji); idx dirapikan saat gabung.
--
-- TIGA TEMPAT PENDAFTARAN: berkas ini + meta/_journal.json; DDL_OTOMATIS_JEJAK di
-- src/server/db/schema.ts; tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER.
-- Kesamaan dijaga src/test/otomatis-jejak-25okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_otomatis_jejak (
  id TEXT PRIMARY KEY,
  fitur TEXT NOT NULL,
  tanggal TEXT NOT NULL,
  jadwal_id TEXT NOT NULL,
  perkara_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  jenis_perkara TEXT NOT NULL DEFAULT '',
  keputusan TEXT NOT NULL,
  aturan TEXT NOT NULL DEFAULT '',
  nomor_aturan INTEGER NOT NULL DEFAULT 0,
  tanggal_tunda TEXT NOT NULL DEFAULT '',
  hasil TEXT NOT NULL DEFAULT '',
  kering INTEGER NOT NULL DEFAULT 0,
  ditolak_penjaga INTEGER NOT NULL DEFAULT 0,
  dibatalkan_petugas INTEGER NOT NULL DEFAULT 0,
  pesan TEXT NOT NULL DEFAULT '',
  edoc TEXT NOT NULL DEFAULT '',
  pemicu TEXT NOT NULL DEFAULT '',
  jam TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_otomatis_jejak_kunci ON aleta_otomatis_jejak(fitur, tanggal, jadwal_id);

CREATE INDEX IF NOT EXISTS idx_otomatis_jejak_tanggal ON aleta_otomatis_jejak(tanggal);

CREATE INDEX IF NOT EXISTS idx_otomatis_jejak_aturan ON aleta_otomatis_jejak(fitur, aturan, tanggal);
