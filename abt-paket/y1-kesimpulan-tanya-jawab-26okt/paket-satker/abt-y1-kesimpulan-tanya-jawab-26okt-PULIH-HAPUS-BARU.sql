-- PEMULIHAN paket y1-kesimpulan-tanya-jawab-26okt: hapus variabel baru 4950-4959 (isian petugas pada variabel ini ikut hilang; paket belum dipakai blangko mana pun).
DELETE FROM abt_variabel WHERE no_var BETWEEN 4950 AND 4959;
SELECT COUNT(*) AS sisa_baris_baru FROM abt_variabel WHERE no_var BETWEEN 4950 AND 4959;
