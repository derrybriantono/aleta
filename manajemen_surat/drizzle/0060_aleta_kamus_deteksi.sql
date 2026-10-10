-- =============================================================================
-- KAMUS DETEKSI & KALIMAT - LAPIS DATABASE, JEJAK KOREKSI, CALON DARI KOREKSI
-- =============================================================================
--
-- 10 Oktober 2026 (paket deteksi lengkap, butir D2, P8, P9). Kontrak bersama:
-- aleta_bot/kamus-deteksi/README.md. Pola deteksi dan templat kalimat adalah
-- DATA dua lapis: benih JSON (ikut citra Docker) dan baris di sini (layar Admin
-- "Kamus deteksi & kalimat"). Baris dengan kode yang sama MENIMPA benih;
-- status "nonaktif" mematikan pola benih; status "draf" TIDAK dikirim ke bot
-- (benihnya tetap berlaku sampai drafnya diaktifkan).
--
--   aleta_kamus_deteksi_pola     pola deteksi (regex) per kelompok
--   aleta_kamus_deteksi_templat  templat rangkaian kata per kelompok
--   aleta_jejak_koreksi          D2: usulan ALETA vs nilai akhir yang disimpan
--                                petugas ke ABT, per variabel per perkara.
--                                Jejak jujur hanya di sini; ABT tidak diberi tanda.
--   aleta_kamus_deteksi_calon    P8: koreksi yang berulang menjadi CALON pola /
--                                templat. Calon TIDAK PERNAH aktif sendiri -
--                                admin menerimanya (jadi aktif/draf) atau menolak.
--
-- Tanpa CHECK: nilai yang sah dijaga modulnya
-- (src/server/modules/aleta-ecourt/kamus-deteksi.ts).
--
-- NOMOR: 0060 (idx 59) dan 0061 (idx 60) diklaim 10 Okt 2026 oleh Agen 4 -
-- assert di D:/aleta-dev/kerja/deteksi-lengkap/klaim-0060-0061.cjs (idx 58 =
-- 0059_aleta_kamus_variabel_sumber adalah entri terakhir).
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_KAMUS_DETEKSI);
--   (c) keempat tabel di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/kamus-deteksi-db-10okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_kamus_deteksi_pola (
  id TEXT PRIMARY KEY,
  kode TEXT NOT NULL,
  kelompok TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  kunci TEXT NOT NULL DEFAULT '',
  regex TEXT NOT NULL,
  flags TEXT NOT NULL DEFAULT 'i',
  status TEXT NOT NULL DEFAULT 'draf',
  yakin TEXT NOT NULL DEFAULT 'ragu',
  contoh_benar TEXT NOT NULL DEFAULT '[]',
  contoh_salah TEXT NOT NULL DEFAULT '[]',
  ukur TEXT NOT NULL DEFAULT '{}',
  catatan TEXT NOT NULL DEFAULT '',
  asal_calon TEXT NOT NULL DEFAULT '',
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_kamus_deteksi_templat (
  id TEXT PRIMARY KEY,
  kode TEXT NOT NULL,
  kelompok TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  gaya TEXT NOT NULL DEFAULT '',
  teks TEXT NOT NULL,
  syarat TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draf',
  catatan TEXT NOT NULL DEFAULT '',
  asal_calon TEXT NOT NULL DEFAULT '',
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_jejak_koreksi (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  variabel TEXT NOT NULL,
  nama_variabel TEXT NOT NULL DEFAULT '',
  nilai_usulan TEXT NOT NULL DEFAULT '',
  sumber TEXT NOT NULL DEFAULT '',
  kode_pola TEXT NOT NULL DEFAULT '',
  keyakinan TEXT NOT NULL DEFAULT '',
  kalimat_sumber TEXT NOT NULL DEFAULT '',
  nilai_akhir TEXT NOT NULL DEFAULT '',
  hasil TEXT NOT NULL DEFAULT '',
  jalur TEXT NOT NULL DEFAULT '',
  petugas_id TEXT NOT NULL DEFAULT '',
  petugas_nama TEXT NOT NULL DEFAULT '',
  pada TEXT NOT NULL,
  dibuat_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_kamus_deteksi_calon (
  id TEXT PRIMARY KEY,
  jenis TEXT NOT NULL,
  sidik TEXT NOT NULL,
  kelompok TEXT NOT NULL DEFAULT '',
  variabel TEXT NOT NULL DEFAULT '',
  kode_pola_asal TEXT NOT NULL DEFAULT '',
  usul_kode TEXT NOT NULL DEFAULT '',
  usul_label TEXT NOT NULL DEFAULT '',
  usul_kunci TEXT NOT NULL DEFAULT '',
  usul_regex TEXT NOT NULL DEFAULT '',
  usul_flags TEXT NOT NULL DEFAULT 'i',
  usul_teks TEXT NOT NULL DEFAULT '',
  contoh_benar TEXT NOT NULL DEFAULT '[]',
  contoh_salah TEXT NOT NULL DEFAULT '[]',
  jumlah_koreksi INTEGER NOT NULL DEFAULT 0,
  jumlah_perkara INTEGER NOT NULL DEFAULT 0,
  jumlah_dipakai INTEGER NOT NULL DEFAULT 0,
  bukti TEXT NOT NULL DEFAULT '[]',
  alasan TEXT NOT NULL DEFAULT '',
  keadaan TEXT NOT NULL DEFAULT 'menunggu',
  ditinjau_oleh TEXT NOT NULL DEFAULT '',
  ditinjau_at TEXT NOT NULL DEFAULT '',
  alasan_tolak TEXT NOT NULL DEFAULT '',
  hasil_kode TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kamus_deteksi_pola_kode ON aleta_kamus_deteksi_pola(kode);

CREATE INDEX IF NOT EXISTS idx_kamus_deteksi_pola_kelompok ON aleta_kamus_deteksi_pola(kelompok, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kamus_deteksi_templat_kode ON aleta_kamus_deteksi_templat(kode);

CREATE INDEX IF NOT EXISTS idx_kamus_deteksi_templat_kelompok ON aleta_kamus_deteksi_templat(kelompok, status);

CREATE INDEX IF NOT EXISTS idx_jejak_koreksi_variabel ON aleta_jejak_koreksi(variabel, hasil);

CREATE INDEX IF NOT EXISTS idx_jejak_koreksi_perkara ON aleta_jejak_koreksi(perkara_id, pada);

CREATE INDEX IF NOT EXISTS idx_jejak_koreksi_pola ON aleta_jejak_koreksi(kode_pola);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kamus_deteksi_calon_sidik ON aleta_kamus_deteksi_calon(sidik);

CREATE INDEX IF NOT EXISTS idx_kamus_deteksi_calon_keadaan ON aleta_kamus_deteksi_calon(keadaan, jenis);
