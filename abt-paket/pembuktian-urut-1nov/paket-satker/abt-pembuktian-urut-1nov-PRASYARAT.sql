-- PRASYARAT abt-pembuktian-urut-1nov (BACA SAJA). Satu baris A|B:
--  A = variabel 2111,7119,2112,7121 yang isinya PERSIS hasil paket tanggal-agenda-31okt (4 sebelum, 0 sesudah)
--  B = variabel yang sama yang isinya PERSIS hasil paket ini (0 sebelum, 4 sesudah)
-- Pasang bila 4|0; pasang ulang bila 0|4; selain itu berhenti tanpa mengubah apa pun.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (2111,7119,2112,7121) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('d5e7da09924ad1dca1d1ec1da6ffecaf','194ecb54d1e0e51e9ad01fb98a1b2b1a','5ddc77c251033ae93e637cedf897919d','5aa4c9f937d2d9a6176736260319165b')),
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (2111,7119,2112,7121) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('ea1a6f017492be339d9d4b8a3278e03f','0c815b2c17526e849a5bd39eb2d04938','417bc583ed9d4d91306176483ce6af5c','b7775bd84b3b028e6157fdfed46a016c'))
) AS prasyarat;
