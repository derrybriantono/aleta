-- PRASYARAT abt-bukti-8529-31okt (BACA SAJA). Satu baris A|B:
--  A = 8529 PERSIS sebelum paket ini (= sesudah seluruh rantai URUTAN-PASANG-31okt): 1 sebelum, 0 sesudah
--  B = 8529 PERSIS hasil paket ini: 0 sebelum, 1 sesudah
-- Pasang bila 1|0; pasang ulang bila 0|1; selain itu (rantai belum lengkap / 8529 disunting) berhenti tanpa mengubah apa pun.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (8529) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('555c3cb9dc004f38b666b6584ae8a140')),
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (8529) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('53198b3e0a7aec310f436bf852f2c047'))
) AS prasyarat;
