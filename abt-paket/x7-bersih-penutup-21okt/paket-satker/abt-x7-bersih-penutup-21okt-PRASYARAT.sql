-- Paket ABT "abt-x7-bersih-penutup-21okt" (21 Okt 2026): PRASYARAT (baca saja). Satu baris: A|B|C|D|E
--  A = isian_rtf_ket_saksi sudah memanggil penyaring paket x6 (1)  - x6 WAJIB terpasang lebih dulu
--  B = fungsi isian_rtf_penutup ada (1)
--  C = tabel SIPP perkara dan perkara_proses ada (2)
--  D = isian_rtf_keterangan masih TEPAT versi lama - md5 definisi, nama basis disamakan (1 sebelum, 0 sesudah)
--  E = isian_rtf_keterangan sudah memanggil isian_rtf_penutup (0 sebelum, 1 sesudah)
-- Syarat pasang: 1|1|2|1|0; pasang ulang: 1|1|2|0|1. Selain itu berhenti, tidak ada yang diubah.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi' AND LOCATE('isian_rtf_saring_penutup', routine_definition) > 0),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_penutup'),
 (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='__SIPP__' AND table_name IN ('perkara','perkara_proses')),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_keterangan'
    AND LOCATE('isian_rtf_penutup', routine_definition) = 0
    AND MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), CONCAT('aps_badilag', '.abt_'))) = '9b005e6442a8b8731f97f3b8dbe98a61'),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_keterangan'
    AND LOCATE('isian_rtf_penutup', routine_definition) > 0)
) AS prasyarat;
