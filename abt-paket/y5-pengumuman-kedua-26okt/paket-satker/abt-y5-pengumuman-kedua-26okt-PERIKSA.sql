-- Periksa: keluaran terakhir harus "SEMUA COCOK" (isi baru persis; modifier tetap admin; baris lain tidak disentuh).
SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var = 7063 AND MD5(sql_query) = '3a7efb779860a3f8d3259c635c70f575' AND LENGTH(sql_query) = 3574 AND modifier = 'admin' AND data_type = 'data_sql') = 1, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil;
