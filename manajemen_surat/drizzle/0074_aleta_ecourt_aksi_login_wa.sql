-- =============================================================================
-- JEJAK AKSI e-COURT: NILAI BARU "login_wa" (login e-Court lewat WhatsApp)
-- =============================================================================
--
-- 18 Oktober 2026 (keputusan pengguna butir 4): riwayat login e-Court lewat
-- WhatsApp (jawaban captcha ke bot) tampil di riwayat e-Court portal, HANYA untuk
-- Super Admin dan Admin. Sumbernya jejak keamanan bot (aleta_bot_system_logs,
-- event ecourt_login_* berjalur whatsapp dan ecourt_wa_captcha_*), disinkronkan
-- idempoten ke tabel 0055 ini (id tetap "eaj-wa-<id peristiwa bot>", pengguna_id
-- "whatsapp"). Yang berubah hanya daftar nilai CHECK kolom aksi.
--
-- Constraint kolom dari 0055 bernama otomatis aleta_ecourt_aksi_jejak_aksi_check
-- (Postgres: <tabel>_<kolom>_check). Dilepas lalu dipasang lagi dengan daftar baru;
-- baris lama tidak disentuh.
--
-- TIGA TEMPAT PENDAFTARAN (sama dengan 0055):
--   (a) berkas ini dan entrinya di meta/_journal.json (idx 69);
--   (b) daftar nilai yang sama di DDL_ECOURT_AKSI_JEJAK (src/server/db/schema.ts) -
--       basis data BARU langsung memakai daftar baru;
--   (c) tabelnya sudah ada di IN_MEMORY_TABLE_PERSISTENCE_ORDER (client.ts, dari 0055).
-- Dijaga src/test/ecourt-aksi-1okt.test.ts dan src/test/riwayat-login-wa-18okt.test.ts.
-- =============================================================================

ALTER TABLE aleta_ecourt_aksi_jejak DROP CONSTRAINT IF EXISTS aleta_ecourt_aksi_jejak_aksi_check;

ALTER TABLE aleta_ecourt_aksi_jejak ADD CONSTRAINT aleta_ecourt_aksi_jejak_aksi_check CHECK (aksi IN ('sambung', 'putus', 'periksa', 'unduh', 'verifikasi', 'verifikasi_kering', 'tte', 'unggah_salinan', 'login_wa'));
