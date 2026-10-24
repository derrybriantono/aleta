-- =============================================================================
-- ALETA Ai TAHAP 4 - DOMPET LENGKAP (25 Okt 2026, T10)
-- =============================================================================
--
--   aleta_ai_kuota_peran       kuota hibah per peran (Rp per bulan), diatur
--                              Super Admin. Hibahnya sendiri TIDAK disimpan di
--                              sini: tiap pemberian adalah mutasi jenis "kuota"
--                              di aleta_ai_mutasi (rujukan kuota:<bulan>:<peran>),
--                              sehingga saldo tetap = jumlah mutasi.
--   aleta_ai_rekonsiliasi      hasil rekonsiliasi harian: saldo vs jumlah
--                              mutasi per pengguna, pendapatan giliran vs
--                              potongan di buku mutasi, tahanan menggantung.
--                              Satu baris per tanggal (id rek-YYYY-MM-DD);
--                              selisih ditandai status = 'selisih'.
--   aleta_ai_obrolan_pesan +   biaya_mdr_rp (bagian MDR QRIS di harga giliran),
--                              kurs_tanggal dan kurs_sumber (kurs yang dipakai
--                              giliran itu dicatat utuh: nilai, tanggal, sumber).
--
-- Tanpa kunci asing dan tanpa CHECK: nilai sah dijaga modul
-- (src/server/modules/aleta-ai/*). Waktu ISO UTC sebagai TEXT.
--
-- NOMOR: T10 memegang 0088-0089 (AWAN.md bagian 2). Di cabang ini jurnal
-- terakhir idx 75 = 0083, jadi 0088 memakai idx 76; sesi laptop menomori ulang
-- idx bila 0084-0087 (T1, T9) digabung lebih dulu - when 0088 sengaja jauh
-- lebih besar supaya urutannya tetap.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_ALETA_AI_DOMPET);
--   (c) kedua tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/aleta-ai-dompet-25okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_ai_kuota_peran (
  peran_id TEXT PRIMARY KEY,
  kuota_bulanan_rp INTEGER NOT NULL DEFAULT 0,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_rekonsiliasi (
  id TEXT PRIMARY KEY,
  tanggal TEXT NOT NULL,
  dijalankan_at TEXT NOT NULL,
  oleh_id TEXT NOT NULL DEFAULT '',
  jumlah_pengguna INTEGER NOT NULL DEFAULT 0,
  jumlah_selisih INTEGER NOT NULL DEFAULT 0,
  tahanan_menggantung INTEGER NOT NULL DEFAULT 0,
  pendapatan_giliran_rp INTEGER NOT NULL DEFAULT 0,
  potong_mutasi_rp INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'seimbang',
  rincian_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_ai_rekonsiliasi_tanggal ON aleta_ai_rekonsiliasi(tanggal);

CREATE INDEX IF NOT EXISTS idx_ai_mutasi_rujukan ON aleta_ai_mutasi(rujukan_id);

ALTER TABLE aleta_ai_obrolan_pesan ADD COLUMN IF NOT EXISTS biaya_mdr_rp DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE aleta_ai_obrolan_pesan ADD COLUMN IF NOT EXISTS kurs_tanggal TEXT NOT NULL DEFAULT '';

ALTER TABLE aleta_ai_obrolan_pesan ADD COLUMN IF NOT EXISTS kurs_sumber TEXT NOT NULL DEFAULT '';
