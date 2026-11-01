-- =============================================================================
-- PENJAGA TENGGAT N2 (2 Nov 2026) - catatan KABAR yang sudah terkirim per tahap
-- =============================================================================
--
-- Satu baris = satu kabar untuk satu penerima tentang satu tenggat pada satu tahap
-- (H-3, H-1, lewat, atau catatan). Kunci utama
-- "<penerima>|<perkara>|<aturan>|<pihak>|<tanggal acuan>|<tahap>" membuat kabar
-- yang SAMA tidak pernah dikirim dua kali: sesudah H-3 terkirim, hari-hari
-- berikutnya diam sampai H-1, lalu sekali saat lewat. Berubahnya tanggal acuan
-- (mis. mediator baru ditunjuk) membuka kabar baru karena kuncinya berbeda.
--
-- Berbeda dari aleta_tenggat_kirim (0110, satu baris per penerima per HARI,
-- pencegah pesan ganda dalam sehari): tabel ini ingatan ANTAR hari.
--
-- Baris ditulis SESUDAH pesan masuk antrean bot WhatsApp; pesan yang gagal tidak
-- dicatat, jadi dicoba lagi pada jalan berikutnya. Isi pesan tidak disimpan.
--
-- NOMOR: 0127, jurnal idx 111 (klaim agen N2 di klaim-1nov.txt; idx 106-110 milik
-- 0122-0126 dari cabang lain, berurutan setelah semua cabang digabung). TIGA TEMPAT:
-- (a) berkas ini + meta/_journal.json; (b) DDL_ALETA_TENGGAT_KABAR di
-- src/server/db/schema.ts; (c) IN_MEMORY_TABLE_PERSISTENCE_ORDER di
-- src/server/db/client.ts. Tanpa kunci asing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aleta_tenggat_kabar (
  id TEXT PRIMARY KEY,
  penerima_id TEXT NOT NULL,
  perkara_id TEXT NOT NULL DEFAULT '',
  aturan TEXT NOT NULL DEFAULT '',
  tahap TEXT NOT NULL DEFAULT '',
  tanggal TEXT NOT NULL,
  dibuat_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenggat_kabar_penerima ON aleta_tenggat_kabar(penerima_id);
CREATE INDEX IF NOT EXISTS idx_tenggat_kabar_tanggal ON aleta_tenggat_kabar(tanggal);
