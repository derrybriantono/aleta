-- =============================================================================
-- RIWAYAT KELENGKAPAN BLANGKO SEBELUM CETAK (25 Okt 2026, rantai D, butir D3 = U13)
-- =============================================================================
--
-- aleta_konseptor_blangko (0067) menyimpan HANYA laporan terakhir blangko PUTUSAN per
-- perkara untuk checklist konseptor. Tabel ini menyimpan SEJARAHNYA untuk SEMUA jenis
-- blangko (putusan, BAS, relaas, penetapan, ...): satu baris per keadaan kelengkapan
-- yang berbeda, dan satu baris khusus pada saat blangko DICETAK. Dari baris-baris saat
-- cetak itulah ALETA belajar isian mana yang BIASANYA sudah terisi ketika sebuah blangko
-- dicetak, lalu mengingatkan petugas bila isian itu masih kosong.
--
--   aleta_blangko_lapor   perkara, blangko (nama berkas), jenis blangko, jenis perkara,
--                         isian TERISI/KOSONG sebagai "kode:1,kode:0" (tanpa nilainya -
--                         tidak ada teks perkara di tabel ini), dicetak 0/1, siapa, kapan.
--
-- DIISI HANYA bila saklar Fitur Satker "wajib-sebelum-cetak" menyala (bawaan MATI; mati =
-- tidak satu baris pun ditulis dan perilaku cetak persis seperti sebelumnya). Retensi 2
-- tahun (modul wajib-cetak.ts, bersihkanLaporLawas), dan paling banyak 50 baris terbaru
-- per perkara + blangko. Tanpa kunci asing dan tanpa CHECK. Waktu ISO UTC sebagai TEXT.
--
-- NOMOR: 0102 milik rantai D (docs/awan/rantai-upgrade-24okt.md). Cabang dasar berujung
-- idx 82 = 0092, jadi 0102 memakai idx 83 (jurnal harus tanpa lubang); idx DIRAPIKAN saat
-- gabung akhir.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_BLANGKO_LAPOR);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/wajib-sebelum-cetak-25okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_blangko_lapor (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  berkas TEXT NOT NULL DEFAULT '',
  jenis_blangko TEXT NOT NULL DEFAULT '',
  jenis_perkara TEXT NOT NULL DEFAULT '',
  isian TEXT NOT NULL DEFAULT '',
  terisi INTEGER NOT NULL DEFAULT 0,
  jumlah INTEGER NOT NULL DEFAULT 0,
  dicetak SMALLINT NOT NULL DEFAULT 0,
  pengguna_id TEXT NOT NULL DEFAULT '',
  pengguna_nama TEXT NOT NULL DEFAULT '',
  pada TEXT NOT NULL,
  dibuat_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blangko_lapor_berkas ON aleta_blangko_lapor(berkas, dicetak);

CREATE INDEX IF NOT EXISTS idx_blangko_lapor_perkara ON aleta_blangko_lapor(perkara_id, berkas, pada);

CREATE INDEX IF NOT EXISTS idx_blangko_lapor_pada ON aleta_blangko_lapor(pada);
