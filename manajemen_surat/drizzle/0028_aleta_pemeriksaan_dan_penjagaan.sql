-- =============================================================================
-- Pemeriksaan perkara dan penjagaan (G1-G5, J1-J6).
--
-- =============================================================================
-- ATURAN PEMERIKSAAN ADALAH DATA, BUKAN KODE
-- =============================================================================
--
-- Menuliskan aturan kompetensi dan syarat formil sebagai kode bekerja, dan
-- itulah masalahnya: pengadilan lalu bergantung pada bunyi hukum yang tidak
-- ada rujukannya, tidak ada tanggal berlakunya, dan tidak dapat diperiksa
-- siapa pun tanpa membaca kode.
--
-- Tiap baris di aleta_aturan_periksa membawa jangkar - alamat pasal di pustaka
-- hukum. Aturan yang jangkarnya tidak ditemukan TIDAK menyatakan lolos dan
-- tidak menyatakan gagal; ia menghasilkan catatan bahwa dasarnya belum ada.
-- Pemeriksaan yang menyatakan "kompetensi terpenuhi" berdasarkan aturan yang
-- dasarnya tidak pernah dimasukkan siapa pun adalah pernyataan hukum tanpa
-- hukum, dan ia terbaca sama meyakinkannya dengan pemeriksaan yang benar.
--
-- Karena itu pengesahannya sama ketatnya dengan pustaka pertimbangan: siapa
-- yang menekan DAN atas perintah siapa.
--
-- =============================================================================
-- SIDIK POLA PERKARA SENGAJA MELUPAKAN YANG MEMBEDAKAN
-- =============================================================================
--
-- aleta_perkara_sidik menyimpan pola fakta, bukan faktanya: jenis perkara,
-- hadir atau tidaknya tergugat, berapa saksi. Nama, tanggal, dan nomor TIDAK
-- pernah masuk - bukan hanya demi kerahasiaan, melainkan karena fakta yang
-- unik membuat tiap perkara serupa hanya dengan dirinya sendiri, dan
-- pencariannya selalu mengembalikan kosong.
--
-- =============================================================================
-- DASAR HUKUM SATU DRAF DIBEKUKAN, SEPERTI BUNYI BUTIRNYA
-- =============================================================================
--
-- aleta_putusan_draf_dasar mencatat pasal apa yang dipakai satu draf DAN versi
-- peraturannya saat itu. Alasannya sama dengan teks_saat_itu pada migrasi
-- 0027: peraturan dapat dicabut atau diubah, dan draf yang hanya menunjuk
-- jangkar akan berubah dasar hukumnya sesudah ditandatangani.
--
-- Kolom terbukti di sini adalah J1. Draf yang salah satu rujukannya tidak
-- ditemukan di pustaka tidak boleh dinyatakan siap - pasal karangan adalah
-- kegagalan terparah sistem semacam ini, dan satu-satunya cara mencegahnya
-- adalah menolak menyelesaikan draf yang memuatnya.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_aturan_periksa (
  id TEXT PRIMARY KEY,
  kode TEXT NOT NULL,
  kelompok TEXT NOT NULL DEFAULT 'formil'
    CHECK (kelompok IN ('kompetensi', 'formil', 'petitum', 'risiko')),
  hal TEXT NOT NULL DEFAULT '',
  jenis TEXT NOT NULL DEFAULT 'wajibAda'
    CHECK (jenis IN ('nilaiSama', 'nilaiSalahSatu', 'wajibAda', 'minimal', 'tidakBoleh')),
  -- Nama fakta perkara yang diadu dengan aturan ini.
  fakta TEXT NOT NULL DEFAULT '',
  -- Nilai pembanding, JSON - dapat berupa teks, angka, atau daftar.
  pembanding TEXT NOT NULL DEFAULT 'null',
  tingkat TEXT NOT NULL DEFAULT 'peringatan'
    CHECK (tingkat IN ('halangan', 'peringatan', 'catatan')),
  tindakan TEXT NOT NULL DEFAULT '',
  -- Alamat pasal di pustaka hukum. Aturan tanpa jangkar tidak memutuskan.
  jangkar TEXT NOT NULL DEFAULT '',
  -- Jenis perkara yang dikenai; kosong berarti semua.
  jenis_perkara TEXT NOT NULL DEFAULT '',
  aktif INTEGER NOT NULL DEFAULT 0,
  -- Pengesahan mencatat DUA hal, sama seperti pustaka pertimbangan.
  disahkan_oleh TEXT NOT NULL DEFAULT '',
  atas_perintah TEXT NOT NULL DEFAULT '',
  disahkan_at TEXT NOT NULL DEFAULT '',
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

-- Pola fakta perkara untuk mencari perkara serupa (G5).
CREATE TABLE IF NOT EXISTS aleta_perkara_sidik (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  jenis_perkara TEXT NOT NULL DEFAULT '',
  -- Butir pola "kunci=nilai" yang sudah dibakukan dan terurut, JSON.
  butir TEXT NOT NULL DEFAULT '[]',
  -- Butir yang digabung dengan "|" - dipakai mencari yang polanya persis sama.
  sidik TEXT NOT NULL DEFAULT '',
  dicatat_at TEXT NOT NULL
);

-- Batas keluar tiap ruas (J5). Baris di sini MENAMBAH aturan bawaan di kode;
-- melonggarkan yang bawaannya terlarang menuntut baris tersendiri, dan baris
-- itu mencatat siapa yang memutuskannya.
CREATE TABLE IF NOT EXISTS aleta_batas_data (
  id TEXT PRIMARY KEY,
  ruas TEXT NOT NULL,
  batas TEXT NOT NULL DEFAULT 'terlarang'
    CHECK (batas IN ('bebas', 'samar', 'terlarang')),
  sebab TEXT NOT NULL DEFAULT '',
  diputuskan_oleh TEXT NOT NULL DEFAULT '',
  atas_perintah TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL
);

-- Dasar hukum satu draf, dibekukan pada saat draf disusun (J1 dan J4).
CREATE TABLE IF NOT EXISTS aleta_putusan_draf_dasar (
  id TEXT PRIMARY KEY,
  draf_id TEXT NOT NULL,
  -- Butir pustaka yang membawa rujukan ini; kosong bila dari aturan periksa.
  butir_id TEXT NOT NULL DEFAULT '',
  jangkar TEXT NOT NULL DEFAULT '',
  -- Sebagaimana tertulis di alineanya, apa adanya.
  tertulis TEXT NOT NULL DEFAULT '',
  -- Nama pendek peraturan dan versinya SAAT ITU.
  peraturan TEXT NOT NULL DEFAULT '',
  versi_peraturan TEXT NOT NULL DEFAULT '',
  -- Jangkarnya benar-benar ditemukan di pustaka hukum saat draf disusun.
  terbukti INTEGER NOT NULL DEFAULT 0,
  diperiksa_at TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aturan_periksa_kode ON aleta_aturan_periksa(kode);
CREATE INDEX IF NOT EXISTS idx_aturan_periksa_aktif ON aleta_aturan_periksa(aktif, kelompok);
CREATE UNIQUE INDEX IF NOT EXISTS idx_perkara_sidik_perkara ON aleta_perkara_sidik(perkara_id);
CREATE INDEX IF NOT EXISTS idx_perkara_sidik_jenis ON aleta_perkara_sidik(jenis_perkara);
CREATE UNIQUE INDEX IF NOT EXISTS idx_batas_data_ruas ON aleta_batas_data(ruas);
CREATE INDEX IF NOT EXISTS idx_putusan_draf_dasar_draf ON aleta_putusan_draf_dasar(draf_id);
CREATE INDEX IF NOT EXISTS idx_putusan_draf_dasar_jangkar ON aleta_putusan_draf_dasar(jangkar);
