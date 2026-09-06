-- =============================================================================
-- Kamus variabel milik ALETA (Tahap 0 - Kemandirian Blangko).
--
-- =============================================================================
-- SALINAN, BUKAN SAMBUNGAN
-- =============================================================================
--
-- Tabel aps_badilag.abt_variabel memuat 1.253 definisi, dan 466 di antaranya
-- sudah memuat SQL yang berjalan. Selama ini ALETA tidak memakainya: pemetaan
-- ditulis tangan satu per satu di TypeScript, 68 di jalur JLF dan 42 di jalur
-- BAS, beririsan 23 - seluruhnya 87 dari 749 kode yang dipakai pustaka blangko.
--
-- Kamus ini menyalin definisi itu ke dalam ALETA. Yang penting dipahami:
-- salinan, bukan sambungan. Sesudah disalin, tidak ada satu pun jalur berjalan
-- yang gagal ketika folder ABT dicabut. Penyalinan boleh diulang kalau ABT
-- diperbarui, tetapi ALETA tidak menunggunya untuk bekerja.
--
-- =============================================================================
-- MENEBAK ARTI DARI NAMANYA ADALAH SUMBER SELURUH CACAT YANG DITEMUKAN
-- =============================================================================
--
-- Pemeriksaan atas 87 pemetaan tangan itu menemukan tujuh yang keliru, dan
-- ketujuhnya lahir dari sebab yang sama: artinya ditebak dari nama variabelnya,
-- bukan dibaca dari definisinya. Yang terbesar:
--
--   #0046#  ABT: "Pemohon/ Penggugat"   - SEBUTAN, bukan nama pihak
--           ALETA mengisinya dengan nama pihak. Muncul 12.935 kali.
--   #0047#  ABT: "Termohon/ Tergugat"   - SEBUTAN. Muncul 5.137 kali.
--   #0690#  ABT: "Majelis Hakim/ Hakim" - SEBUTAN, bukan daftar nama hakim.
--   #4004#  ABT: "KETUA MAJELIS ATAU HAKIM TUNGGAL" - SEBUTAN, bukan nama.
--   #6034#  ABT: "Panitera/Panitera Pengganti"      - JABATAN, bukan nama.
--   #6032#  ABT: "Jurusita/Jurusita Pengganti"      - JABATAN, bukan nama.
--
-- Dokumen rujukan membuktikannya tanpa ragu. Blangko berbunyi
-- "#0098#, NIK #0335#, ... sebagai #0046#;" dan hasil jadinya berbunyi
-- "Muhammad Ilham bin Aco Daude, NIK 7203040912000003, ... sebagai Pemohon I;".
-- #0098# nama, #0046# sebutan. Nama variabel #0098# di ABT sendiri berbunyi
-- "Nama #0046#" - yang mustahil kalau #0046# juga nama.
--
-- Karena itu kamus menyimpan definisi APA ADANYA dari ABT, termasuk sql_query
-- yang tidak diubah sedikit pun. Yang menilai artinya adalah definisinya
-- sendiri, bukan pembacanya.
--
-- =============================================================================
-- KELAS DISIMPAN, BUKAN DIHITUNG SAAT DIBACA
-- =============================================================================
--
-- Kelas A (mekanis), B (butuh manusia), C (mati) disimpan sebagai kolom, bukan
-- disimpulkan setiap kali dibaca. Sebabnya sama dengan biaya pada 0032: aturan
-- penggolongan boleh berubah, dan laporan yang menghitung ulang dengan aturan
-- baru akan berubah angkanya sendiri tanpa satu pun variabel bergerak. Kelas
-- ditetapkan saat penyalinan, dengan aturan yang berlaku saat itu.
--
-- =============================================================================
-- SETIAP PENYALINAN DICATAT
-- =============================================================================
--
-- aleta_kamus_salin mencatat tiap penyalinan: kapan, oleh siapa, dari skema
-- mana, berapa baris masuk. Kamus tanpa catatan penyalinan tidak dapat
-- menjawab "definisi ini dari kapan" - dan pertanyaan itu pasti muncul pada
-- hari sebuah naskah dipersoalkan.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_kamus_variabel (
  no_var TEXT PRIMARY KEY,
  nama TEXT NOT NULL DEFAULT '',
  jenis TEXT NOT NULL DEFAULT '',
  sql_query TEXT NOT NULL DEFAULT '',
  data_tabel TEXT NOT NULL DEFAULT '',
  data_kolom TEXT NOT NULL DEFAULT '',
  default_data TEXT NOT NULL DEFAULT '',
  -- Kelas A/B/C beserta sebab penggolongannya, supaya alasannya dapat dibaca
  -- tanpa menjalankan ulang penggolongnya.
  kelas TEXT NOT NULL DEFAULT 'C',
  sebab_kelas TEXT NOT NULL DEFAULT '',
  -- Variabel lain yang disebut di dalam nama atau sql_query, dipisah koma.
  -- Disimpan supaya penyelesai bertingkat (Tahap 1) tidak perlu mengurai ulang
  -- 1.253 kueri setiap kali berjalan.
  bersarang TEXT NOT NULL DEFAULT '',
  -- Berapa kali kode ini muncul di pustaka blangko. Nol berarti terdefinisi
  -- tetapi tidak terpakai - itu keterangan, bukan kesalahan.
  jumlah_pakai INTEGER NOT NULL DEFAULT 0,
  asal_skema TEXT NOT NULL DEFAULT '',
  salin_id TEXT,
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_kamus_salin (
  id TEXT PRIMARY KEY,
  asal_skema TEXT NOT NULL DEFAULT '',
  jumlah_baris INTEGER NOT NULL DEFAULT 0,
  jumlah_kelas_a INTEGER NOT NULL DEFAULT 0,
  jumlah_kelas_b INTEGER NOT NULL DEFAULT 0,
  jumlah_kelas_c INTEGER NOT NULL DEFAULT 0,
  keadaan TEXT NOT NULL DEFAULT 'selesai',
  sebab TEXT NOT NULL DEFAULT '',
  oleh TEXT NOT NULL DEFAULT '',
  dijalankan_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kamus_variabel_kelas ON aleta_kamus_variabel(kelas);
CREATE INDEX IF NOT EXISTS idx_kamus_variabel_jenis ON aleta_kamus_variabel(jenis);
CREATE INDEX IF NOT EXISTS idx_kamus_variabel_salin ON aleta_kamus_variabel(salin_id);
CREATE INDEX IF NOT EXISTS idx_kamus_salin_waktu ON aleta_kamus_salin(dijalankan_at);
