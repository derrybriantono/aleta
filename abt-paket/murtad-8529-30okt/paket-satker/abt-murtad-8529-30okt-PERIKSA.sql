-- PERIKSA abt-murtad-8529-30okt (BACA SAJA). Baris terakhir harus "SEMUA COCOK".
SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var = 8529 AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) = '1fdfa80464db4e96ceb58b8c60b14542') = 1, 'SEMUA COCOK', 'TIDAK COCOK') AS periksa;
