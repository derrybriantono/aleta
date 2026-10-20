-- PEMULIHAN paket w2a-kebendaan: hapus variabel baru 4780-4849 (isian petugas pada variabel ini ikut terhapus).
DELETE FROM abt_variabel WHERE no_var BETWEEN 4780 AND 4849;
SELECT COUNT(*) AS sisa_baris_baru FROM abt_variabel WHERE no_var BETWEEN 4780 AND 4849;
