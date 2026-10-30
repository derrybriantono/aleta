-- PRASYARAT abt-identitas-kosong-31okt (BACA SAJA). Satu baris A|B|C:
--  A = variabel 3507,3509,3970,3971,7047,7048,7062,9230,9231,11205,11206 yang isinya PERSIS keadaan sebelum paket (11 sebelum, 0 sesudah)
--  B = variabel yang sama yang isinya PERSIS hasil paket (0 sebelum, 11 sesudah)
--  C = fungsi isian_rtf_identitas_kosong sudah ada (0 sebelum, 1 sesudah)
-- Pasang bila 11|0|0; pasang ulang bila 0|11|1; selain itu berhenti tanpa mengubah apa pun.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (3507,3509,3970,3971,7047,7048,7062,9230,9231,11205,11206) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('baf2d3e4bad5d739a2d206c1796649f4','1745cfe571ee689834470b37f65495f4','87c578dc618fee36d94603d1a6a3d689','0db23d493ee3f87d145ef86e1a908a7c','c8fdb0dade2c0d8c7549caeabca6c08b','634fce56fc630914fe9446a079c9fa3a','a42e2fe81e6e6d8be2bcddfb2686e316','9e6573cbdaa626962796658ac807d1f9','6187c62d2d64f3ea352e63ea0e03ff3d','5b0da348b590cb9a36391c9e3d5ffb56','6615ac4aa77f1b12ef057606c457587b')),
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (3507,3509,3970,3971,7047,7048,7062,9230,9231,11205,11206) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('b2c49821806976b8b577670c374c3034','010f3cb080c0a51d7cca23359502b68e','0b3270992f35b20a69c3b8aaaf00f5ed','3b9da06e2551cf1bdddf7230a2c92ddd','e301c4feae2efcb0794fdff285d8f155','f9552a7f198356fd6394e7c212bdfc37','5a0f3279bc836552bd0337463d59e5ee','dff863fbd41b56f29580f5ddee03a971','57cc0d9e95e7bf2f6a1c2c829089f0af','fffb733939324341021a36f281ef66d9','07245104946e48b1d09d96ed4fbc8f4e')),
 (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = 'isian_rtf_identitas_kosong')
) AS prasyarat;
