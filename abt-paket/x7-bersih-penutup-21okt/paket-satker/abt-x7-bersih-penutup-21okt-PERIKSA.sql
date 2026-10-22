-- Paket ABT "abt-x7-bersih-penutup-21okt" (21 Okt 2026): PERIKSA = fungsi jawaban lisan memakai penyaring x6 + tak ada lagi baris penutup di perkara belum minutasi.
-- Baris terakhir "SEMUA COCOK". Tidak mengubah apa pun. (Angka sebelum/sesudah dan perkara minutasi diperiksa pasang-satker.sh dari HITUNG.)
SET @ok = 1;
SELECT 'isian_rtf_keterangan memanggil isian_rtf_penutup' AS butir, (@c := ((SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_keterangan' AND LOCATE('isian_rtf_penutup', routine_definition) > 0)=1)) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'isian_rtf_keterangan tanpa pihak atau NULL tetap tanda strip titik-titik' AS butir, (@c := (isian_rtf_keterangan(0, NULL, 'Tergugat')='- ...' AND isian_rtf_keterangan(0, '0', 'Tergugat')='- ...')) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'x6 masih benar: penutup dikenali, jawaban perkara tidak' AS butir, (@c := (isian_rtf_penutup('Sudah cukup;', 'Apakah masih ada yang ingin Saudara sampaikan ?')=1 AND isian_rtf_penutup('Saya tidak sanggup lagi;', 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?')=0 AND isian_rtf_penutup('Selama pisah sudah tidak ada komunikasi;', '')=0)) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'jawaban lisan: tak satu pun kelompok mencetak butir penutup' AS butir, (@c := ((SELECT COUNT(*) FROM (SELECT DISTINCT perkara_id, pihak_id FROM abt_keterangan_terdakwa WHERE perkara_id IS NOT NULL AND pihak_id IS NOT NULL AND (jawaban LIKE '%cukup%' OR jawaban LIKE '%sekian%' OR jawaban LIKE '%tidak ada%')) g WHERE isian_rtf_keterangan(g.perkara_id, CAST(g.pihak_id AS CHAR), 'Tergugat') REGEXP '(^|[[:space:]])- Bahwa ((tidak ada|tidak|ya|iya|baik), )?((saya|saksi|tergugat|termohon) )?((sudah|telah|memang|sekarang) )*(cukup|sekian|tidak ada lagi|sampai di sini)( sekian| saja| dulu)*[ ;.,]*($|[[:space:]])')=0)) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'perkara belum minutasi: tak ada lagi baris keterangan saksi yang seluruhnya penutup' AS butir, (@c := ((SELECT COUNT(*) FROM abt_keterangan_saksi k WHERE EXISTS (SELECT 1 FROM __SIPP__.perkara p WHERE p.perkara_id = k.perkara_id AND p.proses_terakhir_id < 220) AND NOT EXISTS (SELECT 1 FROM __SIPP__.perkara_proses pp WHERE pp.perkara_id = k.perkara_id AND pp.proses_id = 220) AND k.jawaban IS NOT NULL AND CHAR_LENGTH(k.jawaban) > 0 AND aps_badilag.isian_rtf_penutup(CONVERT(CAST(k.jawaban AS BINARY) USING latin1), IFNULL(CONVERT(CAST(k.pertanyaan AS BINARY) USING latin1), '')) = 1)=0)) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT IF(@ok = 1, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil;
