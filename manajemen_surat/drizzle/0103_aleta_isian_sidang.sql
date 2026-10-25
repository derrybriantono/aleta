-- =============================================================================
-- ISIAN PER SIDANG UNTUK BAS BERUNTUN (25 Okt 2026, rantai D, butir D6 = U12)
-- =============================================================================
--
-- Isian teks/tanggal ABT berkunci (no_var, perkara), BUKAN per sidang. Akibatnya BAS
-- sidang kedua menimpa isian ketikan BAS sidang pertama, dan BAS sidang pertama yang
-- dicetak ulang kemudian memuat isian sidang kedua. Tabel ini menyimpan isian ketikan
-- BAS PER SIDANG di ALETA; saat petugas mencetak BAS sidang tertentu, ekstensi
-- menulis nilai sidang itu ke ABT SEMENTARA, mengambil naskahnya, lalu memulihkan
-- nilai ABT semula (lihat blangko-derry-isian.js, terapkanIsianSidang).
--
--   aleta_isian_sidang   SATU BARIS PER (perkara, sidang, nomor variabel): nilai terakhir
--                        yang diketik atau diterima petugas untuk isian itu di BAS
--                        sidang itu. Nilai kosong ikut disimpan (petugas sengaja
--                        mengosongkannya di sidang itu).
--
-- DIPAKAI HANYA bila saklar Fitur Satker "isian-per-sidang" menyala (bawaan MATI; mati =
-- tidak satu baris pun ditulis dan BAS persis seperti sebelumnya). Tabel baru, bukan
-- kolom di aleta_isian_perkara (0035): indeks unik aleta_isian_perkara(perkara_id, no_var)
-- dan seluruh pembacanya (isian Kelas B blangko ALETA) tidak boleh berubah artinya.
-- Berisi teks isian BAS: HANYA di Postgres kantor, tidak pernah masuk repo atau cloud.
--
-- NOMOR: 0103 milik rantai D (docs/awan/rantai-upgrade-24okt.md). Cabang dasar berujung
-- idx 83 = 0102, jadi 0103 memakai idx 84 (jurnal harus tanpa lubang); idx DIRAPIKAN saat
-- gabung akhir.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_ISIAN_SIDANG);
--   (c) tabelnya di IN_MEMORY_TABLE_PERSISTENCE_ORDER (db/client.ts).
-- Kesamaan (a) dan (b) dijaga src/test/isian-per-sidang-25okt.test.ts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_isian_sidang (
  id TEXT PRIMARY KEY,
  perkara_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  sidang INTEGER NOT NULL DEFAULT 0,
  no_var TEXT NOT NULL DEFAULT '',
  nilai TEXT NOT NULL DEFAULT '',
  diisi_oleh TEXT NOT NULL DEFAULT '',
  diisi_at TEXT NOT NULL,
  diubah_oleh TEXT NOT NULL DEFAULT '',
  diubah_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_isian_sidang_kunci ON aleta_isian_sidang(perkara_id, sidang, no_var);

CREATE INDEX IF NOT EXISTS idx_isian_sidang_perkara ON aleta_isian_sidang(perkara_id, sidang);
