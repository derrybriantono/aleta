-- =============================================================================
-- Pustaka blangko ALETA (Tahap 5 - Kemandirian Blangko).
--
-- =============================================================================
-- BLANGKO ALETA BUKAN BERKAS
-- =============================================================================
--
-- Pustaka ABT berlubang karena ia matriks yang diisi berkas satu per satu:
-- 110 berkas BAS hanya menempati 58 sel, dan tiap dimensi baru melipatgandakan
-- kombinasinya. Menambah berkas tidak akan pernah menutupnya - itulah sebab
-- ABT tidak punya seluruh blangko, dan sebab menyalin 807 berkas ke ALETA akan
-- mewarisi lubangnya sekaligus.
--
-- Blangko ALETA tersusun dari kerangka + bagian + syarat. Dari ketiganya,
-- kombinasi yang ABT tidak punya berkasnya pun terbit dengan benar.
--
-- =============================================================================
-- TEKS DISALIN KE BAGIAN, TIDAK HANYA DITUNJUK
-- =============================================================================
--
-- Bagian yang hanya menyimpan sidik blok akan ikut berubah setiap kali blok
-- kalimatnya disunting - termasuk blangko yang sudah dipakai menerbitkan
-- ratusan dokumen. Perubahan itu tidak menghasilkan galat dan tidak tercatat
-- di mana pun.
--
-- Sidiknya tetap disimpan sebagai asal-usul, tetapi yang dicetak adalah teks
-- pada barisnya sendiri. Aturan yang sama sudah dipakai draf putusan (0027).
--
-- =============================================================================
-- ASAL-USUL DICATAT SEBAGAI SEJARAH, BUKAN SYARAT TERBIT
-- =============================================================================
--
-- Blangko yang diturunkan dari ABT menyimpan jalur asalnya supaya dapat
-- ditelusuri. Blangko baru - untuk dokumen yang ABT memang tidak punya -
-- berdiri tanpa asal-usul, dan itu SAH. Mewajibkannya akan mengunci ALETA pada
-- batas ABT, yang justru kebalikan dari tujuan seluruh rencana ini.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_blangko (
  id TEXT PRIMARY KEY,
  kode TEXT NOT NULL,
  nama TEXT NOT NULL DEFAULT '',
  jenis TEXT NOT NULL DEFAULT '',
  keterangan TEXT NOT NULL DEFAULT '',
  -- Jalur blangko ABT yang menjadi asalnya. KOSONG itu sah.
  asal_abt TEXT NOT NULL DEFAULT '',
  keadaan TEXT NOT NULL DEFAULT 'draf',
  versi INTEGER NOT NULL DEFAULT 1,
  disusun_oleh TEXT NOT NULL DEFAULT '',
  disahkan_oleh TEXT NOT NULL DEFAULT '',
  disahkan_at TEXT,
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_blangko_bagian (
  id TEXT PRIMARY KEY,
  blangko_id TEXT NOT NULL,
  urutan INTEGER NOT NULL DEFAULT 0,
  blok_sidik TEXT NOT NULL DEFAULT '',
  teks TEXT NOT NULL DEFAULT '',
  syarat TEXT NOT NULL DEFAULT '{}',
  rata TEXT NOT NULL DEFAULT 'justify',
  tebal INTEGER NOT NULL DEFAULT 0,
  bernomor INTEGER NOT NULL DEFAULT 0,
  jorok REAL NOT NULL DEFAULT 0,
  selalu INTEGER NOT NULL DEFAULT 0,
  dibuat_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_blangko_terbit (
  id TEXT PRIMARY KEY,
  blangko_id TEXT NOT NULL,
  perkara_id TEXT NOT NULL,
  keadaan TEXT NOT NULL DEFAULT '{}',
  jumlah_bagian INTEGER NOT NULL DEFAULT 0,
  jumlah_penanda INTEGER NOT NULL DEFAULT 0,
  jumlah_tersisa INTEGER NOT NULL DEFAULT 0,
  tersisa TEXT NOT NULL DEFAULT '[]',
  huruf_tak_tercetak INTEGER NOT NULL DEFAULT 0,
  bentuk TEXT NOT NULL DEFAULT 'docx',
  oleh TEXT NOT NULL DEFAULT '',
  pada TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blangko_kode ON aleta_blangko(kode);
CREATE INDEX IF NOT EXISTS idx_blangko_jenis ON aleta_blangko(jenis);
CREATE INDEX IF NOT EXISTS idx_blangko_bagian_induk ON aleta_blangko_bagian(blangko_id, urutan);
CREATE INDEX IF NOT EXISTS idx_blangko_terbit_perkara ON aleta_blangko_terbit(perkara_id);
CREATE INDEX IF NOT EXISTS idx_blangko_terbit_waktu ON aleta_blangko_terbit(pada);
