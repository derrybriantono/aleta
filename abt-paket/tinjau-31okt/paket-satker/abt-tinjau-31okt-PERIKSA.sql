-- Paket ABT "abt-tinjau-31okt" (31 Okt 2026): jawaban pengguna G6 (banding UU 20/1947, 288 = 1875 KUHPerdata, 718 = 390 HIR, 144 (1) = 120 HIR, tenggang verzet ayat (2), RBg baku, butir "-"). Hanya derry_briantono.
SELECT label, ok FROM (
SELECT 'var 11896' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11896 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, ''))) = 'ae1de44ff962d00feb6ab0305c0b299b') AS ok
UNION ALL SELECT 'var 11897' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11897 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, ''))) = '5e93551746a4095c7f0fdd07618b42b6') AS ok
UNION ALL SELECT 'var 11898' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11898 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, ''))) = '51f48b6a4d512fb8231de3b9b151d0f5') AS ok
UNION ALL SELECT 'var 11899' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11899 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, ''))) = '1d7b02fed8c0e6e883a64d8481dac2bc') AS ok
UNION ALL SELECT 'ubah 4303' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4303 AND MD5(IFNULL(sql_query, '')) = '3c939838de25bc5a0a1430a1cd56097d') AS ok
UNION ALL SELECT 'ubah 4308' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4308 AND MD5(IFNULL(sql_query, '')) = '57487f59a85e53bfe4e32dfde8a89908') AS ok
UNION ALL SELECT 'ubah 4807' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4807 AND MD5(IFNULL(sql_query, '')) = '4870d7c29c9c357d41817894042253b2') AS ok
UNION ALL SELECT 'ubah 4808' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4808 AND MD5(IFNULL(sql_query, '')) = '24469349329d87b9dbd3de23a8300eac') AS ok
UNION ALL SELECT 'ubah 4829' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4829 AND MD5(IFNULL(sql_query, '')) = '138d1577e5de15239478d39fc151ce72') AS ok
UNION ALL SELECT 'ubah 4830' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4830 AND MD5(IFNULL(sql_query, '')) = 'a7a278176b606b6cf641805458947b82') AS ok
UNION ALL SELECT 'ubah 4833' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4833 AND MD5(IFNULL(sql_query, '')) = '16ff5a1ffc8c2a80f6a83e999c881fd0') AS ok
UNION ALL SELECT 'ubah 4834' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4834 AND MD5(IFNULL(sql_query, '')) = '4f1baee20b8a5aec8c98f1143a09239e') AS ok
UNION ALL SELECT 'ubah 4864' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4864 AND MD5(IFNULL(sql_query, '')) = 'ed556c5431ecffc947ae94848ddcea03') AS ok
UNION ALL SELECT 'ubah 7006' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 7006 AND MD5(IFNULL(sql_query, '')) = '6f11dea89df14e41dcafefeb9d434b0c') AS ok
UNION ALL SELECT 'ubah 7008' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 7008 AND MD5(IFNULL(sql_query, '')) = '6ef9cf7e616743a46a2c67eb3a09c3a0') AS ok
UNION ALL SELECT 'ubah 7169' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 7169 AND MD5(IFNULL(sql_query, '')) = '3601e8739c0691a86d77956821fb9d95') AS ok
UNION ALL SELECT 'ubah 11208' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11208 AND MD5(IFNULL(sql_query, '')) = '4ca63a9ad7dd1d4c2c89306cc707a840') AS ok
UNION ALL SELECT 'ubah 11217' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11217 AND MD5(IFNULL(sql_query, '')) = 'd3dc1d84875eec68c560efec3e51d1e2') AS ok
UNION ALL SELECT 'ubah 11218' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11218 AND MD5(IFNULL(sql_query, '')) = '311f369b85b64cb1d1f4610aae5363bc') AS ok
) x WHERE ok <> 1
UNION ALL SELECT IF((SELECT COUNT(*) FROM (SELECT 'var 11896' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11896 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, ''))) = 'ae1de44ff962d00feb6ab0305c0b299b') AS ok
UNION ALL SELECT 'var 11897' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11897 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, ''))) = '5e93551746a4095c7f0fdd07618b42b6') AS ok
UNION ALL SELECT 'var 11898' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11898 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, ''))) = '51f48b6a4d512fb8231de3b9b151d0f5') AS ok
UNION ALL SELECT 'var 11899' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11899 AND MD5(CONCAT_WS('|', nama, data_type, IFNULL(sql_query, ''), IFNULL(referensi, ''), IFNULL(multi_sidang, ''), locked, IFNULL(modifier, ''))) = '1d7b02fed8c0e6e883a64d8481dac2bc') AS ok
UNION ALL SELECT 'ubah 4303' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4303 AND MD5(IFNULL(sql_query, '')) = '3c939838de25bc5a0a1430a1cd56097d') AS ok
UNION ALL SELECT 'ubah 4308' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4308 AND MD5(IFNULL(sql_query, '')) = '57487f59a85e53bfe4e32dfde8a89908') AS ok
UNION ALL SELECT 'ubah 4807' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4807 AND MD5(IFNULL(sql_query, '')) = '4870d7c29c9c357d41817894042253b2') AS ok
UNION ALL SELECT 'ubah 4808' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4808 AND MD5(IFNULL(sql_query, '')) = '24469349329d87b9dbd3de23a8300eac') AS ok
UNION ALL SELECT 'ubah 4829' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4829 AND MD5(IFNULL(sql_query, '')) = '138d1577e5de15239478d39fc151ce72') AS ok
UNION ALL SELECT 'ubah 4830' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4830 AND MD5(IFNULL(sql_query, '')) = 'a7a278176b606b6cf641805458947b82') AS ok
UNION ALL SELECT 'ubah 4833' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4833 AND MD5(IFNULL(sql_query, '')) = '16ff5a1ffc8c2a80f6a83e999c881fd0') AS ok
UNION ALL SELECT 'ubah 4834' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4834 AND MD5(IFNULL(sql_query, '')) = '4f1baee20b8a5aec8c98f1143a09239e') AS ok
UNION ALL SELECT 'ubah 4864' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4864 AND MD5(IFNULL(sql_query, '')) = 'ed556c5431ecffc947ae94848ddcea03') AS ok
UNION ALL SELECT 'ubah 7006' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 7006 AND MD5(IFNULL(sql_query, '')) = '6f11dea89df14e41dcafefeb9d434b0c') AS ok
UNION ALL SELECT 'ubah 7008' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 7008 AND MD5(IFNULL(sql_query, '')) = '6ef9cf7e616743a46a2c67eb3a09c3a0') AS ok
UNION ALL SELECT 'ubah 7169' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 7169 AND MD5(IFNULL(sql_query, '')) = '3601e8739c0691a86d77956821fb9d95') AS ok
UNION ALL SELECT 'ubah 11208' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11208 AND MD5(IFNULL(sql_query, '')) = '4ca63a9ad7dd1d4c2c89306cc707a840') AS ok
UNION ALL SELECT 'ubah 11217' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11217 AND MD5(IFNULL(sql_query, '')) = 'd3dc1d84875eec68c560efec3e51d1e2') AS ok
UNION ALL SELECT 'ubah 11218' AS label, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 11218 AND MD5(IFNULL(sql_query, '')) = '311f369b85b64cb1d1f4610aae5363bc') AS ok) y WHERE y.ok <> 1) = 0, 'SEMUA COCOK', 'ADA BEDA'), '';
