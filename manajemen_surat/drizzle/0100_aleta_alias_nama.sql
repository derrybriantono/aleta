-- =============================================================================
-- KAMUS ALIAS NAMA PIHAK (U18, rantai B, 25 Okt 2026)
-- =============================================================================
--
--   aleta_alias_nama   satu baris per (nama baku, varian ejaan): "Muhammad Alwi" <- "Muhamad Alwi", "Moh. Alwi".
--                      Dipakai pemeriksa ejaan dan nama pihak (ide sipp-20; hanya USULAN, tidak pernah menulis ke
--                      SIPP/ABT/e-Court), pengenalan saksi, dan penyamaran ALETA Ai (T9) supaya satu orang yang
--                      ditulis berbeda tetap satu kode samaran.
--
-- Isinya nama orang: hanya disimpan di server kantor, hanya dapat dilihat dan diubah Admin dan Super Admin; pemeriksa
-- memakainya di sisi server dan tidak pernah mengirim daftar kamus ke peramban. Hanya terpakai bila Super Admin
-- menyalakan saklar kinerja.ejaanNamaPihak (mati bawaan).
--
-- baku_kunci / varian_kunci = tulisan dasar (huruf kecil, tanpa tanda baca dan gelar; src/lib/ejaan-nama.ts), untuk
-- mencegah pasangan ganda. Ejaan yang berbeda (Muhamad, Moh.) tetap baris sendiri-sendiri.
-- Tanpa kunci asing dan tanpa CHECK: nilai sah dijaga modul (src/server/modules/aleta-ecourt/alias-nama.ts).
-- Waktu ISO UTC sebagai TEXT.
--
-- NOMOR: rantai B memegang 0098-0100. 0099 tidak dipakai (pekerjaan berkas K14 hidup di memori server, tanpa tabel).
-- Di cabang ini jurnal terakhir sebelum berkas ini idx 81 = 0098, jadi 0100 memakai idx 82; idx dirapikan saat gabung.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_ALIAS_NAMA);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_alias_nama (
  id TEXT PRIMARY KEY,
  baku TEXT NOT NULL,
  varian TEXT NOT NULL,
  baku_kunci TEXT NOT NULL,
  varian_kunci TEXT NOT NULL,
  sumber TEXT NOT NULL DEFAULT 'manual',
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alias_nama_unik ON aleta_alias_nama(baku_kunci, varian_kunci);

CREATE INDEX IF NOT EXISTS idx_alias_nama_varian ON aleta_alias_nama(varian_kunci);
