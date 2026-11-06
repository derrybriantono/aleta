-- Paket ABT "abt-perbaikan-audit-6nov" (6 Nov 2026): perbaikan teks blangko derry_briantono. Tanpa variabel baru; baca saja.
-- PRASYARAT "A|B": A = variabel yang dirujuk tambalan ada: 303 (Tgl. Pengumuman), 2021 (paket saksi-tanya-jawab-43), 8008, 8509, 9100, 9251, 11889, 11890, 12150 (paket a5-kelompok) = 9
--                  B = rumus 9100 (hari dan tanggal pengumuman, titik-titik bila 303 kosong) dan rumus 8509 (duduk perkara e-Court/biasa) persis rumus dasar paket = 2
-- Selain 9|2 rumus yang diandalkan tambalan sudah berubah atau paket pendahulu belum terpasang: BERHENTI tanpa mengubah apa pun.
SELECT CONCAT_WS('|',
 (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (303,2021,8008,8509,9100,9251,11889,11890,12150)),
 (SELECT COUNT(*) FROM abt_variabel WHERE (no_var = 9100 AND MD5(sql_query) = 'f3a8d5bb5a9c8458c5176c57164ab577') OR (no_var = 8509 AND MD5(sql_query) = '3140516484124dc1d95a473f18e8b0f0'))) AS p;
