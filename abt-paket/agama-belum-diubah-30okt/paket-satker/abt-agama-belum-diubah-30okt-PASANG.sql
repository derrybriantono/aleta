-- Paket ABT "abt-agama-belum-diubah-30okt": satu transaksi; hanya cabang agama-belum-diubah (frasa lama persis) yang diganti, baris lain tidak disentuh.
START TRANSACTION;
UPDATE abt_variabel SET sql_query = REPLACE(sql_query, '<mark>TIDAK BENAR QUERY NYA / ALASAN H: AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP - ubah agama pihak itu di SIPP, lalu muat ulang ABT</mark>', '<mark>[AGAMA PIHAK YANG MURTAD BELUM DIUBAH DI SIPP]</mark>')
 WHERE no_var IN (8521,8522,8528,8531) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('4ce9df877cf443006e5a7f06796850b7','701a846f237898ea9bf709622066efa0','97aed24a20a6a2948808b755e5d38756','f6a1c35d4c429736e71537cab96cb913');
COMMIT;
