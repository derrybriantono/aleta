-- Paket ABT y1-kesimpulan-tanya-jawab-26okt (rancangan 26 Okt 2026): variabel tanya_jawab 4950-4959 untuk kesimpulan lisan para pihak.
-- Dijalankan: mysql --default-character-set=latin1 aps_badilag < abt-y1-kesimpulan-tanya-jawab-26okt-PASANG.sql
-- Empat baris disalin dari variabel saudaranya (6112, 6113, 2018, 2019); tidak ada UPDATE/DELETE, tidak ada blangko yang disentuh.

SET NAMES latin1;
-- PRASYARAT: berhenti dengan galat "Subquery returns more than 1 row" bila (a) jatah sudah terpakai, (b) ada variabel lain bernama sama,
-- atau (c) keempat variabel saudara tidak persis seperti yang diukur. Tidak ada yang ditulis.
SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4950 AND 4959) = 0 AND (SELECT COUNT(*) FROM abt_variabel WHERE nama LIKE 'Kesimpulan Lisan%' OR nama LIKE 'Keterangan Kesimpulan Lisan%') = 0 AND (SELECT COUNT(*) FROM abt_variabel WHERE (no_var = 6113 AND nama = 'Replik Lisan #0046#' AND data_type = 'tanya_jawab' AND referensi = 98 AND multi_sidang = 'tanyajawab') OR (no_var = 6112 AND nama = 'Jawaban Lisan #0047#' AND data_type = 'tanya_jawab' AND referensi = 102 AND multi_sidang = 'tanyajawab') OR (no_var = 2019 AND nama = 'Keterangan Replik Lisan #0046#' AND data_type = 'tanya_jawab' AND referensi = 98 AND multi_sidang = 'keterangan') OR (no_var = 2018 AND nama = 'Keterangan Jawaban Lisan #0047#' AND data_type = 'tanya_jawab' AND referensi = 102 AND multi_sidang = 'keterangan')) = 4, 'PRASYARAT COCOK - memasang', (SELECT 'PRASYARAT GAGAL' UNION SELECT 'BERHENTI')) AS prasyarat;

START TRANSACTION;
-- 4950: salinan 6113
INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) SELECT 4950, 'Kesimpulan Lisan #0046#', data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, NOW() FROM abt_variabel WHERE no_var = 6113;
-- 4951: salinan 6112
INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) SELECT 4951, 'Kesimpulan Lisan #0047#', data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, NOW() FROM abt_variabel WHERE no_var = 6112;
-- 4952: salinan 2019
INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) SELECT 4952, 'Keterangan Kesimpulan Lisan #0046#', data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, NOW() FROM abt_variabel WHERE no_var = 2019;
-- 4953: salinan 2018
INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) SELECT 4953, 'Keterangan Kesimpulan Lisan #0047#', data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, NOW() FROM abt_variabel WHERE no_var = 2018;
COMMIT;
SELECT COUNT(*) AS variabel_terpasang FROM abt_variabel WHERE no_var IN (4950, 4951, 4952, 4953);
