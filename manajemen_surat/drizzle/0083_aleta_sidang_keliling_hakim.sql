-- =============================================================================
-- SIDANG KELILING PER HARI & HAKIM YANG MENYIDANGKAN PER PERKARA (22 Okt 2026)
-- =============================================================================
--
-- Permintaan hakim (22 Okt 2026) untuk halaman Jadwal Sidang:
--
--   aleta_sidang_keliling_hari   satu baris per TANGGAL sidang: saklar "Sidang
--                                keliling" (aktif 0/1, bawaan MATI = tidak ada
--                                baris). Dibaca tunda otomatis: pada tanggal
--                                yang aktif, tunda otomatis berjalan pukul 14.00
--                                (bukan jam biasanya). tanggal = 'YYYY-MM-DD'.
--   aleta_hakim_sidang_perkara   satu baris per (tanggal, perkara): SATU hakim
--                                yang menyidangkan perkara itu pada tanggal itu,
--                                walau perkaranya bermajelis. Hanya di ALETA -
--                                tidak ditulis ke SIPP. Bila pilihan ini mengisi
--                                konseptor sementara (aleta_konseptor_sementara),
--                                keadaan konseptor sebelumnya disimpan di
--                                konseptor_sebelum (JSON, '' = belum ada) supaya
--                                pembatalan dapat mengembalikannya.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul
-- (src/server/modules/aleta-ecourt/sidang-keliling-hakim.ts). Waktu disimpan
-- ISO UTC sebagai TEXT. Tidak ada yang ditulis ke SIPP dari tabel ini.
--
-- NOMOR: 0083 diklaim 22 Okt 2026 (0082 diklaim agen lain untuk saklar tunda
-- otomatis). Di cabang ini jurnal terakhir idx 74 = 0081, jadi 0083 memakai
-- idx 75; bila 0082 digabung lebih dulu, 0082 = idx 75 dan 0083 = idx 76
-- (when 0083 sengaja lebih besar daripada 0082 supaya urutannya tetap).
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_SIDANG_KELILING_HAKIM);
--   (c) kedua tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/jadwal-keliling-hakim-massal-22okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_sidang_keliling_hari (
  tanggal TEXT PRIMARY KEY,
  aktif INTEGER NOT NULL DEFAULT 0,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_nama TEXT NOT NULL DEFAULT '',
  diubah_pada TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_hakim_sidang_perkara (
  id TEXT PRIMARY KEY,
  tanggal TEXT NOT NULL,
  perkara_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  sidang_id TEXT NOT NULL DEFAULT '',
  hakim_id TEXT NOT NULL DEFAULT '',
  hakim_nama TEXT NOT NULL,
  hakim_kode TEXT NOT NULL DEFAULT '',
  anggota_majelis INTEGER NOT NULL DEFAULT 0,
  panitera_nama TEXT NOT NULL DEFAULT '',
  konseptor_diisi INTEGER NOT NULL DEFAULT 0,
  konseptor_sebelum TEXT NOT NULL DEFAULT '',
  dipilih_oleh TEXT NOT NULL DEFAULT '',
  dipilih_nama TEXT NOT NULL DEFAULT '',
  waktu TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hakim_sidang_perkara_kunci ON aleta_hakim_sidang_perkara(tanggal, perkara_id);

CREATE INDEX IF NOT EXISTS idx_hakim_sidang_perkara_tanggal ON aleta_hakim_sidang_perkara(tanggal, hakim_nama);
