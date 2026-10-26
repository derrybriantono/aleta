-- =============================================================================
-- SAMPUL BERKAS DAN DAFTAR ISI BERKAS (26 Okt 2026): sunting petugas, halaman manual, ciri tangan, bawaan halaman
-- =============================================================================
--
-- Layar kerja khusus Sampul dan Daftar Isi di panel Blangko ABT by Derry Briantono (rancangan:
-- docs/rancangan/sampul-daftar-isi-26okt/RANCANGAN.md bagian 9-14). Semua sunting petugas disimpan DI ALETA; tidak ada yang ditulis
-- ke SIPP maupun ABT (keputusan Derry 26 Okt, butir D). Hanya dipakai bila saklar Fitur Satker "berkas-perkara-khusus" menyala (bawaan MATI).
--
--   aleta_berkas_susunan  satu baris = satu baris daftar isi yang disunting petugas untuk satu perkara:
--                         tampil (disembunyikan?), urutan (geser; 0 = urutan bawaan), halaman_teks ('' = otomatis; "3" = tiga halaman;
--                         "5-9" = mulai halaman 5 sampai 9), judul/tanggal manual (baris tambahan), tambahan (1 = baris buatan petugas).
--                         id = "<perkara_id>:<bundel>:<kunci>"; kunci stabil, mis. "bas:3", "relaas:2:t1", "kh_tolakkua", "x1".
--   aleta_berkas_sampul   ciri (jenis 'tag', nilai '1'/'0') dan isian ('isian', nilai teks) yang DIUBAH TANGAN pada sampul; yang tidak
--                         ada barisnya = otomatis dari data perkara. id = "<perkara_id>:<jenis>:<kunci>".
--   aleta_berkas_bawaan   jumlah halaman bawaan per jenis dokumen (median arsip yang dipelajari; admin dapat memperbarui). Tanpa baris
--                         = nilai bawaan tertanam di kode (hasil ukur 26 Okt 2026).
--
-- Isi dokumen TIDAK disimpan di sini (hanya angka dan teks pendek). Tanpa kunci asing.
--
-- NOMOR: 0111 dipegang rantai G (lihat 0110). Jurnal idx 98. TIGA TEMPAT: (a) berkas ini + meta/_journal.json;
-- (b) DDL_ALETA_BERKAS_PERKARA di src/server/db/schema.ts; (c) daftar cadangan IN_MEMORY_TABLE_PERSISTENCE_ORDER di src/server/db/client.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_berkas_susunan (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  bundel TEXT NOT NULL,
  kunci TEXT NOT NULL,
  tampil INTEGER NOT NULL DEFAULT 1,
  urutan INTEGER NOT NULL DEFAULT 0,
  halaman_teks TEXT NOT NULL DEFAULT '',
  judul_manual TEXT NOT NULL DEFAULT '',
  tanggal_manual TEXT NOT NULL DEFAULT '',
  tambahan INTEGER NOT NULL DEFAULT 0,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_berkas_susunan_perkara ON aleta_berkas_susunan(perkara_id);

CREATE TABLE IF NOT EXISTS aleta_berkas_sampul (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  jenis TEXT NOT NULL,
  kunci TEXT NOT NULL,
  nilai TEXT NOT NULL DEFAULT '',
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_berkas_sampul_perkara ON aleta_berkas_sampul(perkara_id);

CREATE TABLE IF NOT EXISTS aleta_berkas_bawaan (
  jenis_dokumen TEXT PRIMARY KEY,
  halaman INTEGER NOT NULL,
  jumlah_contoh INTEGER NOT NULL DEFAULT 0,
  diperbarui_at TEXT NOT NULL
);
