-- =============================================================================
-- ALUR KERJA PER PERAN (TAHAP 6) DAN BERDAMPINGAN DENGAN ABT (TAHAP 7) - 5 Nov 2026
-- =============================================================================
--
-- aleta_abt_selesai: keadaan tombol "Selesaikan berkas" per (perkara, blangko). Hanya status tiap langkah (menunggu, jalan, selesai,
--   gagal, dimatikan) dan pesan singkatnya, supaya yang gagal saja yang diulang. TIDAK menyimpan PDF, naskah, atau nama pihak:
--   PDF dibuat ulang saat langkah berikutnya perlu.
--
-- aleta_abt_berdampingan: hasil membandingkan cetakan ABT dengan naskah ALETA ABT yang disusun di belakang. HANYA angka, nama blangko,
--   jenis perkara (kelompok), dan jenis beda (hitungan per kelas, nomor alinea). TIDAK menyimpan isi naskah, kalimat, atau data pihak.
--   perkara_id adalah nomor internal perkara (angka), bukan nomor perkara atau nama.
--
-- Saklar (persetujuan matriks hak, tulis ke luar, berdampingan) memakai aleta_ekstensi_setelan: tanpa tabel, semuanya bawaan MATI.
--
-- NOMOR: 0137, jurnal idx 119 (sesudah 0136/idx 118). TIGA TEMPAT: (a) berkas ini + meta/_journal.json;
-- (b) DDL_ALETA_ABT_ALUR di src/server/db/schema.ts; (c) IN_MEMORY_TABLE_PERSISTENCE_ORDER di src/server/db/client.ts.
-- Tanpa kunci asing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_abt_selesai (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  berkas_id TEXT NOT NULL,
  jenis_berkas TEXT NOT NULL DEFAULT 'putusan',
  langkah TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'menunggu',
  oleh TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_abt_berdampingan (
  id TEXT PRIMARY KEY,
  waktu TEXT NOT NULL,
  pemicu TEXT NOT NULL DEFAULT 'cetak-abt',
  berkas_nama TEXT NOT NULL DEFAULT '',
  folder TEXT NOT NULL DEFAULT '',
  jenis_perkara TEXT NOT NULL DEFAULT 'tidak-diketahui',
  jenis_naskah TEXT NOT NULL DEFAULT 'lain',
  perkara_id TEXT NOT NULL DEFAULT '',
  sidang_ke INTEGER NOT NULL DEFAULT 0,
  hasil TEXT NOT NULL DEFAULT 'belum-diukur',
  sebab_belum TEXT NOT NULL DEFAULT '',
  total_alinea INTEGER NOT NULL DEFAULT 0,
  identik INTEGER NOT NULL DEFAULT 0,
  dijelaskan_n INTEGER NOT NULL DEFAULT 0,
  belum_dijelaskan_n INTEGER NOT NULL DEFAULT 0,
  per_kelas TEXT NOT NULL DEFAULT '{}',
  nomor_beda TEXT NOT NULL DEFAULT '[]',
  waktu_ms INTEGER NOT NULL DEFAULT 0,
  jawaban TEXT NOT NULL DEFAULT '',
  dijawab_oleh TEXT NOT NULL DEFAULT '',
  dijawab_at TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_abt_selesai_kunci ON aleta_abt_selesai(perkara_id, berkas_id);
CREATE INDEX IF NOT EXISTS idx_abt_berdampingan_waktu ON aleta_abt_berdampingan(waktu);
CREATE INDEX IF NOT EXISTS idx_abt_berdampingan_jenis ON aleta_abt_berdampingan(jenis_perkara, hasil);
