-- =============================================================================
-- PENYUNTING BLANGKO DAN VERSI ALETA ABT (5 Nov 2026, Tahap 3)
-- =============================================================================
--
-- Blangko pustaka (aleta_abt_berkas, migrasi 0133) disunting di layar. TIAP SIMPAN = SATU VERSI BARU di tabel ini; isi
-- aleta_abt_berkas TIDAK berubah sampai pemilik (Super Admin) menerbitkan sebuah versi. Suntingan yang belum terbit
-- (status 'draf') tidak dibaca jalur mana pun selain penyunting itu sendiri.
--
--   nomor     1, 2, 3 ... per berkas, tidak pernah dipakai ulang. Versi 1 = salinan ABT saat pertama disunting (jenis 'asal').
--   jenis     'asal' salinan ABT; 'sunting' hasil ketikan; 'pulih' salinan PERSIS PER BITA dari versi lama (dari_nomor).
--   status    'draf' belum terbit; 'terbit' yang dipakai sekarang (paling banyak satu per berkas); 'lama' pernah terbit.
--   isi       teks latin1 apa adanya (pengkodean 'base64' bila memuat bita nol) - sama dengan aleta_abt_berkas.
--
-- Berkas yang pernah disunting ditandai aleta_abt_berkas.diubah = 1 sehingga Sinkron dari ABT tidak menimpanya (aturan di
-- src/lib/aleta-abt-pustaka.ts: ubahan ALETA ABT dibiarkan, sidik ABT dicatat sebagai bentrok).
--
-- NOMOR: 0135, jurnal idx 117 (sesudah 0134/idx 116). TIGA TEMPAT: (a) berkas ini + meta/_journal.json;
-- (b) DDL_ALETA_ABT_PENYUNTING di src/server/db/schema.ts; (c) IN_MEMORY_TABLE_PERSISTENCE_ORDER di src/server/db/client.ts.
-- Tanpa kunci asing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_abt_berkas_versi (
  id TEXT PRIMARY KEY,
  berkas_id TEXT NOT NULL,
  nomor INTEGER NOT NULL,
  isi TEXT NOT NULL DEFAULT '',
  pengkodean TEXT NOT NULL DEFAULT 'latin1',
  md5 TEXT NOT NULL DEFAULT '',
  ukuran INTEGER NOT NULL DEFAULT 0,
  jenis TEXT NOT NULL DEFAULT 'sunting',
  status TEXT NOT NULL DEFAULT 'draf',
  dari_nomor INTEGER NOT NULL DEFAULT 0,
  catatan TEXT NOT NULL DEFAULT '',
  ringkas TEXT NOT NULL DEFAULT '',
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dibuat_nama TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  terbit_oleh TEXT NOT NULL DEFAULT '',
  terbit_nama TEXT NOT NULL DEFAULT '',
  terbit_at TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_abt_versi_berkas_nomor ON aleta_abt_berkas_versi(berkas_id, nomor);
CREATE INDEX IF NOT EXISTS idx_abt_versi_status ON aleta_abt_berkas_versi(berkas_id, status);
