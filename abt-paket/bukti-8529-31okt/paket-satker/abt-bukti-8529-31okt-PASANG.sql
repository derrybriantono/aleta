-- Paket ABT "abt-bukti-8529-31okt": satu transaksi; hanya cabang terakhir 8529 (frasa lama persis) yang diganti, baris lain tidak disentuh.
START TRANSACTION;
UPDATE abt_variabel SET sql_query = REPLACE(sql_query, '<mark>[HURUF ALASAN PERCERAIAN BELUM DIPILIH]</mark>', '<mark>[BUKTI SURAT KTP/SURAT DOMISILI BELUM ADA DI DAFTAR BUKTI]</mark>')
 WHERE no_var IN (8529) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('555c3cb9dc004f38b666b6584ae8a140');
COMMIT;
