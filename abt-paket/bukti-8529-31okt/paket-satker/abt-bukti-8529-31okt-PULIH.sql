-- PULIH abt-bukti-8529-31okt: frasa lama dikembalikan, hanya baris yang masih persis hasil paket.
START TRANSACTION;
UPDATE abt_variabel SET sql_query = REPLACE(sql_query, '<mark>[BUKTI SURAT KTP/SURAT DOMISILI BELUM ADA DI DAFTAR BUKTI]</mark>', '<mark>[HURUF ALASAN PERCERAIAN BELUM DIPILIH]</mark>') WHERE no_var IN (8529) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('53198b3e0a7aec310f436bf852f2c047');
COMMIT;
