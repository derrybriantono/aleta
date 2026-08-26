-- =============================================================================
-- ALETA — Tahap 1: penyelarasan NAMA/DESKRIPSI notifikasi & sumber data lama.
--
-- Konteks: seeding aplikasi memakai "ON CONFLICT (id) DO NOTHING", sehingga
-- record BARU (H-1 pihak, sidang hari ini hakim/panitera, tundaan jurusita)
-- otomatis masuk saat portal restart, TAPI record LAMA tidak ikut berubah nama.
-- File ini hanya memperbarui label agar tidak membingungkan operator.
--
-- Tidak mengubah query, jadwal, penerima, atau status aktif notifikasi apa pun.
--
-- Jalankan di database PORTAL (PostgreSQL), bukan SIPP:
--   docker compose exec -T postgres psql -U aleta -d aleta \
--     < deploy/sql/phase1-rename-notifikasi-standar.sql
-- =============================================================================

BEGIN;

-- Sumber data: perjelas bahwa yang lama adalah H-3.
UPDATE aleta_bot_queries
SET name = 'Pihak Perkara - Pengingat Sidang H-3',
    description = 'Pengingat 3 hari sebelum sidang (H-3) untuk pihak perkara. SQL legacy memakai DATE_ADD(CURDATE(), INTERVAL 3 DAY).'
WHERE id = 'legacy-pihak-sebelum-sidang';

-- Notifikasi pihak: bedakan H-3 dari H-1 yang baru.
UPDATE aleta_bot_notifications
SET name = 'Pihak - Pengingat Sidang H-3',
    description = 'Pengingat kepada pihak perkara 3 hari sebelum jadwal sidang.'
WHERE id = 'pihak-sebelum-sidang';

-- Notifikasi pegawai lama = monitoring status, BUKAN daftar sidang hari ini.
UPDATE aleta_bot_notifications
SET name = 'Hakim - Monitoring Minutasi dan Upload Putusan',
    description = 'Status minutasi, upload putusan, dan antrian sidang untuk Hakim (bukan daftar sidang hari ini).'
WHERE id = 'hakim-jadwal-sidang';

UPDATE aleta_bot_notifications
SET name = 'Panitera - Monitoring BAS dan Minutasi',
    description = 'Status BAS, minutasi, dan tunda mediasi untuk Panitera/Panitera Pengganti (bukan daftar sidang hari ini).'
WHERE id = 'panitera-jadwal-sidang';

COMMIT;

-- Verifikasi hasil:
--   SELECT id, name FROM aleta_bot_notifications ORDER BY category, name;
--   SELECT id, name FROM aleta_bot_queries       ORDER BY category, name;
