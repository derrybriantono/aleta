-- PRASYARAT abt-perbaikan-1nov (BACA SAJA). Satu baris A|B:
--  A = variabel 2111,7119,2112,7121 yang isinya PERSIS keadaan sesudah 29 paket (hasil pembuktian-urut-1nov): 4 sebelum, 0 sesudah
--  B = variabel yang sama yang isinya PERSIS hasil paket ini: 0 sebelum, 4 sesudah
-- Pasang bila 4|0; pasang ulang bila 0|4; selain itu berhenti tanpa mengubah apa pun.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (2111,7119,2112,7121) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('ea1a6f017492be339d9d4b8a3278e03f','0c815b2c17526e849a5bd39eb2d04938','417bc583ed9d4d91306176483ce6af5c','b7775bd84b3b028e6157fdfed46a016c')),
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (2111,7119,2112,7121) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('73ee6ce8299549edf9dbcadd2fd2a7ad','00eeb902cc8b3575d924304db49c2c45','18d43f9ed471e538d0fbfe6d3a61e2b6','5742d960c7490d976881a33ebd9a501d'))
) AS prasyarat;
