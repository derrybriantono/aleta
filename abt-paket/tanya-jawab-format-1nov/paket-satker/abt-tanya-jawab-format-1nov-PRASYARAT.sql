-- Paket ABT "abt-tanya-jawab-format-1nov" (1 Nov 2026, agen M; keputusan pengguna 86): #5404# MAJELIS HAKIM DAN PANITERA SIDANG diganti kueri baru: membandingkan susunan hakim/panitera SIDANG INI dengan SIDANG SEBELUMNYA dari SIPP dan menyusun kalimat pergantian lengkap. Satu variabel; tanpa variabel/menu baru. Hanya pengguna derry_briantono.
-- PRASYARAT (baca saja) "A|B|C": A = #5404# masih PERSIS keadaan dasar (1 pertama, 0 ulang) | B = #5404# sudah persis isi baru (0 pertama, 1 ulang) | C = variabel yang dirujuk kueri (#0033# tanggal sidang, #6091# tanggal sidang sebelumnya, #6034# sebutan panitera) ada (3).
SELECT CONCAT_WS('|',
  (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 5404 AND MD5(IFNULL(sql_query, '')) = 'd38749332fcb853c4f8bb295fb36ff8b' AND MD5(nama) = '03de4212ee1b3c65669aa59c8a95d6b6'),
  (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 5404 AND MD5(IFNULL(sql_query, '')) = 'f919277e90e2d570161fd86fd4363657' AND MD5(nama) = '03de4212ee1b3c65669aa59c8a95d6b6'),
  (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN ('0033', '6034', '6091'))) AS p;
