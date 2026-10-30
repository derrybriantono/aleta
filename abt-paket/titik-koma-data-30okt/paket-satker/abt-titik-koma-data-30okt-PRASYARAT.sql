-- PRASYARAT abt-titik-koma-data-30okt (BACA SAJA). Satu baris A|B|C|D|E:
--  A = fungsi isian_rtf_butir_rapi = versi paket titik-koma-30okt (sidik a3e6da5f05aecb273664713a93b04f1c) (harus 1)
--  B = pemicu ket-saksi-baris-30okt dengan badan ASLINYA (hanya ganti baris) (2 sebelum, 0 sesudah)
--  C = pemicu yang sama dengan badan paket ini (ganti baris + butir rapi) (0 sebelum, 2 sesudah)
--  D = pemicu LAIN pada abt_keterangan_saksi (harus 0)
--  E = jawaban tanya jawab saksi yang titik komanya masih di tengah / ganda (>0 sebelum, 0 sesudah)
-- Pasang bila 1|2|0|0|E; pasang ulang bila 1|0|2|0|0 (hanya PERIKSA). Selain itu berhenti tanpa mengubah apa pun
-- (A=0: pasang titik-koma-30okt dulu; B=0 dan C=0: pasang ket-saksi-baris-30okt dulu).
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type = 'FUNCTION' AND routine_name = 'isian_rtf_butir_rapi'
    AND MD5(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_'), CHAR(92), ''), ' ', ''), CHAR(9), ''), CHAR(13), ''), CHAR(10), '')) = 'a3e6da5f05aecb273664713a93b04f1c'),
 (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND event_object_table = 'abt_keterangan_saksi'
    AND trigger_name IN ('abt_keterangan_saksi_satu_baris_bi', 'abt_keterangan_saksi_satu_baris_bu')
    AND REPLACE(REPLACE(REPLACE(REPLACE(action_statement, ' ', ''), CHAR(9), ''), CHAR(10), ''), CHAR(13), '') = 'BEGINSETNEW.pertanyaan=isian_rtf_satu_baris(NEW.pertanyaan);SETNEW.jawaban=isian_rtf_satu_baris(NEW.jawaban);END'),
 (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND event_object_table = 'abt_keterangan_saksi'
    AND trigger_name IN ('abt_keterangan_saksi_satu_baris_bi', 'abt_keterangan_saksi_satu_baris_bu')
    AND REPLACE(REPLACE(REPLACE(REPLACE(action_statement, ' ', ''), CHAR(9), ''), CHAR(10), ''), CHAR(13), '') = 'BEGINSETNEW.pertanyaan=isian_rtf_satu_baris(NEW.pertanyaan);SETNEW.jawaban=isian_rtf_butir_rapi(isian_rtf_satu_baris(NEW.jawaban),'''');END'),
 (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND event_object_table = 'abt_keterangan_saksi'
    AND trigger_name NOT IN ('abt_keterangan_saksi_satu_baris_bi', 'abt_keterangan_saksi_satu_baris_bu')),
 (SELECT COUNT(*) FROM abt_keterangan_saksi WHERE REPLACE(REPLACE(jawaban, CHAR(10), ' '), CHAR(13), ' ') REGEXP ';.*[[:alnum:]]|;[[:space:]]*;|^[[:space:]]*;|:[[:space:]]*;' AND jawaban LIKE '%;%'
    AND CHAR_LENGTH(jawaban) - CHAR_LENGTH(REPLACE(jawaban, ';', '')) > CHAR_LENGTH(isian_rtf_butir_rapi(jawaban, '')) - CHAR_LENGTH(REPLACE(isian_rtf_butir_rapi(jawaban, ''), ';', '')))
) AS prasyarat;
