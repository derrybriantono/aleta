-- =============================================================================
-- TAUTAN AKUN SIPP YANG DIBUAT ALETA SENDIRI - ASAL & TINJAUAN ADMIN
-- =============================================================================
--
-- 11 Oktober 2026 (permintaan pengguna: "aleta belum bisa deteksi akun sipp
-- nya di aleta, coba kamu samakan atau cocokkan dengan nama di sipp").
--
-- Masuk otomatis dari SIPP ke ALETA (src/server/modules/portal/masuk-sipp-nama.ts)
-- dapat MENULIS tautan akun ALETA <-> username SIPP ke external_app_credentials
-- (tanpa password) sesudah identitas SIPP-nya terbukti (cookie sesi SIPP atau
-- password SIPP), bila akun ALETA-nya dipilih lewat NIP atau NAMA yang sama
-- dan tunggal. Kolom di bawah membuat tautan itu dapat dibedakan dari yang
-- diisi manusia, dan ditinjau Admin di Manajemen Akun:
--
--   tautan_sumber         ''          = diisi manusia di Manajemen Akun (lama)
--                         'nama-sipp' = dipilih lewat nama SIPP = nama ALETA
--                         'nip-sipp'  = dipilih lewat NIP pejabat SIPP
--                         'sesi-sipp' = ditautkan pegawai sendiri dari panel
--                                       (sesi ALETA + sesi SIPP terbukti)
--   tautan_ditinjau_oleh  id Admin yang menyetujui; NULL = perlu ditinjau
--   tautan_ditinjau_pada  waktu ISO persetujuannya
--
-- Tanpa CHECK: nilainya dijaga modulnya, dan ALTER ... ADD COLUMN dengan CHECK
-- tidak berjalan sama di pg-mem.
--
-- NOMOR: 0062 diklaim Agen 1 batch 11 Okt (B) (D:/aleta-dev/kerja/batch-11okt-b/
-- BRIEF.md), idx jurnal 61.
--
-- DUA TEMPAT PENDAFTARAN, keduanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_TAUTAN_SIPP_SUMBER);
--   tabelnya sudah di IN_MEMORY_TABLE_PERSISTENCE_ORDER.
-- Kesamaan (a) dan (b) dijaga src/test/masuk-otomatis-nama-sipp-11okt.test.ts.
-- =============================================================================

ALTER TABLE external_app_credentials ADD COLUMN IF NOT EXISTS tautan_sumber TEXT NOT NULL DEFAULT '';

ALTER TABLE external_app_credentials ADD COLUMN IF NOT EXISTS tautan_ditinjau_oleh TEXT;

ALTER TABLE external_app_credentials ADD COLUMN IF NOT EXISTS tautan_ditinjau_pada TEXT;
