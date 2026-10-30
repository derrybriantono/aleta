-- PRASYARAT abt-bukti-nomor-30okt (BACA SAJA). Satu baris A|B|C|D|E:
--  A = isian sumber (data_teks) ada: 9955,9911,1214,9958,9956,8131,8132,378 (harus 8)
--  B = nomor variabel baru 11170,11171,11172,11173,11174,11175,11176,11177 yang SUDAH dipakai (0 sebelum; 8 sesudah - milik paket ini, lihat C)
--  C = variabel baru yang isinya persis paket ini (0 sebelum, 8 sesudah)
--  D = fungsi isian_rtf_bukti ada (0 sebelum, 1 sesudah)
--  E = baris abt_variabel seluruhnya (info)
-- Pasang bila 8|0|0|0|*; pasang ulang bila 8|8|8|1|*. Selain itu berhenti tanpa mengubah apa pun.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (9955,9911,1214,9958,9956,8131,8132,378) AND data_type = 'data_teks'),
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (11170,11171,11172,11173,11174,11175,11176,11177)),
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (11170,11171,11172,11173,11174,11175,11176,11177) AND data_type = 'data_sql' AND modifier = 'admin' AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('181fb61f5b89330a46c54247a5ce6be1','8bec9cf9c0552cf7f2e2792f73955862','36fb5b6f1dc12109ed9bd974a049f857','14be31d27cd54c491738b044bae235c7','53f114176c81d79adb5178509b89cee5','2236d2efaf504940ab4c00f2dc4dbd61','d98c792af9eb4ffffb8dab75accf4ab4','3e7df3d98eb178deaa5d468dc49cbd22')),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type = 'FUNCTION' AND routine_name = 'isian_rtf_bukti'),
 (SELECT COUNT(*) FROM abt_variabel)
) AS prasyarat;
