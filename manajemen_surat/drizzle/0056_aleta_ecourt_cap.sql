-- =============================================================================
-- CAP PENGADILAN UNTUK EDOC PENETAPAN
-- =============================================================================
--
-- Perbaikan 2 Oktober 2026 (butir 17; kontrak K6 di
-- D:/aleta-dev/kerja/perbaikan-2okt/KONTRAK.md). Gambar cap yang diunggah
-- pengguna sendiri di "Berkas tanda tangan" ALETA e-Court, lalu ditempel
-- otomatis DI ATAS tanda tangan pada edoc PMH/PPP/PJS/PHS.
--
-- CAP DIPERLAKUKAN BEDA DARI TANDA TANGAN: tanda tangan milik SATU orang
-- (aleta_bot_tanda_tangan di basis data bot, wajib disahkan, tertaut ke satu
-- akun); cap milik JABATAN/kantor dan dapat dipakai pejabat mana saja sesuai
-- NAMA cap-nya - peruntukan: 'ketua' (PMH), 'panitera' (PPP, PJS), 'hakim'
-- (PHS), 'umum' (cadangan untuk semua jenis). Cap yang aktif = dapat dipakai.
--
-- Akses HANYA lewat src/server/modules/aleta-ecourt/penetapan-edoc.ts.
-- Gambar disimpan sebagai base64 (TEXT) seperti aleta_tipe_keluaran - tabel
-- kecil, beberapa baris saja.
--
-- Waktu disimpan sebagai TEXT ISO, mengikuti 0050-0055.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_ECOURT_CAP);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/backend-2okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_ecourt_cap (
  id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  peruntukan TEXT NOT NULL CHECK (peruntukan IN ('ketua', 'panitera', 'hakim', 'umum')),
  keterangan TEXT NOT NULL DEFAULT '',
  jenis_berkas TEXT NOT NULL CHECK (jenis_berkas IN ('png', 'jpg')),
  ukuran INTEGER NOT NULL DEFAULT 0,
  isi_base64 TEXT NOT NULL,
  aktif INTEGER NOT NULL DEFAULT 1,
  diunggah_oleh_id TEXT NOT NULL DEFAULT '',
  diunggah_oleh_nama TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ecourt_cap_peruntukan ON aleta_ecourt_cap(peruntukan, aktif);
