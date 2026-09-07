-- =============================================================================
-- Isian perkara untuk Kelas B (Tahap 3 - Kemandirian Blangko).
--
-- =============================================================================
-- MELEKAT PADA PERKARA, BUKAN PADA BLANGKO
-- =============================================================================
--
-- Mas kawin sebuah perkara tetap mas kawin yang sama, baik ia tercetak di BAS,
-- di penetapan, maupun di salinan. Menyimpannya per blangko berarti panitera
-- mengetiknya kembali tiap kali membuka blangko yang berbeda - dan dua ketikan
-- atas fakta yang sama pasti berselisih cepat atau lambat, lalu BAS dan
-- putusan perkara itu menyebut mahar yang berbeda.
--
-- Karena itu kuncinya perkara + nomor variabel, bukan perkara + blangko.
--
-- =============================================================================
-- SIAPA MENGISI DAN KAPAN, SELALU
-- =============================================================================
--
-- Isian ini adalah FAKTA PERKARA yang masuk ke naskah yang ditandatangani, dan
-- tidak ada sumbernya di mana pun kecuali orang yang mengetiknya. Nilai tanpa
-- penulisnya tidak dapat dipertanggungjawabkan pada hari ia dipersoalkan.
--
-- Riwayat penyuntingan disimpan terpisah, bukan menimpa: yang menjawab
-- "sejak kapan maharnya tertulis begini" adalah riwayatnya, bukan nilainya.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_isian_perkara (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  no_var TEXT NOT NULL,
  nilai TEXT NOT NULL DEFAULT '',
  diisi_oleh TEXT NOT NULL DEFAULT '',
  diisi_at TEXT NOT NULL,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_isian_riwayat (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  no_var TEXT NOT NULL,
  nilai_lama TEXT NOT NULL DEFAULT '',
  nilai_baru TEXT NOT NULL DEFAULT '',
  oleh TEXT NOT NULL DEFAULT '',
  pada TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_isian_perkara_kunci ON aleta_isian_perkara(perkara_id, no_var);
CREATE INDEX IF NOT EXISTS idx_isian_perkara_perkara ON aleta_isian_perkara(perkara_id);
CREATE INDEX IF NOT EXISTS idx_isian_riwayat_kunci ON aleta_isian_riwayat(perkara_id, no_var);
