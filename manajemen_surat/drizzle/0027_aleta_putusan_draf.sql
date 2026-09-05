-- =============================================================================
-- Draf putusan dan riwayat versinya (F1-F6).
--
-- =============================================================================
-- YANG DISIMPAN BUKAN NASKAHNYA SAJA, MELAINKAN ASALNYA
-- =============================================================================
--
-- Draf putusan yang hanya menyimpan naskah jadi tidak dapat dijawab
-- pertanyaan yang paling mungkin ditanyakan bertahun kemudian: alinea ini
-- datang dari mana, aturan mana yang dipakainya, dan siapa yang pernah
-- mengesahkan bunyinya.
--
-- Maka tiap draf menyimpan tiga hal: naskahnya, butir pustaka yang
-- dirangkainya, dan nilai yang mengisinya beserta sistem asalnya.
--
-- =============================================================================
-- BUNYI BUTIR DISALIN, TIDAK CUKUP DITUNJUK
-- =============================================================================
--
-- Inilah sebab tabel aleta_putusan_draf_butir menyimpan teks_saat_itu, bukan
-- hanya butir_id.
--
-- Butir pustaka boleh diganti (D7): versi baru menggantikan, yang lama
-- ditandai. Draf yang hanya menunjuk butir_id akan ikut berubah bunyinya
-- setiap kali butirnya disunting - termasuk draf yang sudah ditandatangani
-- setahun sebelumnya. Putusan yang bunyinya berubah sesudah ditandatangani
-- bukan kekeliruan data; ia pemalsuan, betapa pun tidak disengaja.
--
-- Menyimpan salinan memang memakan ruang. Ruang itu jauh lebih murah daripada
-- satu putusan yang tidak dapat dibuktikan bunyinya saat ditandatangani.
--
-- =============================================================================
-- DRAF TETAP DRAF SAMPAI ADA TANDA TANGAN HAKIM
-- =============================================================================
--
-- Tidak ada keadaan "terbit" di sini, dan itu disengaja. ALETA menyusun;
-- hakim memutus. Kolom keadaan berhenti di 'ditandatangani', dan yang
-- menandatangani dicatat namanya - bukan sebagai setelan yang dapat
-- dimatikan, melainkan sebagai bentuk tabelnya.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_putusan_draf (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  -- Versi ke berapa untuk perkara ini. Versi lama TIDAK dihapus.
  versi INTEGER NOT NULL DEFAULT 1,
  jenis_naskah TEXT NOT NULL DEFAULT 'PUTUSAN',
  keadaan TEXT NOT NULL DEFAULT 'draf'
    CHECK (keadaan IN ('draf', 'diperiksa', 'ditandatangani', 'dibatalkan')),
  naskah TEXT NOT NULL DEFAULT '',
  -- Bagian wajib yang masih kosong saat draf ini disimpan, JSON.
  belum_terisi TEXT NOT NULL DEFAULT '[]',
  -- Halangan dari pemeriksaan amar-petitum dan biaya, JSON.
  halangan TEXT NOT NULL DEFAULT '[]',
  -- Seluruh bagian wajib terisi DAN tidak ada halangan.
  siap INTEGER NOT NULL DEFAULT 0,
  ditandatangani_oleh TEXT NOT NULL DEFAULT '',
  ditandatangani_at TEXT NOT NULL DEFAULT '',
  catatan TEXT NOT NULL DEFAULT '',
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

-- Butir pustaka yang dirangkai draf ini, beserta bunyinya SAAT ITU.
CREATE TABLE IF NOT EXISTS aleta_putusan_draf_butir (
  id TEXT PRIMARY KEY,
  draf_id TEXT NOT NULL,
  -- Bagian mana yang memakainya: pertimbangan, amar, dan seterusnya.
  kunci_bagian TEXT NOT NULL DEFAULT '',
  butir_id TEXT NOT NULL DEFAULT '',
  urutan INTEGER NOT NULL DEFAULT 0,
  -- Salinan bunyi butir pada saat draf disusun.
  teks_saat_itu TEXT NOT NULL DEFAULT '',
  -- Versi butir pada saat itu, supaya perbedaan dengan pustaka hari ini terbaca.
  versi_butir INTEGER NOT NULL DEFAULT 0,
  -- Syarat yang membuatnya terpilih, JSON - inilah jawaban "mengapa alinea ini".
  alasan TEXT NOT NULL DEFAULT '[]'
);

-- Nilai yang mengisi naskah, beserta sistem asalnya.
CREATE TABLE IF NOT EXISTS aleta_putusan_draf_nilai (
  id TEXT PRIMARY KEY,
  draf_id TEXT NOT NULL,
  nama TEXT NOT NULL,
  nilai TEXT NOT NULL DEFAULT '',
  -- SIPP, APS Badilag, e-Court, atau ALETA. Nilai tanpa asal tidak berguna
  -- saat ditelusuri: yang ditanyakan selalu "menurut sistem yang mana".
  asal TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_putusan_draf_perkara ON aleta_putusan_draf(perkara_id, versi);
CREATE INDEX IF NOT EXISTS idx_putusan_draf_keadaan ON aleta_putusan_draf(keadaan);
CREATE UNIQUE INDEX IF NOT EXISTS idx_putusan_draf_versi ON aleta_putusan_draf(perkara_id, versi);
CREATE INDEX IF NOT EXISTS idx_putusan_draf_butir_draf ON aleta_putusan_draf_butir(draf_id, urutan);
CREATE INDEX IF NOT EXISTS idx_putusan_draf_butir_butir ON aleta_putusan_draf_butir(butir_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_putusan_draf_nilai_kunci ON aleta_putusan_draf_nilai(draf_id, nama);
