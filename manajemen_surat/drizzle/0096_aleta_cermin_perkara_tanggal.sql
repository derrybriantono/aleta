-- =============================================================================
-- CERMIN PERKARA (A5, 25 Okt 2026) - tanggal dasar lingkup Status Perkara
-- =============================================================================
--
-- Hitungan tag Status Perkara dibatasi lingkup "dasar tanggal" (didaftarkan,
-- diputus, minutasi, BHT, bersidang, akta cerai, relaas, ikrar). aleta_cermin_perkara
-- (0090) sudah memuat empat yang pertama; kolom di bawah melengkapi empat sisanya
-- supaya hitungan tag dari cermin dapat menyaring lingkup yang sama dengan jalur
-- lama. Diisi pemindai/pembaruan dari SIPP (hanya membaca).
--
--   tanggal_sidang_maks  sidang TERAKHIR yang pernah dijadwalkan (MAX, termasuk masa depan)
--   tanggal_akta         MAX(perkara_akta_cerai.tgl_akta_cerai)
--   tanggal_relaas       MAX(perkara_pelaksanaan_relaas.tanggal_relaas)
--   tanggal_ikrar        MAX(perkara_ikrar_talak.tgl_ikrar_talak)
--
-- Kosong ('') = belum ada. Baris lama berisi '' sampai pemindaian/pembaruan
-- berikutnya mengisinya (pemindaian ulang di Pemantau mengisi semuanya).
--
-- NOMOR: rantai A memegang 0090, 0096, 0097. Jurnal idx 82. TIGA TEMPAT: (a) berkas
-- ini + meta/_journal.json; (b) DDL_ALETA_CERMIN_PERKARA_TANGGAL di
-- src/server/db/schema.ts; (c) tidak ada tabel baru, jadi daftar cadangan tetap.
-- =============================================================================

ALTER TABLE aleta_cermin_perkara ADD COLUMN IF NOT EXISTS tanggal_sidang_maks TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_perkara ADD COLUMN IF NOT EXISTS tanggal_akta TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_perkara ADD COLUMN IF NOT EXISTS tanggal_relaas TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_cermin_perkara ADD COLUMN IF NOT EXISTS tanggal_ikrar TEXT NOT NULL DEFAULT '';
