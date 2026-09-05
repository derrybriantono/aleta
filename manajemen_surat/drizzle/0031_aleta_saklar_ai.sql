-- =============================================================================
-- Saklar mati AI (I6) - per pengadilan, per peran, atau per perkara.
--
-- =============================================================================
-- SATU "MATI" MEMATIKAN SELURUHNYA
-- =============================================================================
--
-- Saklar yang dapat dibatalkan lapisan lain bukan saklar. Bila pengadilan
-- mematikan AI dan setelan peran masih dapat menyalakannya, yang dimatikan
-- pengadilan sebenarnya tidak pernah mati - dan yang menekannya mengira sudah.
--
-- Tabel ini karena itu tidak menyimpan "menang siapa": penghitungnya membaca
-- seluruh baris yang cocok, dan satu baris mati sudah cukup. Baris menyala
-- tidak pernah membatalkan baris mati di lingkup mana pun.
--
-- =============================================================================
-- ALASAN WAJIB SAAT MEMATIKAN, TIDAK SAAT MENYALAKAN
-- =============================================================================
--
-- Bukan pilih kasih. Saklar yang mati adalah keadaan yang akan ditanyakan
-- orang lain - "mengapa AI tidak jalan?" - dan alasan yang tercatat menjawab
-- tanpa perlu mencari siapa yang menekan. Tanpa alasan, pertanyaan itu
-- berakhir di pranata komputer yang mencoba memperbaiki sesuatu yang sengaja
-- dimatikan hakim.
--
-- =============================================================================
-- LINGKUP PERKARA SENGAJA TIDAK MENUNTUT ADMIN
-- =============================================================================
--
-- Hakim yang menangani perkara yang para pihaknya dikenal luas berhak
-- memutuskan tidak ada apa pun dari berkas itu yang keluar, tanpa mematikan
-- AI bagi seluruh pengadilan dan tanpa meminta izin siapa pun.
--
-- Izin yang harus diminta tidak akan diminta pada hari yang sibuk, dan
-- kehati-hatian yang menuntut izin berhenti dilakukan.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_ai_saklar (
  id TEXT PRIMARY KEY,
  lingkup TEXT NOT NULL CHECK (lingkup IN ('pengadilan', 'peran', 'perkara')),
  -- Id peran atau id perkara; kosong untuk lingkup pengadilan.
  kunci TEXT NOT NULL DEFAULT '',
  menyala INTEGER NOT NULL DEFAULT 1,
  -- Wajib terisi saat menyala = 0.
  alasan TEXT NOT NULL DEFAULT '',
  diputuskan_oleh TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

-- Satu baris per lingkup dan kunci. Dua baris yang bertentangan untuk satu
-- kunci akan membuat keadaan AI bergantung urutan baca - dan urutan baca
-- bukan sesuatu yang pernah diputuskan siapa pun.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_saklar_kunci ON aleta_ai_saklar(lingkup, kunci);
CREATE INDEX IF NOT EXISTS idx_ai_saklar_mati ON aleta_ai_saklar(menyala);
