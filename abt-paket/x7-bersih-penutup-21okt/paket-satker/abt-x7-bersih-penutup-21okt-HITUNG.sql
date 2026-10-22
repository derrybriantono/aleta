-- Paket ABT "abt-x7-bersih-penutup-21okt": HITUNG (baca saja). Satu baris: T|R|C
--  T = seluruh baris abt_keterangan_saksi
--  R = baris di perkara BELUM minutasi (sasaran paket)
--  C = baris di perkara belum minutasi yang jawabannya SELURUHNYA kalimat penutup (yang akan dihapus)
-- Sebelum: T|R|C; sesudah harus T-C|R-C|0.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM aps_badilag.abt_keterangan_saksi),
 (SELECT COUNT(*) FROM aps_badilag.abt_keterangan_saksi k WHERE EXISTS (SELECT 1 FROM __SIPP__.perkara p WHERE p.perkara_id = k.perkara_id AND p.proses_terakhir_id < 220)
  AND NOT EXISTS (SELECT 1 FROM __SIPP__.perkara_proses pp WHERE pp.perkara_id = k.perkara_id AND pp.proses_id = 220)),
 (SELECT COUNT(*) FROM aps_badilag.abt_keterangan_saksi k WHERE EXISTS (SELECT 1 FROM __SIPP__.perkara p WHERE p.perkara_id = k.perkara_id AND p.proses_terakhir_id < 220)
  AND NOT EXISTS (SELECT 1 FROM __SIPP__.perkara_proses pp WHERE pp.perkara_id = k.perkara_id AND pp.proses_id = 220)
    AND k.jawaban IS NOT NULL AND CHAR_LENGTH(k.jawaban) > 0
  AND aps_badilag.isian_rtf_penutup(CONVERT(CAST(k.jawaban AS BINARY) USING latin1), IFNULL(CONVERT(CAST(k.pertanyaan AS BINARY) USING latin1), '')) = 1)
) AS hitung;
