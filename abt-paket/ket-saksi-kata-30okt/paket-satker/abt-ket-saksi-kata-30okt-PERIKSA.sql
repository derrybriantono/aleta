-- PERIKSA abt-ket-saksi-kata-30okt (BACA SAJA). Baris terakhir harus "SEMUA COCOK".
SELECT IF(
  isian_rtf_ganti_kata('Saya tidak mengetahuinya, yang saya tahu', 'ya, ', '') = 'Saya tidak mengetahuinya, yang saya tahu'
  AND isian_rtf_ganti_kata('ya, saya kenal', 'ya, ', '') = 'saya kenal'
  AND isian_rtf_ganti_kata('saya kenal, kesayangan saya.', 'saya', 'saksi') = 'saksi kenal, kesayangan saksi.'
  AND isian_rtf_ganti_kata('Saya', 'saya', 'saksi') = 'saksi'
  AND isian_rtf_ganti_kata(NULL, 'saya', 'saksi') IS NULL
  AND (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type = 'FUNCTION'
         AND routine_name = 'isian_rtf_ket_saksi' AND LOCATE('isian_rtf_ganti_kata', routine_definition) > 0
         AND LOCATE('isian_rtf_saring_penutup', routine_definition) > 0) = 1
  AND isian_rtf_ket_saksi(0, NULL) = '...',
  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;
