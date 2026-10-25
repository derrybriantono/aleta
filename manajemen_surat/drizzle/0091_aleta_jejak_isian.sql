-- =============================================================================
-- JEJAK ISIAN DAN BUTIR SAKSI (25 Okt 2026, rantai C, butir C1 = U1 + U2 + U6)
-- =============================================================================
--
-- Fondasi lingkar belajar: tanpa jejak, tidak ada yang dapat diukur atau
-- diurungkan lintas PC. Dua tabel, DIISI HANYA bila saklar Fitur Satker
-- "jejak-isian" dinyalakan Super Admin (bawaan MATI; saklar mati = perilaku
-- lama persis dan tidak satu baris pun ditulis).
--
--   aleta_saksi_butir    U1: SATU BARIS PER BUTIR tanya-jawab saksi yang disimpan
--                        petugas - pertanyaan, usulan mesin, teks final, asal
--                        fakta, kode pola, katalog/varian/jenis keterangan.
--                        Tiga jalur mengisinya: katalog (saksi-susun.js), cerai
--                        lama (abt.js saksi-sdg), dan tanya-jawab Blangko Derry.
--                        Selisih usulan vs final juga masuk aleta_jejak_koreksi.
--   aleta_isian_jejak    U2 + U6: SATU BARIS PER PENYIMPANAN satu isian ABT -
--                        nilai usulan beserta asal pengisi, nilai SEBELUM
--                        ditimpa (utuh, supaya Urungkan dapat dijalankan dari
--                        PC mana pun), nilai final, cara (otomatis / saran
--                        diterima / diubah / diketik / diurungkan), dan hasil
--                        baca-ulang dari ABT (terverifikasi).
--
-- Berisi teks keterangan saksi dan nama asli: HANYA di Postgres kantor, tidak
-- pernah masuk repo atau cloud. RETENSI 2 TAHUN (keputusan Derry 24 Okt):
-- baris yang lebih tua dibersihkan modul (jejak-isian.ts, bersihkanJejakLawas).
-- Tanpa kunci asing dan tanpa CHECK: nilai yang sah dijaga modul. Waktu ISO UTC
-- sebagai TEXT.
--
-- NOMOR: 0091 milik rantai C (docs/awan/rantai-upgrade-24okt.md). Di cabang
-- ini jurnal terakhir idx 80 = 0088, jadi 0091 memakai idx 81 (jurnal harus
-- tanpa lubang; uji di banyak berkas menjaganya). Rantai A memakai idx 81-82
-- di cabangnya sendiri - idx DIRAPIKAN saat gabung akhir.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_JEJAK_ISIAN);
--   (c) kedua tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/jejak-isian-25okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_saksi_butir (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  sidang TEXT NOT NULL DEFAULT '',
  saksi_ke INTEGER NOT NULL DEFAULT 0,
  pihak TEXT NOT NULL DEFAULT '',
  jalur TEXT NOT NULL DEFAULT '',
  variabel TEXT NOT NULL DEFAULT '',
  katalog TEXT NOT NULL DEFAULT '',
  versi_katalog TEXT NOT NULL DEFAULT '',
  jenis_perkara TEXT NOT NULL DEFAULT '',
  butir TEXT NOT NULL DEFAULT '',
  varian TEXT NOT NULL DEFAULT '',
  jenis_keterangan TEXT NOT NULL DEFAULT '',
  nomor_butir INTEGER NOT NULL DEFAULT 0,
  pertanyaan TEXT NOT NULL DEFAULT '',
  usulan TEXT NOT NULL DEFAULT '',
  teks_final TEXT NOT NULL DEFAULT '',
  hasil TEXT NOT NULL DEFAULT '',
  kemiripan DOUBLE PRECISION NOT NULL DEFAULT 0,
  sumber_fakta TEXT NOT NULL DEFAULT '',
  keyakinan TEXT NOT NULL DEFAULT '',
  kode_pola TEXT NOT NULL DEFAULT '',
  pengguna_id TEXT NOT NULL DEFAULT '',
  pengguna_nama TEXT NOT NULL DEFAULT '',
  pada TEXT NOT NULL,
  dibuat_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_isian_jejak (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  jenis_perkara TEXT NOT NULL DEFAULT '',
  blangko TEXT NOT NULL DEFAULT '',
  jenis_blangko TEXT NOT NULL DEFAULT '',
  kode TEXT NOT NULL DEFAULT '',
  nama_variabel TEXT NOT NULL DEFAULT '',
  nilai_usulan TEXT NOT NULL DEFAULT '',
  asal_usulan TEXT NOT NULL DEFAULT '',
  keyakinan TEXT NOT NULL DEFAULT '',
  kode_pola TEXT NOT NULL DEFAULT '',
  nilai_sebelum TEXT NOT NULL DEFAULT '',
  sebelum_dipotong SMALLINT NOT NULL DEFAULT 0,
  nilai_final TEXT NOT NULL DEFAULT '',
  final_dipotong SMALLINT NOT NULL DEFAULT 0,
  cara TEXT NOT NULL DEFAULT '',
  hasil TEXT NOT NULL DEFAULT '',
  terverifikasi TEXT NOT NULL DEFAULT '',
  nilai_terbaca TEXT NOT NULL DEFAULT '',
  jalur TEXT NOT NULL DEFAULT '',
  urungkan_dari TEXT NOT NULL DEFAULT '',
  diurungkan_oleh TEXT NOT NULL DEFAULT '',
  diurungkan_at TEXT NOT NULL DEFAULT '',
  pengguna_id TEXT NOT NULL DEFAULT '',
  pengguna_nama TEXT NOT NULL DEFAULT '',
  pada TEXT NOT NULL,
  dibuat_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saksi_butir_perkara ON aleta_saksi_butir(perkara_id, pada);

CREATE INDEX IF NOT EXISTS idx_saksi_butir_katalog ON aleta_saksi_butir(katalog, hasil);

CREATE INDEX IF NOT EXISTS idx_saksi_butir_pada ON aleta_saksi_butir(pada);

CREATE INDEX IF NOT EXISTS idx_isian_jejak_kode ON aleta_isian_jejak(kode, hasil);

CREATE INDEX IF NOT EXISTS idx_isian_jejak_perkara ON aleta_isian_jejak(perkara_id, pada);

CREATE INDEX IF NOT EXISTS idx_isian_jejak_pada ON aleta_isian_jejak(pada);
