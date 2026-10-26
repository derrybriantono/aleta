-- =============================================================================
-- PENJAGA TENGGAT TERJADWAL (G1, 25 Okt 2026) - catatan kirim pengingat WhatsApp
-- =============================================================================
--
-- Satu baris = satu pengingat untuk satu penerima pada satu tanggal. Kunci utama
-- "<tanggal>:<id penerima>" membuat PENGIRIMAN GANDA mustahil: pengirim
-- MENGKLAIM baris lebih dahulu (INSERT ... ON CONFLICT DO NOTHING) dan hanya yang
-- berhasil mengklaim yang mengirim. Proses yang mati di tengah, detak yang
-- tumpang tindih, atau dua mesin portal tidak pernah mengirim dua pesan ke orang
-- yang sama pada hari yang sama.
--
--   status  diklaim -> terkirim | gagal | dilewati
--   dilewati: penerima tidak punya nomor WhatsApp yang sah, atau pengiriman WhatsApp dimatikan di server.
--
-- Hanya dipakai bila saklar pengingat WhatsApp menyala (bawaan MATI). Saklar
-- disimpan di aleta_ekstensi_setelan (kunci 'sistem:penjaga-tenggat'), tanpa
-- tabel baru. Isi pesan TIDAK disimpan di sini (hanya jumlah butir) - pesan
-- sudah tercatat di antrean bot WhatsApp.
--
-- NOMOR: rantai G memegang 0110 dan 0111. Jurnal idx 83. TIGA TEMPAT: (a) berkas
-- ini + meta/_journal.json; (b) DDL_ALETA_TENGGAT_KIRIM di src/server/db/schema.ts;
-- (c) daftar cadangan IN_MEMORY_TABLE_PERSISTENCE_ORDER di src/server/db/client.ts.
-- Tanpa kunci asing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_tenggat_kirim (
  id TEXT PRIMARY KEY,
  tanggal TEXT NOT NULL,
  penerima_id TEXT NOT NULL,
  penerima_nama TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'diklaim',
  jumlah_butir INTEGER NOT NULL DEFAULT 0,
  antrean_id TEXT NOT NULL DEFAULT '',
  keterangan TEXT NOT NULL DEFAULT '',
  dibuat_at TEXT NOT NULL,
  diubah_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenggat_kirim_tanggal ON aleta_tenggat_kirim(tanggal);
