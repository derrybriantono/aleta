-- PRASYARAT abt-ket-saksi-kata-30okt (BACA SAJA). Satu baris A|B|C|D:
--  A = isian_rtf_ket_saksi ada (1) | B = isian_rtf_ganti_kata ada (0 sebelum, 1 sesudah)
--  C = definisi isian_rtf_ket_saksi = versi x6 terpasang (md5 19408aadfcfb1fe1b3463d46a9bfdc8b, nama basis disamakan) (1 sebelum, 0 sesudah)
--  D = definisi = versi paket ini (md5 7dd6366cdd3ccbf23a5e5c9eb87bf996) (0 sebelum, 1 sesudah)
-- Pasang bila 1|0|1|0; pasang ulang bila 1|1|0|1; selain itu berhenti tanpa mengubah apa pun.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ganti_kata'),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'
    AND MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) = '19408aadfcfb1fe1b3463d46a9bfdc8b'),
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'
    AND MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) = '7dd6366cdd3ccbf23a5e5c9eb87bf996')
) AS prasyarat;
