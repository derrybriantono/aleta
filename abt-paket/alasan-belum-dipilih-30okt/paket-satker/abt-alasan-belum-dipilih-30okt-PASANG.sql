-- Paket ABT "abt-alasan-belum-dipilih-30okt": satu transaksi; hanya cabang ELSE (frasa lama persis) yang diganti, baris lain tidak disentuh.
START TRANSACTION;
UPDATE abt_variabel SET sql_query = REPLACE(REPLACE(sql_query, '<mark>TIDAK BENAR QUERY NYA / BELUM ISI ALASAN DI KOLOM ABT</mark>', '<mark>[HURUF ALASAN PERCERAIAN BELUM DIPILIH]</mark>'), '<mark>TIDAK BENAR QUERY NYA</mark>', '<mark>[HURUF ALASAN PERCERAIAN BELUM DIPILIH]</mark>')
 WHERE no_var IN (4020,8530,8531,8532,8511,8512,8521,8522,8528,8529) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('0ec6ea4d884e2f131623a56c1409ca23','115714c4ec8a59f93d1ac4cc48c9ec4c','300d12b7ae9f13661a138d7e85f46199','3e0a2bad90cfd9df1d132d6cd3c8c90c','823eb7a25c6fdd3f3f700d0d2c858bfe','c116cefd2dbd1667474ad14177c7f84a','de9976c51e8bc98394df57388f49c033','f1f55a43bec88820234c3ca9d05c2bd9','f3da57319c5ebc4448faedf441ec599b','ff1b662d33881bfca8671be7c9d21a9f');
COMMIT;
