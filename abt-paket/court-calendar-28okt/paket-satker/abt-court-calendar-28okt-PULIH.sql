-- Paket ABT "abt-court-calendar-28okt" (28 Okt 2026): blangko Court Calendar (penetapan jadwal persidangan dan perubahan jadwal karena gugatan rekonvensi), folder baru "98c Court Calendar - BAS", satu baris abt_menu, dua blangko RTF. Tanpa variabel/fungsi baru.
-- PULIH (deterministik): baris baru dihapus HANYA bila isinya masih persis paket (yang sudah disunting orang dibiarkan dan dilaporkan oleh pulih-satker.sh).
START TRANSACTION;
DELETE FROM abt_menu WHERE direktori = '98c Court Calendar - BAS' AND parent_direktori = 'derry_briantono' AND MD5(CONCAT_WS('|', nama, nama_alias, direktori, parent_direktori, proses_id_min, proses_id_max, perkara_id_min, perkara_id_max, perkara_id_referensi, user_cek, user_grup_id, user_top_id, IFNULL(user_validator,''))) = 'ec4c198e8aba632f60fbf2b1e4c36360';
COMMIT;
SELECT 'PULIH SQL SELESAI';
