-- =============================================================================
-- REKAM ANTRIAN - PRESISI DETIK DAN TIGA JARAK WAKTU
-- =============================================================================
--
-- Diminta pengguna 27 September 2026: jarak antara perkara sebelumnya, yang
-- sedang berjalan, dan yang berikutnya "masih bingung dalam menghitungnya".
-- Yang diminta sebagai gantinya TIGA jarak yang masing-masing menjawab satu
-- pertanyaan:
--
--   menunggu_detik       sejak pihak mengambil nomor antrian sampai
--                        perkaranya dipanggil masuk
--   jarak_sebelum_detik  sejak perkara SEBELUMNYA di ruang yang sama
--                        dipanggil sampai perkara ini dipanggil
--   lama_sidang_detik    sejak perkara ini dipanggil sampai perkara
--                        BERIKUTNYA di ruang yang sama dipanggil
--
-- =============================================================================
-- KENAPA DETIK, PADAHAL KOLOM LAMA SUDAH MENYIMPAN MENIT
-- =============================================================================
--
-- Kolom lama (0048) menyimpan jam "HH:MM" dan jarak dalam menit. Dua sidang
-- yang dipanggil 09:22:59 dan 09:23:01 berjarak dua DETIK tetapi tercatat satu
-- MENIT; dua yang dipanggil 09:22:01 dan 09:22:59 berjarak hampir semenit
-- tetapi tercatat NOL - dan nol berarti "dipanggil bersamaan", keadaan yang
-- diwarnai merah. Aplikasi antrian sendiri menyimpan detiknya; membuangnya di
-- ALETA berarti membuang ketelitian yang sudah ada.
--
-- Kolom lama TETAP diisi, supaya pembaca lama tidak kehilangan apa pun.
--
-- =============================================================================
-- BASIS WAKTUNYA JAM APLIKASI ANTRIAN, BUKAN UTC
-- =============================================================================
--
-- waktu_ambil_lengkap, waktu_panggil_pertama, dan waktu_panggil_lengkap
-- berbentuk "YYYY-MM-DD HH:MM:SS" menurut jam dinding server antrian (NOW()
-- lokalnya, WITA) - SAMA dengan yang ditulis aplikasi antrian. BUKAN UTC seperti
-- kolom *_at ALETA lainnya. Ketiga jarak di atas dihitung dari waktu-waktu itu
-- dan TIDAK PERNAH dari pertama_direkam_at/direkam_at: mengurangkan dua basis
-- waktu menghasilkan selisih delapan jam tanpa satu pun galat.
--
-- =============================================================================
-- NULL BUKAN NOL
-- =============================================================================
--
-- Ketiga jarak boleh NULL, dan artinya "tidak ada" atau "belum diketahui":
-- perkara pertama di ruangnya tidak punya jarak sebelum; perkara yang masih
-- bersidang belum punya lama sidang; perkara terakhir pada hari yang sudah
-- lewat tidak pernah punya pembanding. Nol adalah keadaan yang sungguh terjadi
-- - dipanggil pada detik yang sama - dan tidak boleh menggantikan NULL.
--
-- Selisih NEGATIF (dipanggil sebelum mengambil nomor) juga disimpan NULL:
-- itu tanda datanya keliru, dan memaksanya menjadi nol menyembunyikannya.
--
-- Jalur idempoten yang sama ada di src/server/db/schema.ts (CREATE TABLE dan
-- ALTER pada migrationStatements) - pemasangan yang melewati berkas drizzle
-- tetap menerima kolomnya.
-- =============================================================================

ALTER TABLE aleta_rekam_antrian ADD COLUMN IF NOT EXISTS waktu_ambil_lengkap TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_rekam_antrian ADD COLUMN IF NOT EXISTS jam_jadwal TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_rekam_antrian ADD COLUMN IF NOT EXISTS waktu_panggil_pertama TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_rekam_antrian ADD COLUMN IF NOT EXISTS waktu_panggil_lengkap TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_rekam_antrian ADD COLUMN IF NOT EXISTS jumlah_panggil INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aleta_rekam_antrian ADD COLUMN IF NOT EXISTS menunggu_detik INTEGER;
ALTER TABLE aleta_rekam_antrian ADD COLUMN IF NOT EXISTS jarak_sebelum_detik INTEGER;
ALTER TABLE aleta_rekam_antrian ADD COLUMN IF NOT EXISTS lama_sidang_detik INTEGER;
