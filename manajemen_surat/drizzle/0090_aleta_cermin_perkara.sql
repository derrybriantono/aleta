-- =============================================================================
-- CERMIN PERKARA (C0, 25 Okt 2026) - keadaan tiap perkara SIPP siap di basis data ALETA
-- =============================================================================
--
-- Sekali di awal, ALETA memindai seluruh perkara SIPP (berkelompok, malam hari,
-- bisa dilanjutkan) dan menyimpan keadaannya di sini; sesudah itu hanya perkara
-- baru/berubah yang diperbarui. Layar membaca cermin ini (per layar, lewat
-- saklar Super Admin yang MATI bawaan) alih-alih menanyai SIPP berkali-kali.
--
-- ATURAN (docs/rancangan/upgrade-otomatisasi-24okt/README.md, bagian C0):
--   * Cermin hanya untuk DIBACA. Tulisan tetap ke SIPP/ABT lewat jalur lama yang
--     membaca ulang sumbernya; tidak ada trigger atau ubahan skema di SIPP/ABT.
--   * SIPP tetap sumber kebenaran. Cermin yang tertinggal = layar kembali ke SIPP.
--   * Berisi data pribadi (nama pihak) - hanya di server kantor, tidak masuk repo.
--
--   aleta_cermin_perkara   satu baris per perkara: identitas, pelaksana,
--                          sidang terakhir/berikut, akhir perkara, penanda.
--   aleta_cermin_sidang    satu baris per jadwal sidang; baris_json = baris
--                          yang SAMA dengan yang disusun bot untuk layar Jadwal
--                          Sidang (satu-satunya sumber bentuknya), sehingga isi
--                          layar dari cermin = isi dari jalur lama.
--   aleta_cermin_pihak     nama dan sebutan pihak, kuasa, alamat ringkas.
--   aleta_cermin_mediasi   satu baris per perkara/pertemuan mediasi; baris_json
--                          idem untuk layar Jadwal Mediasi.
--   aleta_cermin_tag       penanda Status Perkara yang sudah dihitung
--                          (perkara x tag) - klik tag cukup sekali baca Postgres.
--   aleta_cermin_jejak     tanda terakhir per tabel SIPP, kemajuan pemindai awal,
--                          hasil pencocokan, dan catatan galat.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai sah dijaga modul
-- (src/server/modules/cermin/*). Waktu ISO UTC sebagai TEXT; tanggal SIPP
-- sebagai TEXT 'YYYY-MM-DD'.
--
-- NOMOR: rantai A memegang 0090, 0096, 0097. Jurnal: idx 81 (idx sesudah 0088 =
-- 80); sesi laptop merapikan idx saat gabung. TIGA TEMPAT PENDAFTARAN, semuanya
-- wajib: (a) berkas ini + meta/_journal.json; (b) DDL yang sama di
-- src/server/db/schema.ts (DDL_ALETA_CERMIN_PERKARA); (c) keenam tabel di
-- IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts). Kesamaan (a) dan (b) dijaga
-- src/test/cermin-dasar-25okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_cermin_perkara (
  perkara_id TEXT PRIMARY KEY,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  jenis_perkara_id INTEGER,
  jenis_perkara_nama TEXT NOT NULL DEFAULT '',
  alur_perkara_id INTEGER,
  tanggal_pendaftaran TEXT NOT NULL DEFAULT '',
  prodeo INTEGER NOT NULL DEFAULT 0,
  tahapan_terakhir_id INTEGER,
  tahapan_terakhir_text TEXT NOT NULL DEFAULT '',
  proses_terakhir_id INTEGER,
  proses_terakhir_text TEXT NOT NULL DEFAULT '',
  majelis_hakim TEXT NOT NULL DEFAULT '',
  panitera_pengganti TEXT NOT NULL DEFAULT '',
  jurusita TEXT NOT NULL DEFAULT '',
  sidang_pertama TEXT NOT NULL DEFAULT '',
  sidang_terakhir TEXT NOT NULL DEFAULT '',
  sidang_berikut TEXT NOT NULL DEFAULT '',
  jumlah_sidang INTEGER NOT NULL DEFAULT 0,
  tanggal_putusan TEXT NOT NULL DEFAULT '',
  status_putusan TEXT NOT NULL DEFAULT '',
  putusan_verstek INTEGER NOT NULL DEFAULT 0,
  tanggal_minutasi TEXT NOT NULL DEFAULT '',
  tanggal_bht TEXT NOT NULL DEFAULT '',
  status_mediasi TEXT NOT NULL DEFAULT '',
  sisa_panjar DOUBLE PRECISION,
  penanda_json TEXT NOT NULL DEFAULT '{}',
  sipp_diperbarui TEXT NOT NULL DEFAULT '',
  cermin_diperbarui TEXT NOT NULL,
  sidik TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_cermin_sidang (
  sidang_id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL DEFAULT '',
  tanggal_sidang TEXT NOT NULL DEFAULT '',
  jam_sidang TEXT NOT NULL DEFAULT '',
  ruangan TEXT NOT NULL DEFAULT '',
  agenda TEXT NOT NULL DEFAULT '',
  ditunda INTEGER NOT NULL DEFAULT 0,
  baris_json TEXT NOT NULL DEFAULT '{}',
  sipp_diperbarui TEXT NOT NULL DEFAULT '',
  cermin_diperbarui TEXT NOT NULL,
  sidik TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_cermin_pihak (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL DEFAULT '',
  sisi INTEGER NOT NULL DEFAULT 0,
  urutan INTEGER NOT NULL DEFAULT 0,
  nama TEXT NOT NULL DEFAULT '',
  sebutan TEXT NOT NULL DEFAULT '',
  kuasa TEXT NOT NULL DEFAULT '',
  alamat_ringkas TEXT NOT NULL DEFAULT '',
  cermin_diperbarui TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_cermin_mediasi (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL DEFAULT '',
  tanggal TEXT NOT NULL DEFAULT '',
  mediator TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  baris_json TEXT NOT NULL DEFAULT '{}',
  sipp_diperbarui TEXT NOT NULL DEFAULT '',
  cermin_diperbarui TEXT NOT NULL,
  sidik TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS aleta_cermin_tag (
  perkara_id TEXT NOT NULL,
  tag_kunci TEXT NOT NULL,
  cermin_diperbarui TEXT NOT NULL,
  PRIMARY KEY (perkara_id, tag_kunci)
);

CREATE TABLE IF NOT EXISTS aleta_cermin_jejak (
  kunci TEXT PRIMARY KEY,
  nilai_json TEXT NOT NULL DEFAULT '{}',
  diperbarui_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cermin_perkara_nomor ON aleta_cermin_perkara(nomor_perkara);
CREATE INDEX IF NOT EXISTS idx_cermin_perkara_sipp ON aleta_cermin_perkara(sipp_diperbarui);
CREATE INDEX IF NOT EXISTS idx_cermin_sidang_tanggal ON aleta_cermin_sidang(tanggal_sidang, jam_sidang);
CREATE INDEX IF NOT EXISTS idx_cermin_sidang_perkara ON aleta_cermin_sidang(perkara_id);
CREATE INDEX IF NOT EXISTS idx_cermin_pihak_perkara ON aleta_cermin_pihak(perkara_id);
CREATE INDEX IF NOT EXISTS idx_cermin_mediasi_tanggal ON aleta_cermin_mediasi(tanggal);
CREATE INDEX IF NOT EXISTS idx_cermin_mediasi_perkara ON aleta_cermin_mediasi(perkara_id);
CREATE INDEX IF NOT EXISTS idx_cermin_tag_kunci ON aleta_cermin_tag(tag_kunci, perkara_id);
