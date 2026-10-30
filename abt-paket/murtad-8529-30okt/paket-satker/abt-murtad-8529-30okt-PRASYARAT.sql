-- PRASYARAT abt-murtad-8529-30okt (BACA SAJA). Satu baris A|B: A = 8529 PERSIS sebelum paket (sesudah alasan-belum-dipilih-30okt), B = PERSIS hasil paket.
-- Pasang bila 1|0; pasang ulang bila 0|1; selain itu berhenti tanpa mengubah apa pun.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 8529 AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) = '7d03edaa4ddf9c305703328b8e04135b'),
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 8529 AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) = '1fdfa80464db4e96ceb58b8c60b14542')
) AS prasyarat;
