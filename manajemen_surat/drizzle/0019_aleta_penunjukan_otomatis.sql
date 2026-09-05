-- =============================================================================
-- Penunjukan PMH, PPP, PJS, dan PHS dari ekstensi ALETA.
--
-- =============================================================================
-- YANG TIDAK DISIMPAN DI SINI
-- =============================================================================
--
-- Susunan majelis TIDAK disimpan di sini. SIPP sudah menyimpannya sendiri pada
-- ref_sk_majelis_tetap (nomor dan tanggal SK) dan ref_majelis_tetap (majelis
-- mana, hakim siapa, urutan keberapa, kompetensi apa) - termasuk kompetensi
-- yang membedakan majelis yang boleh memeriksa ekonomi syariah.
--
-- Rencana semula memang menyalinnya ke sini. Itu dibatalkan setelah struktur
-- SIPP dibaca: menyalin data yang sudah ada hanya melahirkan dua kebenaran yang
-- lambat laun berselisih, dan yang berselisih itu susunan majelis - hal yang
-- salahnya berujung pada penetapan yang keliru, bukan sekadar tampilan.
--
-- =============================================================================
-- YANG MEMANG PERLU DISIMPAN
-- =============================================================================
--
-- Tiga hal, dan hanya tiga:
--
--   1. Hari sidang tiap majelis, dan kode panitera penggantinya. Keduanya isi
--      SK yang tidak punya tempat di SIPP - ref_majelis_tetap hanya memuat
--      hakim, tidak memuat hari maupun panitera.
--   2. Aturan yang dipakai menyusun usulan - jeda minimal, ambang nilai
--      sengketa, klasifikasi yang berhakim tunggal.
--   3. Catatan apa yang benar-benar diisikan ekstensi ke borang SIPP.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Hari sidang tiap majelis
--
-- majelis_kode mengikuti hakim_pn.kode di SIPP - A, B, C1, C2, C3 - sehingga
-- tidak perlu dicocokkan lewat nama, yang berubah tiap mutasi.
--
-- hari memakai angka JavaScript: 0 Minggu, 1 Senin, sampai 6 Sabtu. Disimpan
-- sebagai angka, bukan nama hari, supaya perhitungan tanggal tidak perlu
-- menerjemahkan teks yang bisa saja tertulis "senin", "Senin", atau "SENIN".
--
-- panitera_kode memuat kode D dari SK, dipisah koma bila lebih dari satu -
-- Majelis A memang memegang dua panitera pengganti sekaligus. Kodenya mengikuti
-- panitera_pn.kode di SIPP, jadi tetap dicocokkan lewat kode, bukan nama.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aleta_sipp_hari_sidang (
  majelis_kode TEXT PRIMARY KEY,
  hari SMALLINT NOT NULL CHECK (hari BETWEEN 0 AND 6),
  panitera_kode TEXT NOT NULL DEFAULT '',
  keterangan TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- -----------------------------------------------------------------------------
-- 2. Aturan penunjukan
--
-- Disimpan sebagai kunci-nilai, bukan sebagai kolom tersendiri, karena
-- seluruhnya memang setelan tunggal - satu pengadilan satu nilai - dan
-- menambah setelan baru nanti tidak boleh menuntut migrasi baru.
--
-- Nilainya TEXT supaya angka, daftar, dan pilihan dapat ditampung satu bentuk.
-- Yang membacanya menafsirkan sendiri, dan setiap penafsiran punya nilai
-- cadangan bila isinya tidak masuk akal.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aleta_sipp_aturan_penunjukan (
  kunci TEXT PRIMARY KEY,
  nilai TEXT NOT NULL,
  keterangan TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

-- -----------------------------------------------------------------------------
-- 3. Catatan pengisian
--
-- Tiap medan yang diisikan ekstensi ke borang SIPP dicatat satu baris.
--
-- Yang dicatat bukan hanya nilainya, melainkan juga ASALNYA: usulan otomatis
-- yang diterima apa adanya, atau pilihan manual yang menggantikannya. Tanpa
-- pembedaan itu, pertanyaan "apakah otomasinya benar" hanya dapat dijawab
-- dengan kesan. Dengan pembedaan itu, ia dapat dijawab dengan angka - berapa
-- persen usulan yang diubah orang sebelum dikerjakan.
--
-- akun_sipp dan aleta_user_id keduanya dicatat karena keduanya memang bisa
-- berbeda orang: panel ALETA melayang di atas halaman SIPP yang punya sesi
-- sendiri.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aleta_sipp_penunjukan_log (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  jenis TEXT NOT NULL CHECK (jenis IN ('pmh', 'ppp', 'pjs', 'phs')),
  medan TEXT NOT NULL,
  nilai TEXT NOT NULL DEFAULT '',
  asal TEXT NOT NULL DEFAULT 'otomatis' CHECK (asal IN ('otomatis', 'manual')),
  usulan_semula TEXT NOT NULL DEFAULT '',
  alasan TEXT NOT NULL DEFAULT '',
  akun_sipp TEXT NOT NULL DEFAULT '',
  aleta_user_id TEXT,
  aleta_peran TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aleta_sipp_penunjukan_log_perkara
  ON aleta_sipp_penunjukan_log (perkara_id);

CREATE INDEX IF NOT EXISTS idx_aleta_sipp_penunjukan_log_waktu
  ON aleta_sipp_penunjukan_log (created_at);

-- Menjawab "berapa usulan yang diubah orang" tanpa memindai seluruh tabel.
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_penunjukan_log_asal
  ON aleta_sipp_penunjukan_log (jenis, asal);
