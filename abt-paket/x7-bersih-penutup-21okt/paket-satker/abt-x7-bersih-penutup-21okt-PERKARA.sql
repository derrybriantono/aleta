-- Paket ABT "abt-x7-bersih-penutup-21okt": PERKARA (baca saja) = per perkara yang punya baris penutup: perkara_id, seluruh baris keterangan saksi, baris penutup.
-- Sesudah paket, jumlah baris penutup 0 dan seluruh baris berkurang tepat sebanyak baris penutup (perkara_id saja, tanpa nama).
SELECT k.perkara_id, COUNT(*) AS baris, SUM(IF(EXISTS (SELECT 1 FROM __SIPP__.perkara p WHERE p.perkara_id = k.perkara_id AND p.proses_terakhir_id < 220) AND NOT EXISTS (SELECT 1 FROM __SIPP__.perkara_proses pp WHERE pp.perkara_id = k.perkara_id AND pp.proses_id = 220) AND k.jawaban IS NOT NULL AND CHAR_LENGTH(k.jawaban) > 0 AND aps_badilag.isian_rtf_penutup(CONVERT(CAST(k.jawaban AS BINARY) USING latin1), IFNULL(CONVERT(CAST(k.pertanyaan AS BINARY) USING latin1), '')) = 1, 1, 0)) AS penutup
FROM aps_badilag.abt_keterangan_saksi k
WHERE k.perkara_id IN (SELECT e.perkara_id FROM (SELECT DISTINCT d.perkara_id FROM aps_badilag.abt_keterangan_saksi d WHERE EXISTS (SELECT 1 FROM __SIPP__.perkara p WHERE p.perkara_id = d.perkara_id AND p.proses_terakhir_id < 220)
  AND NOT EXISTS (SELECT 1 FROM __SIPP__.perkara_proses pp WHERE pp.perkara_id = d.perkara_id AND pp.proses_id = 220)
    AND d.jawaban IS NOT NULL AND CHAR_LENGTH(d.jawaban) > 0
  AND aps_badilag.isian_rtf_penutup(CONVERT(CAST(d.jawaban AS BINARY) USING latin1), IFNULL(CONVERT(CAST(d.pertanyaan AS BINARY) USING latin1), '')) = 1) e)
GROUP BY k.perkara_id ORDER BY k.perkara_id;
