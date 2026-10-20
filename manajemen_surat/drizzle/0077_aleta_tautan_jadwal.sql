-- =============================================================================
-- TAUTAN JADWAL SIDANG - tampilan Jadwal Sidang tanpa akun, lewat rahasia
-- =============================================================================
--
-- 20 Oktober 2026 (permintaan pengguna): Jadwal Sidang dapat dibuka lewat
-- alamat /jadwal/<rahasia> tanpa masuk akun. Tombol tunda | putus tetap menulis
-- ke SIPP atas panitera pengganti perkara itu, jadi tautannya dijaga: rahasia
-- panjang acak yang disimpan sebagai HASH sha256 (rahasia asli hanya tampak
-- sekali saat dibuat), hanya dari jaringan kantor, masa berlaku opsional,
-- dapat dicabut, batas laju, dan jejak jujur tiap tindakan menulis.
--
--   aleta_tautan_jadwal          satu baris per tautan (hash, akun yang diwakili,
--                                masa berlaku, pencabutan, pemakaian terakhir)
--   aleta_tautan_jadwal_jejak    satu baris per tindakan MENULIS lewat tautan:
--                                sumber (nama tautan), IP, waktu, perkara, aksi
--   aleta_tautan_jadwal_saklar   satu baris (id = 1): mati = 1 menghentikan
--                                SEMUA tautan sekaligus
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul
-- (src/server/modules/tautan-jadwal/service.ts).
--
-- NOMOR: 0077 diklaim 20 Okt 2026 (0075 dan 0076 diklaim agen lain). Jurnal
-- wajib tanpa lubang, jadi memakai idx 70.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_TAUTAN_JADWAL);
--   (c) ketiga tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/tautan-jadwal-20okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_tautan_jadwal (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  hash_rahasia TEXT NOT NULL,
  bertindak_sebagai TEXT NOT NULL,
  bertindak_nama TEXT NOT NULL DEFAULT '',
  berlaku_sampai TEXT NOT NULL DEFAULT '',
  dicabut_pada TEXT NOT NULL DEFAULT '',
  dicabut_oleh TEXT NOT NULL DEFAULT '',
  dibuat_oleh TEXT NOT NULL,
  dibuat_nama TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  terakhir_dipakai TEXT NOT NULL DEFAULT '',
  terakhir_ip TEXT NOT NULL DEFAULT '',
  jumlah_pakai INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS aleta_tautan_jadwal_jejak (
  id TEXT PRIMARY KEY,
  tautan_id TEXT NOT NULL,
  tautan_nama TEXT NOT NULL DEFAULT '',
  bertindak_sebagai TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  waktu TEXT NOT NULL,
  metode TEXT NOT NULL DEFAULT '',
  jalur TEXT NOT NULL DEFAULT '',
  aksi TEXT NOT NULL DEFAULT '',
  perkara TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_tautan_jadwal_saklar (
  id INTEGER PRIMARY KEY,
  mati INTEGER NOT NULL DEFAULT 0,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_pada TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tautan_jadwal_hash ON aleta_tautan_jadwal(hash_rahasia);

CREATE INDEX IF NOT EXISTS idx_tautan_jadwal_jejak ON aleta_tautan_jadwal_jejak(tautan_id, waktu);
