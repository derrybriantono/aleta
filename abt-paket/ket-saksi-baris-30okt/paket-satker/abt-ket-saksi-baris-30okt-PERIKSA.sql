-- PERIKSA abt-ket-saksi-baris-30okt (BACA SAJA). Baris terakhir harus "SEMUA COCOK".
SELECT IF(
  isian_rtf_satu_baris(CONCAT('telah', CHAR(10), 'menikah')) = 'telah menikah'
  AND isian_rtf_satu_baris(CONCAT('a ', CHAR(13), CHAR(10), '  b')) = 'a b'
  AND isian_rtf_satu_baris(CONCAT(CHAR(10), 'a', CHAR(10), CHAR(10))) = 'a'
  AND isian_rtf_satu_baris('tanpa ganti  baris') = 'tanpa ganti  baris'
  AND isian_rtf_satu_baris(NULL) IS NULL
  AND (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND event_object_table = 'abt_keterangan_saksi'
         AND trigger_name IN ('abt_keterangan_saksi_satu_baris_bi', 'abt_keterangan_saksi_satu_baris_bu')) = 2
  AND (SELECT COUNT(*) FROM abt_keterangan_saksi WHERE LOCATE(CHAR(10), CONCAT(IFNULL(pertanyaan, ''), IFNULL(jawaban, ''))) > 0
         OR LOCATE(CHAR(13), CONCAT(IFNULL(pertanyaan, ''), IFNULL(jawaban, ''))) > 0) = 0,
  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;
