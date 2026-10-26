-- =============================================================================
-- KETEPATAN ISIAN (25 Okt 2026, rantai D, butir D1 = U3 + U4)
-- =============================================================================
--
-- Gerbang isian bot (aleta_bot/config/gerbang-isian.json) statis. Dua tabel ini
-- membuatnya hidup: angka lapangan dari jejak isian (0091) dan keputusan Super
-- Admin atas usulan naik/turun. Keduanya HANYA diisi bila saklar Fitur Satker
-- "ketepatan-isian" menyala (bawaan MATI; mati = bot memakai berkas JSON saja,
-- persis seperti sebelumnya).
--
--   aleta_ketepatan_isian     SATU BARIS PER ISIAN x PENGISI x JENIS PERKARA x BULAN:
--                             usulan, diterima, diubah, bertahan, presisi. Dihitung
--                             ulang dari aleta_isian_jejak (tabel turunan: boleh
--                             dibuang dan dihitung lagi tanpa kehilangan apa pun).
--   aleta_ketepatan_keputusan SATU BARIS PER USULAN naik/turun beserta nasibnya:
--                             usulan -> disetujui | ditolak | dicabut | kedaluwarsa.
--                             Baris disetujui yang berlaku=1 adalah "gerbang versi
--                             basis data" yang didorong ke bot. KENAIKAN TIDAK PERNAH
--                             OTOMATIS: yang mengisi diputuskan_oleh hanya penyetuju
--                             manusia (Super Admin).
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul. Waktu ISO UTC
-- sebagai TEXT. Berisi hitungan saja - tidak ada teks perkara atau nama pihak.
--
-- NOMOR: 0092 milik rantai D (docs/awan/rantai-upgrade-24okt.md). Cabang dasar
-- (fitur/jejak-isian) berujung idx 81 = 0091, jadi 0092 memakai idx 82 (jurnal
-- harus tanpa lubang). idx DIRAPIKAN saat gabung akhir.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_KETEPATAN_ISIAN);
--   (c) kedua tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/ketepatan-isian-25okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_ketepatan_isian (
  id TEXT PRIMARY KEY,
  kode TEXT NOT NULL DEFAULT '',
  pengisi TEXT NOT NULL DEFAULT '',
  jenis_perkara TEXT NOT NULL DEFAULT '',
  bulan TEXT NOT NULL DEFAULT '',
  usulan INTEGER NOT NULL DEFAULT 0,
  diterima INTEGER NOT NULL DEFAULT 0,
  diubah INTEGER NOT NULL DEFAULT 0,
  diubah_otomatis INTEGER NOT NULL DEFAULT 0,
  diketik INTEGER NOT NULL DEFAULT 0,
  bertahan INTEGER NOT NULL DEFAULT 0,
  presisi DOUBLE PRECISION,
  dihitung_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ketepatan_keputusan (
  id TEXT PRIMARY KEY,
  kode TEXT NOT NULL DEFAULT '',
  pengisi TEXT NOT NULL DEFAULT '',
  jenis_perkara TEXT NOT NULL DEFAULT '',
  arah TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'usulan',
  dari_status TEXT NOT NULL DEFAULT '',
  ke_status TEXT NOT NULL DEFAULT '',
  jumlah INTEGER NOT NULL DEFAULT 0,
  bertahan INTEGER NOT NULL DEFAULT 0,
  presisi DOUBLE PRECISION NOT NULL DEFAULT 0,
  bulan_awal TEXT NOT NULL DEFAULT '',
  bulan_akhir TEXT NOT NULL DEFAULT '',
  dapat_diterapkan SMALLINT NOT NULL DEFAULT 0,
  berlaku SMALLINT NOT NULL DEFAULT 0,
  catatan TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diputuskan_oleh TEXT NOT NULL DEFAULT '',
  diputuskan_nama TEXT NOT NULL DEFAULT '',
  diputuskan_at TEXT NOT NULL DEFAULT '',
  dicabut_oleh TEXT NOT NULL DEFAULT '',
  dicabut_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_ketepatan_isian_kode ON aleta_ketepatan_isian(kode, bulan);

CREATE INDEX IF NOT EXISTS idx_ketepatan_keputusan_status ON aleta_ketepatan_keputusan(status, berlaku);

CREATE INDEX IF NOT EXISTS idx_ketepatan_keputusan_kunci ON aleta_ketepatan_keputusan(kode, pengisi, jenis_perkara);
