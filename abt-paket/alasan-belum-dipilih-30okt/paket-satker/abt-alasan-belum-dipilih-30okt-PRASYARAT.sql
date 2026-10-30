-- PRASYARAT abt-alasan-belum-dipilih-30okt (BACA SAJA). Satu baris A|B:
--  A = variabel 4020, 8511, 8512, 8521, 8522, 8528, 8529, 8530, 8531, 8532 yang isinya PERSIS sebelum paket (10 sebelum, 0 sesudah)
--  B = variabel yang sama yang isinya PERSIS hasil paket (0 sebelum, 10 sesudah)
-- Pasang bila 10|0; pasang ulang bila 0|10; selain itu berhenti tanpa mengubah apa pun.
-- Frasa lama per variabel (cabang lain, mis. alasan H agama belum diubah, TIDAK disentuh):
--   4020: frasa lama 1 kali (cabang ELSE yang diganti 1)
--   8511: frasa lama 1 kali (cabang ELSE yang diganti 1)
--   8512: frasa lama 1 kali (cabang ELSE yang diganti 1)
--   8521: frasa lama 2 kali (cabang ELSE yang diganti 1)
--   8522: frasa lama 2 kali (cabang ELSE yang diganti 1)
--   8528: frasa lama 2 kali (cabang ELSE yang diganti 1)
--   8529: frasa lama 1 kali (cabang ELSE yang diganti 1)
--   8530: frasa lama 1 kali (cabang ELSE yang diganti 1)
--   8531: frasa lama 2 kali (cabang ELSE yang diganti 1)
--   8532: frasa lama 1 kali (cabang ELSE yang diganti 1)
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (4020,8530,8531,8532,8511,8512,8521,8522,8528,8529) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('0ec6ea4d884e2f131623a56c1409ca23','115714c4ec8a59f93d1ac4cc48c9ec4c','300d12b7ae9f13661a138d7e85f46199','3e0a2bad90cfd9df1d132d6cd3c8c90c','823eb7a25c6fdd3f3f700d0d2c858bfe','c116cefd2dbd1667474ad14177c7f84a','de9976c51e8bc98394df57388f49c033','f1f55a43bec88820234c3ca9d05c2bd9','f3da57319c5ebc4448faedf441ec599b','ff1b662d33881bfca8671be7c9d21a9f')),
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (4020,8530,8531,8532,8511,8512,8521,8522,8528,8529) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('1b2b8bf22a3225e0bf7da0c7059de2e7','46c7070cbe12ac8881f9df253c091351','4ce9df877cf443006e5a7f06796850b7','5051ea609b678fadd08aea321fecf12a','6ec6591cb10f9927afbdca0562b95b53','701a846f237898ea9bf709622066efa0','7d03edaa4ddf9c305703328b8e04135b','97aed24a20a6a2948808b755e5d38756','9b0753819ac8d44460915ef0d59a903e','f6a1c35d4c429736e71537cab96cb913'))
) AS prasyarat;
