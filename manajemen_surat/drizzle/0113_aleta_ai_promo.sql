-- =============================================================================
-- ALETA Ai - PROGRAM PROMOSI "GRATIS PAKAI ALETA Ai" (27 Okt 2026)
-- =============================================================================
--
-- Super Admin menyalakan program promosi di Pengaturan ALETA Ai: sasaran (semua / peran tertentu), periode WITA,
-- jatah gratis per pengguna (giliran per hari dan/atau nilai setara rupiah selama periode), dan batas total biaya API
-- promosi satker. Pengaturannya disimpan di aleta_ai_pengaturan (kunci promo_konfig), tanpa tabel baru.
--
--   aleta_ai_promo_pakai   satu baris = satu giliran (atau satu jalan tugas) yang ditagih Rp0 karena promosi:
--                          jenis ('giliran' | 'tugas'), rujukan_id (id pesan AI / rujukan jalan tugas), tanggal WITA,
--                          dihitung (1 = memakai jatah; 0 = gagal/ditolak tanpa keluaran, tidak memakai jatah),
--                          setara_rp (harga bila ditagih normal; dihitung terhadap jatah rupiah), token, biaya_api_rp
--                          (pengeluaran pengelola; dihitung terhadap batas promosi satker).
--   aleta_ai_obrolan_pesan + promo (1 = giliran ini gratis karena promosi; terpisah dari gratis Super Admin).
--
-- Tanpa kunci asing. NOMOR 0113, jurnal idx 99. TIGA TEMPAT: berkas ini + meta/_journal.json, DDL_ALETA_AI_PROMO di schema.ts
-- (tabel, indeks, kolom), dan daftar IN_MEMORY_TABLE_PERSISTENCE_ORDER di client.ts.

CREATE TABLE IF NOT EXISTS aleta_ai_promo_pakai (
  id TEXT PRIMARY KEY,
  pengguna_id TEXT NOT NULL,
  peran_id TEXT NOT NULL DEFAULT '',
  jenis TEXT NOT NULL DEFAULT 'giliran',
  rujukan_id TEXT NOT NULL DEFAULT '',
  tanggal TEXT NOT NULL,
  dihitung INTEGER NOT NULL DEFAULT 1,
  setara_rp INTEGER NOT NULL DEFAULT 0,
  token INTEGER NOT NULL DEFAULT 0,
  biaya_api_rp DOUBLE PRECISION NOT NULL DEFAULT 0,
  kelompok TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_promo_pakai_pengguna ON aleta_ai_promo_pakai(pengguna_id, tanggal);

CREATE INDEX IF NOT EXISTS idx_ai_promo_pakai_rujukan ON aleta_ai_promo_pakai(rujukan_id);

ALTER TABLE aleta_ai_obrolan_pesan ADD COLUMN IF NOT EXISTS promo INTEGER NOT NULL DEFAULT 0;
