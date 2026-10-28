-- PRASYARAT abt-blangko-ikrar-92-28okt (baca saja): jumlah variabel yang DIRUJUK dua blangko baru yang ada di abt_variabel.
-- Harus 27 (semua ada). Kurang = blangko akan mencetak penanda mentah - TIDAK dipasang.
SELECT COUNT(DISTINCT no_var) FROM abt_variabel WHERE no_var IN (1,12,13,14,15,32,33,46,47,48,168,1069,1090,1099,1101,1164,2050,4046,4047,6034,7062,8004,8008,8010,8184,9218,9500);
