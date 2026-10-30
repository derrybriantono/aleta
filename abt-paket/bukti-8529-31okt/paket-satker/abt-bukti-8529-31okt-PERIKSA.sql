-- PERIKSA abt-bukti-8529-31okt (BACA SAJA). Baris terakhir harus "SEMUA COCOK".
SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (8529) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('53198b3e0a7aec310f436bf852f2c047')) = 1
  AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (8529) AND LOCATE('[HURUF ALASAN PERCERAIAN BELUM DIPILIH]', sql_query) > 0) = 0
  AND (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (8529) AND LOCATE('<mark>[BUKTI SURAT KTP/SURAT DOMISILI BELUM ADA DI DAFTAR BUKTI]</mark>', sql_query) > 0) = 1,
  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;
