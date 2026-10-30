-- PERIKSA abt-agama-belum-diubah-30okt (BACA SAJA). Baris terakhir harus "SEMUA COCOK".
SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (8521,8522,8528,8531) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('0b0a5f0ea5704c9b9496612708e18a71','3f03d33e8d5dee4c8ef1e3d3d4e6ad94','abd65b1466bb8469fffcfc8128774315','b036f24f7ad5bfc16b7a7aa120989a88')) = 4
  AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (8521,8522,8528,8531) AND LOCATE('ALASAN H: AGAMA', sql_query) > 0) = 0
  AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (8521,8522,8528,8531) AND LOCATE('<mark>[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]</mark>', sql_query) > 0) = 4,
  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;
