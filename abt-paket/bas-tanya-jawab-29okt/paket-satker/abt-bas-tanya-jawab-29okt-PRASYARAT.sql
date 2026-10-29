-- PRASYARAT paket abt-bas-tanya-jawab-29okt (BACA SAJA). Satu baris A|B|C|D|E:
--  A = variabel yang DIRUJUK blangko hasil tambal dan ada di abt_variabel (harus 17):
--      tanya-jawab saksi BAS 5058 5059 5060 6120 6121 | keterangan saksi putusan 9259 9260 9264 9265 |
--      agama saksi 1199 1205 6102 6108 | lafal sumpah 7029 7030 7031 7032
--  B = dari 5058 5059 5060 6120 6121: berjenis tanya_jawab bermodus 'tanyajawab' dengan referensi nama saksi 1197 1203 6132 6100 6106 (harus 5)
--  C = dari 9259 9260 9264 9265: data_sql yang memanggil isian_rtf_ket_saksi (harus 4)
--  D = fungsi isian_rtf_ket_saksi ada (harus 1)
--  E = fungsi isian_rtf_ket_saksi sudah memakai penyaring penutup paket x6 (1 = ya; 0 = belum - info, tidak menghentikan)
-- Paket ini TIDAK mengubah satu baris pun di basis data; yang diubah hanya berkas RTF blangko derry_briantono.
SELECT CONCAT(
  (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (5058,5059,5060,6120,6121,9259,9260,9264,9265,1199,1205,6102,6108,7029,7030,7031,7032)), '|',
  (SELECT COUNT(*) FROM abt_variabel WHERE data_type = 'tanya_jawab' AND multi_sidang = 'tanyajawab'
     AND ((no_var = 5058 AND referensi = 1197) OR (no_var = 5059 AND referensi = 1203) OR (no_var = 5060 AND referensi = 6132) OR (no_var = 6120 AND referensi = 6100) OR (no_var = 6121 AND referensi = 6106))), '|',
  (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (9259,9260,9264,9265) AND data_type = 'data_sql' AND sql_query LIKE '%isian_rtf_ket_saksi%'), '|',
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type = 'FUNCTION' AND routine_name = 'isian_rtf_ket_saksi'), '|',
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type = 'FUNCTION' AND routine_name = 'isian_rtf_ket_saksi' AND routine_definition LIKE '%isian_rtf_saring_penutup%')
);
