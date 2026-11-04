-- Paket ABT "abt-keputusan-a-kerangka-4nov" (4 Nov 2026): kerangka berisian + variabel baru (keputusan Derry 182/184). Hanya derry_briantono.
START TRANSACTION;
DELETE v FROM abt_variabel v WHERE v.no_var = 9266 AND MD5(CONCAT_WS('|', v.nama, v.data_type, REPLACE(IFNULL(v.sql_query, ''), CONCAT(DATABASE(), '.'), 'aps_badilag.'), IFNULL(v.referensi, ''), IFNULL(v.multi_sidang, ''), v.locked, IFNULL(v.modifier, ''))) = 'cdb271d6852c9cdc83f51454862c7652';
DELETE v FROM abt_variabel v WHERE v.no_var = 9267 AND MD5(CONCAT_WS('|', v.nama, v.data_type, REPLACE(IFNULL(v.sql_query, ''), CONCAT(DATABASE(), '.'), 'aps_badilag.'), IFNULL(v.referensi, ''), IFNULL(v.multi_sidang, ''), v.locked, IFNULL(v.modifier, ''))) = '6abb9f9c6efe62d469a428a099d48fe0';
DELETE v FROM abt_variabel v WHERE v.no_var = 9268 AND MD5(CONCAT_WS('|', v.nama, v.data_type, REPLACE(IFNULL(v.sql_query, ''), CONCAT(DATABASE(), '.'), 'aps_badilag.'), IFNULL(v.referensi, ''), IFNULL(v.multi_sidang, ''), v.locked, IFNULL(v.modifier, ''))) = 'be716591b6a903a93028bb123563275b';
DELETE v FROM abt_variabel v WHERE v.no_var = 9269 AND MD5(CONCAT_WS('|', v.nama, v.data_type, REPLACE(IFNULL(v.sql_query, ''), CONCAT(DATABASE(), '.'), 'aps_badilag.'), IFNULL(v.referensi, ''), IFNULL(v.multi_sidang, ''), v.locked, IFNULL(v.modifier, ''))) = '455d4eb01693fe52665111f213909f98';
COMMIT;
