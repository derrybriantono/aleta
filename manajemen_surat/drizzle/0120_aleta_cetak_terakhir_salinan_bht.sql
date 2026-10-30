-- =============================================================================
-- CETAKAN TERAKHIR PER PERKARA + SALINAN PUTUSAN SESUDAH BHT (30 Oktober 2026)
-- =============================================================================
--
--   aleta_cetak_terakhir   ringkasan teks cetakan terakhir satu blangko pada satu perkara (potongan paragraf: sidik + 160 huruf
--                          pertama), dibandingkan dengan naskah sekarang untuk keterangan "N bagian berubah sejak cetakan
--                          terakhir". BUKAN dokumen: tidak dapat disusun kembali dari sini. Satu baris per (perkara, blangko),
--                          ditimpa tiap cetak. Data pribadi tetap di server ALETA.
--   aleta_salinan_bht      perkara yang baru BHT menurut SIPP dan salinannya belum diurus: dicatat pendeteksi berkala, ditutup
--                          petugas saat salinan sudah dicetak ('menunggu' -> 'selesai'). Hanya penunjuk perkara, tanpa isi.
--
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modulnya (src/server/modules/aleta-ecourt/cetak-terakhir.ts, salinan-bht.ts).
--
-- NOMOR: 0120 (idx 106) diklaim 30 Okt 2026 (blok 0120-0121 agen G3G5-KENDALI-CETAK).
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_CETAK_TERAKHIR);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_cetak_terakhir (
  perkara_id TEXT NOT NULL,
  berkas_kunci TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  bagian TEXT NOT NULL DEFAULT '[]',
  jumlah_bagian INTEGER NOT NULL DEFAULT 0,
  dicetak_pada TEXT NOT NULL,
  dicetak_oleh TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (perkara_id, berkas_kunci)
);

CREATE TABLE IF NOT EXISTS aleta_salinan_bht (
  perkara_id TEXT NOT NULL PRIMARY KEY,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  tanggal_putusan TEXT NOT NULL DEFAULT '',
  tanggal_bht TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'menunggu',
  terdeteksi_pada TEXT NOT NULL,
  selesai_pada TEXT NOT NULL DEFAULT '',
  selesai_oleh TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_cetak_terakhir_pada ON aleta_cetak_terakhir(dicetak_pada);
CREATE INDEX IF NOT EXISTS idx_salinan_bht_status ON aleta_salinan_bht(status, tanggal_bht);
