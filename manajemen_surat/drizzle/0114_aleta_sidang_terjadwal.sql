-- =============================================================================
-- UNGGAH BAS TERJADWAL & TUNDAAN TERJADWAL (27 Oktober 2026)
-- =============================================================================
--
-- Petugas memilih sidang, mengisi (tunda) atau menyeret berkas (BAS), memilih jam, lalu SERVER
-- menulis ke SIPP lewat bot pada waktunya - tanpa peramban yang terbuka. Pola dari unggah putusan
-- terjadwal (0080), tetapi satu baris = satu pekerjaan (tanpa jadwal induk, tanpa langkah ganda).
--
--   aleta_sidang_terjadwal         satu pekerjaan: jenis ('bas' | 'tunda'), siapa menjadwalkan (akun ALETA, peran,
--                                  akun SIPP, alamat peramban), sidangnya (perkara_id, jadwal_id, tanggal_sidang),
--                                  saat rencana (ISO UTC + teks WITA), muatan untuk bot (muatan_json), berkas BAS
--                                  (di folder ALETA_UPLOAD_DIR/sidang-terjadwal, bukan di basis data), status,
--                                  klaim pelaksana, dan hasil.
--   aleta_sidang_terjadwal_jejak   jejak jujur tiap peristiwa: dijadwalkan, dimulai, selesai/dilewati/gagal, dibatalkan.
--
-- Status: menunggu | jalan | selesai | dilewati (sudah ada di SIPP) | gagal | dibatalkan | kedaluwarsa.
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul
-- (src/server/modules/sidang-terjadwal/*, src/lib/sidang-terjadwal.ts).
-- Waktu disimpan ISO UTC sebagai TEXT; waktu_rencana_wita "YYYY-MM-DD HH:mm" untuk dibaca petugas.
-- Tidak ada kata ALETA yang ditulis ke SIPP dari tabel ini: semuanya hanya catatan ALETA sendiri.
--
-- NOMOR: 0114 diklaim 27 Okt 2026 (jurnal terakhir idx 99 = 0113); idx 100.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_SIDANG_TERJADWAL);
--   (c) kedua tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/sidang-terjadwal-27okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_sidang_terjadwal (
  id TEXT PRIMARY KEY,
  jenis TEXT NOT NULL,
  dibuat_oleh TEXT NOT NULL,
  dibuat_nama TEXT NOT NULL DEFAULT '',
  peran TEXT NOT NULL DEFAULT '',
  akun_sipp TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  perkara_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL,
  jadwal_id TEXT NOT NULL,
  tanggal_sidang TEXT NOT NULL,
  waktu_rencana TEXT NOT NULL,
  waktu_rencana_wita TEXT NOT NULL DEFAULT '',
  muatan_json TEXT NOT NULL DEFAULT '{}',
  berkas_nama TEXT NOT NULL DEFAULT '',
  berkas_bentuk TEXT NOT NULL DEFAULT '',
  berkas_ukuran INTEGER NOT NULL DEFAULT 0,
  berkas_sha256 TEXT NOT NULL DEFAULT '',
  berkas_jalur TEXT NOT NULL DEFAULT '',
  berkas_hapus_pada TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'menunggu',
  percobaan INTEGER NOT NULL DEFAULT 0,
  klaim_oleh TEXT NOT NULL DEFAULT '',
  klaim_sampai TEXT NOT NULL DEFAULT '',
  tunggu_sampai TEXT NOT NULL DEFAULT '',
  hasil_ringkas TEXT NOT NULL DEFAULT '',
  hasil_json TEXT NOT NULL DEFAULT '{}',
  mulai_pada TEXT NOT NULL DEFAULT '',
  selesai_pada TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sidang_terjadwal_jejak (
  id TEXT PRIMARY KEY,
  butir_id TEXT NOT NULL DEFAULT '',
  jenis TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  waktu TEXT NOT NULL,
  peristiwa TEXT NOT NULL,
  pelaku TEXT NOT NULL DEFAULT '',
  pelaku_id TEXT NOT NULL DEFAULT '',
  akun_sipp TEXT NOT NULL DEFAULT '',
  hasil TEXT NOT NULL DEFAULT '',
  ringkas TEXT NOT NULL DEFAULT '',
  rinci_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sidang_terjadwal_giliran ON aleta_sidang_terjadwal(status, waktu_rencana);

CREATE INDEX IF NOT EXISTS idx_sidang_terjadwal_pembuat ON aleta_sidang_terjadwal(dibuat_oleh, status);

CREATE INDEX IF NOT EXISTS idx_sidang_terjadwal_sidang ON aleta_sidang_terjadwal(jenis, jadwal_id, status);

CREATE INDEX IF NOT EXISTS idx_sidang_terjadwal_perkara ON aleta_sidang_terjadwal(perkara_id, status);

CREATE INDEX IF NOT EXISTS idx_sidang_terjadwal_jejak_butir ON aleta_sidang_terjadwal_jejak(butir_id, waktu);

CREATE INDEX IF NOT EXISTS idx_sidang_terjadwal_jejak_waktu ON aleta_sidang_terjadwal_jejak(waktu);
