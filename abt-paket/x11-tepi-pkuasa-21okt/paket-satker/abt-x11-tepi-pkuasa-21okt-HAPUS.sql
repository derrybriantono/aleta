-- Paket ABT "abt-x11-tepi-pkuasa-21okt": HAPUS. Hanya id di DAFTAR (penanda __IDS__ diisi pasang-satker.sh) DAN yang masih memenuhi syarat saat dihapus.
DELETE k FROM aps_badilag.abt_keterangan_saksi k
WHERE k.id IN (__IDS__)
  AND EXISTS (SELECT 1 FROM __SIPP__.perkara p WHERE p.perkara_id = k.perkara_id)
  AND NOT EXISTS (SELECT 1 FROM __SIPP__.perkara_proses pp WHERE pp.perkara_id = k.perkara_id AND pp.proses_id = 220)
  AND k.jawaban IS NOT NULL AND CHAR_LENGTH(k.jawaban) > 0
  AND aps_badilag.isian_rtf_penutup(CONVERT(CAST(k.jawaban AS BINARY) USING latin1), IFNULL(CONVERT(CAST(k.pertanyaan AS BINARY) USING latin1), '')) = 1;
SELECT ROW_COUNT();
