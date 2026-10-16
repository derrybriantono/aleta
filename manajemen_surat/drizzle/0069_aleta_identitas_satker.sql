-- =============================================================================
-- IDENTITAS SATKER UNTUK BLANGKO ABT (Pengaturan SIPP & ABT > Identitas satker)
-- =============================================================================
--
-- 17 Oktober 2026 (keputusan pengguna butir 3, 4, 7): nama pengadilan,
-- Pengadilan Tinggi, alamat kantor, telepon/WA, laman, surel, kode surat,
-- zona waktu, dan LOGO kop satker diatur Super Admin/Admin di ALETA.
-- SIPP tidak menyimpan telepon/laman/surel/logo; blangko Derry mengambilnya
-- dari isian satker per KodePN di kueri variabel 9271-9274 (paket
-- abt-universal-satker-derry). Menerapkan ke ABT berjalan lewat jalur tulis
-- Pengaturan SIPP & ABT (cadangan + riwayat di aleta_abt_suntingan + Kembalikan);
-- logo kop lewat PAKET yang dibangun bot dan dipasang petugas server.
--
-- Satu baris (id = 1). Logo disimpan sebagai PNG/JPG base64 (<= 2 MB,
-- dikecilkan portal) - tidak ada berkas terpisah yang dapat tercecer.
-- Tidak ada keterangan ALETA yang masuk ke SIPP (butir 45).
--
-- NOMOR: 0069 (idx 66) diklaim 17 Okt 2026 oleh agen keputusan-17okt-c.
-- Lihat memori migrasi-0039-diklaim.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_IDENTITAS_SATKER);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/identitas-satker-17okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_identitas_satker (
  id INTEGER PRIMARY KEY,
  kode_satker TEXT NOT NULL DEFAULT '',
  nama_pengadilan TEXT NOT NULL DEFAULT '',
  pengadilan_tinggi TEXT NOT NULL DEFAULT '',
  alamat TEXT NOT NULL DEFAULT '',
  telepon TEXT NOT NULL DEFAULT '',
  laman TEXT NOT NULL DEFAULT '',
  surel TEXT NOT NULL DEFAULT '',
  kode_surat TEXT NOT NULL DEFAULT '',
  zona_waktu TEXT NOT NULL DEFAULT '',
  logo_base64 TEXT NOT NULL DEFAULT '',
  logo_jenis TEXT NOT NULL DEFAULT '',
  logo_md5 TEXT NOT NULL DEFAULT '',
  logo_lebar INTEGER NOT NULL DEFAULT 0,
  logo_tinggi INTEGER NOT NULL DEFAULT 0,
  diubah_oleh_id TEXT NOT NULL DEFAULT '',
  diubah_oleh_nama TEXT NOT NULL DEFAULT '',
  diubah_pada TEXT NOT NULL DEFAULT ''
);
