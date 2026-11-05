-- Paket ABT "abt-prodeo-8507-5nov" (5 Nov 2026): variabel 8507 DUDUK PERKARA PRODEO, nilai prodeo diakhiri kata kendali netral. Nilai non-prodeo tetap kosong.
-- PRASYARAT "A|B": A = rumus 8507 persis rumus lama (1) | B = rumus 8507 persis rumus paket (1). Pasang pertama 1|0, pasang ulang 0|1; selain itu rumus server berbeda: BERHENTI.
SELECT CONCAT_WS('|', (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 8507 AND MD5(sql_query) = '0a3a264a0310d50d6d71bc6b5fc66c80'), (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 8507 AND MD5(sql_query) = '95a6487094847e1861016883387b7498')) AS p;
