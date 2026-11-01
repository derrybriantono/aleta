-- =============================================================================
-- ALETA Ai: BANYAK PROYEK KELOLAAN SUPER ADMIN (1 November 2026, keputusan 72 + ralat)
-- =============================================================================
--
-- Selain proyek bawaan satker (aleta_ai_proyek, ZIP V4.5), Super Admin dapat membuat banyak proyek
-- bergaya Project Claude: instruksi, berkas pengetahuan (PDF, Word, RTF, Markdown, teks), dan memori.
-- Hanya Super Admin yang membuat, menyunting, dan menghapus; pengguna lain hanya MEMAKAI proyek yang
-- diizinkan bagi peran atau akunnya (isinya tidak pernah dikirim ke peramban mereka).
--
--   aleta_ai_proyek_kelola   id, nama, deskripsi, instruksi, sertakan_bawaan (1 = proyek bawaan satker ikut),
--                            akses ('semua' | 'peran' | 'pengguna'), akses_peran / akses_pengguna (dipisah koma),
--                            memori_aktif (1 = ALETA Ai boleh mengusulkan memori), aktif, versi, dibuat_oleh, dibuat_at, diubah_at
--   aleta_ai_pengetahuan     berkas pengetahuan: proyek_id, nama, jenis, ukuran (bita asli), karakter (panjang teks), teks (hasil ekstraksi),
--                            selalu (1 = selalu ikut ke prompt), dibuat_at, diubah_at
--   aleta_ai_memori_proyek   catatan yang diingat proyek: proyek_id, isi, status ('disetujui' | 'usulan'),
--                            sumber ('super-admin' | 'usulan-ai'), dibuat_at, diputuskan_oleh, diputuskan_at
--   aleta_ai_proyek_catatan  riwayat perubahan proyek (siapa mengubah apa), tanpa isi berkas
--   aleta_ai_proyek_pilihan  proyek yang dipilih pada sebuah percakapan (percakapan_id unik)
--
-- Tanpa kunci asing dan tanpa CHECK: nilai sah dijaga modul src/server/modules/aleta-ai/proyek-kelola.ts.
--
-- NOMOR: 0122 (idx 106) diklaim 1 Nov 2026 oleh agen I2 (klaim-1nov.txt).
-- TIGA TEMPAT PENDAFTARAN: (a) berkas ini + _journal.json; (b) DDL_ALETA_AI_PROYEK_KELOLA di src/server/db/schema.ts;
-- (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_ai_proyek_kelola (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  deskripsi TEXT NOT NULL DEFAULT '',
  instruksi TEXT NOT NULL DEFAULT '',
  sertakan_bawaan INTEGER NOT NULL DEFAULT 1,
  akses TEXT NOT NULL DEFAULT 'semua',
  akses_peran TEXT NOT NULL DEFAULT '',
  akses_pengguna TEXT NOT NULL DEFAULT '',
  memori_aktif INTEGER NOT NULL DEFAULT 1,
  aktif INTEGER NOT NULL DEFAULT 1,
  versi INTEGER NOT NULL DEFAULT 1,
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_pengetahuan (
  id TEXT PRIMARY KEY,
  proyek_id TEXT NOT NULL,
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL DEFAULT '',
  ukuran INTEGER NOT NULL DEFAULT 0,
  karakter INTEGER NOT NULL DEFAULT 0,
  teks TEXT NOT NULL DEFAULT '',
  selalu INTEGER NOT NULL DEFAULT 0,
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_memori_proyek (
  id TEXT PRIMARY KEY,
  proyek_id TEXT NOT NULL,
  isi TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disetujui',
  sumber TEXT NOT NULL DEFAULT 'super-admin',
  dibuat_at TEXT NOT NULL,
  diputuskan_oleh TEXT NOT NULL DEFAULT '',
  diputuskan_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_ai_proyek_catatan (
  id TEXT PRIMARY KEY,
  proyek_id TEXT NOT NULL,
  aksi TEXT NOT NULL,
  ringkas TEXT NOT NULL DEFAULT '',
  oleh TEXT NOT NULL DEFAULT '',
  waktu TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_ai_proyek_pilihan (
  percakapan_id TEXT PRIMARY KEY,
  proyek_id TEXT NOT NULL,
  dipilih_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_pengetahuan_proyek ON aleta_ai_pengetahuan(proyek_id);
CREATE INDEX IF NOT EXISTS idx_ai_memori_proyek_proyek ON aleta_ai_memori_proyek(proyek_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_proyek_catatan_proyek ON aleta_ai_proyek_catatan(proyek_id, waktu);
CREATE INDEX IF NOT EXISTS idx_ai_proyek_pilihan_proyek ON aleta_ai_proyek_pilihan(proyek_id);
