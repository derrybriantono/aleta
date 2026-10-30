-- PULIH abt-bukti-nomor-30okt: variabel baru dihapus HANYA bila isinya masih persis paket (yang disunting dibiarkan dan dihitung).
START TRANSACTION;
DELETE FROM abt_variabel WHERE no_var IN (11170,11171,11172,11173,11174,11175,11176,11177) AND data_type = 'data_sql' AND modifier = 'admin' AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('181fb61f5b89330a46c54247a5ce6be1','8bec9cf9c0552cf7f2e2792f73955862','36fb5b6f1dc12109ed9bd974a049f857','14be31d27cd54c491738b044bae235c7','53f114176c81d79adb5178509b89cee5','2236d2efaf504940ab4c00f2dc4dbd61','d98c792af9eb4ffffb8dab75accf4ab4','3e7df3d98eb178deaa5d468dc49cbd22');
SELECT CONCAT('VARIABEL DIHAPUS ', ROW_COUNT());
COMMIT;
SELECT CONCAT('VARIABEL TERSISA ', COUNT(*)) FROM abt_variabel WHERE no_var IN (11170,11171,11172,11173,11174,11175,11176,11177);
