-- =============================================================================
-- JEJAK KIRIM KETERANGAN SAKSI KE BAS SIPP (25 Okt 2026, rantai C, butir C6 = U10)
-- =============================================================================
--
-- Tombol "Kirim keterangan saksi ke BAS SIPP" di Susun saksi (ABT) mencetak BAS sidang dari ABT (yang memuat keterangan saksi
-- tersimpan), memperlihatkan pratinjau, membaca ulang e-Doc di SIPP, lalu - hanya atas persetujuan petugas - mengunggahnya sebagai
-- e-Doc BAS lewat rute unggah yang sudah ada. Tabel ini mencatat TIAP percobaan (pratinjau, kirim, gagal, dobel) supaya tercatat
-- siapa mengirim apa. Tidak ada isi BAS yang disimpan: hanya sidik (sha256 awal), ukuran, dan hitungan.
--
-- SAKLAR: butir katalog Fitur Satker "saksi-ke-bas-sipp" (bawaan MATI). Mati = ekstensi tidak menampilkan tombol dan server tidak
-- menulis jejak. Retensi 2 tahun (dibersihkan oleh modul). Tanpa kunci asing dan tanpa CHECK; waktu ISO UTC sebagai TEXT.
--
-- NOMOR: 0101 milik rantai C; di cabang ini jurnal terakhir idx 82 = 0093, jadi 0101 memakai idx 83 (idx DIRAPIKAN saat gabung akhir).
-- TIGA TEMPAT PENDAFTARAN: (a) berkas ini + meta/_journal.json; (b) DDL_SAKSI_KIRIM_BAS di src/server/db/schema.ts;
-- (c) tabel di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_saksi_kirim_bas (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  sidang_id TEXT NOT NULL DEFAULT '',
  urutan_sidang INTEGER NOT NULL DEFAULT 0,
  tahap TEXT NOT NULL DEFAULT 'pratinjau',
  hasil TEXT NOT NULL DEFAULT '',
  jumlah_saksi INTEGER NOT NULL DEFAULT 0,
  jumlah_jawaban INTEGER NOT NULL DEFAULT 0,
  jumlah_hilang INTEGER NOT NULL DEFAULT 0,
  ukuran INTEGER NOT NULL DEFAULT 0,
  sidik TEXT NOT NULL DEFAULT '',
  catatan TEXT NOT NULL DEFAULT '',
  pengguna_id TEXT NOT NULL DEFAULT '',
  pengguna_nama TEXT NOT NULL DEFAULT '',
  pada TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saksi_kirim_bas_perkara ON aleta_saksi_kirim_bas(perkara_id, pada);
CREATE INDEX IF NOT EXISTS idx_saksi_kirim_bas_pada ON aleta_saksi_kirim_bas(pada);
