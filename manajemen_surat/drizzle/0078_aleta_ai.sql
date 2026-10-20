-- =============================================================================
-- ALETA Ai TAHAP 1 (server): proyek V4.5, percakapan, saldo, tarif, kurs, rute
-- =============================================================================
--
-- 20 Oktober 2026. Fondasi sisi server ALETA Ai: asisten hukum di dalam portal
-- yang memakai Project "ALETA AI PA V4.5" (core prompt + modul) dan memanggil
-- API Claude dari server. Kunci API hanya di env server (ANTHROPIC_API_KEY),
-- tidak pernah di basis data.
--
--   aleta_ai_proyek      versi proyek V4.5 (core prompt, modul + pemicu, menu,
--                        lampiran non-teks untuk tahap 3); satu baris aktif
--   aleta_ai_obrolan  percakapan milik satu pengguna (judul terenkripsi)
--   aleta_ai_obrolan_pesan       pesan; isi terenkripsi; token per jenis; biaya USD,
--                        kurs, biaya rupiah yang ditagih
--   aleta_ai_penggunaan   satu baris per panggilan API (jawaban, klasifikasi)
--   aleta_ai_saldo       saldo per pengguna - HANYA berubah bersama baris
--                        aleta_ai_mutasi (saldo = jumlah mutasi)
--   aleta_ai_mutasi      buku mutasi: isi, tahan, lepas, potong, koreksi
--   aleta_ai_harga       tarif per model (per juta token), diisi Super Admin
--   aleta_ai_kurs        kurs USD-IDR harian dengan sumbernya
--   aleta_ai_pengaturan  margin, penyangga kurs, minimum, pembulatan, batas,
--                        saklar
--   aleta_ai_rute        tabel rute model: kelompok -> model, effort, label,
--                        peran yang boleh
--   aleta_ai_jejak       jejak audit (tanpa isi pesan)
--
-- Nama obrolan/obrolan_pesan/penggunaan sengaja BERBEDA dari aleta_ai_percakapan/_pesan/_pemakaian
-- milik lapisan AI lama (0030-0032, lapisan-ai.ts) yang sudah ada dan terpakai.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul
-- (src/server/modules/aleta-ai/*).
--
-- NOMOR: 0078 diklaim 20 Okt 2026 (0075 SKP, 0076 TTD, 0077 tautan jadwal
-- diklaim agen lain). Jurnal wajib tanpa lubang, jadi memakai idx 70.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_ALETA_AI);
--   (c) kesebelas tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/aleta-ai-server-20okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_ai_proyek (
  id TEXT PRIMARY KEY,
  versi INTEGER NOT NULL,
  nama TEXT NOT NULL DEFAULT '',
  core_prompt TEXT NOT NULL DEFAULT '',
  modul_json TEXT NOT NULL DEFAULT '[]',
  menu_json TEXT NOT NULL DEFAULT '[]',
  lampiran_json TEXT NOT NULL DEFAULT '[]',
  sumber_nama TEXT NOT NULL DEFAULT '',
  sumber_sha TEXT NOT NULL DEFAULT '',
  aktif INTEGER NOT NULL DEFAULT 0,
  diunggah_oleh TEXT NOT NULL DEFAULT '',
  diunggah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_obrolan (
  id TEXT PRIMARY KEY,
  pemilik_id TEXT NOT NULL,
  judul TEXT NOT NULL DEFAULT '',
  perkara_ref TEXT NOT NULL DEFAULT '',
  tersembunyi INTEGER NOT NULL DEFAULT 0,
  proyek_versi INTEGER NOT NULL DEFAULT 0,
  jumlah_pesan INTEGER NOT NULL DEFAULT 0,
  dibuat_at TEXT NOT NULL,
  diperbarui_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_obrolan_pesan (
  id TEXT PRIMARY KEY,
  percakapan_id TEXT NOT NULL,
  pemilik_id TEXT NOT NULL,
  peran TEXT NOT NULL,
  isi TEXT NOT NULL DEFAULT '',
  pemicu TEXT NOT NULL DEFAULT '',
  kelompok TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  effort TEXT NOT NULL DEFAULT '',
  mode_label TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'selesai',
  token_masuk INTEGER NOT NULL DEFAULT 0,
  token_keluar INTEGER NOT NULL DEFAULT 0,
  token_cache_tulis INTEGER NOT NULL DEFAULT 0,
  token_cache_baca INTEGER NOT NULL DEFAULT 0,
  biaya_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  kurs_dasar DOUBLE PRECISION NOT NULL DEFAULT 0,
  kurs DOUBLE PRECISION NOT NULL DEFAULT 0,
  biaya_api_rp DOUBLE PRECISION NOT NULL DEFAULT 0,
  biaya_rp INTEGER NOT NULL DEFAULT 0,
  perkiraan_rp INTEGER NOT NULL DEFAULT 0,
  gratis INTEGER NOT NULL DEFAULT 0,
  dibuat_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_penggunaan (
  id TEXT PRIMARY KEY,
  pesan_id TEXT NOT NULL DEFAULT '',
  percakapan_id TEXT NOT NULL DEFAULT '',
  pengguna_id TEXT NOT NULL,
  peran_id TEXT NOT NULL DEFAULT '',
  jenis TEXT NOT NULL DEFAULT 'jawaban',
  model TEXT NOT NULL DEFAULT '',
  effort TEXT NOT NULL DEFAULT '',
  kelompok TEXT NOT NULL DEFAULT '',
  token_masuk INTEGER NOT NULL DEFAULT 0,
  token_keluar INTEGER NOT NULL DEFAULT 0,
  token_cache_tulis INTEGER NOT NULL DEFAULT 0,
  token_cache_baca INTEGER NOT NULL DEFAULT 0,
  biaya_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  kurs_dasar DOUBLE PRECISION NOT NULL DEFAULT 0,
  biaya_api_rp DOUBLE PRECISION NOT NULL DEFAULT 0,
  dibuat_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_saldo (
  pengguna_id TEXT PRIMARY KEY,
  saldo_rp INTEGER NOT NULL DEFAULT 0,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_mutasi (
  id TEXT PRIMARY KEY,
  pengguna_id TEXT NOT NULL,
  jenis TEXT NOT NULL,
  jumlah_rp INTEGER NOT NULL,
  saldo_setelah INTEGER NOT NULL,
  rujukan_id TEXT NOT NULL DEFAULT '',
  catatan TEXT NOT NULL DEFAULT '',
  oleh_id TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_harga (
  model TEXT PRIMARY KEY,
  masuk_per_juta DOUBLE PRECISION NOT NULL DEFAULT 0,
  keluar_per_juta DOUBLE PRECISION NOT NULL DEFAULT 0,
  cache_tulis_per_juta DOUBLE PRECISION NOT NULL DEFAULT 0,
  cache_baca_per_juta DOUBLE PRECISION NOT NULL DEFAULT 0,
  ambang_token INTEGER NOT NULL DEFAULT 0,
  masuk_atas DOUBLE PRECISION NOT NULL DEFAULT 0,
  keluar_atas DOUBLE PRECISION NOT NULL DEFAULT 0,
  cache_tulis_atas DOUBLE PRECISION NOT NULL DEFAULT 0,
  cache_baca_atas DOUBLE PRECISION NOT NULL DEFAULT 0,
  fallback INTEGER NOT NULL DEFAULT 0,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_kurs (
  id TEXT PRIMARY KEY,
  tanggal TEXT NOT NULL,
  kurs DOUBLE PRECISION NOT NULL,
  sumber TEXT NOT NULL DEFAULT '',
  diambil_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_pengaturan (
  kunci TEXT PRIMARY KEY,
  nilai TEXT NOT NULL DEFAULT '',
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_rute (
  kelompok TEXT PRIMARY KEY,
  judul TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  effort TEXT NOT NULL DEFAULT 'medium',
  label TEXT NOT NULL DEFAULT 'Cepat',
  peran_json TEXT NOT NULL DEFAULT '[]',
  urutan INTEGER NOT NULL DEFAULT 0,
  perkiraan_keluaran INTEGER NOT NULL DEFAULT 1000,
  max_tokens INTEGER NOT NULL DEFAULT 8000,
  naik_ke TEXT NOT NULL DEFAULT '',
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_jejak (
  id TEXT PRIMARY KEY,
  waktu TEXT NOT NULL,
  pengguna_id TEXT NOT NULL DEFAULT '',
  peran_id TEXT NOT NULL DEFAULT '',
  aksi TEXT NOT NULL,
  percakapan_id TEXT NOT NULL DEFAULT '',
  pesan_id TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  token_total INTEGER NOT NULL DEFAULT 0,
  biaya_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
  biaya_rp INTEGER NOT NULL DEFAULT 0,
  hasil TEXT NOT NULL DEFAULT '',
  ringkas TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_ai_proyek_versi ON aleta_ai_proyek(versi);

CREATE INDEX IF NOT EXISTS idx_ai_obrolan_pemilik ON aleta_ai_obrolan(pemilik_id, diperbarui_at);

CREATE INDEX IF NOT EXISTS idx_ai_obrolan_pesan_obrolan ON aleta_ai_obrolan_pesan(percakapan_id, dibuat_at);

CREATE INDEX IF NOT EXISTS idx_ai_obrolan_pesan_pemilik ON aleta_ai_obrolan_pesan(pemilik_id, dibuat_at);

CREATE INDEX IF NOT EXISTS idx_ai_penggunaan_waktu ON aleta_ai_penggunaan(dibuat_at);

CREATE INDEX IF NOT EXISTS idx_ai_penggunaan_pengguna ON aleta_ai_penggunaan(pengguna_id, dibuat_at);

CREATE INDEX IF NOT EXISTS idx_ai_mutasi_pengguna ON aleta_ai_mutasi(pengguna_id, dibuat_at);

CREATE INDEX IF NOT EXISTS idx_ai_kurs_tanggal ON aleta_ai_kurs(tanggal);

CREATE INDEX IF NOT EXISTS idx_ai_jejak_waktu ON aleta_ai_jejak(waktu);
