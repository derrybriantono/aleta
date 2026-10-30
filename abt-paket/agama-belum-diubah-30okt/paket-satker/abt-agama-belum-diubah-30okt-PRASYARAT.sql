-- PRASYARAT abt-agama-belum-diubah-30okt (BACA SAJA). Satu baris A|B:
--  A = variabel 8521, 8522, 8528, 8531 yang isinya PERSIS sebelum paket ini (= sesudah paket alasan-belum-dipilih-30okt): 4 sebelum, 0 sesudah
--  B = variabel yang sama yang isinya PERSIS hasil paket ini: 0 sebelum, 4 sesudah
-- Pasang bila 4|0; pasang ulang bila 0|4; selain itu (mis. paket alasan-belum-dipilih-30okt belum dipasang) berhenti tanpa mengubah apa pun.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (8521,8522,8528,8531) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('4ce9df877cf443006e5a7f06796850b7','701a846f237898ea9bf709622066efa0','97aed24a20a6a2948808b755e5d38756','f6a1c35d4c429736e71537cab96cb913')),
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (8521,8522,8528,8531) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('0b0a5f0ea5704c9b9496612708e18a71','3f03d33e8d5dee4c8ef1e3d3d4e6ad94','abd65b1466bb8469fffcfc8128774315','b036f24f7ad5bfc16b7a7aa120989a88'))
) AS prasyarat;
