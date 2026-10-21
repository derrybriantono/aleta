-- =============================================================================
-- ARSIP HASIL MEDIASI PER PERKARA (21 Oktober 2026)
-- =============================================================================
--
-- SIPP tidak punya tempat unggah dokumen "hasil mediasi" (tab Mediasi hanya
-- mencetak Laporan Mediator dan Pernyataan Para Pihak dari template; kolom e-Doc
-- terdekat, perkara_mediasi.isi_akta_perdamaian_dok, adalah Akta Perdamaian).
-- Atas persetujuan pengguna, dokumennya disimpan di arsip ALETA sendiri, per
-- perkara, dan tombolnya muncul di bawah "Edit Hasil Mediasi" di SIPP.
--
--   aleta_mediasi_berkas        satu berkas hasil mediasi: nama asli, bentuk asal
--                               (pdf/rtf/doc/docx), PDF-nya (hasil konversi bila
--                               bukan PDF), siapa mengunggah, versi, status
--                               (aktif / diganti / dihapus). Isi berkasnya ada di
--                               folder penyimpanan yang di-mount
--                               (ALETA_UPLOAD_DIR/mediasi-hasil/<perkara>/), bukan
--                               di basis data.
--   aleta_mediasi_berkas_jejak  jejak jujur: unggah, ganti, hapus, lihat/unduh,
--                               dan kiriman ke e-Doc Akta Perdamaian SIPP (siapa,
--                               peran, akun SIPP, IP, hasil).
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul
-- (src/server/modules/mediasi-arsip/*). Waktu disimpan ISO UTC sebagai TEXT.
-- Tidak ada kata ALETA yang ditulis ke SIPP dari tabel ini.
--
-- NOMOR: 0081 diklaim 21 Okt 2026 (jurnal terakhir idx 73 = 0080); idx 74.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_MEDIASI_ARSIP);
--   (c) kedua tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/pratinjau-dokumen-mediasi-21okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_mediasi_berkas (
  id TEXT PRIMARY KEY,
  nomor_perkara TEXT NOT NULL,
  perkara_kunci TEXT NOT NULL,
  urutan_mediasi INTEGER NOT NULL DEFAULT 0,
  nama_asli TEXT NOT NULL,
  bentuk_asal TEXT NOT NULL DEFAULT '',
  jalur_asal TEXT NOT NULL DEFAULT '',
  jalur_pdf TEXT NOT NULL DEFAULT '',
  ukuran_asal INTEGER NOT NULL DEFAULT 0,
  ukuran_pdf INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL DEFAULT '',
  versi INTEGER NOT NULL DEFAULT 1,
  menggantikan_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'aktif',
  peringatan TEXT NOT NULL DEFAULT '',
  diunggah_oleh TEXT NOT NULL,
  diunggah_nama TEXT NOT NULL DEFAULT '',
  peran TEXT NOT NULL DEFAULT '',
  akun_sipp TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  ke_sipp_pada TEXT NOT NULL DEFAULT '',
  ke_sipp_oleh TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL,
  dihapus_oleh TEXT NOT NULL DEFAULT '',
  dihapus_pada TEXT NOT NULL DEFAULT '',
  alasan_hapus TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_mediasi_berkas_jejak (
  id TEXT PRIMARY KEY,
  berkas_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  waktu TEXT NOT NULL,
  peristiwa TEXT NOT NULL,
  pelaku TEXT NOT NULL DEFAULT '',
  pelaku_id TEXT NOT NULL DEFAULT '',
  peran TEXT NOT NULL DEFAULT '',
  akun_sipp TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  hasil TEXT NOT NULL DEFAULT '',
  ringkas TEXT NOT NULL DEFAULT '',
  rinci_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_mediasi_berkas_perkara ON aleta_mediasi_berkas(perkara_kunci, status);

CREATE INDEX IF NOT EXISTS idx_mediasi_berkas_sha ON aleta_mediasi_berkas(perkara_kunci, sha256);

CREATE INDEX IF NOT EXISTS idx_mediasi_berkas_jejak_berkas ON aleta_mediasi_berkas_jejak(berkas_id, waktu);

CREATE INDEX IF NOT EXISTS idx_mediasi_berkas_jejak_perkara ON aleta_mediasi_berkas_jejak(nomor_perkara, waktu);
