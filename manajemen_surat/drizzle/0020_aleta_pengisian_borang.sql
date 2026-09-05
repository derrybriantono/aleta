-- =============================================================================
-- Pengisian formulir SIPP oleh ekstensi ALETA.
--
-- =============================================================================
-- KENAPA PENUNJUK KOLOM JADI DATA, BUKAN KODE
-- =============================================================================
--
-- Nama kolom formulir SIPP berbeda antar versi, persis seperti nama kolomnya -
-- itulah sebabnya sippSkemaService membaca information_schema alih-alih menebak
-- nama kolom. Alasan yang sama berlaku di sini, dan taruhannya lebih besar:
-- kolom yang salah nama membuat kueri gagal dengan jelas, sedangkan penunjuk
-- kolom yang salah membuat pengisian mengenai kolom LAIN - dan itu tidak gagal
-- sama sekali, ia hanya salah.
--
-- Karena itu penunjuknya disimpan sebagai data yang dapat disunting, dan
-- ekstensi punya mode "baca formulir" yang menyebutkan kolom apa saja yang benar
-- ada di halaman - sehingga petanya diisi dari kenyataan, bukan dari ingatan.
--
-- Selama petanya kosong, tombol Kerjakan tetap mati. Itu disengaja: lebih baik
-- tombol yang jelas belum siap daripada tombol yang mengisi kolom yang salah.
--
-- =============================================================================
-- CATATAN PENGISIAN SUDAH ADA DI MIGRASI 0019
-- =============================================================================
--
-- aleta_sipp_penunjukan_log dibuat di sana, dan dipakai di sini apa adanya.
-- Yang ditambahkan hanya kolom hasil - apakah pengisiannya benar-benar mendarat
-- di SIPP setelah Simpan ditekan.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Peta kolom formulir
--
-- borang   : "data-umum", "pmh", "ppp", "pjs", "phs"
-- medan    : nama peran kolomnya menurut ALETA - "hakim_ketua", "tanggal_sidang",
--           dan seterusnya. TIDAK sama dengan nama kolom di SIPP; justru itu
--           yang dipetakan.
-- penunjuk: pemilih CSS pada halaman SIPP.
-- jenis   : bagaimana ia diisi -
--             teks    isian biasa
--             pilih   dropdown, termasuk select2
--             tanggal datepicker
--             kaya    CKEditor dan sejenisnya
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aleta_sipp_borang_medan (
  borang TEXT NOT NULL,
  medan TEXT NOT NULL,
  penunjuk TEXT NOT NULL,
  jenis TEXT NOT NULL DEFAULT 'teks' CHECK (jenis IN ('teks', 'pilih', 'tanggal', 'kaya')),
  wajib SMALLINT NOT NULL DEFAULT 0,
  catatan TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (borang, medan)
);

CREATE INDEX IF NOT EXISTS idx_aleta_sipp_borang_medan_borang
  ON aleta_sipp_borang_medan (borang);

-- -----------------------------------------------------------------------------
-- 2. Hasil pengisian: apakah ia benar-benar mendarat
--
-- Mengisi formulir tidak sama dengan tercatat. Petugas dapat membatalkan,
-- SIPP dapat menolak, dan sambungan dapat putus di tengah. Karena itu sesudah
-- Simpan ditekan, bot MEMBACA ULANG perkara itu dari SIPP dan mencatat apakah
-- yang tercatat sama dengan yang diisikan.
--
-- Tanpa pembacaan ulang, catatan pengisian hanya membuktikan ALETA mengetik -
-- bukan membuktikan pengadilan mencatat.
-- -----------------------------------------------------------------------------
ALTER TABLE aleta_sipp_penunjukan_log
  ADD COLUMN IF NOT EXISTS mendarat TEXT NOT NULL DEFAULT 'belum';

ALTER TABLE aleta_sipp_penunjukan_log
  ADD COLUMN IF NOT EXISTS diperiksa_at TEXT;

ALTER TABLE aleta_sipp_penunjukan_log
  ADD COLUMN IF NOT EXISTS tercatat TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_aleta_sipp_penunjukan_log_mendarat
  ON aleta_sipp_penunjukan_log (mendarat);
