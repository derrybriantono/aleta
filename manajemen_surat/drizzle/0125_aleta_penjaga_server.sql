-- =============================================================================
-- PENJAGA SERVER - RIWAYAT KEJADIAN (N4, 1 November 2026)
-- =============================================================================
--
-- Penjaga server memantau ruang disk, cadangan, layanan, dan sertifikat, lalu mengabari Super Admin lewat
-- WhatsApp (tanpa AI, hanya mengabari - tidak pernah membersihkan atau menghapus apa pun di server).
-- Satu baris = satu KEJADIAN (dari mulai sampai pulih). Dipakai untuk (1) satu pesan per kejadian dan
-- tahan ulang, (2) kabar "pulih", (3) riwayat di layar Super Admin. Aturan: src/lib/penjaga-server.ts;
-- mesin: src/server/modules/penjaga-server/layanan.ts. Pengaturannya di aleta_ekstensi_setelan (*sistem*).
--
--   kunci              jenis kejadian, mis. disk:/home, cadangan, layanan:bot
--   tingkat            peringatan | merah
--   berturut           berapa kali berturut-turut terlihat (layanan baru dikabari bila sudah 2x)
--   pulih_at           kosong = masih berlangsung
--   kabar_at           kabar terakhir yang terkirim; kabar_tingkat tingkatnya (naik ke merah = kabar baru)
--   kabar_pulih_at     kabar "pulih" yang sudah terkirim
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modulnya. Riwayat > 90 hari dibuang modul.
--
-- NOMOR: 0125 (idx 109) diklaim 1 Nov 2026 (agen N4 penjaga-server; D:/Aplikasi/aleta/tmp/klaim-1nov.txt).
-- idx 106-108 = 0122-0124 milik cabang lain; idx berurutan setelah semua cabang digabung.
--
-- TIGA TEMPAT PENDAFTARAN: berkas ini + meta/_journal.json; DDL_PENJAGA_SERVER di src/server/db/schema.ts;
-- tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts). Kesamaannya dijaga src/test/penjaga-server-1nov.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_penjaga_kejadian (
  id TEXT PRIMARY KEY,
  kunci TEXT NOT NULL,
  tingkat TEXT NOT NULL,
  judul TEXT NOT NULL DEFAULT '',
  uraian TEXT NOT NULL DEFAULT '',
  mulai_at TEXT NOT NULL,
  terakhir_dilihat_at TEXT NOT NULL,
  berturut INTEGER NOT NULL DEFAULT 1,
  pulih_at TEXT NOT NULL DEFAULT '',
  kabar_at TEXT NOT NULL DEFAULT '',
  kabar_tingkat TEXT NOT NULL DEFAULT '',
  jumlah_kabar INTEGER NOT NULL DEFAULT 0,
  kabar_pulih_at TEXT NOT NULL DEFAULT '',
  catatan TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_penjaga_kejadian_kunci ON aleta_penjaga_kejadian(kunci, pulih_at);

CREATE INDEX IF NOT EXISTS idx_penjaga_kejadian_mulai ON aleta_penjaga_kejadian(mulai_at);
