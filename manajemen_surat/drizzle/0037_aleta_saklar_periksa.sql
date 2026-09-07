-- =============================================================================
-- Saklar periksa hasil dan uji kemandirian (Tahap 6 - Kemandirian Blangko).
--
-- =============================================================================
-- BAWAANNYA MATI, DAN ITU KEPUTUSAN YANG DIAMBIL SADAR
-- =============================================================================
--
-- Blangko ALETA langsung dipakai tanpa pemeriksaan wajib. Penjagaan
-- penggantinya ada di tempat lain: uji Tahap 1 menuntut tiap blangko ABT dapat
-- disusun ulang tepat kata demi kata sebelum korpusnya disimpan, dan
-- pemeriksaan di tingkat DOKUMEN dilakukan hakim yang menyidangkan.
--
-- Saklar ini menyalakannya kembali bila suatu saat diperlukan.
--
-- =============================================================================
-- SATU SAKLAR PER GOLONGAN DOKUMEN, BUKAN SATU UNTUK SEMUA
-- =============================================================================
--
-- Relaas dan putusan risikonya tidak sama. Saklar tunggal memaksa keduanya
-- diperlakukan sama - dan yang terjadi berikutnya selalu sama: saklarnya
-- dimatikan demi golongan yang paling sering, lalu golongan yang paling
-- berisiko ikut kehilangan penjagaannya.
--
-- =============================================================================
-- SAKLAR YANG DAPAT DIGESER TANPA JEJAK SAMA SAJA DENGAN TIDAK ADA
-- =============================================================================
--
-- Tiap pergeseran dicatat: siapa, kapan, dari keadaan apa ke keadaan apa, dan
-- atas dasar apa. Pertanyaan "sejak kapan putusan tidak lagi diperiksa"
-- pasti muncul, dan ia harus terjawab.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_saklar_periksa (
  id TEXT PRIMARY KEY,
  golongan TEXT NOT NULL,
  menyala INTEGER NOT NULL DEFAULT 0,
  alasan TEXT NOT NULL DEFAULT '',
  digeser_oleh TEXT NOT NULL DEFAULT '',
  digeser_at TEXT NOT NULL,
  dibuat_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_saklar_riwayat (
  id TEXT PRIMARY KEY,
  golongan TEXT NOT NULL,
  dari INTEGER NOT NULL DEFAULT 0,
  ke INTEGER NOT NULL DEFAULT 0,
  alasan TEXT NOT NULL DEFAULT '',
  oleh TEXT NOT NULL DEFAULT '',
  pada TEXT NOT NULL
);

-- Uji kemandirian: apakah ALETA masih dapat menerbitkan dokumen ketika folder
-- ABT dicabut dan sambungan aps_badilag dimatikan. Dijalankan berkala, bukan
-- sekali lalu dilupakan - ketergantungan selalu menyelinap kembali diam-diam.
CREATE TABLE IF NOT EXISTS aleta_uji_mandiri (
  id TEXT PRIMARY KEY,
  dijalankan_at TEXT NOT NULL,
  dijalankan_oleh TEXT NOT NULL DEFAULT '',
  mandiri INTEGER NOT NULL DEFAULT 0,
  jumlah_diperiksa INTEGER NOT NULL DEFAULT 0,
  jumlah_bergantung INTEGER NOT NULL DEFAULT 0,
  temuan TEXT NOT NULL DEFAULT '[]',
  sebab TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saklar_periksa_golongan ON aleta_saklar_periksa(golongan);
CREATE INDEX IF NOT EXISTS idx_saklar_riwayat_golongan ON aleta_saklar_riwayat(golongan, pada);
CREATE INDEX IF NOT EXISTS idx_uji_mandiri_waktu ON aleta_uji_mandiri(dijalankan_at);
