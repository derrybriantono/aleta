-- Paket ABT "abt-prodeo-8507-5nov" (5 Nov 2026): variabel 8507 DUDUK PERKARA PRODEO, nilai prodeo diakhiri kata kendali netral. Nilai non-prodeo tetap kosong.
SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var = 8507 AND MD5(sql_query) = '95a6487094847e1861016883387b7498') = 1, 'SEMUA COCOK', 'ADA BEDA') AS periksa;
