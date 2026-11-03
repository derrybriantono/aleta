-- =============================================================================
-- REGISTER KUASA HUKUM PER PERKARA (3 Nov 2026) - nomor & tanggal register kuasa khusus
-- =============================================================================
--
-- Borang SIPP "Tambah/Ubah Data Kuasa Hukum" hanya punya Nomor/Tanggal SURAT kuasa
-- (perkara_pengacara.nomor_kuasa/tanggal_kuasa). Nomor & tanggal REGISTER kuasa khusus di
-- kepaniteraan tidak punya kolom di SIPP, dan skema SIPP tidak diubah - maka disimpan di sini.
--
-- ATURAN (keputusan Derry 3 Nov): satu NAMA kuasa (orang yang sama; dicocokkan tanpa gelar,
-- tanda baca, dan spasi) dalam satu perkara = satu nomor dan tanggal register. Pihak lain yang
-- memberi kuasa kepada kuasa yang sama ikut nilai itu. Register BARU hanya bila kuasa itu
-- ditambahkan pada tanggal lain (tanggal surat kuasa berbeda). Kunci baris:
--   (nomor_perkara, kunci_nama, tanggal_surat_kuasa)   - tanggal_surat_kuasa ISO, '' bila belum diisi.
--
-- Dibaca: borang kuasa SIPP di ekstensi (mengisi otomatis) dan usulan isian ABT #8539#/#0132#
-- (kalimat kuasa blangko). Ditulis: ekstensi, SESUDAH SIPP menjawab berhasil menyimpan kuasa.
-- Tidak ada yang ditulis ke SIPP/ABT oleh tabel ini.
--
-- NOMOR: 0132, jurnal idx 114 (klaim agen SIPPFORM di klaim-1nov.txt). TIGA TEMPAT:
-- (a) berkas ini + meta/_journal.json; (b) DDL_ALETA_REGISTER_KUASA di src/server/db/schema.ts;
-- (c) IN_MEMORY_TABLE_PERSISTENCE_ORDER di src/server/db/client.ts. Tanpa kunci asing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_register_kuasa (
  id TEXT PRIMARY KEY,
  nomor_perkara TEXT NOT NULL,
  kunci_nama TEXT NOT NULL,
  nama_kuasa TEXT NOT NULL DEFAULT '',
  pihak_ke INTEGER NOT NULL DEFAULT 1,
  pihak_nama TEXT NOT NULL DEFAULT '',
  tanggal_surat_kuasa TEXT NOT NULL DEFAULT '',
  nomor_register TEXT NOT NULL DEFAULT '',
  tanggal_register TEXT NOT NULL DEFAULT '',
  dibuat_oleh TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_register_kuasa_perkara ON aleta_register_kuasa(nomor_perkara, kunci_nama);
