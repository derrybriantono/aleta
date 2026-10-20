-- abt-u2b-cerai-susulan (prasyarat, HANYA SELECT): harus menjawab 35|1|1.
-- 35 = variabel 4100-4150 hasil paket u2 ada (bukan ditambah/diubah paket ini); 1 = variabel 4138 (amar akibat perceraian) berjenis data_sql; 1 = variabel 8505 (amar biaya perkara) ada.
SELECT CONCAT(
  (SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4100 AND 4150), '|',
  (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4138 AND data_type = 'data_sql'), '|',
  (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 8505)) AS prasyarat;
