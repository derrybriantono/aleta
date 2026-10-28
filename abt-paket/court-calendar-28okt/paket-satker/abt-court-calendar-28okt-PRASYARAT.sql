-- Paket ABT "abt-court-calendar-28okt" (28 Okt 2026): blangko Court Calendar (penetapan jadwal persidangan dan perubahan jadwal karena gugatan rekonvensi), folder baru "98c Court Calendar - BAS", satu baris abt_menu, dua blangko RTF. Tanpa variabel/fungsi baru.
-- PRASYARAT (baca saja) "A|B|C": A = variabel yang dirujuk kedua blangko ADA di abt_variabel (harus 37) | B = baris abt_menu folder baru (0 pertama, 1 sudah terpasang) | C = menu id 963 (folder ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)) ada dengan hak persis seperti yang disalin ke menu baru (harus 1).
-- Benar: "37|0|1" (pasang pertama) atau "37|1|1" (pasang ulang).
SELECT CONCAT_WS('|',
  (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (0001,0012,0017,0033,0048,0053,0098,0102,0150,0194,0306,2111,2112,4004,5368,6033,6034,7036,7037,7085,7086,7111,7112,7113,7114,7115,7116,7117,7118,7119,7121,7122,8008,8011,8438,8544,8545)),
  (SELECT COUNT(*) FROM abt_menu WHERE direktori = '98c Court Calendar - BAS' AND parent_direktori = 'derry_briantono'),
  (SELECT COUNT(*) FROM abt_menu m WHERE m.id = 963 AND m.direktori = 'ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)' AND m.parent_direktori IN ('derry_briantono', '_arsip_derry_briantono') AND m.proses_id_min = 80 AND m.proses_id_max = 297 AND m.perkara_id_min = 15 AND m.perkara_id_max = 15 AND m.perkara_id_referensi = 'alur_perkara_id' AND m.user_cek = 3 AND m.user_grup_id = '1|30|500|430|1000|1010|1020' AND m.user_top_id = '1|30' AND m.user_validator = '10|20')
) AS prasyarat;
