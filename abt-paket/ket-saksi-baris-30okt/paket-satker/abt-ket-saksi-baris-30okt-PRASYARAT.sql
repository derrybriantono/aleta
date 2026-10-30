-- PRASYARAT abt-ket-saksi-baris-30okt (BACA SAJA). Satu baris A|B|C|D:
--  A = fungsi isian_rtf_satu_baris ada (0 sebelum, 1 sesudah)
--  B = pemicu paket ini pada abt_keterangan_saksi (0 sebelum, 2 sesudah)
--  C = pemicu LAIN pada abt_keterangan_saksi (harus 0; MariaDB 5.5 hanya boleh satu pemicu per waktu/peristiwa)
--  D = baris tanya-jawab saksi yang pertanyaan/jawabannya memuat ganti baris (info: >0 sebelum, 0 sesudah)
-- Pasang bila A|B|C = 0|0|0; pasang ulang bila 1|2|0. Selain itu berhenti tanpa mengubah apa pun.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type = 'FUNCTION' AND routine_name = 'isian_rtf_satu_baris'),
 (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND event_object_table = 'abt_keterangan_saksi'
    AND trigger_name IN ('abt_keterangan_saksi_satu_baris_bi', 'abt_keterangan_saksi_satu_baris_bu')),
 (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND event_object_table = 'abt_keterangan_saksi'
    AND trigger_name NOT IN ('abt_keterangan_saksi_satu_baris_bi', 'abt_keterangan_saksi_satu_baris_bu')),
 (SELECT COUNT(*) FROM abt_keterangan_saksi WHERE LOCATE(CHAR(10), CONCAT(IFNULL(pertanyaan, ''), IFNULL(jawaban, ''))) > 0
    OR LOCATE(CHAR(13), CONCAT(IFNULL(pertanyaan, ''), IFNULL(jawaban, ''))) > 0)
) AS prasyarat;
