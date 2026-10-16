-- =============================================================================
-- PENGATURAN SIPP & ABT - CADANGAN DAN RIWAYAT SUNTINGAN ATAS ABT
-- =============================================================================
--
-- 16 Oktober 2026 (Tahap H). Halaman admin "Pengaturan SIPP & ABT" mengubah
-- tiga hal di basis data ABT (aps_badilag, MariaDB 5.5, latin1):
--   menu      hak menu satu folder Blangko Derry (abt_menu) dan saklar
--             kebijakan yang diturunkan darinya (mis. hakim melihat BAS)
--   config    abt_config yang diizinkan (validasi_data_bas)
--   variabel  kueri / isian bawaan satu variabel (abt_variabel)
--   templat   isi satu template tanya jawab (abt_tanyajawab_template)
--
-- ABT sendiri tidak menyimpan riwayat. Tiap suntingan dicatat DI SINI SEBELUM
-- ditulis ke ABT (status 'menunggu'), lalu diperbarui menjadi 'tersimpan' atau
-- 'gagal'. nilai_lama = cadangan persis yang dipakai tombol Kembalikan;
-- Kembalikan menulis nilai_lama hanya bila isi ABT sekarang masih sama dengan
-- nilai_baru suntingan itu (tidak menimpa ubahan orang lain sesudahnya).
-- Jejak jujur hanya di sini; ABT tidak diberi tanda ALETA.
--
-- Tanpa CHECK: nilai yang sah dijaga modulnya
-- (src/server/modules/pengaturan-abt/service.ts).
--
-- NOMOR: 0066 (idx 63) diklaim 16 Okt 2026 oleh agen Tahap H (0064/0065
-- diklaim 12 Okt tetapi tidak pernah masuk branch mana pun; jurnal wajib tanpa
-- lubang, jadi idx 63 dipakai di sini). Lihat memori migrasi-0039-diklaim.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_ABT_SUNTINGAN);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/pengaturan-sipp-abt-16okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_abt_suntingan (
  id TEXT PRIMARY KEY,
  jenis TEXT NOT NULL,
  kunci TEXT NOT NULL,
  ringkas TEXT NOT NULL DEFAULT '',
  nilai_lama TEXT NOT NULL DEFAULT '{}',
  nilai_baru TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'menunggu',
  galat TEXT NOT NULL DEFAULT '',
  pulih_dari TEXT NOT NULL DEFAULT '',
  oleh_id TEXT NOT NULL DEFAULT '',
  oleh_nama TEXT NOT NULL DEFAULT '',
  oleh_peran TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  pada TEXT NOT NULL,
  selesai_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_abt_suntingan_kunci ON aleta_abt_suntingan(jenis, kunci, pada);

CREATE INDEX IF NOT EXISTS idx_abt_suntingan_pada ON aleta_abt_suntingan(pada);
