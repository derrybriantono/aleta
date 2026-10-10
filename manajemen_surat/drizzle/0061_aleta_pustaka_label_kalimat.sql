-- =============================================================================
-- D3 - PUSTAKA KALIMAT: LABEL BAGIAN, ALASAN, DAN KEADAAN PADA BUTIR PUSTAKA
-- =============================================================================
--
-- 10 Oktober 2026 (paket deteksi lengkap, butir D3). Pustaka pertimbangan yang
-- sudah ada (0026, aleta_pertimbangan_butir; modul pustaka-pertimbangan.ts)
-- DIPERLUAS, bukan dibuat pustaka kedua. Kolom baru memberi tiap kalimat label
-- yang dibaca templat P6/P7 (kalimat-saksi, kalimat-hakim):
--
--   bagian         pertimbangan | keterangan-saksi | tuntutan | posita | amar
--                  (butir lama = pertimbangan; serap dari putusan tetap begitu)
--   label_alasan   JSON daftar huruf alasan perceraian (A-K) - USULAN, hal hukum
--                  selalu diperiksa manusia
--   label_keadaan  JSON daftar keadaan (mis. "verstek", "nafkah-anak",
--                  "qobla-dukhul", "pisah-rumah") - kunci kelompok kamus deteksi
--   label_oleh/_at siapa terakhir menetapkan label; kosong = belum ditetapkan
--                  orang (usulan otomatis dari kamus deteksi tidak mengisinya)
--
-- NOMOR: 0061 (idx 60) - lihat 0060_aleta_kamus_deteksi.sql.
--
-- TIGA TEMPAT PENDAFTARAN: berkas ini + _journal.json; DDL_PUSTAKA_LABEL di
-- src/server/db/schema.ts; aleta_pertimbangan_butir sudah di
-- IN_MEMORY_TABLE_PERSISTENCE_ORDER. Dijaga kamus-deteksi-db-10okt.test.ts.
-- =============================================================================

ALTER TABLE aleta_pertimbangan_butir ADD COLUMN IF NOT EXISTS bagian TEXT NOT NULL DEFAULT 'pertimbangan';

ALTER TABLE aleta_pertimbangan_butir ADD COLUMN IF NOT EXISTS label_alasan TEXT NOT NULL DEFAULT '[]';

ALTER TABLE aleta_pertimbangan_butir ADD COLUMN IF NOT EXISTS label_keadaan TEXT NOT NULL DEFAULT '[]';

ALTER TABLE aleta_pertimbangan_butir ADD COLUMN IF NOT EXISTS label_oleh TEXT NOT NULL DEFAULT '';

ALTER TABLE aleta_pertimbangan_butir ADD COLUMN IF NOT EXISTS label_at TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_pertimbangan_bagian ON aleta_pertimbangan_butir(bagian, keadaan);
