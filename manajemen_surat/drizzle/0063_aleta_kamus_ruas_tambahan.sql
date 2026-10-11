-- =============================================================================
-- KAMUS DETEKSI - RUAS TAMBAHAN POLA & TEMPLAT DI LAPIS DATABASE
-- =============================================================================
--
-- 11 Oktober 2026 (batch B, agen 6). Pola benih aleta_bot/kamus-deteksi/awal/
-- *.json memakai RUAS TAMBAHAN di luar ruas baku 0060 yang dibaca mesin bot:
-- sebab, jenis, kata, cakupan, hanyaDeteksi (alasan), ganti, kebalikan,
-- golongan, jk (saksi-hubungan), bentuk, awalan (jenis perkara), peran
-- (tuntutan, gugatan, kontak), urut, perbuatan, variabel (waktu, pelaku,
-- tempat-tinggal); templat: kodeAbt, asal, bagian. Sebelum kolom ini, admin
-- yang menyunting atau menonaktifkan pola benih dari layar "Kamus deteksi &
-- kalimat" menulis baris TANPA ruas itu - baris menimpa benih menurut kode,
-- dan pola di bot rusak diam-diam (mis. jangkar terbalik tanpa peta
-- `kebalikan`, istilah hubungan tanpa `golongan`).
--
--   tambahan  JSON objek ruas tambahan; digabung kembali ke objek pola/templat
--             saat lapis didorong ke bot (ruas baku selalu menang).
--
-- NOMOR: 0063 (idx 62) diklaim 11 Okt 2026 untuk agen 6. 0062 (idx 61)
-- diklaim agen lain dan belum digabung saat berkas ini ditulis - idx 61
-- SENGAJA tidak dipakai di sini.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_KAMUS_RUAS_TAMBAHAN);
--   (c) kedua tabel sudah di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts;
--       cadangan menyalin seluruh kolom, potret lama tanpa kolom ini
--       dipulihkan dengan bawaan '{}').
-- Kesamaan (a) dan (b) dijaga src/test/kamus-ruas-tambahan-11okt.test.ts.
-- =============================================================================

ALTER TABLE aleta_kamus_deteksi_pola ADD COLUMN IF NOT EXISTS tambahan TEXT NOT NULL DEFAULT '{}';

ALTER TABLE aleta_kamus_deteksi_templat ADD COLUMN IF NOT EXISTS tambahan TEXT NOT NULL DEFAULT '{}';
