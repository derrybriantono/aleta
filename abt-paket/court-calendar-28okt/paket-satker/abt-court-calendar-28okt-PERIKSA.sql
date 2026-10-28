-- Paket ABT "abt-court-calendar-28okt" (28 Okt 2026): blangko Court Calendar (penetapan jadwal persidangan dan perubahan jadwal karena gugatan rekonvensi), folder baru "98c Court Calendar - BAS", satu baris abt_menu, dua blangko RTF. Tanpa variabel/fungsi baru.
-- PERIKSA (baca saja): baris menu persis isi paket. Baris terakhir harus: SEMUA COCOK
SELECT label, ok FROM (
SELECT 'menu 98c Court Calendar - BAS' AS label, (SELECT COUNT(*) FROM abt_menu WHERE direktori = '98c Court Calendar - BAS' AND parent_direktori = 'derry_briantono' AND MD5(CONCAT_WS('|', nama, nama_alias, direktori, parent_direktori, proses_id_min, proses_id_max, perkara_id_min, perkara_id_max, perkara_id_referensi, user_cek, user_grup_id, user_top_id, IFNULL(user_validator,''))) = 'ec4c198e8aba632f60fbf2b1e4c36360') AS ok
) c WHERE ok <> 1
UNION ALL
SELECT IF(COUNT(*) = 1, 'SEMUA COCOK', CONCAT(1 - COUNT(*), ' TIDAK COCOK')), COUNT(*) FROM (
SELECT (SELECT COUNT(*) FROM abt_menu WHERE direktori = '98c Court Calendar - BAS' AND parent_direktori = 'derry_briantono' AND MD5(CONCAT_WS('|', nama, nama_alias, direktori, parent_direktori, proses_id_min, proses_id_max, perkara_id_min, perkara_id_max, perkara_id_referensi, user_cek, user_grup_id, user_top_id, IFNULL(user_validator,''))) = 'ec4c198e8aba632f60fbf2b1e4c36360') AS ok
) d WHERE ok = 1;
