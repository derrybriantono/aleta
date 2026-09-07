-- =============================================================================
-- Korpus blangko (Tahap 1 - Kemandirian Blangko).
--
-- =============================================================================
-- 807 BERKAS ITU BUKAN 807 DOKUMEN
-- =============================================================================
--
-- Pustaka ABT adalah satu kerangka dokumen dikali matriks keadaan, dituliskan
-- sebagai berkas terpisah untuk tiap kombinasi. Terbukti dengan angka: 32.550
-- alinea yang terpakai pada 807 blangko hanya memuat 8.448 kalimat yang
-- berbeda, dan 110 berkas BAS hanya menempati 58 sel matriks.
--
-- Karena itu yang disimpan di sini BUKAN salinan berkasnya, melainkan:
--   blok kalimat  - tiap kalimat hukum, sekali saja
--   susunan       - urutan blok yang membentuk tiap blangko
--   dimensi       - sel matriks yang ditempati blangko itu
--
-- Dari ketiganya, kombinasi yang ABT tidak punya berkasnya pun kelak dapat
-- disusun - dan itulah yang tidak mungkin dicapai dengan menyalin berkas.
--
-- =============================================================================
-- YANG SAMA PERSIS DISATUKAN; YANG MIRIP TIDAK PERNAH DISATUKAN SENDIRI
-- =============================================================================
--
-- Blok identitas para pihak di ABT sungguhan berbeda antar berkas: satu memuat
-- NIK, satu tidak; urutan pendidikan dan pekerjaan tertukar; "bertempat tinggal
-- di" berhadapan dengan "tempat kediaman di". Tidak satu pun keliru, tetapi
-- keduanya tidak mungkin dua-duanya yang dikehendaki.
--
-- Menyatukannya otomatis berarti MENGUBAH BUNYI naskah hukum tanpa seorang pun
-- memutuskannya. Karena itu hanya yang SAMA PERSIS disatukan; yang bentuknya
-- sama tetapi teksnya berbeda dicatat di aleta_blok_geser dan menunggu manusia
-- memilih. Ditemukan 747 kelompok semacam itu.
--
-- Akibat aturan ini, penyusunan ulang tiap blangko dari korpus selalu tepat
-- kata demi kata - dan itulah uji lulus Tahap 1.
--
-- =============================================================================
-- SUSUNAN DISIMPAN SEBAGAI DERET, BUKAN SEBAGAI 32.550 BARIS
-- =============================================================================
--
-- Satu baris per alinea per blangko berarti 32.550 baris yang tidak pernah
-- ditanya satu per satu - ia selalu dibaca utuh sebagai urutan. Deret pada
-- barisnya sendiri membuat penyusunan ulang menjadi satu pembacaan, bukan
-- tiga puluh dua ribu.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_blok_kalimat (
  sidik TEXT PRIMARY KEY,
  teks TEXT NOT NULL,
  -- Teks dengan penanda dan angka disamarkan. Dipakai HANYA untuk menemukan
  -- pergeseran, tidak pernah untuk menyusun naskah.
  bentuk TEXT NOT NULL DEFAULT '',
  sidik_bentuk TEXT NOT NULL DEFAULT '',
  penanda TEXT NOT NULL DEFAULT '',
  panjang INTEGER NOT NULL DEFAULT 0,
  jumlah_pakai INTEGER NOT NULL DEFAULT 0,
  korpus_id TEXT,
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_blangko_sumber (
  id TEXT PRIMARY KEY,
  jalur TEXT NOT NULL,
  folder TEXT NOT NULL DEFAULT '',
  berkas TEXT NOT NULL DEFAULT '',
  jenis TEXT NOT NULL DEFAULT '',
  -- Dimensi keadaan yang terbaca dari nama berkas, beserta kuncinya. Dua
  -- blangko berkunci sama menempati sel matriks yang sama.
  dimensi TEXT NOT NULL DEFAULT '{}',
  kunci_dimensi TEXT NOT NULL DEFAULT '',
  dimensi_terbaca INTEGER NOT NULL DEFAULT 0,
  -- Urutan sidik blok, dipisah koma - susunan dokumennya.
  urutan TEXT NOT NULL DEFAULT '',
  jumlah_alinea INTEGER NOT NULL DEFAULT 0,
  jumlah_dibuang INTEGER NOT NULL DEFAULT 0,
  penanda TEXT NOT NULL DEFAULT '',
  besar_byte INTEGER NOT NULL DEFAULT 0,
  korpus_id TEXT,
  dipelajari_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_blok_geser (
  id TEXT PRIMARY KEY,
  sidik_bentuk TEXT NOT NULL,
  bentuk TEXT NOT NULL DEFAULT '',
  -- Varian sebagai JSON: [{sidik, teks, jumlahPakai}]. Selalu dibaca utuh.
  varian TEXT NOT NULL DEFAULT '[]',
  jumlah_varian INTEGER NOT NULL DEFAULT 0,
  -- 'baru' selama belum ada yang memutuskan; 'diputus' sesudahnya. Blok
  -- terpilih TIDAK diisi mesin - memilih bunyi kalimat hukum pekerjaan hakim.
  keadaan TEXT NOT NULL DEFAULT 'baru',
  blok_terpilih TEXT NOT NULL DEFAULT '',
  alasan TEXT NOT NULL DEFAULT '',
  diputus_oleh TEXT NOT NULL DEFAULT '',
  diputus_at TEXT,
  korpus_id TEXT,
  dibuat_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_korpus_jalan (
  id TEXT PRIMARY KEY,
  jumlah_berkas INTEGER NOT NULL DEFAULT 0,
  jumlah_blok INTEGER NOT NULL DEFAULT 0,
  jumlah_geser INTEGER NOT NULL DEFAULT 0,
  jumlah_gagal_susun INTEGER NOT NULL DEFAULT 0,
  gagal_susun TEXT NOT NULL DEFAULT '[]',
  keadaan TEXT NOT NULL DEFAULT 'selesai',
  sebab TEXT NOT NULL DEFAULT '',
  oleh TEXT NOT NULL DEFAULT '',
  dijalankan_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blok_kalimat_bentuk ON aleta_blok_kalimat(sidik_bentuk);
CREATE INDEX IF NOT EXISTS idx_blok_kalimat_pakai ON aleta_blok_kalimat(jumlah_pakai);
CREATE UNIQUE INDEX IF NOT EXISTS idx_blangko_sumber_jalur ON aleta_blangko_sumber(jalur);
CREATE INDEX IF NOT EXISTS idx_blangko_sumber_jenis ON aleta_blangko_sumber(jenis);
CREATE INDEX IF NOT EXISTS idx_blangko_sumber_kunci ON aleta_blangko_sumber(kunci_dimensi);
CREATE UNIQUE INDEX IF NOT EXISTS idx_blok_geser_bentuk ON aleta_blok_geser(sidik_bentuk);
CREATE INDEX IF NOT EXISTS idx_blok_geser_keadaan ON aleta_blok_geser(keadaan);
CREATE INDEX IF NOT EXISTS idx_korpus_jalan_waktu ON aleta_korpus_jalan(dijalankan_at);
