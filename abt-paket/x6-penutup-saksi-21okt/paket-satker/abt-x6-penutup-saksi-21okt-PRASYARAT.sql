-- Paket ABT "abt-x6-penutup-saksi-21okt" (21 Okt 2026): PRASYARAT (baca saja). Satu baris: A|B|C|D|E|F
--  A = fungsi isian_rtf_ket_saksi (1)
--  B = fungsi baru isian_rtf_penutup + isian_rtf_saring_penutup (0 sebelum, 2 sesudah)
--  C = isian_rtf_ket_saksi masih TEPAT versi lama (md5 definisi, nama basis disamakan) (1 sebelum, 0 sesudah)
--  D = isian_rtf_ket_saksi sudah memanggil isian_rtf_saring_penutup (0 sebelum, 1 sesudah)
--  E = variabel abt_variabel yang memanggil isian_rtf_ket_saksi (info; 7 di server 21 Okt: 9259-9265)
--  F = fungsi isian_rtf_* seluruhnya (info; 20 sebelum, 22 sesudah)
-- Syarat pasang: A|B|C|D = 1|0|1|0; pasang ulang: 1|2|0|1. Selain itu berhenti, tidak ada yang diubah.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name IN ('isian_rtf_penutup','isian_rtf_saring_penutup')),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'
    AND LOCATE('isian_rtf_saring_penutup', routine_definition) = 0
    AND MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) = 'f984ebccf51a11d4f3779cc9092fd491'),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'
    AND LOCATE('isian_rtf_saring_penutup', routine_definition) > 0),
 (SELECT COUNT(*) FROM abt_variabel WHERE LOCATE('isian_rtf_ket_saksi', IFNULL(sql_query, '')) > 0),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name LIKE 'isian\_rtf\_%')
) AS prasyarat;
