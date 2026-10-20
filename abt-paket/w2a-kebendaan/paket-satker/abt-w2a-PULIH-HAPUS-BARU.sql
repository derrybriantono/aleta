-- PEMULIHAN paket w2a-kebendaan: hapus variabel baru 4750-4849 (isian petugas pada variabel ini ikut terhapus).
DELETE FROM abt_variabel WHERE no_var BETWEEN 4750 AND 4849;
SELECT COUNT(*) AS sisa_baris_baru FROM abt_variabel WHERE no_var BETWEEN 4750 AND 4849;
