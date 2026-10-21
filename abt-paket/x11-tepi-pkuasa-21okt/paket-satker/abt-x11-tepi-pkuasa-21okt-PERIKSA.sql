-- Paket ABT "abt-x11-tepi-pkuasa-21okt" (21 Okt 2026): PERIKSA = tak ada lagi baris penutup utuh di perkara tanpa catatan Minutasi. Baris terakhir "SEMUA COCOK". Tidak mengubah apa pun.
SET @ok = 1;
SELECT 'perkara tanpa catatan Minutasi: tak ada baris keterangan saksi yang seluruhnya penutup' AS butir, (@c := ((SELECT COUNT(*) FROM abt_keterangan_saksi k WHERE EXISTS (SELECT 1 FROM __SIPP__.perkara p WHERE p.perkara_id = k.perkara_id) AND NOT EXISTS (SELECT 1 FROM __SIPP__.perkara_proses pp WHERE pp.perkara_id = k.perkara_id AND pp.proses_id = 220) AND k.jawaban IS NOT NULL AND CHAR_LENGTH(k.jawaban) > 0 AND aps_badilag.isian_rtf_penutup(CONVERT(CAST(k.jawaban AS BINARY) USING latin1), IFNULL(CONVERT(CAST(k.pertanyaan AS BINARY) USING latin1), '')) = 1)=0)) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT IF(@ok = 1, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil;
