-- PEMULIHAN paket u5-ahli-waris: hapus variabel baru 4500-4599 (isian petugas pada variabel ini ikut terhapus bila ada kunci asing CASCADE).
DELETE FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599;
SELECT COUNT(*) AS sisa_baris_baru FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599;
