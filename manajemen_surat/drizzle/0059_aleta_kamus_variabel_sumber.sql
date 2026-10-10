-- =============================================================================
-- D1 - KAMUS VARIABEL ABT: SUMBER, ARTI, BLANGKO PEMAKAI, STATUS, CERMIN SIPP
-- =============================================================================
--
-- 10 Oktober 2026 (rencana-upgrade-sinkron-sipp-abt, D1). Kamus 0033 menyalin
-- definisi ABT apa adanya; kolom baru ini menyimpan URAIANNYA supaya terbaca
-- orang dan dipakai mesin (pengingat sebelum CETAK, B1):
--
--   urutan_data, referensi   dua ruas abt_variabel yang belum ikut disalin 0033
--                            (urutan pihak untuk data_sipp; acuan turunan)
--   sumber                   sipp | ecourt | isian | turunan | sistem | tanpa
--   sumber_rinci             kolom SIPP yang dibaca / tabel yang disentuh kueri
--   tabel_sipp               daftar tabel SIPP dipisah koma
--   arti                     arti singkat, dapat disunting Super Admin
--   blangko_pakai            JSON: contoh nama berkas blangko yang memakainya
--   jumlah_blangko           berapa blangko memakainya (pindaian RTF)
--   status                   otomatis | manual | rawan-petik | tanpa-sumber
--   cermin_sipp              kunci data inti SIPP yang dicerminkan (nama pihak,
--                            nomor perkara, majelis/PP/JS, tanggal, kuasa, biaya)
--   disunting_oleh/_at       terisi = arti/sumber/cermin dipegang Super Admin;
--                            urai ulang TIDAK menimpanya
--
-- Tanpa CHECK: nilai yang sah dijaga modulnya (src/lib/kamus-sumber-abt.ts),
-- dan ALTER ... ADD COLUMN dengan CHECK tidak berjalan sama di pg-mem.
--
-- Akses HANYA lewat src/server/modules/aleta-ecourt/kamus-sumber.ts (urai,
-- sunting, nilai SIPP untuk pengingat) dan kamus-variabel.ts (salin).
--
-- NOMOR: 0059 diklaim 10 Okt 2026 (assert di D:/aleta-dev/kerja/kamus-variabel/
-- klaim-0059.cjs). 0057 milik Agen ALETA tahap 1 belum di-commit, jadi 0058 ada
-- di idx 57 dan 0059 di idx 58; ketika 0057 masuk, keduanya bergeser satu.
--
-- TIGA TEMPAT PENDAFTARAN, semuanya wajib (yang terlewat gagal diam-diam):
--   (a) berkas ini dan entrinya di meta/_journal.json;
--   (b) DDL yang sama di src/server/db/schema.ts (DDL_KAMUS_SUMBER);
--   (c) tabelnya sudah di IN_MEMORY_TABLE_PERSISTENCE_ORDER sejak 0033.
-- Kesamaan (a) dan (b) dijaga src/test/kamus-variabel-cek-cetak.test.ts.
-- =============================================================================

ALTER TABLE aleta_kamus_variabel ADD COLUMN IF NOT EXISTS urutan_data TEXT NOT NULL DEFAULT '';

ALTER TABLE aleta_kamus_variabel ADD COLUMN IF NOT EXISTS referensi TEXT NOT NULL DEFAULT '';

ALTER TABLE aleta_kamus_variabel ADD COLUMN IF NOT EXISTS sumber TEXT NOT NULL DEFAULT '';

ALTER TABLE aleta_kamus_variabel ADD COLUMN IF NOT EXISTS sumber_rinci TEXT NOT NULL DEFAULT '';

ALTER TABLE aleta_kamus_variabel ADD COLUMN IF NOT EXISTS tabel_sipp TEXT NOT NULL DEFAULT '';

ALTER TABLE aleta_kamus_variabel ADD COLUMN IF NOT EXISTS arti TEXT NOT NULL DEFAULT '';

ALTER TABLE aleta_kamus_variabel ADD COLUMN IF NOT EXISTS blangko_pakai TEXT NOT NULL DEFAULT '[]';

ALTER TABLE aleta_kamus_variabel ADD COLUMN IF NOT EXISTS jumlah_blangko INTEGER NOT NULL DEFAULT 0;

ALTER TABLE aleta_kamus_variabel ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT '';

ALTER TABLE aleta_kamus_variabel ADD COLUMN IF NOT EXISTS cermin_sipp TEXT NOT NULL DEFAULT '';

ALTER TABLE aleta_kamus_variabel ADD COLUMN IF NOT EXISTS disunting_oleh TEXT NOT NULL DEFAULT '';

ALTER TABLE aleta_kamus_variabel ADD COLUMN IF NOT EXISTS disunting_at TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_kamus_variabel_cermin ON aleta_kamus_variabel(cermin_sipp);

CREATE INDEX IF NOT EXISTS idx_kamus_variabel_status ON aleta_kamus_variabel(status);
