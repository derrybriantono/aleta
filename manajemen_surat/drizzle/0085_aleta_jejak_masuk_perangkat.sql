-- =============================================================================
-- JEJAK MASUK & PERANGKAT (23 Okt 2026)
-- =============================================================================
--
-- Permintaan Super Admin: audit trail masuk yang lengkap dan batas jumlah
-- perangkat yang boleh masuk bersamaan (per peran + pengecualian per akun).
--
--   aleta_jejak_masuk          log peristiwa: MASUK, MASUK_GAGAL, KELUAR,
--                              MASUK_DITOLAK_BATAS_PERANGKAT, SESI_DICABUT,
--                              SESI_KEDALUWARSA, PERANGKAT_BARU, IP_BERUBAH.
--                              sesi_ref = hash sesi, BUKAN token.
--   aleta_perangkat            satu baris per (perangkat_id, user_id);
--                              perangkat_id = kuki aleta_perangkat (acak).
--                              MAC hanya catatan beserta sumbernya, tidak
--                              pernah dipakai untuk keputusan keamanan.
--   aleta_sesi_perangkat       sesi -> perangkat (menghitung dan mencabut).
--   aleta_batas_perangkat      kebijakan: cakupan 'peran' (sasaran = roleId)
--                              atau 'akun' (sasaran = user id). maks 0 = tanpa
--                              batas. Tanpa baris = tanpa batas (bawaan).
--   aleta_tiket_perangkat      tiket sekali pakai 5 menit "pilih perangkat yang
--                              dikeluarkan"; id = SHA-256 tiket, bukan tiketnya.
--   aleta_setelan_jejak_masuk  retensi, jam kerja, saklar akun Windows.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul
-- (src/server/modules/perangkat/). Waktu ISO UTC sebagai TEXT. Tidak ada yang
-- ditulis ke SIPP/ABT/e-Court dari tabel ini.
--
-- NOMOR: 0085 (0084 diklaim fitur/t1-aleta-ai-tahap2). Di cabang ini jurnal
-- terakhir idx 75 = 0083, jadi 0085 memakai idx 76; bila 0084 digabung lebih
-- dulu, idx disesuaikan saat penggabungan (when 0085 sengaja lebih besar).
--
-- TIGA TEMPAT PENDAFTARAN: berkas ini + meta/_journal.json; DDL_JEJAK_PERANGKAT
-- di src/server/db/schema.ts; tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER.
-- Kesamaan dijaga src/test/jejak-masuk-perangkat.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_jejak_masuk (
  id TEXT PRIMARY KEY,
  waktu TEXT NOT NULL,
  peristiwa TEXT NOT NULL,
  alasan TEXT NOT NULL DEFAULT '',
  jalur TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  nama TEXT NOT NULL DEFAULT '',
  peran TEXT NOT NULL DEFAULT '',
  identitas_samar TEXT NOT NULL DEFAULT '',
  sesi_ref TEXT NOT NULL DEFAULT '',
  perangkat_id TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  rantai_xff TEXT NOT NULL DEFAULT '',
  agen TEXT NOT NULL DEFAULT '',
  jenis_perangkat TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT '',
  peramban TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  ingat TEXT NOT NULL DEFAULT '',
  nama_komputer TEXT NOT NULL DEFAULT '',
  mac TEXT NOT NULL DEFAULT '',
  mac_sumber TEXT NOT NULL DEFAULT '',
  pelaku_id TEXT NOT NULL DEFAULT '',
  pelaku_nama TEXT NOT NULL DEFAULT '',
  rincian TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS aleta_perangkat (
  id TEXT PRIMARY KEY,
  perangkat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  nama_terbaca TEXT NOT NULL DEFAULT '',
  jenis TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT '',
  os_rinci TEXT NOT NULL DEFAULT '',
  peramban TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  agen TEXT NOT NULL DEFAULT '',
  nama_komputer TEXT NOT NULL DEFAULT '',
  akun_windows TEXT NOT NULL DEFAULT '',
  mac TEXT NOT NULL DEFAULT '',
  mac_sumber TEXT NOT NULL DEFAULT '',
  mac_catatan TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  ip_terakhir TEXT NOT NULL DEFAULT '',
  pertama_dilihat TEXT NOT NULL,
  terakhir_dilihat TEXT NOT NULL,
  data_ekstensi_pada TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_sesi_perangkat (
  session_id TEXT PRIMARY KEY,
  sesi_ref TEXT NOT NULL,
  perangkat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  jalur TEXT NOT NULL DEFAULT '',
  ip_awal TEXT NOT NULL DEFAULT '',
  ip_terakhir TEXT NOT NULL DEFAULT '',
  ingat TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  terakhir_aktif TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_batas_perangkat (
  id TEXT PRIMARY KEY,
  cakupan TEXT NOT NULL,
  sasaran TEXT NOT NULL,
  maks INTEGER NOT NULL DEFAULT 0,
  perilaku TEXT NOT NULL DEFAULT 'keluarkan-terlama',
  berlaku_sampai TEXT NOT NULL DEFAULT '',
  alasan TEXT NOT NULL DEFAULT '',
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_nama TEXT NOT NULL DEFAULT '',
  diubah_pada TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_tiket_perangkat (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  perangkat_id TEXT NOT NULL,
  jalur TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  kedaluwarsa_pada TEXT NOT NULL,
  dipakai_pada TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_setelan_jejak_masuk (
  kunci TEXT PRIMARY KEY,
  nilai TEXT NOT NULL DEFAULT '',
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_pada TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_jejak_masuk_waktu ON aleta_jejak_masuk(waktu);

CREATE INDEX IF NOT EXISTS idx_jejak_masuk_akun ON aleta_jejak_masuk(user_id, waktu);

CREATE INDEX IF NOT EXISTS idx_jejak_masuk_perangkat ON aleta_jejak_masuk(perangkat_id, waktu);

CREATE INDEX IF NOT EXISTS idx_jejak_masuk_ip ON aleta_jejak_masuk(ip, waktu);

CREATE UNIQUE INDEX IF NOT EXISTS idx_perangkat_kunci ON aleta_perangkat(perangkat_id, user_id);

CREATE INDEX IF NOT EXISTS idx_perangkat_akun ON aleta_perangkat(user_id, terakhir_dilihat);

CREATE INDEX IF NOT EXISTS idx_sesi_perangkat_akun ON aleta_sesi_perangkat(user_id, perangkat_id);

CREATE INDEX IF NOT EXISTS idx_sesi_perangkat_ref ON aleta_sesi_perangkat(sesi_ref);

CREATE UNIQUE INDEX IF NOT EXISTS idx_batas_perangkat_kunci ON aleta_batas_perangkat(cakupan, sasaran);

CREATE INDEX IF NOT EXISTS idx_tiket_perangkat_akun ON aleta_tiket_perangkat(user_id, kedaluwarsa_pada);
