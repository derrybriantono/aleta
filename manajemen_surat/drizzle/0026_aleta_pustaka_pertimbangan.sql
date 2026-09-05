-- =============================================================================
-- Pustaka pertimbangan hukum (D1-D7).
--
-- =============================================================================
-- INILAH YANG MENGGANTIKAN AI UNTUK SEBAGIAN BESAR PERKARA
-- =============================================================================
--
-- Tanpa pustaka ini, setiap putusan harus dikarang dari nol dan AI menjadi
-- keharusan - dengan biaya, keraguan, dan risiko pasal karangan yang
-- menyertainya. Dengan pustaka, sebagian besar putusan dirakit dari
-- pertimbangan yang sudah pernah dipakai dan sudah pernah ditandatangani hakim.
--
-- =============================================================================
-- SATUANNYA ALINEA, DAN ALINEA YANG SAMA HANYA SEKALI
-- =============================================================================
--
-- Sumbernya 2.224 pertimbangan di perkara_pertimbangan_hukum - sekitar 18 juta
-- huruf tulisan hakim pengadilan ini sendiri. Sebagian besar alineanya berulang
-- hampir kata demi kata antar putusan.
--
-- Karena itu butir dikunci pada SIDIK alineanya, sesudah nama, tanggal, dan
-- nomor perkara dibuang. Tanpa itu, alinea yang bunyinya persis sama pada dua
-- ratus putusan menghasilkan dua ratus butir - dan pustaka menjadi salinan
-- putusan, bukan kumpulan pertimbangan.
--
-- =============================================================================
-- MASUK SEBAGAI USULAN, DIPAKAI SESUDAH DISAHKAN
-- =============================================================================
--
-- Risiko terbesar proyek ini berpindah dari AI ke pustaka. Satu butir yang
-- keliru - pasal salah kutip, syarat terlalu longgar - tidak salah sekali,
-- melainkan salah di SETIAP putusan yang memakainya, dengan rapi dan
-- meyakinkan.
--
-- Pengesahannya mencatat DUA hal: siapa yang menekan, dan atas perintah siapa.
-- Tanpa yang kedua, jejaknya hanya menunjuk operator.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_pertimbangan_butir (
  id TEXT PRIMARY KEY,
  -- Sidik alinea sesudah nama, tanggal, dan nomor perkara dibuang.
  sidik TEXT NOT NULL,
  teks TEXT NOT NULL,
  jenis_perkara TEXT NOT NULL DEFAULT '',
  -- Isu hukum yang dibahas alinea ini, diisi manusia saat mengesahkan.
  isu TEXT NOT NULL DEFAULT '',
  -- Syarat berlaku sebagai aturan atas fakta perkara (D2), JSON.
  syarat TEXT NOT NULL DEFAULT '{}',
  -- Berapa putusan memuat alinea ini - petunjuk seberapa mapan ia dipakai.
  jumlah_pemakaian INTEGER NOT NULL DEFAULT 0,
  keadaan TEXT NOT NULL DEFAULT 'usulan' CHECK (keadaan IN ('usulan', 'disahkan', 'ditolak', 'diganti')),
  -- Pengesahan: siapa yang menekan DAN atas perintah siapa.
  disahkan_oleh TEXT,
  atas_perintah TEXT NOT NULL DEFAULT '',
  disahkan_at TEXT,
  alasan_tolak TEXT NOT NULL DEFAULT '',
  -- Versi berikutnya menggantikan, tidak menghapus: putusan lama merujuk yang
  -- berlaku saat itu, dan rujukan ke tempat kosong lebih buruk daripada
  -- rujukan ke butir yang sudah tidak dipakai.
  diganti_oleh_id TEXT,
  versi INTEGER NOT NULL DEFAULT 1,
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

-- Rujukan pasal yang DIBACA dari bunyi alineanya sendiri, bukan ditebak.
CREATE TABLE IF NOT EXISTS aleta_pertimbangan_rujukan (
  id TEXT PRIMARY KEY,
  butir_id TEXT NOT NULL,
  tertulis TEXT NOT NULL DEFAULT '',
  pasal TEXT NOT NULL DEFAULT '',
  ayat TEXT NOT NULL DEFAULT '',
  huruf TEXT NOT NULL DEFAULT '',
  peraturan TEXT NOT NULL DEFAULT '',
  -- Jangkar pustaka hukum; kosong bila peraturannya belum dikenali.
  jangkar TEXT NOT NULL DEFAULT '',
  -- Jangkar itu benar-benar ditemukan di pustaka hukum. Inilah yang membuat
  -- "kutipan wajib terbukti" mungkin.
  terbukti INTEGER NOT NULL DEFAULT 0,
  diperiksa_at TEXT NOT NULL DEFAULT ''
);

-- Putusan mana saja yang memuat alinea ini. Bukan hiasan: butir yang muncul di
-- dua ratus putusan jelas lebih mapan daripada yang muncul sekali, dan yang
-- mengesahkan berhak tahu bedanya.
CREATE TABLE IF NOT EXISTS aleta_pertimbangan_asal (
  id TEXT PRIMARY KEY,
  butir_id TEXT NOT NULL,
  perkara_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  tanggal TEXT NOT NULL DEFAULT '',
  urutan_alinea INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pertimbangan_sidik ON aleta_pertimbangan_butir(sidik);
CREATE INDEX IF NOT EXISTS idx_pertimbangan_keadaan ON aleta_pertimbangan_butir(keadaan, jenis_perkara);
CREATE INDEX IF NOT EXISTS idx_pertimbangan_rujukan_butir ON aleta_pertimbangan_rujukan(butir_id);
CREATE INDEX IF NOT EXISTS idx_pertimbangan_rujukan_jangkar ON aleta_pertimbangan_rujukan(jangkar);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pertimbangan_asal_kunci ON aleta_pertimbangan_asal(butir_id, perkara_id, urutan_alinea);
