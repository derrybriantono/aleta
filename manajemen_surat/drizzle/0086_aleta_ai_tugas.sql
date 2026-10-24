-- =============================================================================
-- ALETA Ai TAHAP 3: TUGAS (COWORK) DAN BERKAS KELUARAN (25 Okt 2026)
-- =============================================================================
--
-- Tugas = perintah kerja panjang (draf putusan, panduan sidang, komparasi arah
-- putusan) yang berjalan sebagai rangkaian langkah terlihat:
--   rencana -> ambil data -> susun -> periksa -> berkas
--
-- STATUS DI TABEL, BUKAN DI MEMORI PROSES: peramban boleh ditutup, server boleh
-- dimulai ulang; pelari tugas (src/server/modules/aleta-ai/tugas.ts) membaca
-- langkah yang belum selesai dari sini lalu melanjutkannya.
--
--   aleta_ai_tugas          satu baris per tugas. `instruksi`, `hasil` TERENKRIPSI.
--                           `segmen` = nomor jalan (tiap jalan = satu tahan saldo,
--                           rujukan mutasi = id tugas[:segmen]); `usd_segmen` =
--                           biaya API jalan ini (untuk menutup jalan yang terputus).
--                           `detak_at` = denyut pelari; denyut basi = pelari mati
--                           (mis. server dimulai ulang) dan tugas boleh dilanjutkan.
--   aleta_ai_tugas_langkah  satu baris per langkah; model/effort/token/biaya per
--                           langkah (pola aleta_ai_penggunaan). `hasil` TERENKRIPSI
--                           dan TERSAMAR (kode samaran, bukan data asli).
--   aleta_ai_berkas         berkas keluaran (DOCX/RTF/PDF/HTML/XLSX) untuk
--                           pengguna: data ASLI dikembalikan; isi TERENKRIPSI.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai sah dijaga modul. Tidak ada yang
-- ditulis ke SIPP/ABT/e-Court.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib:
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_ALETA_AI_TUGAS);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/aleta-ai-tugas-25okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_ai_tugas (
  id TEXT PRIMARY KEY,
  pemilik_id TEXT NOT NULL,
  peran_id TEXT NOT NULL DEFAULT '',
  jenis TEXT NOT NULL,
  judul TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  instruksi TEXT NOT NULL DEFAULT '',
  format_berkas TEXT NOT NULL DEFAULT 'docx',
  kelompok TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  effort TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'antre',
  pesan_status TEXT NOT NULL DEFAULT '',
  minta_berhenti INTEGER NOT NULL DEFAULT 0,
  segmen INTEGER NOT NULL DEFAULT 0,
  tahan_rp INTEGER NOT NULL DEFAULT 0,
  biaya_rp INTEGER NOT NULL DEFAULT 0,
  biaya_usd REAL NOT NULL DEFAULT 0,
  usd_segmen REAL NOT NULL DEFAULT 0,
  gratis INTEGER NOT NULL DEFAULT 0,
  proyek_versi INTEGER NOT NULL DEFAULT 0,
  hasil TEXT NOT NULL DEFAULT '',
  detak_at TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diperbarui_at TEXT NOT NULL,
  selesai_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_ai_tugas_langkah (
  id TEXT PRIMARY KEY,
  tugas_id TEXT NOT NULL,
  urutan INTEGER NOT NULL,
  kode TEXT NOT NULL,
  judul TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'menunggu',
  catatan TEXT NOT NULL DEFAULT '',
  hasil TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  effort TEXT NOT NULL DEFAULT '',
  token_masuk INTEGER NOT NULL DEFAULT 0,
  token_keluar INTEGER NOT NULL DEFAULT 0,
  token_cache_tulis INTEGER NOT NULL DEFAULT 0,
  token_cache_baca INTEGER NOT NULL DEFAULT 0,
  biaya_usd REAL NOT NULL DEFAULT 0,
  segmen INTEGER NOT NULL DEFAULT 0,
  mulai_at TEXT NOT NULL DEFAULT '',
  selesai_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_ai_berkas (
  id TEXT PRIMARY KEY,
  tugas_id TEXT NOT NULL,
  pemilik_id TEXT NOT NULL,
  nama TEXT NOT NULL,
  format TEXT NOT NULL,
  mime TEXT NOT NULL,
  ukuran INTEGER NOT NULL DEFAULT 0,
  templat TEXT NOT NULL DEFAULT '',
  isi TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_tugas_pemilik ON aleta_ai_tugas(pemilik_id, dibuat_at);
CREATE INDEX IF NOT EXISTS idx_ai_tugas_status ON aleta_ai_tugas(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_tugas_langkah_urut ON aleta_ai_tugas_langkah(tugas_id, urutan);
CREATE INDEX IF NOT EXISTS idx_ai_berkas_tugas ON aleta_ai_berkas(tugas_id);
