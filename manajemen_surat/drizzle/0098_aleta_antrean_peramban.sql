-- =============================================================================
-- ANTREAN KERJA PERAMBAN DI BASIS DATA (K15, rantai B, 25 Okt 2026)
-- =============================================================================
--
--   aleta_antrean_peramban   salinan keadaan antrean kerja massal yang tadinya hanya hidup di
--                            chrome.storage peramban: cetak massal Blangko Derry, relaas massal
--                            juru sita, dan catatan pengerjaan putusan terjadwal. Satu baris per
--                            (pengguna, jenis, kunci antrean). Sesudah Chrome ditutup, antrean yang
--                            belum selesai ditawarkan kembali kepada PEMILIKNYA (tidak pernah
--                            dijalankan sendiri).
--
-- Isi muatan_json HANYA keadaan pengerjaan (nomor perkara, nama berkas, status per butir) - tidak
-- ada isi putusan, NIK, atau nama pihak. Dibaca/ditulis hanya oleh pemiliknya. Dibuang 14 hari
-- sesudah diubah terakhir (selesai: 2 hari). Hanya terisi bila Super Admin menyalakan saklar
-- kinerja.antreanDiServer (mati bawaan).
--
-- Tanpa kunci asing dan tanpa CHECK: nilai sah dijaga modul
-- (src/server/modules/aleta-ecourt/antrean-peramban.ts). Waktu ISO UTC sebagai TEXT.
--
-- NOMOR: rantai B memegang 0098-0100 (docs/awan/rantai-upgrade-24okt.md). Di cabang ini jurnal
-- terakhir idx 80 = 0088, jadi 0098 memakai idx 81; idx dirapikan saat gabung.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_ANTREAN_PERAMBAN);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_antrean_peramban (
  pengguna_id TEXT NOT NULL,
  jenis TEXT NOT NULL,
  kunci TEXT NOT NULL,
  perangkat TEXT NOT NULL DEFAULT '',
  ringkas TEXT NOT NULL DEFAULT '',
  selesai INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  muatan_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'jalan',
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL,
  PRIMARY KEY (pengguna_id, jenis, kunci)
);

CREATE INDEX IF NOT EXISTS idx_antrean_peramban_status ON aleta_antrean_peramban(pengguna_id, status);
