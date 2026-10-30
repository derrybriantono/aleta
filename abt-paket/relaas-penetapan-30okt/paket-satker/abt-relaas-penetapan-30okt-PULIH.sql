-- Paket ABT "abt-relaas-penetapan-30okt" (30 Okt 2026): relaas/pemberitahuan dan penetapan PTSP blangko Derry - koma tunggal, spasi, identitas, upaya hukum pemberitahuan putusan, tanggal relaas e-Court, PA tujuan delegasi, penetapan hari sidang.
-- PULIH: baris baru paket ini dihapus HANYA bila isinya masih persis isi paket (baris lain tidak disentuh).
START TRANSACTION;
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11200 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = '715bcc621768faf3aa733e2ddf6bdb94';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11201 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = 'e9e4bc4014c3eee53849241b91a4591b';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11202 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = 'ebd52d5b729c534a64063d6728f741ce';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11203 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = '45623fb156d860dab075323e2211a6c7';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11204 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = 'c3a21c1d68433ff59ae561c5b2412e99';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11205 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = '8ad7b769e3c00be2873bfe93e7057647';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11206 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = '439a69c4c58cb3647ec81774199d018d';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11207 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = 'e19377daca46f8d06aa3fc653fa46471';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11208 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = '828d478920e26ed32b80c466b89fc439';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11209 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = 'ae798ab94decb1fd6c8d820ba51de337';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11210 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = 'c16e7b9e46b121d5f4b28c8c2bef96f9';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11211 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = 'c08e4af2f0dffb04b6bb5e2d4929f383';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11212 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = '680f5dbc927ebfb38f8b3aee639b7767';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11213 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = '440ba4719bdd65b90a804ed942fbba39';
DELETE FROM aps_badilag.abt_variabel WHERE no_var = 11214 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), locked)) = '9a70427a3c38e6f9e65c6b11ef635710';
COMMIT;
