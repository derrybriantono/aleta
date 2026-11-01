-- =============================================================================
-- HALAMAN BAS RUNUT (1 November 2026, keputusan pengguna 71)
-- =============================================================================
--
-- BAS sidang pertama mulai halaman 1; tiap BAS berikutnya mulai dari halaman terakhir BAS sebelumnya + 1 (termasuk lompatan halaman bukti
-- sesudah Z cross). Halaman awal & akhir tiap BAS dicatat tiap BAS dicetak / diunduh / diunggah lewat panel dan unggah e-Doc.
--
--   aleta_bas_halaman   perkara_id (SIPP), sidang_kunci (id jadwal sidang SIPP; 't:YYYY-MM-DD' bila id tidak diketahui), sidang_id,
--                       tanggal_sidang, nomor_perkara, halaman_awal, halaman_akhir (nomor tampil terakhir, lompatan bukti ikut),
--                       halaman_fisik (jumlah halaman PDF), lompat_bukti (halaman bukti sesudah Z), sumber ('cetak'|'unduh'|'unggah'),
--                       dicatat_oleh (id akun), dicatat_pada.
--
-- Tanpa kunci asing. Modul: src/server/modules/aleta-ecourt/bas-halaman/.
--
-- NOMOR: 0123 (idx 107) diklaim 1 Nov 2026 agen I1 (D:/Aplikasi/aleta/tmp/klaim-1nov.txt; 0122/idx 106 milik agen I2).
--
-- TIGA TEMPAT PENDAFTARAN: (a) berkas ini + _journal.json; (b) DDL_BAS_HALAMAN di src/server/db/schema.ts;
-- (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_bas_halaman (
  perkara_id TEXT NOT NULL,
  sidang_kunci TEXT NOT NULL,
  sidang_id TEXT NOT NULL DEFAULT '',
  tanggal_sidang TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  halaman_awal INTEGER NOT NULL DEFAULT 1,
  halaman_akhir INTEGER NOT NULL DEFAULT 1,
  halaman_fisik INTEGER NOT NULL DEFAULT 1,
  lompat_bukti INTEGER NOT NULL DEFAULT 0,
  sumber TEXT NOT NULL DEFAULT '',
  dicatat_oleh TEXT NOT NULL DEFAULT '',
  dicatat_pada TEXT NOT NULL,
  PRIMARY KEY (perkara_id, sidang_kunci)
);

CREATE INDEX IF NOT EXISTS idx_bas_halaman_tanggal ON aleta_bas_halaman(perkara_id, tanggal_sidang);
