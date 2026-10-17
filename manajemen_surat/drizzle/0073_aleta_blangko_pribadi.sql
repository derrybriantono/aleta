-- =============================================================================
-- BUAT BLANGKO SENDIRI - blangko pribadi milik akun dan riwayatnya
-- =============================================================================
--
-- 18 Oktober 2026. Hakim, panitera, dan konseptor menyunting atau mengunggah
-- blangko miliknya (RTF/DOCX/PDF); isiannya dipetakan ke isian ABT yang sudah
-- ada, lalu diekspor ke blangko Putusan Mandiri atau diajukan sebagai paket
-- RTF untuk folder blangko ABT. ALETA tidak menulis ke folder ABT: paket hanya
-- diunduh Super Admin sesudah disetujui, dan isian baru TIDAK dibuat otomatis.
--
--   aleta_blangko_pribadi          satu baris per blangko; isi (paragraf) dan
--                                  pemetaan disimpan sebagai JSON teks, paket
--                                  yang diajukan disimpan sebagai cuplikan
--                                  supaya yang disetujui sama dengan yang diajukan
--   aleta_blangko_pribadi_riwayat  jejak tindakan atas blangko pribadi
--
-- Hak: pemilik dan Super Admin (dijaga modul, bukan kolom). Tanpa kunci asing
-- dan tanpa CHECK: nilai yang sah dijaga modul
-- (src/server/modules/aleta-ecourt/blangko-sendiri.ts).
--
-- NOMOR: 0073 diklaim 18 Okt 2026 oleh agen Y3 (0071 dan 0072 mungkin dipakai
-- branch lain). Jurnal wajib tanpa lubang, jadi memakai idx 68.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_BLANGKO_PRIBADI);
--   (c) kedua tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/blangko-sendiri-18okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_blangko_pribadi (
  id TEXT PRIMARY KEY,
  pemilik_id TEXT NOT NULL,
  pemilik_nama TEXT NOT NULL DEFAULT '',
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL DEFAULT 'lain',
  asal TEXT NOT NULL DEFAULT 'sunting',
  berkas_asal TEXT NOT NULL DEFAULT '',
  keadaan TEXT NOT NULL DEFAULT 'draf',
  untuk_putusan_mandiri INTEGER NOT NULL DEFAULT 0,
  isi_json TEXT NOT NULL DEFAULT '[]',
  pemetaan_json TEXT NOT NULL DEFAULT '[]',
  peringatan_json TEXT NOT NULL DEFAULT '[]',
  paket_status TEXT NOT NULL DEFAULT 'tidak',
  paket_diajukan_at TEXT NOT NULL DEFAULT '',
  paket_rtf TEXT NOT NULL DEFAULT '',
  paket_daftar TEXT NOT NULL DEFAULT '',
  paket_diputuskan_oleh TEXT NOT NULL DEFAULT '',
  paket_diputuskan_at TEXT NOT NULL DEFAULT '',
  paket_catatan TEXT NOT NULL DEFAULT '',
  versi INTEGER NOT NULL DEFAULT 1,
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_blangko_pribadi_riwayat (
  id TEXT PRIMARY KEY,
  blangko_id TEXT NOT NULL,
  tindakan TEXT NOT NULL,
  ringkas TEXT NOT NULL DEFAULT '',
  oleh_id TEXT NOT NULL DEFAULT '',
  oleh_nama TEXT NOT NULL DEFAULT '',
  pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blangko_pribadi_pemilik ON aleta_blangko_pribadi(pemilik_id, diubah_at);

CREATE INDEX IF NOT EXISTS idx_blangko_pribadi_paket ON aleta_blangko_pribadi(paket_status, paket_diajukan_at);

CREATE INDEX IF NOT EXISTS idx_blangko_pribadi_riwayat ON aleta_blangko_pribadi_riwayat(blangko_id, pada);
