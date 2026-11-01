-- =============================================================================
-- ALETA Ai - DOMPET SATKER (1 Nov 2026)
-- =============================================================================
--
-- Satu dompet bersama satker yang dapat dipakai seluruh pengguna menurut ATURAN (peran / pengguna). Pola dompet pengguna
-- (aleta_ai_saldo / aleta_ai_mutasi) TIDAK diubah; ini tabel terpisah:
--
--   aleta_ai_satker_saldo    satu baris (id 'utama'): saldo dompet satker.
--   aleta_ai_satker_mutasi   buku mutasi dompet satker: isi (oleh Super Admin), tahan/lepas/potong (pemakaian; pengguna_id
--                            dan peran_id = SIAPA yang memakai), koreksi. Saldo selalu = jumlah mutasi.
--   aleta_ai_satker_aturan   aturan pakai: sasaran 'peran' | 'pengguna' (+ sasaran_id), boleh (1/0), batas_bulanan_rp
--                            (0 = tanpa batas; pada aturan peran = batas tiap pengguna peran itu; pada aturan pengguna =
--                            batas pengguna itu). Aturan pengguna mengalahkan aturan peran. Tanpa aturan = tidak boleh.
--
-- Tanpa kunci asing. NOMOR 0124, jurnal idx 108 (idx 106 = 0122 aleta-ai-proyek, 107 = 0123 bas-halaman-runut; berurutan
-- setelah ketiga cabang digabung). TIGA TEMPAT: berkas ini + meta/_journal.json, DDL_ALETA_AI_SATKER di schema.ts, dan daftar
-- IN_MEMORY_TABLE_PERSISTENCE_ORDER di client.ts.

CREATE TABLE IF NOT EXISTS aleta_ai_satker_saldo (
  id TEXT PRIMARY KEY,
  saldo_rp INTEGER NOT NULL DEFAULT 0,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_satker_mutasi (
  id TEXT PRIMARY KEY,
  jenis TEXT NOT NULL,
  jumlah_rp INTEGER NOT NULL,
  saldo_setelah INTEGER NOT NULL,
  rujukan_id TEXT NOT NULL DEFAULT '',
  pengguna_id TEXT NOT NULL DEFAULT '',
  peran_id TEXT NOT NULL DEFAULT '',
  oleh_id TEXT NOT NULL DEFAULT '',
  catatan TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_satker_aturan (
  id TEXT PRIMARY KEY,
  sasaran TEXT NOT NULL,
  sasaran_id TEXT NOT NULL,
  boleh INTEGER NOT NULL DEFAULT 1,
  batas_bulanan_rp INTEGER NOT NULL DEFAULT 0,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_satker_aturan ON aleta_ai_satker_aturan(sasaran, sasaran_id);
CREATE INDEX IF NOT EXISTS idx_ai_satker_mutasi_waktu ON aleta_ai_satker_mutasi(dibuat_at);
CREATE INDEX IF NOT EXISTS idx_ai_satker_mutasi_pengguna ON aleta_ai_satker_mutasi(pengguna_id, dibuat_at);
CREATE INDEX IF NOT EXISTS idx_ai_satker_mutasi_rujukan ON aleta_ai_satker_mutasi(rujukan_id);
