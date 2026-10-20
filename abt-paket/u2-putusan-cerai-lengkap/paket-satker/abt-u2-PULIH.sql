-- PEMULIHAN paket U2: hapus variabel baru 4100-4150. Variabel lama tidak diubah oleh paket ini.
-- CATATAN: menghapus variabel ikut menghapus isian petugasnya di abt_data_teks (FK ON DELETE CASCADE): isian 4100-4109.
DELETE FROM abt_variabel WHERE no_var BETWEEN 4100 AND 4299;
SELECT COUNT(*) AS sisa_baris_baru FROM abt_variabel WHERE no_var BETWEEN 4100 AND 4299;
