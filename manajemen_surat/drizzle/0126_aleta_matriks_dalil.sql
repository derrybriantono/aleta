-- =============================================================================
-- MATRIKS DALIL SATU SUMBER (1 November 2026, P2 - keputusan Derry 90)
-- =============================================================================
--
-- Dalil para pihak (posita/petitum gugatan, jawaban + gugatan rekonvensi, replik, duplik, kesimpulan) dipecah per butir SEKALI
-- oleh bot (aleta_bot/services/matriksDalilService.js) dari teks yang dibaca pembaca e-Court bersama (atau posita/petitum SIPP),
-- lalu disimpan di sini satu baris per perkara dan dibaca panel Peta dalil, rincian alasan, keterangan saksi, ALETA Ai, agen A1/A2.
--
--   aleta_matriks_dalil   nomor_perkara (kunci), sidik (sidik daftar berkas e-Court, atau 'sipp:<sidik posita>'), versi (versi
--                         penyusun bot), sumber_gugatan ('ecourt' | 'sipp' | ''), jumlah (banyak dalil), matriks (JSON MatriksDalil
--                         lib/matriks-dalil.ts), pembuktian (JSON peta id dalil -> status pembuktian; diisi agen A2, TIDAK disentuh
--                         hitung ulang), lama_ms (lama hitung bot), dihitung_pada.
--
-- Tanpa kunci asing dan tanpa CHECK. Modul: src/server/modules/aleta-ecourt/matriks-dalil.ts.
--
-- NOMOR: 0126 (idx 110) diklaim 1 Nov 2026 di klaim-1nov.txt (agen P2). Celah idx 106-109 = 0122 (I2), 0123 (I1), 0124 (J1),
-- 0125 (N4) di cabang lain - jurnal berurutan sesudah semua cabang digabung.
--
-- TIGA TEMPAT PENDAFTARAN: (a) berkas ini + _journal.json; (b) DDL_MATRIKS_DALIL di src/server/db/schema.ts;
-- (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_matriks_dalil (
  nomor_perkara TEXT NOT NULL PRIMARY KEY,
  sidik TEXT NOT NULL DEFAULT '',
  versi INTEGER NOT NULL DEFAULT 1,
  sumber_gugatan TEXT NOT NULL DEFAULT '',
  jumlah INTEGER NOT NULL DEFAULT 0,
  matriks TEXT NOT NULL DEFAULT '{}',
  pembuktian TEXT NOT NULL DEFAULT '{}',
  lama_ms INTEGER NOT NULL DEFAULT 0,
  dihitung_pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_matriks_dalil_dihitung ON aleta_matriks_dalil(dihitung_pada);
