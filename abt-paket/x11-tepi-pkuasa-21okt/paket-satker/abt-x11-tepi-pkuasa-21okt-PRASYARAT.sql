-- Paket ABT "abt-x11-tepi-pkuasa-21okt" (21 Okt 2026): PRASYARAT (baca saja). Satu baris: A|B|C|D
--  A = isian_rtf_ket_saksi memanggil penyaring paket x6 (1)    B = fungsi isian_rtf_penutup ada (1)
--  C = tabel SIPP perkara dan perkara_proses ada (2)           D = isian_rtf_keterangan memanggil isian_rtf_penutup, paket x7 (1)
-- Syarat pasang: 1|1|2|1. Selain itu berhenti, tidak ada yang diubah. (Keadaan berkas RTF diperiksa pasang-satker.sh.)
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi' AND LOCATE('isian_rtf_saring_penutup', routine_definition) > 0),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_penutup'),
 (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='__SIPP__' AND table_name IN ('perkara','perkara_proses')),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_keterangan' AND LOCATE('isian_rtf_penutup', routine_definition) > 0)
) AS prasyarat;
