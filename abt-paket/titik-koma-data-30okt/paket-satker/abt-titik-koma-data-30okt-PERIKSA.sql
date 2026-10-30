-- PERIKSA abt-titik-koma-data-30okt (BACA SAJA). Baris terakhir harus "SEMUA COCOK": tidak ada lagi jawaban yang titik komanya
-- di tengah/ganda, kedua pemicu berbadan paket ini, dan fungsi perapi masih versi titik-koma-30okt.
SELECT IF(
  (SELECT COUNT(*) FROM abt_keterangan_saksi WHERE REPLACE(REPLACE(jawaban, CHAR(10), ' '), CHAR(13), ' ') REGEXP ';.*[[:alnum:]]|;[[:space:]]*;|^[[:space:]]*;|:[[:space:]]*;' AND jawaban LIKE '%;%'
     AND CHAR_LENGTH(jawaban) - CHAR_LENGTH(REPLACE(jawaban, ';', '')) > CHAR_LENGTH(isian_rtf_butir_rapi(jawaban, '')) - CHAR_LENGTH(REPLACE(isian_rtf_butir_rapi(jawaban, ''), ';', ''))) = 0
  AND (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND event_object_table = 'abt_keterangan_saksi'
     AND trigger_name IN ('abt_keterangan_saksi_satu_baris_bi', 'abt_keterangan_saksi_satu_baris_bu')
     AND REPLACE(REPLACE(REPLACE(REPLACE(action_statement, ' ', ''), CHAR(9), ''), CHAR(10), ''), CHAR(13), '') = 'BEGINSETNEW.pertanyaan=isian_rtf_satu_baris(NEW.pertanyaan);SETNEW.jawaban=isian_rtf_butir_rapi(isian_rtf_satu_baris(NEW.jawaban),'''');END') = 2
  AND isian_rtf_butir_rapi('tidak berhasil;karena jauh;', '') = 'tidak berhasil, karena jauh;',
  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;
