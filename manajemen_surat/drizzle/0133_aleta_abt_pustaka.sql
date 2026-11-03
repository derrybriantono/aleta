-- =============================================================================
-- PUSTAKA ALETA ABT (3 Nov 2026, Tahap 1) - blangko Derry disimpan di database ALETA sendiri
-- =============================================================================
--
-- Permintaan Derry: seluruh "Blangko ABT by Derry Briantono" (berkas RTF, variabel yang dipakai,
-- hak menu folder) ikut tersimpan di ALETA, supaya bila dipasang di server lain tidak bergantung
-- pada nomor variabel ABT setempat; ancang-ancang aplikasi tersendiri ALETA ABT.
--
-- KUNCI: variabel berkunci KODE ALETA ABT sendiri (AA + 5 angka) yang tidak berubah lagi sesudah
-- diberikan. Nomor variabel ABT (#NNNN#) hanya PETA per server di aleta_abt_peta_variabel - server
-- lain boleh memetakan kode yang sama ke nomor berbeda, atau tidak memetakannya sama sekali.
--
-- SINKRON SATU ARAH ABT -> ALETA ABT, TIDAK PERNAH MENIMPA (src/lib/aleta-abt-pustaka.ts):
--   baru            ditambahkan (asal 'abt', sidik_asal = sidik ABT)
--   sama            tidak ditulis
--   berubah di ABT  baris yang BELUM diubah di ALETA ABT ikut diperbarui
--   bentrok         baris yang SUDAH diubah di ALETA ABT (diubah = 1, atau asal 'aleta') dibiarkan;
--                   sidik ABT dicatat di bentrok_sidik/bentrok_md5 + bentrok_at
--   hilang di ABT   status 'hilang' + hilang_at, TIDAK dihapus
-- ABT dibaca saja (bot ALETA, MariaDB 5.5 + folder blangko hanya-baca); tidak satu baris pun ditulis ke ABT/SIPP.
-- Isi RTF disimpan sebagai teks latin1 apa adanya (pengkodean 'latin1'; 'base64' bila memuat bita nol).
--
-- NOMOR: 0133, jurnal idx 115 (klaim agen DBDERRY di klaim-1nov.txt). TIGA TEMPAT:
-- (a) berkas ini + meta/_journal.json; (b) DDL_ALETA_ABT_PUSTAKA di src/server/db/schema.ts;
-- (c) IN_MEMORY_TABLE_PERSISTENCE_ORDER di src/server/db/client.ts. Tanpa kunci asing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_abt_berkas (
  id TEXT PRIMARY KEY,
  folder TEXT NOT NULL DEFAULT '',
  nama TEXT NOT NULL DEFAULT '',
  arsip INTEGER NOT NULL DEFAULT 0,
  isi TEXT NOT NULL DEFAULT '',
  pengkodean TEXT NOT NULL DEFAULT 'latin1',
  md5 TEXT NOT NULL DEFAULT '',
  ukuran INTEGER NOT NULL DEFAULT 0,
  waktu_berkas TEXT NOT NULL DEFAULT '',
  penanda_asal TEXT NOT NULL DEFAULT '[]',
  penanda_kode TEXT NOT NULL DEFAULT '[]',
  asal TEXT NOT NULL DEFAULT 'abt',
  asal_server TEXT NOT NULL DEFAULT '',
  md5_asal TEXT NOT NULL DEFAULT '',
  diubah INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aktif',
  bentrok_md5 TEXT NOT NULL DEFAULT '',
  bentrok_at TEXT NOT NULL DEFAULT '',
  hilang_at TEXT NOT NULL DEFAULT '',
  disinkron_at TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_abt_variabel (
  kode TEXT PRIMARY KEY,
  nama TEXT NOT NULL DEFAULT '',
  tipe TEXT,
  data_tabel TEXT,
  data_kolom TEXT,
  urutan_data TEXT,
  referensi_asal TEXT,
  referensi_kode TEXT NOT NULL DEFAULT '',
  sql_query TEXT,
  default_data TEXT,
  multi_sidang TEXT,
  dikunci INTEGER NOT NULL DEFAULT 0,
  pengubah_asal TEXT NOT NULL DEFAULT '',
  waktu_asal TEXT NOT NULL DEFAULT '',
  sumber TEXT NOT NULL DEFAULT 'blangko',
  jumlah_blangko INTEGER NOT NULL DEFAULT 0,
  rujukan_asal TEXT NOT NULL DEFAULT '[]',
  rujukan_kode TEXT NOT NULL DEFAULT '[]',
  asal TEXT NOT NULL DEFAULT 'abt',
  asal_server TEXT NOT NULL DEFAULT '',
  asal_no TEXT NOT NULL DEFAULT '',
  sidik_asal TEXT NOT NULL DEFAULT '',
  diubah INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aktif',
  bentrok_sidik TEXT NOT NULL DEFAULT '',
  bentrok_at TEXT NOT NULL DEFAULT '',
  hilang_at TEXT NOT NULL DEFAULT '',
  disinkron_at TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_abt_peta_variabel (
  id TEXT PRIMARY KEY,
  server TEXT NOT NULL,
  no_var TEXT NOT NULL,
  kode TEXT NOT NULL,
  sidik TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'aktif',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_abt_menu (
  id TEXT PRIMARY KEY,
  nama TEXT,
  nama_alias TEXT,
  parent_direktori TEXT,
  user_grup_id TEXT,
  user_top_id TEXT,
  user_validator TEXT,
  user_cek TEXT,
  proses_id_min TEXT,
  proses_id_max TEXT,
  perkara_id_min TEXT,
  perkara_id_max TEXT,
  perkara_id_referensi TEXT,
  asal_id TEXT NOT NULL DEFAULT '',
  waktu_asal TEXT NOT NULL DEFAULT '',
  asal TEXT NOT NULL DEFAULT 'abt',
  asal_server TEXT NOT NULL DEFAULT '',
  sidik_asal TEXT NOT NULL DEFAULT '',
  diubah INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aktif',
  bentrok_sidik TEXT NOT NULL DEFAULT '',
  bentrok_at TEXT NOT NULL DEFAULT '',
  hilang_at TEXT NOT NULL DEFAULT '',
  disinkron_at TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_abt_sinkron (
  id TEXT PRIMARY KEY,
  server TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'jalan',
  oleh TEXT NOT NULL DEFAULT '',
  sidik TEXT NOT NULL DEFAULT '',
  ringkasan TEXT NOT NULL DEFAULT '{}',
  galat TEXT NOT NULL DEFAULT '',
  mulai_at TEXT NOT NULL,
  selesai_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_abt_berkas_folder ON aleta_abt_berkas(folder, status);
CREATE INDEX IF NOT EXISTS idx_abt_variabel_status ON aleta_abt_variabel(status, asal_server);
CREATE UNIQUE INDEX IF NOT EXISTS idx_abt_peta_server_no ON aleta_abt_peta_variabel(server, no_var);
CREATE INDEX IF NOT EXISTS idx_abt_peta_kode ON aleta_abt_peta_variabel(kode, server);
CREATE INDEX IF NOT EXISTS idx_abt_menu_status ON aleta_abt_menu(status, asal_server);
CREATE INDEX IF NOT EXISTS idx_abt_sinkron_mulai ON aleta_abt_sinkron(mulai_at);
