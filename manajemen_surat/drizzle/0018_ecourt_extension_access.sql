-- =============================================================================
-- Akses ekstensi ALETA E-Court per peran.
--
-- Sebelum ini, siapa pun yang punya sesi portal dapat memakai seluruh kemampuan
-- ekstensi: melihat konteks perkara, mengunduh berkas e-Court, dan menitip
-- permintaan penarikan. Satu sesi portal berarti akses penuh ke berkas perkara
-- siapa pun.
--
-- Tabel ini memisahkannya menjadi tiga kemampuan yang dapat dinyalakan dan
-- dimatikan per peran dari halaman Integrasi e-Court.
--
-- Super Admin dan Admin TIDAK disimpan di sini. Keduanya selalu berkemampuan
-- penuh, dan itu ditegakkan di dalam kode - bukan oleh baris di tabel ini.
-- Bila kewenangan mereka bergantung pada data, satu pengalihan yang keliru
-- dapat mengunci seluruh administrasi keluar dari pengaturannya sendiri, tanpa
-- jalan kembali lewat antarmuka.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ecourt_extension_access (
  role_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  enabled SMALLINT NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (role_id, capability),
  CONSTRAINT fk_ecourt_extension_access_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE INDEX IF NOT EXISTS idx_ecourt_extension_access_capability
  ON ecourt_extension_access (capability);
