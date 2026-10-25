-- =============================================================================
-- PUSAT KESEHATAN + CATATAN GALAT + HASIL UJI BEBAN (E2, 25 Okt 2026)
-- =============================================================================
--
--   aleta_catatan_galat           satu baris per KELOMPOK galat (sidik = sha256
--                                 dari sumber + jenis + pesan yang sudah
--                                 dibersihkan + lokasi). Jumlah kejadian naik
--                                 tanpa menambah baris.
--   aleta_catatan_galat_kejadian  rincian per kejadian (halaman, akun, peramban,
--                                 versi, potongan stack). Retensi 90 hari,
--                                 dipangkas modul; isinya TIDAK memuat sandi,
--                                 token, atau data perkara (dibersihkan modul).
--   aleta_uji_beban_hasil         hasil skrip uji beban (scripts/uji-beban.mjs)
--                                 yang diimpor Super Admin; Pusat kesehatan
--                                 menampilkan yang terakhir.
--   aleta_kesehatan_status        warna terakhir tiap komponen + kapan mulai
--                                 merah + kapan terakhir diperingatkan lewat
--                                 WhatsApp (supaya peringatan tidak berulang).
--   aleta_kesehatan_riwayat       satu baris per pemeriksaan berkala (14 hari).
--   aleta_perangkat.versi_ekstensi  versi ekstensi yang dilaporkan PC itu.
--
-- Saklar (pemeriksaan berkala + WhatsApp) disimpan di aleta_ekstensi_setelan
-- (pengguna *sistem*), MATI bawaan; tidak perlu tabel.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai sah dijaga modul
-- (src/server/modules/kesehatan/*). Waktu ISO UTC sebagai TEXT.
--
-- NOMOR: rantai E memegang 0094, 0095, 0104. Jurnal memakai idx sementara 81 (menyambung 80 agar uji "idx = urutan" tetap hijau)
-- (dirapikan saat gabung akhir).
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_KESEHATAN_GALAT);
--   (c) tabel-tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_catatan_galat (
  id TEXT PRIMARY KEY,
  sidik TEXT NOT NULL,
  sumber TEXT NOT NULL,
  jenis TEXT NOT NULL DEFAULT '',
  pesan TEXT NOT NULL DEFAULT '',
  lokasi TEXT NOT NULL DEFAULT '',
  jumlah INTEGER NOT NULL DEFAULT 1,
  pertama_at TEXT NOT NULL,
  terakhir_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'baru',
  ditangani_oleh TEXT NOT NULL DEFAULT '',
  ditangani_at TEXT NOT NULL DEFAULT '',
  catatan TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_catatan_galat_kejadian (
  id TEXT PRIMARY KEY,
  galat_id TEXT NOT NULL,
  waktu TEXT NOT NULL,
  halaman TEXT NOT NULL DEFAULT '',
  akun_id TEXT NOT NULL DEFAULT '',
  akun_nama TEXT NOT NULL DEFAULT '',
  peramban TEXT NOT NULL DEFAULT '',
  versi TEXT NOT NULL DEFAULT '',
  potongan_stack TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_uji_beban_hasil (
  id TEXT PRIMARY KEY,
  diimpor_at TEXT NOT NULL,
  diimpor_oleh TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  perangkat INTEGER NOT NULL DEFAULT 0,
  profil TEXT NOT NULL DEFAULT '',
  sasaran TEXT NOT NULL DEFAULT '',
  durasi_detik INTEGER NOT NULL DEFAULT 0,
  p95_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  galat_persen DOUBLE PRECISION NOT NULL DEFAULT 0,
  hasil_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS aleta_kesehatan_status (
  kunci TEXT PRIMARY KEY,
  warna TEXT NOT NULL DEFAULT 'kelabu',
  sejak TEXT NOT NULL,
  diperiksa_at TEXT NOT NULL,
  merah_berturut INTEGER NOT NULL DEFAULT 0,
  diperingatkan_at TEXT NOT NULL DEFAULT '',
  ringkas TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_kesehatan_riwayat (
  id TEXT PRIMARY KEY,
  waktu TEXT NOT NULL,
  warna TEXT NOT NULL DEFAULT 'kelabu',
  ringkas_json TEXT NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catatan_galat_sidik ON aleta_catatan_galat(sidik);

CREATE INDEX IF NOT EXISTS idx_catatan_galat_terakhir ON aleta_catatan_galat(terakhir_at);

CREATE INDEX IF NOT EXISTS idx_catatan_galat_kejadian_galat ON aleta_catatan_galat_kejadian(galat_id, waktu);

CREATE INDEX IF NOT EXISTS idx_catatan_galat_kejadian_waktu ON aleta_catatan_galat_kejadian(waktu);

CREATE INDEX IF NOT EXISTS idx_uji_beban_hasil_dibuat ON aleta_uji_beban_hasil(dibuat_at);

CREATE INDEX IF NOT EXISTS idx_kesehatan_riwayat_waktu ON aleta_kesehatan_riwayat(waktu);

ALTER TABLE aleta_perangkat ADD COLUMN IF NOT EXISTS versi_ekstensi TEXT NOT NULL DEFAULT '';
