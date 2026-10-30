-- PRASYARAT abt-variabel-sehat-30okt (BACA SAJA). Satu baris A|B:
--  A = variabel 4303,9292,9293 yang isinya PERSIS keadaan sesudah semua paket 29-30 Okt (3 sebelum paket ini, 0 sesudah)
--  B = variabel yang sama yang isinya PERSIS hasil paket ini (0 sebelum, 3 sesudah)
-- Pasang bila 3|0; pasang ulang bila 0|3; selain itu (mis. variabel sudah disunting orang) berhenti tanpa mengubah apa pun.
--   4303: isian Tgl Nikah (5197) dirapikan: awalan "pada " dan tanda baca di ujung dibuang (4 tempat) (md5 lama d86abd141b6927cd0145837ed26d4574 -> baru a292d5ccec844e3afb691231ec58956a)
--   9292: batas domisili elektronik juga dikenali bila tertulis "Domisili Eletronik" (md5 lama 5d2f309c0256832151702b2e4836800e -> baru 72673433f4f952badafa8f400ab6e9f6)
--   9293: batas domisili elektronik juga dikenali bila tertulis "Domisili Eletronik" (md5 lama 4fadbebb5db4fd7df167d6005972866e -> baru 269c70ab10ef61ae6e1dc025055a4d88)
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (4303,9292,9293) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('d86abd141b6927cd0145837ed26d4574','5d2f309c0256832151702b2e4836800e','4fadbebb5db4fd7df167d6005972866e')),
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (4303,9292,9293) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('a292d5ccec844e3afb691231ec58956a','72673433f4f952badafa8f400ab6e9f6','269c70ab10ef61ae6e1dc025055a4d88'))
) AS prasyarat;
