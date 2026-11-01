-- =============================================================================
-- PENGUKUR DRAF vs PUTUSAN AKHIR (1 November 2026, P3 - keputusan Derry 90)
-- =============================================================================
--
-- Sesudah putusan diputus, draf pertimbangan & amar A1 (draf H-7, 0068) dibandingkan dengan putusan akhir (amar + pertimbangan
-- SIPP, atau dokumen putusan yang diunggah) oleh aturan murni (lib/banding-draf-a1.ts + lib/pengukur-draf.ts) - tanpa AI.
--
--   aleta_pengukur_draf    satu baris per perkara: hakim (ketua majelis) & majelis, bulan putusan, varian draf yang dipakai, sidik bahan
--                          (putusan akhir + saat draf dibuat; bahan sama = tidak diukur ulang), angka kecocokan (pembilang/penyebut
--                          amar, dasar hukum, bagian, huruf alasan) dan koreksi hakim yang sudah TERSAMAR (koreksi_json).
--   aleta_pengukur_usulan  usulan memori proyek ALETA Ai dari pola koreksi yang berulang (tersamar: tanpa nama pihak/data perkara).
--                          status 'baru' (menunggu keputusan Super Admin) | 'diteruskan' (sudah dikirim ke memori proyek) | 'ditolak'.
--
-- Tanpa kunci asing dan tanpa CHECK. Modul: src/server/modules/aleta-ecourt/pengukur-draf.ts.
--
-- NOMOR: 0130 (idx 113) diklaim 1 Nov 2026 di klaim-1nov.txt (agen P3). Celah idx 111-112 = 0127 (N2) dan 0129 (N3) di cabang
-- lain - jurnal berurutan sesudah semua cabang digabung (when 1792348200001 > 0129 N3 1792344600001).
--
-- TIGA TEMPAT PENDAFTARAN: (a) berkas ini + _journal.json; (b) DDL_PENGUKUR_DRAF di src/server/db/schema.ts;
-- (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_pengukur_draf (
  perkara_id TEXT NOT NULL PRIMARY KEY,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  jenis_perkara TEXT NOT NULL DEFAULT '',
  hakim TEXT NOT NULL DEFAULT '',
  majelis TEXT NOT NULL DEFAULT '',
  tanggal_putusan TEXT NOT NULL DEFAULT '',
  bulan TEXT NOT NULL DEFAULT '',
  arah TEXT NOT NULL DEFAULT '',
  varian TEXT NOT NULL DEFAULT '',
  sumber TEXT NOT NULL DEFAULT '',
  tanggal_sidang_draf TEXT NOT NULL DEFAULT '',
  draf_dibuat_pada TEXT NOT NULL DEFAULT '',
  sidik TEXT NOT NULL DEFAULT '',
  amar_akhir INTEGER NOT NULL DEFAULT 0,
  amar_cocok INTEGER NOT NULL DEFAULT 0,
  amar_persis INTEGER NOT NULL DEFAULT 0,
  dasar_akhir INTEGER NOT NULL DEFAULT 0,
  dasar_cocok INTEGER NOT NULL DEFAULT 0,
  dasar_terverifikasi INTEGER NOT NULL DEFAULT 0,
  bagian_akhir INTEGER NOT NULL DEFAULT 0,
  bagian_cocok INTEGER NOT NULL DEFAULT 0,
  huruf_draf TEXT NOT NULL DEFAULT '',
  huruf_akhir TEXT NOT NULL DEFAULT '',
  huruf_sama INTEGER NOT NULL DEFAULT -1,
  koreksi_json TEXT NOT NULL DEFAULT '[]',
  lama_ms INTEGER NOT NULL DEFAULT 0,
  diukur_pada TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_pengukur_usulan (
  id TEXT NOT NULL PRIMARY KEY,
  lingkup TEXT NOT NULL DEFAULT 'semua',
  hakim TEXT NOT NULL DEFAULT '',
  jenis TEXT NOT NULL DEFAULT '',
  kunci TEXT NOT NULL DEFAULT '',
  teks TEXT NOT NULL DEFAULT '',
  perkara INTEGER NOT NULL DEFAULT 0,
  dari INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'baru',
  proyek_id TEXT NOT NULL DEFAULT '',
  dibuat_pada TEXT NOT NULL,
  diperbarui_pada TEXT NOT NULL,
  diputuskan_oleh TEXT NOT NULL DEFAULT '',
  diputuskan_pada TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_pengukur_draf_bulan ON aleta_pengukur_draf(bulan, hakim);
CREATE INDEX IF NOT EXISTS idx_pengukur_usulan_status ON aleta_pengukur_usulan(status, lingkup);
