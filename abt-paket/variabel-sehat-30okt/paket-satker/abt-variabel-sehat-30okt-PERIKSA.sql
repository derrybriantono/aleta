-- PERIKSA abt-variabel-sehat-30okt (BACA SAJA). Baris terakhir harus "SEMUA COCOK".
SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (4303,9292,9293) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('a292d5ccec844e3afb691231ec58956a','72673433f4f952badafa8f400ab6e9f6','269c70ab10ef61ae6e1dc025055a4d88')) = 3
  AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4303 AND LOCATE('pada #5197#', sql_query) > 0) = 0
  AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (9292, 9293) AND LOCATE('''domisili el''', sql_query) > 0) = 2,
  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;
