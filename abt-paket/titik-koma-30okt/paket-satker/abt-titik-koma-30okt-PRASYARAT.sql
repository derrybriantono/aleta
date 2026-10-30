-- PRASYARAT abt-titik-koma-30okt (BACA SAJA). Satu baris A|B|C|D|E:
--  A = isian_rtf_ket_saksi = versi paket ket-saksi-kata-30okt (md5 db6d1b0f2c171f2505e3de6ffd10e4f0) (1 sebelum, 0 sesudah)
--  B = isian_rtf_bukti = versi paket bukti-nomor-30okt (md5 8dc9c24e6f362576f34fed57544ff8f1) (1 sebelum, 0 sesudah)
--  C = isian_rtf_butir_rapi ada (0 sebelum, 1 sesudah)
--  D = isian_rtf_ket_saksi = versi paket ini (md5 9ba910f2eb7ada8bd1807b08735af6db) (0 sebelum, 1 sesudah)
--  E = isian_rtf_bukti = versi paket ini (md5 235645dca0bb330eb6e0bcbec31ca697) (0 sebelum, 1 sesudah)
-- Pasang bila 1|1|0|0|0; pasang ulang bila 0|0|1|1|1; selain itu berhenti tanpa mengubah apa pun
-- (A=0 atau B=0 sebelum pasang: pasang ket-saksi-kata-30okt dan bukti-nomor-30okt dulu).
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'
    AND MD5(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_'), CHAR(92), ''), ' ', ''), CHAR(9), ''), CHAR(13), ''), CHAR(10), '')) = 'db6d1b0f2c171f2505e3de6ffd10e4f0'),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_bukti'
    AND MD5(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_'), CHAR(92), ''), ' ', ''), CHAR(9), ''), CHAR(13), ''), CHAR(10), '')) = '8dc9c24e6f362576f34fed57544ff8f1'),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_butir_rapi'),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'
    AND MD5(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_'), CHAR(92), ''), ' ', ''), CHAR(9), ''), CHAR(13), ''), CHAR(10), '')) = '9ba910f2eb7ada8bd1807b08735af6db'),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_bukti'
    AND MD5(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_'), CHAR(92), ''), ' ', ''), CHAR(9), ''), CHAR(13), ''), CHAR(10), '')) = '235645dca0bb330eb6e0bcbec31ca697')
) AS prasyarat;
