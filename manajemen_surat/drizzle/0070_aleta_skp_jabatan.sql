-- =============================================================================
-- SKP JABATAN PERKARA (Panitera, Panmud, PP, Jurusita, Kasir, Meja, dst.)
-- =============================================================================
--
-- 17 Oktober 2026 (rancangan disetujui pengguna 13.47): realisasi SKP bulanan,
-- triwulan, dan tahunan per jabatan dibaca dari SIPP; yang tidak terbaca dari
-- SIPP diisi manual dengan bukti. Empat tabel di bawah menyimpan hal yang
-- TIDAK ada di SIPP: siapa pegawai di balik tiap akun SIPP, target yang
-- disahkan, isian manual, dan tangkapan realisasi yang dikunci.
--
-- Bentuk barisnya dijabarkan di src/lib/skp-jabatan-tipe.ts (BarisSkp*).
-- Kolom *_json berisi JSON teks; tanggal ISO "YYYY-MM-DD" atau ISO penuh.
--
-- NOMOR: 0070 (idx 67) diklaim 17 Okt 2026 oleh agen skp-dasar.
-- Lihat memori migrasi-0039-diklaim.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json (SUDAH);
--   (b) DDL yang sama di src/server/db/schema.ts (agen Server/DB/hak);
--   (c) keempat tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

-- Satu akun SIPP dapat dipegang bergantian oleh beberapa pegawai (Kasir, Meja):
-- tautannya bertanggal. Rangkap jabatan: jabatan_utama + jabatan_tambahan_json.
CREATE TABLE IF NOT EXISTS aleta_skp_akun_pegawai (
  id TEXT PRIMARY KEY,
  username_sipp TEXT NOT NULL,
  user_id_sipp TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL,
  jabatan_utama TEXT NOT NULL DEFAULT '',
  jabatan_tambahan_json TEXT NOT NULL DEFAULT '[]',
  berlaku_dari TEXT NOT NULL,
  berlaku_sampai TEXT NOT NULL DEFAULT '',
  dikonfirmasi_oleh_id TEXT NOT NULL DEFAULT '',
  dikonfirmasi_pada TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  diperbarui_pada TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aleta_skp_akun_pegawai_user ON aleta_skp_akun_pegawai(user_id, berlaku_dari);
CREATE INDEX IF NOT EXISTS idx_aleta_skp_akun_pegawai_username ON aleta_skp_akun_pegawai(username_sipp, berlaku_dari);

-- Target per jabatan, tahun, RHK, dan indikator. status 'usulan' sampai
-- disahkan (Panitera/Ketua).
CREATE TABLE IF NOT EXISTS aleta_skp_target (
  id TEXT PRIMARY KEY,
  jabatan TEXT NOT NULL,
  tahun INTEGER NOT NULL,
  kunci_rhk TEXT NOT NULL,
  kunci_indikator TEXT NOT NULL,
  target_nilai REAL,
  target_teks TEXT NOT NULL DEFAULT '',
  satuan TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'usulan',
  diubah_oleh_id TEXT NOT NULL DEFAULT '',
  diubah_pada TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_aleta_skp_target ON aleta_skp_target(jabatan, tahun, kunci_rhk, kunci_indikator);

-- Isian manual untuk indikator yang tidak terbaca dari SIPP. status:
-- 'draf' | 'diajukan' | 'disetujui'. bukti_json = daftar bukti dukung.
CREATE TABLE IF NOT EXISTS aleta_skp_isian (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  periode TEXT NOT NULL,
  tahun INTEGER NOT NULL,
  kunci_rhk TEXT NOT NULL,
  kunci_indikator TEXT NOT NULL DEFAULT '',
  nilai REAL,
  nilai_teks TEXT NOT NULL DEFAULT '',
  catatan TEXT NOT NULL DEFAULT '',
  bukti_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draf',
  diisi_oleh_id TEXT NOT NULL DEFAULT '',
  diajukan_pada TEXT NOT NULL DEFAULT '',
  ditinjau_oleh_id TEXT NOT NULL DEFAULT '',
  ditinjau_pada TEXT NOT NULL DEFAULT '',
  catatan_tinjauan TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  diperbarui_pada TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_aleta_skp_isian ON aleta_skp_isian(user_id, periode, tahun, kunci_rhk, kunci_indikator);

-- Tangkapan realisasi yang dikunci (angka tidak berubah walau SIPP berubah).
CREATE TABLE IF NOT EXISTS aleta_skp_penetapan (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  jenis TEXT NOT NULL,
  periode TEXT NOT NULL,
  tahun INTEGER NOT NULL,
  tangkapan_json TEXT NOT NULL DEFAULT '{}',
  dihitung_pada TEXT NOT NULL,
  pejabat_penilai_id TEXT NOT NULL DEFAULT '',
  pejabat_penilai_nama TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draf',
  dikunci_oleh_id TEXT NOT NULL DEFAULT '',
  dikunci_pada TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_aleta_skp_penetapan ON aleta_skp_penetapan(user_id, jenis, periode, tahun);
