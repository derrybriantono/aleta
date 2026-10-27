-- =============================================================================
-- KAMUS DETEKSI & KALIMAT - RIWAYAT PERUBAHAN (27 Oktober 2026)
-- =============================================================================
--
-- Setiap perubahan pola/templat dari layar Admin "Kamus deteksi & kalimat" tercatat: SIAPA (akun), KAPAN, dan ISI LAMA
-- (beserta isi baru). Pola baru yang diketik lalu diaktifkan juga tercatat (isi lama kosong). Dipakai untuk melihat
-- siapa mengubah apa dan mengembalikan isi lama bila perlu.
--
--   aleta_kamus_deteksi_riwayat   satu baris per perubahan: jenis ('pola' | 'templat'), kode, kelompok,
--                                 aksi ('buat' | 'ubah' | 'status' | 'kembali-ke-benih'), isi_lama / isi_baru (JSON,
--                                 '' bila tidak ada), oleh (akun), pada (ISO UTC).
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modulnya (src/server/modules/aleta-ecourt/kamus-deteksi.ts).
--
-- NOMOR: 0116 (idx 102) diklaim 27 Okt 2026.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_KAMUS_RIWAYAT);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/kamus-riwayat-27okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_kamus_deteksi_riwayat (
  id TEXT PRIMARY KEY,
  jenis TEXT NOT NULL,
  kode TEXT NOT NULL,
  kelompok TEXT NOT NULL DEFAULT '',
  aksi TEXT NOT NULL,
  isi_lama TEXT NOT NULL DEFAULT '',
  isi_baru TEXT NOT NULL DEFAULT '',
  oleh TEXT NOT NULL DEFAULT '',
  pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kamus_deteksi_riwayat_kode ON aleta_kamus_deteksi_riwayat(kode, pada);
CREATE INDEX IF NOT EXISTS idx_kamus_deteksi_riwayat_pada ON aleta_kamus_deteksi_riwayat(pada);
